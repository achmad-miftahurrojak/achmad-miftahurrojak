const USERNAME = "achmad-miftahurrojak";
const colorFor = (index) => `hsl(${Math.round((index * 137.508) % 360)} 78% 60%)`;

async function githubJson(url, token) {
  const result = await fetch(url, { headers: {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "profile-language-chart",
  }});
  if (!result.ok) throw new Error(`GitHub API returned ${result.status}`);
  return result;
}

async function collectLanguages(token) {
  const totals = new Map();
  for (let page = 1; ; page += 1) {
    const result = await githubJson(`https://api.github.com/user/repos?affiliation=owner&visibility=all&per_page=100&page=${page}`, token);
    const repos = await result.json();
    const owned = repos.filter(repo => repo.owner?.login?.toLowerCase() === USERNAME);
    await Promise.all(owned.map(async repo => {
      const response = await githubJson(repo.languages_url, token);
      const languages = await response.json();
      for (const [name, bytes] of Object.entries(languages)) totals.set(name, (totals.get(name) || 0) + bytes);
    }));
    if (repos.length < 100) break;
  }
  return [...totals.entries()].sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
    .map(([name, bytes], index) => ({ name, bytes, color: colorFor(index) }));
}

const xml = value => String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;", "'":"&apos;"})[char]);

function render(languages) {
  const width = 1000;
  const rowHeight = 28;
  const rowTop = 112;
  const height = Math.max(250, rowTop + rowHeight * languages.length + 28);
  const total = languages.reduce((sum, row) => sum + row.bytes, 0);
  const rows = languages.map(row => ({ ...row, share: total ? row.bytes / total * 100 : 0 }));
  const cx = 210, cy = height / 2 + 4, radius = 88, circumference = 2 * Math.PI * radius;
  let offset = 0;
  const slices = rows.map(row => {
    const arc = circumference * row.share / 100;
    const svg = `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${row.color}" stroke-width="27" stroke-dasharray="${arc.toFixed(2)} ${circumference.toFixed(2)}" stroke-dashoffset="${(-circumference * offset / 100).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"/>`;
    offset += row.share;
    return svg;
  }).join("");
  const max = Math.max(...rows.map(row => row.share), 1);
  const legend = rows.map((row, index) => {
    const y = rowTop + index * rowHeight;
    const bar = 520 * row.share / max;
    const percent = row.share > 0 && row.share < 0.05 ? "<0.1%" : `${row.share.toFixed(1)}%`;
    return `<g><circle cx="432" cy="${y}" r="5.5" fill="${row.color}"/><text x="450" y="${y + 5}" fill="#edf4ff" font-family="Arial,sans-serif" font-size="14" font-weight="700">${xml(row.name)}</text><text x="970" y="${y + 5}" text-anchor="end" fill="#b4c2d6" font-family="Arial,sans-serif" font-size="13">${percent}</text><rect x="450" y="${y + 12}" width="520" height="4" rx="2" fill="#29364a"/><rect x="450" y="${y + 12}" width="${bar.toFixed(2)}" height="4" rx="2" fill="${row.color}"/></g>`;
  }).join("");
  const center = rows.length
    ? `<text x="${cx}" y="${cy - 3}" text-anchor="middle" fill="#f4f7fb" font-family="Arial,sans-serif" font-size="25" font-weight="700">${rows[0].share.toFixed(1)}%</text><text x="${cx}" y="${cy + 22}" text-anchor="middle" fill="#b4c2d6" font-family="Arial,sans-serif" font-size="14" font-weight="700">${xml(rows[0].name)}</text>`
    : `<text x="${cx}" y="${cy + 5}" text-anchor="middle" fill="#b4c2d6" font-family="Arial,sans-serif" font-size="13">NO LANGUAGE DATA</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><title>Most used languages across public and private repositories</title><rect width="${width}" height="${height}" rx="24" fill="#101829"/><rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="23" fill="none" stroke="#26364a"/><text x="36" y="42" fill="#37dabe" font-family="Arial,sans-serif" font-size="15" font-weight="700" letter-spacing="1.4">MOST USED LANGUAGES</text><text x="36" y="67" fill="#b4c2d6" font-family="Arial,sans-serif" font-size="12">${USERNAME.toUpperCase()} · ALL REPOSITORIES</text><path d="M36 86H964" stroke="#26364a"/><circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="#29364a" stroke-width="27"/>${slices}${center}${legend}</svg>`;
}

export default async function handler(_request, response) {
  const token = process.env.GH_STATS_TOKEN;
  if (!token) return response.status(503).send("Missing GH_STATS_TOKEN environment variable");
  try {
    const image = render(await collectLanguages(token));
    response.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    response.setHeader("Cache-Control", "no-store, max-age=0, must-revalidate");
    response.setHeader("X-Content-Type-Options", "nosniff");
    return response.status(200).send(image);
  } catch (error) {
    console.error("Unable to render language chart:", error);
    return response.status(502).send("Unable to load GitHub language data");
  }
};
