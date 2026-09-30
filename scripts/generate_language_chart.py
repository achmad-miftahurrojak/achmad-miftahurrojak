#!/usr/bin/env python3
"""Build an animated language-share chart from GitHub repository metadata."""

from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


USERNAME = os.environ.get("GH_USERNAME", "achmad-miftahurrojak")
TOKEN = os.environ.get("GH_TOKEN")
OUTPUT = Path("assets/most-used-languages.gif")
WIDTH, HEIGHT = 1000, 440
BG = (10, 15, 28)
PANEL = (16, 24, 41)
MUTED = (153, 169, 190)
WHITE = (235, 243, 250)
ACCENT = (55, 218, 190)
PALETTE = [
    (56, 189, 248), (45, 212, 191), (251, 191, 36), (192, 132, 252),
    (251, 113, 133), (163, 230, 53), (129, 140, 248), (251, 146, 60),
    (103, 232, 249), (244, 114, 182), (196, 181, 253), (134, 239, 172),
]


def request_json(url: str) -> object:
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "most-used-languages-profile-chart",
    }
    if TOKEN:
        headers["Authorization"] = f"Bearer {TOKEN}"
    req = urllib.request.Request(url, headers=headers)
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30) as response:
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
            if not isinstance(repository, dict):
                continue
            language_url = repository.get("languages_url")
            if not language_url:
                continue
            languages = request_json(language_url)
            if isinstance(languages, dict):
                for language, byte_count in languages.items():
                    totals[language] = totals.get(language, 0) + int(byte_count)
        if len(repositories) < 100:
            break
        page += 1
    return dict(sorted(totals.items(), key=lambda item: (-item[1], item[0])))


def font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold
        else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "C:/Windows/Fonts/segoeui.ttf",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            pass
    return ImageFont.load_default()


def draw_chart(languages: list[tuple[str, int]], progress: float, frame: int) -> Image.Image:
    image = Image.new("RGB", (WIDTH, HEIGHT), BG)
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((18, 18, WIDTH - 18, HEIGHT - 18), 26, fill=PANEL,
                           outline=(38, 54, 74), width=1)
    draw.text((54, 46), "MOST USED LANGUAGES", font=font(16, True), fill=ACCENT)
    draw.text((54, 75), f"{USERNAME}  /  ALL REPOSITORIES", font=font(13), fill=MUTED)
    draw.line((54, 110, WIDTH - 54, 110), fill=(38, 54, 74), width=1)

    center = (280, 265)
    radius = 112
    ring_box = (center[0] - radius, center[1] - radius,
                center[0] + radius, center[1] + radius)
    draw.ellipse(ring_box, outline=(37, 51, 69), width=34)
    visible = sum(value for _, value in languages) * progress
    total = sum(value for _, value in languages) or 1
    angle = -90.0
    for index, (_, value) in enumerate(languages):
        segment = 360 * value / total
        portion = max(0.0, min(1.0, (visible / total * 360 - (angle + 90)) / segment))
        if portion > 0:
            draw.arc(ring_box, start=angle, end=angle + segment * portion,
                     fill=PALETTE[index % len(PALETTE)], width=34)
        angle += segment

    if languages:
        primary = languages[0][0]
        draw.text((center[0], center[1] - 17), primary, font=font(22, True),
                  fill=WHITE, anchor="mm")
        draw.text((center[0], center[1] + 16), "LANGUAGE MIX", font=font(11, True),
                  fill=MUTED, anchor="mm")
    else:
        draw.text((center[0], center[1] - 8), "RUN WORKFLOW", font=font(14, True),
                  fill=WHITE, anchor="mm")
        draw.text((center[0], center[1] + 16), "TO GENERATE", font=font(11, True),
                  fill=MUTED, anchor="mm")

    shown = languages[:8]
    total_shown = sum(value for _, value in languages) or 1
    start_y = 139
    row_gap = 34
    for index, (name, value) in enumerate(shown):
        y = start_y + index * row_gap
        color = PALETTE[index % len(PALETTE)]
        draw.rounded_rectangle((535, y + 3, 547, y + 15), 5, fill=color)
        draw.text((563, y), name, font=font(15, True), fill=WHITE)
        percent = value / total_shown * 100
        draw.text((946, y), f"{percent:4.1f}%", font=font(14), fill=MUTED, anchor="ra")
        draw.rounded_rectangle((563, y + 24, 946, y + 28), 2, fill=(35, 48, 65))
        bar_width = int(383 * percent / (languages[0][1] / total_shown * 100)) if languages else 0
        draw.rounded_rectangle((563, y + 24, 563 + max(2, bar_width), y + 28),
                               2, fill=color)

    draw.text((54, 394), "BY LANGUAGE BYTES  ·  PUBLIC + PRIVATE REPOS", font=font(11, True), fill=MUTED)
    draw.text((946, 394), "UPDATED AUTOMATICALLY", font=font(11, True), fill=ACCENT, anchor="ra")
    # A small travelling accent gives the loop a subtle motion beyond the chart sweep.
    pulse_x = 54 + (frame % 24) * 3
    draw.ellipse((pulse_x, 423, pulse_x + 4, 427), fill=ACCENT)
    return image


def main() -> None:
    values = collect_language_bytes()
    languages = list(values.items())
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    frame_count = 24
    frames = [draw_chart(languages, min(1.0, (index + 1) / 17), index)
              for index in range(frame_count)]
    frames[0].save(OUTPUT, save_all=True, append_images=frames[1:], duration=85,
                   loop=0, optimize=True, disposal=2)
    print(f"Wrote {OUTPUT} with {len(languages)} languages from repositories accessible to the token.")


if __name__ == "__main__":
    main()
