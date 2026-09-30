#!/usr/bin/env python3
"""Collect repository language shares and build the README's static preview."""
from __future__ import annotations
import html
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

USERNAME = os.environ.get("GH_USERNAME", "achmad-miftahurrojak")
TOKEN = os.environ.get("GH_TOKEN")
DATA_PATH = Path("language-chart/languages.json")
PREVIEW_PATH = Path("assets/most-used-languages.svg")
COLORS = ["#38bdf8", "#2dd4bf", "#fbbf24", "#c084fc", "#fb7185", "#a3e635", "#818cf8", "#fb923c", "#67e8f9", "#f472b6"]

def request_json(url: str) -> object:
    headers = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "most-used-languages-profile-chart"}
    if TOKEN:
        headers["Authorization"] = f"Bearer {TOKEN}"
    request = urllib.request.Request(url, headers=headers)
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            if error.code == 403 and error.headers.get("X-RateLimit-Remaining") == "0":
                reset = int(error.headers.get("X-RateLimit-Reset", "0"))
                time.sleep(max(1, min(reset - int(time.time()), 60)))
                continue
            raise RuntimeError(f"GitHub API returned HTTP {error.code} for {url}") from error
        except urllib.error.URLError:
            if attempt == 3:
                raise
            time.sleep(2 ** attempt)
    raise RuntimeError("GitHub API request failed after retries")

def collect_language_bytes() -> dict[str, int]:
    totals: dict[str, int] = {}
    page = 1
    while True:
        query = urllib.parse.urlencode({"per_page": 100, "page": page, "type": "owner"})
        repos = request_json(f"https://api.github.com/users/{USERNAME}/repos?{query}")
        if not isinstance(repos, list):
            raise RuntimeError("Unexpected response while listing repositories")
        for repo in repos:
            if not isinstance(repo, dict) or not repo.get("languages_url"):
                continue
            values = request_json(repo["languages_url"])
            if isinstance(values, dict):
                for name, count in values.items():
                    totals[name] = totals.get(name, 0) + int(count)
        if len(repos) < 100:
            break
        page += 1
    return dict(sorted(totals.items(), key=lambda item: (-item[1], item[0])))

def chart_items(totals: dict[str, int]) -> list[dict[str, object]]:
    total = sum(totals.values())
    if not total:
        return []
    ranked = list(totals.items())
    visible = ranked[:8]
    if len(ranked) > 8:
        visible.append(("Other", sum(value for _, value in ranked[8:])))
    return [{"name": name, "share": round(value / total * 100, 2), "color": COLORS[index % len(COLORS)]}
            for index, (name, value) in enumerate(visible)]

def svg_preview(items: list[dict[str, object]]) -> str:
    width, height, cx, cy, radius = 1000, 440, 235, 246, 112
    circumference = 2 * 3.141592653589793 * radius
    pieces = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
      '<rect width="1000" height="440" rx="26" fill="#101829"/>',
      '<rect x="1" y="1" width="998" height="438" rx="25" fill="none" stroke="#26364a"/>',
      '<text x="48" y="54" fill="#37dabe" font-family="Arial,sans-serif" font-size="15" font-weight="700" letter-spacing="1.5">MOST USED LANGUAGES</text>',
      '<text x="48" y="82" fill="#99a9be" font-family="Arial,sans-serif" font-size="13">ACHMAD-MIFTAHUROJAK  /  ALL REPOSITORIES</text>',
      '<path d="M48 108H952" stroke="#26364a"/>',
      f'<circle cx="{cx}" cy="{cy}" r="{radius}" fill="none" stroke="#253448" stroke-width="34"/>']
    offset = 0.0
    for item in items:
        share = float(item["share"])
        pieces.append(f'<circle cx="{cx}" cy="{cy}" r="{radius}" fill="none" stroke="{item["color"]}" stroke-width="34" stroke-dasharray="{circumference * share / 100:.2f} {circumference:.2f}" stroke-dashoffset="{-circumference * offset / 100:.2f}" transform="rotate(-90 {cx} {cy})"/>')
        offset += share
    if items:
        label = html.escape(str(items[0]["name"]))
        pieces.extend([f'<text x="{cx}" y="{cy - 4}" text-anchor="middle" fill="#ebf3fa" font-family="Arial,sans-serif" font-size="24" font-weight="700">{label}</text>',
                       '<text x="235" y="270" text-anchor="middle" fill="#99a9be" font-family="Arial,sans-serif" font-size="11" font-weight="700" letter-spacing="1">LANGUAGE MIX</text>'])
    else:
        pieces.extend([f'<text x="{cx}" y="{cy - 3}" text-anchor="middle" fill="#ebf3fa" font-family="Arial,sans-serif" font-size="17" font-weight="700">INTERACTIVE CHART</text>',
                       f'<text x="{cx}" y="{cy + 21}" text-anchor="middle" fill="#99a9be" font-family="Arial,sans-serif" font-size="12">OPEN TO VIEW</text>'])
    for index, item in enumerate(items[:8]):
        y = 145 + index * 34
        share = float(item["share"])
        pieces.extend([f'<rect x="520" y="{y}" width="12" height="12" rx="6" fill="{item["color"]}"/>',
          f'<text x="548" y="{y + 11}" fill="#ebf3fa" font-family="Arial,sans-serif" font-size="14" font-weight="700">{html.escape(str(item["name"]))}</text>',
          f'<text x="950" y="{y + 11}" text-anchor="end" fill="#99a9be" font-family="Arial,sans-serif" font-size="13">{share:.1f}%</text>',
          f'<rect x="548" y="{y + 19}" width="402" height="4" rx="2" fill="#253448"/>',
          f'<rect x="548" y="{y + 19}" width="{402 * share / max(float(items[0]["share"]), 0.01):.2f}" height="4" rx="2" fill="{item["color"]}"/>'])
    pieces.extend(['<text x="48" y="399" fill="#99a9be" font-family="Arial,sans-serif" font-size="10" font-weight="700" letter-spacing=".4">BY LANGUAGE BYTES  ·  PUBLIC + PRIVATE REPOS</text>',
      '<text x="952" y="399" text-anchor="end" fill="#37dabe" font-family="Arial,sans-serif" font-size="10" font-weight="700" letter-spacing=".4">OPEN FOR INTERACTIVE CHART</text>', '</svg>'])
    return "\n".join(pieces) + "\n"

def main() -> None:
    totals = collect_language_bytes()
    items = chart_items(totals)
    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    PREVIEW_PATH.parent.mkdir(parents=True, exist_ok=True)
    DATA_PATH.write_text(json.dumps({"username": USERNAME, "updated_at": datetime.now(timezone.utc).isoformat(), "languages": items}, indent=2) + "\n", encoding="utf-8")
    PREVIEW_PATH.write_text(svg_preview(items), encoding="utf-8")
    print(f"Wrote {DATA_PATH} and {PREVIEW_PATH} with {len(items)} language groups.")

if __name__ == "__main__":
    main()
