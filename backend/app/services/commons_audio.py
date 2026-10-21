"""A separate, attributed field-recording archive when Xeno-canto is unavailable.

Only exact species audio categories are queried; videos and unlicensed files
are excluded. No recording is ever presented under another archive's credit.
"""
import html
import re
import time
from urllib.parse import urlsplit, urlunsplit
from collections import OrderedDict

import requests

_CACHE: OrderedDict[str, tuple[float, list[dict]]] = OrderedDict()
_TAG = re.compile(r"<[^>]+>")


def _text(value: str) -> str:
    return html.unescape(_TAG.sub("", value)).strip()


def recordings(scientific_name: str) -> list[dict]:
    cached = _CACHE.get(scientific_name)
    if cached and cached[0] > time.monotonic():
        return cached[1]
    response = requests.get(
        "https://commons.wikimedia.org/w/api.php",
        params={
            "action": "query", "format": "json", "generator": "categorymembers",
            "gcmtitle": f"Category:Audio files of {scientific_name}",
            "gcmtype": "file", "gcmlimit": 30, "prop": "imageinfo",
            "iiprop": "url|mime|size|extmetadata",
            "iiextmetadatafilter": "Artist|LicenseShortName|LicenseUrl",
        },
        headers={"User-Agent": "Birdpedia/1.0 (educational species field guide)"},
        timeout=12,
    )
    response.raise_for_status()
    result = []
    for page in response.json().get("query", {}).get("pages", {}).values():
        for info in page.get("imageinfo", []):
            meta = info.get("extmetadata", {})
            licence = meta.get("LicenseUrl", {}).get("value", "")
            if not info.get("mime", "").startswith("audio/") or not licence:
                continue
            if info.get("size", 0) > 20_000_000:
                continue
            result.append({
                "title": page["title"].removeprefix("File:"),
                "url": urlunsplit(urlsplit(info["url"])._replace(query="")), "page_url": info["descriptionurl"],
                "recordist": _text(meta.get("Artist", {}).get("value", "Wikimedia contributor")),
                "license": _text(meta.get("LicenseShortName", {}).get("value", "See source")),
                "license_url": licence, "size": info.get("size", 0),
            })
    result.sort(key=lambda item: item["size"])
    _CACHE[scientific_name] = (time.monotonic() + 21600, result[:3])
    while len(_CACHE) > 256:
        _CACHE.popitem(last=False)
    return result[:3]
