"""Immovlan provider (immovlan.be).

Immovlan is another major Belgian portal. Its search results are available as
JSON from an internal API used by the site's front-end. We page through it and
map each item to a `Listing`.

Best-effort, like the other providers: internal endpoint, defensive parsing,
isolated failures. Use IMMOVLAN_COOKIE to pass a fresh cookie if blocked.
"""

from __future__ import annotations

import time
from typing import List, Optional

import requests

from ..criteria import Criteria
from ..models import Listing
from .base import Provider
from .common import dig, first, make_session, to_int

SEARCH_URL = "https://www.immovlan.be/en/api/search/realestate"
PAGE_SIZE = 20

_CONDITION_MAP = {
    "excellent": "AS_NEW",
    "good": "GOOD",
    "new": "NEW",
    "as new": "AS_NEW",
    "renovated": "JUST_RENOVATED",
    "to renovate": "TO_RENOVATE",
    "to refresh": "TO_BE_DONE_UP",
    "to restore": "TO_RESTORE",
}


class ImmovlanProvider(Provider):
    name = "immovlan"

    def __init__(self, max_pages: int = 10, delay: float = 1.5, timeout: int = 20):
        self.max_pages = max_pages
        self.delay = delay
        self.timeout = timeout
        self.session = make_session(
            cookie_env="IMMOVLAN_COOKIE",
            referer="https://www.immovlan.be/en/real-estate",
        )

    def search(self, criteria: Criteria) -> List[Listing]:
        listings: List[Listing] = []
        for page in range(1, self.max_pages + 1):
            params = self._build_params(criteria, page)
            try:
                resp = self.session.get(SEARCH_URL, params=params, timeout=self.timeout)
            except requests.RequestException as exc:
                raise RuntimeError(f"Immovlan request failed: {exc}") from exc

            if resp.status_code in (401, 403):
                raise RuntimeError(
                    "Immovlan returned %s (blocked). Try IMMOVLAN_COOKIE or a higher --delay."
                    % resp.status_code
                )
            resp.raise_for_status()

            try:
                data = resp.json()
            except ValueError as exc:
                raise RuntimeError(
                    "Immovlan did not return JSON (endpoint shape may have changed)."
                ) from exc

            results = (
                data.get("results")
                or data.get("classifieds")
                or dig(data, "data", "items")
                or []
            )
            if not results:
                break

            for raw in results:
                parsed = _parse(raw)
                if parsed:
                    listings.append(parsed)

            if len(results) < PAGE_SIZE:
                break
            time.sleep(self.delay)

        return listings

    def _build_params(self, c: Criteria, page: int) -> dict:
        params = {
            "transactiontypes": "for-sale",
            "propertytypes": "house",
            "page": page,
            "noindex": 0,
        }
        if c.postal_codes:
            params["towns"] = ",".join(c.postal_codes)
        if c.price_min is not None:
            params["minprice"] = c.price_min
        if c.price_max is not None:
            params["maxprice"] = c.price_max
        if c.min_bedrooms:
            params["minbedrooms"] = c.min_bedrooms
        return params


def _parse(raw: dict) -> Optional[Listing]:
    listing_id = first(raw.get("id"), raw.get("classifiedId"), raw.get("reference"))
    if listing_id is None:
        return None

    price = first(
        raw.get("price"),
        dig(raw, "price", "value"),
        dig(raw, "transaction", "price"),
    )
    loc = raw.get("location") or raw
    postal = first(loc.get("zip"), loc.get("postalCode"), raw.get("zip"))
    locality = first(loc.get("city"), loc.get("locality"), raw.get("city"))

    url = first(raw.get("url"), raw.get("detailUrl"))
    if url and url.startswith("/"):
        url = "https://www.immovlan.be" + url
    if not url:
        url = f"https://www.immovlan.be/en/detail/{listing_id}"

    image = first(
        raw.get("mainImage"),
        dig(raw, "media", "mainImage", "url"),
        (raw.get("images") or [None])[0],
    )

    cond_raw = first(raw.get("condition"), dig(raw, "building", "condition"))
    condition = _CONDITION_MAP.get(str(cond_raw).strip().lower()) if cond_raw else None

    return Listing(
        source="immovlan",
        listing_id=str(listing_id),
        url=url,
        price=to_int(price),
        property_type="HOUSE",
        bedrooms=to_int(first(raw.get("bedrooms"), raw.get("bedroomCount"))),
        bathrooms=to_int(first(raw.get("bathrooms"), raw.get("bathroomCount"))),
        living_area=to_int(first(raw.get("livingArea"), raw.get("habitableSurface"))),
        land_area=to_int(first(raw.get("groundArea"), raw.get("landSurface"), raw.get("plotArea"))),
        garden_area=to_int(first(raw.get("gardenArea"), raw.get("gardenSurface"))),
        has_garden=first(raw.get("hasGarden"), raw.get("garden")),
        condition=condition,
        postal_code=str(postal) if postal else None,
        locality=locality,
        province=first(loc.get("province"), raw.get("province")),
        image_url=image,
        title=" ".join(str(x) for x in ["House", locality, postal] if x).strip() or None,
        extra={},
    )
