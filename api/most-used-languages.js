const USERNAME = "achmad-miftahurrojak";
const COLORS = ["#38bdf8", "#2dd4bf", "#fbbf24", "#c084fc", "#fb7185", "#a3e635", "#818cf8", "#fb923c", "#67e8f9", "#f472b6"];

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
    .map(([name, bytes], index) => ({ name, bytes, color: COLORS[index % COLORS.length] }));
}

const xml = value => String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;", "'":"&apos;"})[char]);

function render(languages) {
  const width = 900, rowHeight = 24, rowTop = 84;
  const height = Math.max(220, rowTop + rowHeight * languages.length + 32);
  const total = languages.reduce((sum, row) => sum + row.bytes, 0);
  const rows = languages.map(row => ({ ...row, share: total ? row.bytes / total * 100 : 0 }));
  const cx = 180, cy = height / 2, radius = 72, circumference = 2 * Math.PI * radius;
  let offset = 0;
  const slices = rows.map(row => {
    const arc = circumference * row.share / 100;
    const svg = `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${row.color}" stroke-width="25" stroke-dasharray="${arc.toFixed(2)} ${circumference.toFixed(2)}" stroke-dashoffset="${(-circumference * offset / 100).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"/>`;
    offset += row.share;
    return svg;
  }).join("");
  const max = Math.max(...rows.map(row => row.share), 1);
  const legend = rows.map((row, index) => {
    const y = rowTop + index * rowHeight, bar = 486 * row.share / max;
    return `<circle cx="365" cy="${y + 1}" r="5.5" fill="${row.color}"/><text x="382" y="${y + 5}" fill="#ebf3fa" font-family="Arial,sans-serif" font-size="12.5" font-weight="700">${xml(row.name)}</text><text x="868" y="${y + 5}" text-anchor="end" fill="#99a9be" font-family="Arial,sans-serif" font-size="12">${row.share.toFixed(1)}%</text><rect x="382" y="${y + 11}" width="486" height="3.5" rx="1.75" fill="#253448"/><rect x="382" y="${y + 11}" width="${bar.toFixed(2)}" height="3.5" rx="1.75" fill="${row.color}"/>`;
  }).join("");
  const center = rows.length
    ? `<text x="${cx}" y="${cy - 3}" text-anchor="middle" fill="#ebf3fa" font-family="Arial,sans-serif" font-size="18" font-weight="700">${xml(rows[0].name)}</text><text x="${cx}" y="${cy + 18}" text-anchor="middle" fill="#99a9be" font-family="Arial,sans-serif" font-size="10" font-weight="700" letter-spacing=".6">LANGUAGE MIX</text>`
    : `<text x="${cx}" y="${cy + 5}" text-anchor="middle" fill="#99a9be" font-family="Arial,sans-serif" font-size="12">NO LANGUAGE DATA</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" rx="22" fill="#101829"/><rect x="1" y="1" width="898" height="${height - 2}" rx="21" fill="none" stroke="#26364a"/><text x="32" y="39" fill="#37dabe" font-family="Arial,sans-serif" font-size="14" font-weight="700" letter-spacing="1.4">MOST USED LANGUAGES</text><text x="32" y="61" fill="#99a9be" font-family="Arial,sans-serif" font-size="11">${USERNAME.toUpperCase()} / ALL REPOSITORIES</text><path d="M32 76H868" stroke="#26364a"/><circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="#253448" stroke-width="25"/>${slices}${center}${legend}<text x="32" y="${height - 13}" fill="#99a9be" font-family="Arial,sans-serif" font-size="9.5" font-weight="700" letter-spacing=".3">LANGUAGE BYTES · PUBLIC + PRIVATE REPOSITORIES</text></svg>`;
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
