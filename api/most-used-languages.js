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
  const height = 500;
  const rowHeight = 35;
  const rowTop = 165;
  const total = languages.reduce((sum, row) => sum + row.bytes, 0);
  const rows = languages.slice(0, 8).map(row => ({ ...row, share: total ? row.bytes / total * 100 : 0 }));
  const cx = 270, cy = 300, radius = 136;
  const angleAt = index => -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(rows.length, 1);
  const pointAt = (index, distance) => ({
    x: cx + Math.cos(angleAt(index)) * distance,
    y: cy + Math.sin(angleAt(index)) * distance,
  });
  const polygonPoints = distances => distances.map((distance, index) => {
    const point = pointAt(index, distance);
    return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
  }).join(" ");
  const grid = rows.length ? [0.25, 0.5, 0.75, 1].map(level =>
    `<polygon points="${polygonPoints(rows.map(() => radius * level))}" fill="none" stroke="#29364a" stroke-width="1"/>`
  ).join("") : "";
  const spokes = rows.map((_row, index) => {
    const point = pointAt(index, radius);
    return `<path d="M${cx} ${cy}L${point.x.toFixed(2)} ${point.y.toFixed(2)}" stroke="#29364a" stroke-width="1"/>`;
  }).join("");
  const max = Math.max(rows[0]?.share || 0, 1);
  const area = rows.length
    ? `<polygon points="${polygonPoints(rows.map(row => radius * row.share / max))}" fill="#38bdf8" fill-opacity=".18" stroke="#38bdf8" stroke-width="2.5" stroke-linejoin="round"/>`
    : "";
  const points = rows.map((row, index) => {
    const point = pointAt(index, radius * row.share / max);
    return `<circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="5" fill="${row.color}" stroke="#101829" stroke-width="2"/>`;
  }).join("");
  const legend = rows.map((row, index) => {
    const y = rowTop + index * rowHeight;
    const bar = 359 * row.share / max;
    const percent = row.share > 0 && row.share < 0.05 ? "<0.1%" : `${row.share.toFixed(1)}%`;
    return `<g><circle cx="585" cy="${y}" r="5.5" fill="${row.color}"/><text x="603" y="${y + 5}" fill="#edf4ff" font-family="Arial,sans-serif" font-size="14" font-weight="700">${xml(row.name)}</text><text x="962" y="${y + 5}" text-anchor="end" fill="#b4c2d6" font-family="Arial,sans-serif" font-size="13">${xml(percent)}</text><rect x="603" y="${y + 13}" width="359" height="4" rx="2" fill="#29364a"/><rect x="603" y="${y + 13}" width="${bar.toFixed(2)}" height="4" rx="2" fill="${row.color}"/></g>`;
  }).join("");
  const empty = rows.length ? "" : `<text x="${cx}" y="${cy + 5}" text-anchor="middle" fill="#b4c2d6" font-family="Arial,sans-serif" font-size="13">NO LANGUAGE DATA</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><title>Top eight languages across all repositories</title><desc>Radar chart of language byte shares with exact percentages in the legend.</desc><rect width="${width}" height="${height}" rx="24" fill="#101829"/><rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="23" fill="none" stroke="#26364a"/><text x="36" y="42" fill="#37dabe" font-family="Arial,sans-serif" font-size="15" font-weight="700" letter-spacing="1.4">MOST USED LANGUAGES</text><text x="36" y="67" fill="#b4c2d6" font-family="Arial,sans-serif" font-size="12">ALL REPOSITORIES · TOP 8</text><path d="M36 86H964" stroke="#26364a"/>${grid}${spokes}${area}${points}${empty}${legend}</svg>`;
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
