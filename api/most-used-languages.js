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
    const delay = (0.1 + rows.indexOf(row) * 0.09).toFixed(2);
    const segment = `<circle class="donut-segment" style="--arc:${visibleArc.toFixed(2)};--circ:${circumference.toFixed(2)};--delay:${delay}s" cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${row.color}" stroke-width="27" stroke-linecap="round" stroke-dasharray="${visibleArc.toFixed(2)} ${circumference.toFixed(2)}" stroke-dashoffset="${(-circumference * offset / 100).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"/>`;
    offset += row.share;
    return segment;
  }).join("");
  const counter = (value, x, y, index, textAnchor = "end") => {
    const baseDelay = 0.5 + index * 0.07;
    const ticks = value < 0.05 ? "" : Array.from({ length: 6 }, (_, tick) => {
      const delay = (baseDelay + tick * 0.065).toFixed(2);
      const label = `${(value * tick / 6).toFixed(1)}%`;
      return `<text class="number-tick" style="--delay:${delay}s" x="${x}" y="${y}" text-anchor="${textAnchor}" fill="#d6e2f2" font-family="Arial,sans-serif" font-size="13" font-weight="700">${xml(label)}</text>`;
    }).join("");
    const finalDelay = (baseDelay + 0.41).toFixed(2);
    const finalLabel = value > 0 && value < 0.05 ? "&lt;0.1%" : `${value.toFixed(1)}%`;
    return `${ticks}<text class="number-final" style="--delay:${finalDelay}s" x="${x}" y="${y}" text-anchor="${textAnchor}" fill="#d6e2f2" font-family="Arial,sans-serif" font-size="13" font-weight="700">${finalLabel}</text>`;
  };
  const legend = rows.map((row, index) => {
    const y = 103 + index * 32;
    const bar = 575 * row.share / Math.max(rows[0]?.share || 0, 1);
    const delay = (0.28 + index * 0.07).toFixed(2);
    return `<g class="legend-enter" style="--delay:${delay}s"><circle cx="484" cy="${y + 5}" r="6" fill="${row.color}"/><text x="503" y="${y + 10}" fill="#edf4ff" font-family="Arial,sans-serif" font-size="14" font-weight="700">${xml(row.name)}</text><rect x="503" y="${y + 17}" width="662" height="4" rx="2" fill="#29364a"/><rect class="legend-bar" style="--bar-width:${bar.toFixed(2)}px;--delay:${delay}s" x="503" y="${y + 17}" width="${bar.toFixed(2)}" height="4" rx="2" fill="${row.color}"/></g>${counter(row.share, 1165, y + 10, index)}`;
  }).join("");
  const center = rows.length
    ? `<text class="center-enter" style="--delay:0.7s" x="${cx}" y="${cy - 4}" text-anchor="middle" fill="#f4f7fb" font-family="Arial,sans-serif" font-size="22" font-weight="700">${xml(rows[0].name)}</text>${counter(rows[0].share, cx, cy + 21, 0, "middle")}`
    : `<text x="${cx}" y="${cy + 5}" text-anchor="middle" fill="#b4c2d6" font-family="Arial,sans-serif" font-size="13">NO LANGUAGE DATA</text>`;
  const motion = `<style>@keyframes enter-from-right{from{opacity:0;transform:translateX(28px)}to{opacity:1;transform:translateX(0)}}@keyframes enter-from-left{from{opacity:0;transform:translateX(-18px)}to{opacity:1;transform:translateX(0)}}@keyframes draw{from{stroke-dasharray:0 var(--circ)}to{stroke-dasharray:var(--arc) var(--circ)}}@keyframes grow{from{width:0}to{width:var(--bar-width)}}@keyframes tick{0%{opacity:0;transform:translateY(5px)}12%,88%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(-5px)}}@keyframes settle{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}.donut-enter{animation:enter-from-right .55s cubic-bezier(.2,.75,.25,1) both}.header-enter,.legend-enter{animation:enter-from-left .42s cubic-bezier(.2,.75,.25,1) var(--delay) both}.center-enter{animation:enter-from-left .42s cubic-bezier(.2,.75,.25,1) var(--delay) both}.donut-segment{animation:draw .86s cubic-bezier(.22,.7,.25,1) var(--delay) both}.legend-bar{animation:grow .62s cubic-bezier(.2,.75,.25,1) var(--delay) both}.number-tick{opacity:0;animation:tick .105s linear var(--delay) both}.number-final{opacity:0;animation:settle .2s ease var(--delay) both}@media(prefers-reduced-motion:reduce){.donut-enter,.header-enter,.legend-enter,.center-enter,.donut-segment,.legend-bar,.number-tick,.number-final{animation:none!important}.donut-segment{stroke-dasharray:var(--arc) var(--circ)!important}.legend-bar{width:var(--bar-width)!important}.number-tick{display:none}.number-final{opacity:1}}</style>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><title>Top eight languages across all repositories</title><desc>Animated donut chart of language byte shares with exact percentages in the legend.</desc><defs><radialGradient id="chart-glow"><stop offset="0" stop-color="#1d3551"/><stop offset="1" stop-color="#101829"/></radialGradient></defs>${motion}<rect width="${width}" height="${height}" rx="24" fill="url(#chart-glow)"/><rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="23" fill="none" stroke="#26364a"/><text class="header-enter" style="--delay:0s" x="32" y="38" fill="#37dabe" font-family="Arial,sans-serif" font-size="14" font-weight="700" letter-spacing="1.5">MOST USED LANGUAGES</text><text class="header-enter" style="--delay:0.12s" x="32" y="59" fill="#b4c2d6" font-family="Arial,sans-serif" font-size="11">ALL REPOSITORIES</text><rect x="1091" y="23" width="76" height="26" rx="13" fill="#123843"/><circle cx="1107" cy="36" r="3.5" fill="#2dd4bf"/><text x="1117" y="40" fill="#8df5df" font-family="Arial,sans-serif" font-size="10" font-weight="700" letter-spacing=".8">TOP 8</text><path d="M32 75H1168" stroke="#26364a"/><g class="donut-enter"><circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="#29364a" stroke-width="27"/>${slices}${center}</g>${legend}<text class="header-enter" style="--delay:0.2s" x="32" y="354" fill="#8395ad" font-family="Arial,sans-serif" font-size="10" letter-spacing=".7">LANGUAGE BYTE SHARE</text></svg>`;
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
