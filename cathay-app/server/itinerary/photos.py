"""Find a web photo for each place, and use it only when it really shows that place.

Tavily returns photos from whole web pages, so a photo can show something else on the same page
(a menu, another temple). Two sources of candidates are used:
1. A targeted search per card, "<place name> <destination>", with depth "advanced" (the docs recommend
   it for niche topics such as single restaurants and small temples).
2. The photos from the discovery searches (a fallback).

A photo is accepted only if its description or its page title names the place (over half of the
distinctive words in the name must appear), and its URL is https from a non-social host.
Otherwise the card keeps the local category photo.
"""
import logging
import re
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlparse

log = logging.getLogger(__name__)

TARGETED_RESULTS = 5
MAX_URL_LENGTH = 500
MAX_WORKERS = 4
# Social and CDN hosts serve images without a reliable page, so they are never used.
BLOCKED_HOSTS = ("fbsbx.com", "facebook.com", "instagram.com", "tiktok.com", "pinterest.")
# Words that appear in many place names and prove nothing on their own.
GENERIC = {
    "the", "and", "of", "in", "at", "tokyo", "japan", "visit", "tour", "tours", "food", "market", "museum",
    "park", "temple", "shrine", "garden", "class", "cruise", "guided", "private", "night", "day", "best",
    "walk", "walking", "hidden", "gem", "gems", "district", "street", "area", "restaurant", "cafe",
    # Category words: a photo of any ramen or sushi would match, so they prove nothing on their own.
    "ramen", "sushi", "izakaya", "ceremony", "experience", "lunch", "dinner", "breakfast", "bar", "shop",
    "shopping", "tasting", "cooking", "class", "shrine", "tea", "fish", "outer", "inner",
}
WORD = re.compile(r"[a-z0-9]+")
# Thumbnails and site chrome, not photos of a place: tiny sizes, logos, icons, og-image banners.
LOW_RES = re.compile(r"(?<![0-9])(\d{2,3})x(\d{2,3})(?![0-9])|(?<![0-9])(\d{2,3})px")
CHROME = re.compile(r"og-image|logo|icon|sprite|favicon|banner|avatar|placeholder", re.IGNORECASE)
MIN_SIZE_PX = 300


def is_small(url: str) -> bool:
    """True for thumbnails such as 150x150 or 120px, which are too small to show on a card."""
    for match in LOW_RES.finditer(url):
        size = match.group(1) or match.group(3)
        if match.group(1) and match.group(2):
            if min(int(match.group(1)), int(match.group(2))) < MIN_SIZE_PX:
                return True
        elif size and int(size) < MIN_SIZE_PX:
            return True
    return False


def clean_images(raw_images, page_url: str, page_title: str) -> list[dict]:
    """Keep usable https images. Tavily gives objects with url/title/description, but strings also work."""
    images = []
    for raw in raw_images if isinstance(raw_images, list) else []:
        if isinstance(raw, str):
            url, title, description = raw, "", ""
        elif isinstance(raw, dict):
            url = raw.get("url") or ""
            title = raw.get("title") or ""
            description = raw.get("description") or ""
        else:
            continue
        url = str(url).strip()
        if not url.startswith("https://") or len(url) > MAX_URL_LENGTH:
            continue
        host = urlparse(url).netloc.lower()
        if any(blocked in host for blocked in BLOCKED_HOSTS) or CHROME.search(url) or is_small(url):
            continue
        images.append(
            {
                "url": url,
                "description": str(description)[:300],
                "page_url": page_url,
                "page_title": str(title or page_title or page_url)[:300],
            }
        )
    return images


def _fold(text: str) -> str:
    """Lower-case and strip accents, so 'Sensō-ji' matches 'Senso-ji'."""
    decomposed = unicodedata.normalize("NFKD", text or "")
    return "".join(ch for ch in decomposed if not unicodedata.combining(ch)).lower()


def distinctive_words(name: str) -> list[str]:
    return [w for w in WORD.findall(_fold(name)) if len(w) >= 4 and w not in GENERIC]


def matches_place(name: str, *texts: str) -> bool:
    """True when at least half (rounded up) of the distinctive words in the name appear in the texts."""
    words = set(distinctive_words(name))
    if not words:
        return False
    tokens = set(WORD.findall(" ".join(_fold(t) for t in texts)))
    needed = (len(words) + 1) // 2
    return len(words & tokens) >= needed


def best_photo(card: dict, candidates: list[dict]) -> dict | None:
    """The first candidate whose own description names this place.

    The page title is NOT used as evidence. Live tests showed that a page named after a place
    (for example "Tokyo Ramen Festa 2026" or "Senso-ji - Wikipedia") often hosts unrelated images
    such as a site banner or a painting of a different deity. An image without a description is
    therefore never used.
    """
    for image in candidates:
        if matches_place(card["name"], image.get("description", "")):
            return image
    return None


def _targeted_images(search_client, card: dict, destination: str) -> list[dict]:
    query = f"{card['name']} {destination}"[:300]
    try:
        result = search_client.search(
            query=query,
            search_depth="advanced",
            max_results=TARGETED_RESULTS,
            include_answer=False,
            include_raw_content=False,
            include_images=True,
            include_image_descriptions=True,
        )
    except Exception as exc:  # noqa: BLE001 - a failed photo search must not fail the deck
        log.info("Targeted photo search failed for %s: %s", card["name"], type(exc).__name__)
        return []
    images = []
    for item in (result or {}).get("results", []):
        images += clean_images(item.get("images"), item.get("url") or "", item.get("title") or "")
    return images


def find_place_images(search_client, cards: list[dict], destination: str) -> dict[str, list[dict]]:
    """One targeted search per card, run in parallel. Returns {card id: candidate photos}."""
    if search_client is None or not cards:
        return {}
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        found = list(pool.map(lambda card: _targeted_images(search_client, card, destination), cards))
    return {card["id"]: images for card, images in zip(cards, found)}


def attach_photos(cards: list[dict], per_card: dict[str, list[dict]], shared: list[dict]) -> list[dict]:
    """Give each card a verified web photo, or None (the local category photo is used instead).

    Each card tries its own targeted candidates first, then the shared discovery candidates.
    A photo is used at most once, so two places never show the same picture.
    """
    used: set[str] = set()
    for card in cards:
        pool = per_card.get(card["id"], []) + shared
        open_candidates = [c for c in pool if c["url"] not in used]
        image = best_photo(card, open_candidates)
        if image:
            used.add(image["url"])
            card["web_photo"] = {
                "url": image["url"],
                "page_url": image["page_url"],
                "page_title": image["page_title"][:140],
                "verified": True,
            }
        else:
            card["web_photo"] = None
    return cards
