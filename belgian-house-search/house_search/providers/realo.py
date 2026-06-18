"""Realo provider (realo.be).

Realo publishes its search results page with the data embedded as JSON in the
HTML (a Next.js / __INITIAL_STATE__ style payload). We fetch the search page
and extract that JSON blob, then map each estate to a `Listing`.

Best-effort, like the other providers: the embedded-JSON shape can change.
Parsing is defensive and failures are isolated by the aggregator. Use
REALO_COOKIE to pass a fresh cookie if blocked.
"""

from __future__ import annotations

import json
import re
import time
from typing import List, Optional

import requests

from ..criteria import Criteria
from ..models import Listing
from .base import Provider
from .common import dig, first, make_session, to_int

BASE = "https://www.realo.be"

# Realo embeds JSON in one of these script blocks depending on the build.
_JSON_PATTERNS = [
    re.compile(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', re.S),
    re.compile(r"window\.__INITIAL_STATE__\s*=\s*(\{.*?\});", re.S),
    re.compile(r'<script type="application/json"[^>]*>(\{.*?\})</script>', re.S),
]

_CONDITION_MAP = {
    "excellent": "AS_NEW",
    "good": "GOOD",
    "new": "NEW",
    "renovated": "JUST_RENOVATED",
    "to renovate": "TO_RENOVATE",
    "to restore": "TO_RESTORE",
}


class RealoProvider(Provider):
    name = "realo"

    def __init__(self, max_pages: int = 10, delay: float = 1.5, timeout: int = 20):
        self.max_pages = max_pages
        self.delay = delay
        self.timeout = timeout
        self.session = make_session(cookie_env="REALO_COOKIE", referer=BASE)
        # Realo's search page returns HTML, not JSON.
        self.session.headers["Accept"] = (
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        )

    def search(self, criteria: Criteria) -> List[Listing]:
        listings: List[Listing] = []
        # Realo searches by location text; we query each postal code separately.
        zips = criteria.postal_codes or [""]
        for zip_code in zips:
            for page in range(1, self.max_pages + 1):
                params = self._build_params(criteria, page)
                path = f"/en/search/house/for-sale/{zip_code}" if zip_code else "/en/search/house/for-sale"
                try:
                    resp = self.session.get(BASE + path, params=params, timeout=self.timeout)
                except requests.RequestException as exc:
                    raise RuntimeError(f"Realo request failed: {exc}") from exc

                if resp.status_code in (401, 403):
                    raise RuntimeError(
                        "Realo returned %s (blocked). Try REALO_COOKIE or a higher --delay."
                        % resp.status_code
                    )
                if resp.status_code == 404:
                    break
                resp.raise_for_status()

                estates = _extract_estates(resp.text)
                if not estates:
                    break
                for raw in estates:
                    parsed = _parse(raw)
                    if parsed:
                        listings.append(parsed)
                time.sleep(self.delay)
        return listings

    def _build_params(self, c: Criteria, page: int) -> dict:
        params = {"page": page}
        if c.price_min is not None:
            params["priceMin"] = c.price_min
        if c.price_max is not None:
            params["priceMax"] = c.price_max
        if c.min_bedrooms:
            params["bedroomsMin"] = c.min_bedrooms
        return params


def _extract_estates(htmltext: str) -> List[dict]:
    """Pull the listings array out of Realo's embedded JSON, defensively."""
    for pat in _JSON_PATTERNS:
        m = pat.search(htmltext)
        if not m:
            continue
        try:
            blob = json.loads(m.group(1))
        except ValueError:
            continue
        estates = _find_estates(blob)
        if estates:
            return estates
    return []


def _find_estates(obj, _depth: int = 0) -> List[dict]:
    """Recursively look for a list of estate-like dicts in nested JSON."""
    if _depth > 8:
        return []
    if isinstance(obj, dict):
        for key in ("estates", "results", "listings", "items"):
            val = obj.get(key)
            if isinstance(val, list) and val and isinstance(val[0], dict):
                if any(k in val[0] for k in ("price", "id", "bedrooms", "geo")):
                    return val
        for v in obj.values():
            found = _find_estates(v, _depth + 1)
            if found:
                return found
    elif isinstance(obj, list):
        for v in obj:
            found = _find_estates(v, _depth + 1)
            if found:
                return found
    return []


def _parse(raw: dict) -> Optional[Listing]:
    listing_id = first(raw.get("id"), raw.get("estateId"))
    if listing_id is None:
        return None

    geo = raw.get("geo") or raw.get("location") or {}
    price = first(raw.get("price"), dig(raw, "price", "amount"))
    postal = first(geo.get("zip"), geo.get("postalCode"), raw.get("zip"))
    locality = first(geo.get("city"), geo.get("locality"), raw.get("city"))

    url = first(raw.get("url"), raw.get("permalink"))
    if url and url.startswith("/"):
        url = BASE + url
    if not url:
        url = f"{BASE}/en/{listing_id}"

    image = first(
        dig(raw, "thumbnail", "url"),
        raw.get("image"),
        (raw.get("images") or [None])[0],
    )

    cond_raw = raw.get("condition")
    condition = _CONDITION_MAP.get(str(cond_raw).strip().lower()) if cond_raw else None

    return Listing(
        source="realo",
        listing_id=str(listing_id),
        url=url,
        price=to_int(price),
        property_type="HOUSE",
        bedrooms=to_int(raw.get("bedrooms")),
        bathrooms=to_int(raw.get("bathrooms")),
        living_area=to_int(first(raw.get("livingArea"), raw.get("area"))),
        land_area=to_int(first(raw.get("groundArea"), raw.get("plotArea"))),
        garden_area=to_int(raw.get("gardenArea")),
        has_garden=raw.get("hasGarden"),
        condition=condition,
        postal_code=str(postal) if postal else None,
        locality=locality,
        province=first(geo.get("province"), raw.get("province")),
        image_url=image,
        title=" ".join(str(x) for x in ["House", locality, postal] if x).strip() or None,
        extra={},
    )
