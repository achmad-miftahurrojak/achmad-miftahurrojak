#!/usr/bin/env python3
"""WaveFlix scraper sidecar — stdin/stdout JSON protocol.

Contract:
  Request → {"id":str, "action":str, ...params}
  Success → {"id":str, "success":true, "data":[...]}
  Error   → {"id":str, "success":false, "error":{"code":str, "message":str}}

Actions:
  cari_film    params: {query:str, batas:int?}  → data: HasilFilm[]
  cari_trending  params: {}                       → data: HasilFilm[]

HasilFilm: {judul:str, url:str, deskripsi:str, poster:str, tipe:"movie"|"series"}
"""

import json, os, re, sys, traceback, asyncio
from unidecode import unidecode
import cloudscraper
from bs4 import BeautifulSoup
import urllib.parse, urllib.request

TMDB_API_KEY = os.getenv('TMDB_API_KEY', '')
IDLIX_BASE = os.getenv('WAVEFLIX_IDLIX_BASE', 'https://z2.idlixku.com')

_scraper = cloudscraper.create_scraper()


def _err(code, message):
    return json.dumps({'id': '?', 'success': False, 'error': {'code': code, 'message': message}}, ensure_ascii=False)


def _ok(rid, data):
    return json.dumps({'id': rid, 'success': True, 'data': data}, ensure_ascii=False)


def _valid_film(item):
    return isinstance(item, dict) and all(k in item for k in ('judul', 'url', 'deskripsi', 'poster', 'tipe'))


def _cek_ketersediaan(url):
    try:
        teks = _scraper.get(url, timeout=5).text
        return '<title>IDLIX / Nonton Film' not in teks
    except Exception:
        return False


async def _tmdb_search(query, batas, session=None):
    headers = {'accept': 'application/json'}
    params = {'query': query, 'language': 'en-US'}
    if len(TMDB_API_KEY) > 50:
        headers['Authorization'] = f'Bearer {TMDB_API_KEY}'
    else:
        params['api_key'] = TMDB_API_KEY

    import aiohttp
    close_session = session is None
    if session is None:
        session = aiohttp.ClientSession()
    try:
        async with session.get('https://api.themoviedb.org/3/search/multi',
                               headers=headers, params=params) as resp:
            if resp.status != 200:
                return []
            data = await resp.json()
    finally:
        if close_session:
            await session.close()

    hasil_mentah = []
    for item in data.get('results', []):
        tipe = item.get('media_type')
        if tipe not in ('movie', 'tv'):
            continue
        judul = item.get('title') if tipe == 'movie' else item.get('name')
        tahun_raw = item.get('release_date') if tipe == 'movie' else item.get('first_air_date')
        if not judul or not tahun_raw:
            continue
        tahun = tahun_raw.split('-')[0]
        judul_roman = unidecode(judul)
        slug = re.sub(r'[^a-zA-Z0-9\s-]', '', judul_roman).strip().lower()
        slug = re.sub(r'\s+', '-', slug)
        slug_lengkap = f'{slug}-{tahun}'
        idlix_tipe = 'movie' if tipe == 'movie' else 'series'

        poster = ''
        if item.get('poster_path'):
            poster = f"https://image.tmdb.org/t/p/w500{item['poster_path']}"

        if tipe == 'tv':
            try:
                tv_headers = {'accept': 'application/json'}
                tv_params = {'language': 'en-US'}
                if len(TMDB_API_KEY) > 50:
                    tv_headers['Authorization'] = f'Bearer {TMDB_API_KEY}'
                else:
                    tv_params['api_key'] = TMDB_API_KEY
                async with session.get(f"https://api.themoviedb.org/3/tv/{item['id']}",
                                       headers=tv_headers, params=tv_params) as tv_resp:
                    if tv_resp.status == 200:
                        tv_data = await tv_resp.json()
                        valid = [s for s in tv_data.get('seasons', [])
                                 if s.get('season_number', 0) > 0 and s.get('poster_path')]
                        if valid:
                            valid.sort(key=lambda x: x['season_number'], reverse=True)
                            poster = f"https://image.tmdb.org/t/p/w500{valid[0]['poster_path']}"
            except Exception:
                pass

        hasil_mentah.append({
            'judul': f'{judul_roman} ({tahun})',
            'url': f'{IDLIX_BASE}/{idlix_tipe}/{slug_lengkap}',
            'deskripsi': item.get('overview', 'Tidak ada deskripsi.'),
            'poster': poster,
            'tipe': idlix_tipe,
        })

    target = min(len(hasil_mentah), batas + 3)
    verified = []
    for item in hasil_mentah[:target]:
        if _cek_ketersediaan(item['url']):
            item['url'] = _pendekin_url(item['url'])
            verified.append(item)
        if len(verified) >= batas:
            break
    return verified


def _pendekin_url(url):
    alias_safe = re.sub(r'[^a-zA-Z0-9-]', '', url.strip('/').split('/')[-1])[:30].rstrip('-')
    try:
        api = f"https://tinyurl.com/api-create.php?url={urllib.parse.quote(url)}&alias={alias_safe}"
        result = urllib.request.urlopen(api, timeout=5).read().decode('utf-8').strip()
        if result.startswith('http'):
            return result
    except Exception:
        try:
            api = f"https://tinyurl.com/api-create.php?url={urllib.parse.quote(url)}"
            result = urllib.request.urlopen(api, timeout=5).read().decode('utf-8').strip()
            if result.startswith('http'):
                return result
        except Exception:
            pass
    return url


def _cari_trending():
    try:
        html = _scraper.get(IDLIX_BASE + '/', timeout=10).text
    except Exception:
        return []
    soup = BeautifulSoup(html, 'html.parser')
    judul_trending = []
    h2 = soup.find('h2', string='Trending Now')
    if h2:
        ul = h2.find_next_sibling('ul')
        if ul:
            for a in ul.find_all('a')[:10]:
                judul_trending.append(a.text)
    if not judul_trending:
        return []

    hasil_akhir = []
    for judul in judul_trending:
        try:
            hasil = asyncio.run(_tmdb_search(judul, 1))
            if hasil:
                hasil_akhir.append(hasil[0])
        except Exception:
            continue
    return hasil_akhir


async def _handle_cari_film(query, batas):
    return await _tmdb_search(query, batas)


def _handle_cari_trending():
    return _cari_trending()


async def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        req = json.loads(line)
        rid = req.get('id', '0')
        action = req.get('action', '')
        try:
            if action == 'cari_film':
                query = req.get('query')
                if not isinstance(query, str) or not query.strip():
                    print(_err('INVALID_PARAMS', 'query must be a non-empty string'), flush=True)
                    continue
                batas = int(req.get('batas', 5))
                if batas < 1 or batas > 20:
                    batas = 5
                data = await _handle_cari_film(query, batas)
                if not isinstance(data, list):
                    data = []
                data = [d for d in data if _valid_film(d)][:batas]
                print(_ok(rid, data), flush=True)
            elif action == 'cari_trending':
                data = _handle_cari_trending()
                if not isinstance(data, list):
                    data = []
                print(_ok(rid, data), flush=True)
            else:
                print(_err('UNKNOWN_ACTION', f'unknown action: {action}'), flush=True)
        except json.JSONDecodeError:
            print(_err('PARSE_ERROR', 'invalid JSON request'), flush=True)
        except Exception:
            err_msg = traceback.format_exc()
            print(_err('INTERNAL_ERROR', err_msg[:500]), flush=True)


if __name__ == '__main__':
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())