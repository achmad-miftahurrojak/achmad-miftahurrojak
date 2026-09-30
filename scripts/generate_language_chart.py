#!/usr/bin/env python3
"""Aggregate language byte counts and render a compact profile chart."""
from __future__ import annotations

import html
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

USERNAME = os.environ.get("GH_USERNAME", "achmad-miftahurrojak")
TOKEN = os.environ.get("GH_TOKEN")
PREVIEW_PATH = Path("assets/most-used-languages.svg")
COLORS = [
    "#38bdf8", "#2dd4bf", "#fbbf24", "#c084fc", "#fb7185",
    "#a3e635", "#818cf8", "#fb923c", "#67e8f9", "#f472b6",
]


def request_json(url: str) -> object:
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "profile-language-chart",
        "Authorization": f"Bearer {TOKEN}",
    }
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
        repositories = request_json(f"https://api.github.com/users/{USERNAME}/repos?{query}")
        if not isinstance(repositories, list):
            raise RuntimeError("Unexpected response while listing repositories")
        for repository in repositories:
            if not isinstance(repository, dict) or not repository.get("languages_url"):
                continue
            languages = request_json(repository["languages_url"])
            if isinstance(languages, dict):
                for name, byte_count in languages.items():
                    totals[name] = totals.get(name, 0) + int(byte_count)
        if len(repositories) < 100:
            break
        page += 1
    return dict(sorted(totals.items(), key=lambda item: (-item[1], item[0])))


def language_rows(totals: dict[str, int]) -> list[dict[str, object]]:
    total_bytes = sum(totals.values())
    if not total_bytes:
        return []
    return [
        {
            "name": name,
            "share": round(byte_count / total_bytes * 100, 2),
            "color": COLORS[index % len(COLORS)],
        }
        for index, (name, byte_count) in enumerate(totals.items())
    ]


def render_svg(rows: list[dict[str, object]]) -> str:
    width = 900
    row_height = 24
    row_top = 76
    height = max(220, row_top + row_height * len(rows) + 32)
    center_x, center_y, radius = 180, height / 2, 72
    circumference = 2 * 3.141592653589793 * radius
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        f'<rect width="{width}" height="{height}" rx="22" fill="#101829"/>',
        f'<rect x="1" y="1" width="{width - 2}" height="{height - 2}" rx="21" fill="none" stroke="#26364a"/>',
        '<text x="32" y="39" fill="#37dabe" font-family="Arial,sans-serif" font-size="14" font-weight="700" letter-spacing="1.4">MOST USED LANGUAGES</text>',
        f'<path d="M32 55H{width - 32}" stroke="#26364a"/>',
        f'<circle cx="{center_x}" cy="{center_y:.1f}" r="{radius}" fill="none" stroke="#253448" stroke-width="25"/>',
    ]

    offset = 0.0
    for row in rows:
        share = float(row["share"])
        arc = circumference * share / 100
        parts.append(
            f'<circle cx="{center_x}" cy="{center_y:.1f}" r="{radius}" fill="none" '
            f'stroke="{row["color"]}" stroke-width="25" '
            f'stroke-dasharray="{arc:.2f} {circumference:.2f}" '
            f'stroke-dashoffset="{-circumference * offset / 100:.2f}" '
            f'transform="rotate(-90 {center_x} {center_y:.1f})"/>'
        )
        offset += share

    if rows:
        parts.extend([
            f'<text x="{center_x}" y="{center_y - 3:.1f}" text-anchor="middle" fill="#ebf3fa" font-family="Arial,sans-serif" font-size="18" font-weight="700">{html.escape(str(rows[0]["name"]))}</text>',
            f'<text x="{center_x}" y="{center_y + 18:.1f}" text-anchor="middle" fill="#99a9be" font-family="Arial,sans-serif" font-size="10" font-weight="700" letter-spacing=".6">LANGUAGE MIX</text>',
        ])

    max_share = max((float(row["share"]) for row in rows), default=1.0)
    for index, row in enumerate(rows):
        y = row_top + index * row_height
        share = float(row["share"])
        name = html.escape(str(row["name"]))
        color = str(row["color"])
        parts.extend([
            f'<circle cx="365" cy="{y + 1}" r="5.5" fill="{color}"/>',
            f'<text x="382" y="{y + 5}" fill="#ebf3fa" font-family="Arial,sans-serif" font-size="12.5" font-weight="700">{name}</text>',
            f'<text x="868" y="{y + 5}" text-anchor="end" fill="#99a9be" font-family="Arial,sans-serif" font-size="12">{share:.1f}%</text>',
            f'<rect x="382" y="{y + 11}" width="486" height="3.5" rx="1.75" fill="#253448"/>',
            f'<rect x="382" y="{y + 11}" width="{486 * share / max_share:.2f}" height="3.5" rx="1.75" fill="{color}"/>',
        ])

    if not rows:
        parts.append(f'<text x="{center_x}" y="{center_y + 5:.1f}" text-anchor="middle" fill="#99a9be" font-family="Arial,sans-serif" font-size="12">NO LANGUAGE DATA</text>')
    parts.append(f'<text x="32" y="{height - 13}" fill="#99a9be" font-family="Arial,sans-serif" font-size="9.5" font-weight="700" letter-spacing=".3">ALL AUTHORIZED REPOSITORIES · LANGUAGE BYTES</text>')
    parts.append("</svg>")
    return "\n".join(parts) + "\n"


def main() -> None:
    if not TOKEN:
        raise RuntimeError("GH_STATS_TOKEN is required to include public and private repositories.")
    rows = language_rows(collect_language_bytes())
    PREVIEW_PATH.parent.mkdir(parents=True, exist_ok=True)
    PREVIEW_PATH.write_text(render_svg(rows), encoding="utf-8")
    print(f"Updated {len(rows)} languages from all repositories the token can access.")


if __name__ == "__main__":
    main()
