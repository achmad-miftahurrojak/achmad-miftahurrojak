const USERNAME = "achmad-miftahurrojak";
const COLORS = ["#38bdf8", "#2dd4bf", "#a78bfa", "#facc15", "#fb7185", "#a3e635", "#818cf8", "#fb923c"];
const colorFor = index => COLORS[index % COLORS.length];

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
  const width = 1200;
  const height = 380;
  const total = languages.reduce((sum, row) => sum + row.bytes, 0);
  const rows = languages.slice(0, 8).map(row => ({ ...row, share: total ? row.bytes / total * 100 : 0 }));
  const cx = 245, cy = 214, radius = 103;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const slices = rows.map(row => {
    const arc = circumference * row.share / 100;
    const visibleArc = Math.max(arc - 3, 0);
    const segment = `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${row.color}" stroke-width="27" stroke-linecap="round" stroke-dasharray="${visibleArc.toFixed(2)} ${circumference.toFixed(2)}" stroke-dashoffset="${(-circumference * offset / 100).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"/>`;
    offset += row.share;
    return segment;
  }).join("");
  const legend = rows.map((row, index) => {
    const y = 103 + index * 32;
    const bar = 575 * row.share / Math.max(rows[0]?.share || 0, 1);
    const percent = row.share > 0 && row.share < 0.05 ? "<0.1%" : `${row.share.toFixed(1)}%`;
    return `<g><circle cx="484" cy="${y + 5}" r="6" fill="${row.color}"/><text x="503" y="${y + 10}" fill="#edf4ff" font-family="Arial,sans-serif" font-size="14" font-weight="700">${xml(row.name)}</text><text x="1165" y="${y + 10}" text-anchor="end" fill="#d6e2f2" font-family="Arial,sans-serif" font-size="13" font-weight="700">${xml(percent)}</text><rect x="503" y="${y + 17}" width="662" height="4" rx="2" fill="#29364a"/><rect x="503" y="${y + 17}" width="${bar.toFixed(2)}" height="4" rx="2" fill="${row.color}"/></g>`;
  }).join("");
  const center = rows.length
    ? `<text x="${cx}" y="${cy - 4}" text-anchor="middle" fill="#f4f7fb" font-family="Arial,sans-serif" font-size="22" font-weight="700">${xml(rows[0].name)}</text><text x="${cx}" y="${cy + 21}" text-anchor="middle" fill="#b4c2d6" font-family="Arial,sans-serif" font-size="13" font-weight="700">${rows[0].share.toFixed(1)}%</text>`
    : `<text x="${cx}" y="${cy + 5}" text-anchor="middle" fill="#b4c2d6" font-family="Arial,sans-serif" font-size="13">NO LANGUAGE DATA</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><title>Top eight languages across all repositories</title><desc>Donut chart of language byte shares with exact percentages in the legend.</desc><defs><radialGradient id="chart-glow"><stop offset="0" stop-color="#1d3551"/><stop offset="1" stop-color="#101829"/></radialGradient></defs><rect width="${width}" height="${height}" rx="24" fill="url(#chart-glow)"/><rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="23" fill="none" stroke="#26364a"/><text x="32" y="38" fill="#37dabe" font-family="Arial,sans-serif" font-size="14" font-weight="700" letter-spacing="1.5">MOST USED LANGUAGES</text><text x="32" y="59" fill="#b4c2d6" font-family="Arial,sans-serif" font-size="11">ALL REPOSITORIES</text><rect x="1091" y="23" width="76" height="26" rx="13" fill="#123843"/><circle cx="1107" cy="36" r="3.5" fill="#2dd4bf"/><text x="1117" y="40" fill="#8df5df" font-family="Arial,sans-serif" font-size="10" font-weight="700" letter-spacing=".8">TOP 8</text><path d="M32 75H1168" stroke="#26364a"/><circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="#29364a" stroke-width="27"/>${slices}${center}${legend}<text x="32" y="354" fill="#8395ad" font-family="Arial,sans-serif" font-size="10" letter-spacing=".7">LANGUAGE BYTE SHARE</text></svg>`;
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
