"""Zimmo provider (zimmo.be).

Zimmo is a large Belgian portal. Its results are loaded by the front-end from
an internal search API that accepts a JSON filter body and returns a JSON list
of "realEstateProperties". We post one request per page and map the results.

Best-effort, like the Immoweb provider: this is an internal endpoint, so the
exact request/response shape can drift. The parsing is defensive — unknown
fields become None rather than crashing — and the multi-source aggregator
isolates failures, so if Zimmo changes its API the other sources still work.

If you get blocked or get HTML back, paste a fresh cookie via the
ZIMMO_COOKIE environment variable. The mapping lives in `_parse`.
"""

from __future__ import annotations

import time
from typing import List, Optional

import requests

from ..criteria import Criteria
from ..models import Listing
from .base import Provider
from .common import dig, first, make_session, to_int

# Zimmo's front-end calls this internal search endpoint.
SEARCH_URL = "https://www.zimmo.be/nl/zoeken/api/search/"
PAGE_SIZE = 30

# Zimmo condition labels (NL) -> our normalized codes.
_CONDITION_MAP = {
    "instapklaar": "GOOD",
    "uitstekend": "AS_NEW",
    "nieuw": "NEW",
    "gerenoveerd": "JUST_RENOVATED",
    "te renoveren": "TO_RENOVATE",
    "op te frissen": "TO_BE_DONE_UP",
}


class ZimmoProvider(Provider):
    name = "zimmo"

    def __init__(self, max_pages: int = 10, delay: float = 1.5, timeout: int = 20):
        self.max_pages = max_pages
        self.delay = delay
        self.timeout = timeout
        self.session = make_session(
            cookie_env="ZIMMO_COOKIE",
            referer="https://www.zimmo.be/nl/zoeken/",
        )

    def search(self, criteria: Criteria) -> List[Listing]:
        listings: List[Listing] = []
        for page in range(self.max_pages):
            body = self._build_body(criteria, page)
            try:
                resp = self.session.post(SEARCH_URL, json=body, timeout=self.timeout)
            except requests.RequestException as exc:
                raise RuntimeError(f"Zimmo request failed: {exc}") from exc

            if resp.status_code in (401, 403):
                raise RuntimeError(
                    "Zimmo returned %s (blocked). Try ZIMMO_COOKIE or a higher --delay."
                    % resp.status_code
                )
            resp.raise_for_status()

            try:
                data = resp.json()
            except ValueError as exc:
                raise RuntimeError(
                    "Zimmo did not return JSON (endpoint shape may have changed)."
                ) from exc

            results = (
                data.get("realEstateProperties")
                or data.get("results")
                or dig(data, "data", "properties")
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

    def _build_body(self, c: Criteria, page: int) -> dict:
        filt: dict = {
            "category": "HOUSE",
            "transactionType": "FOR_SALE",
            "pagingOptions": {"page": page, "size": PAGE_SIZE},
            "sortType": "RELEVANCE",
        }
        if c.postal_codes:
            filt["zips"] = list(c.postal_codes)
        price = {}
        if c.price_min is not None:
            price["min"] = c.price_min
        if c.price_max is not None:
            price["max"] = c.price_max
        if price:
            filt["price"] = price
        if c.min_bedrooms:
            filt["bedrooms"] = {"min": c.min_bedrooms}
        return filt


def _parse(raw: dict) -> Optional[Listing]:
    listing_id = first(raw.get("id"), raw.get("propertyId"), dig(raw, "property", "id"))
    if listing_id is None:
        return None

    prop = raw.get("property") or raw
    price = first(
        dig(raw, "priceRaw"),
        dig(raw, "price", "amount"),
        raw.get("price"),
        dig(prop, "price"),
    )
    postal = first(dig(prop, "zip"), dig(prop, "location", "zip"), raw.get("zip"))
    locality = first(dig(prop, "city"), dig(prop, "location", "city"), raw.get("city"))

    url = first(raw.get("url"), prop.get("url"))
    if url and url.startswith("/"):
        url = "https://www.zimmo.be" + url
    if not url:
        url = f"https://www.zimmo.be/nl/{listing_id}/"

    image = first(
        dig(raw, "mainImage", "url"),
        dig(prop, "mainPicture"),
        (raw.get("images") or [None])[0],
    )

    cond_raw = first(prop.get("condition"), raw.get("condition"))
    condition = _CONDITION_MAP.get(str(cond_raw).strip().lower()) if cond_raw else None

    return Listing(
        source="zimmo",
        listing_id=str(listing_id),
        url=url,
        price=to_int(price),
        property_type="HOUSE",
        bedrooms=to_int(first(prop.get("bedrooms"), raw.get("bedrooms"))),
        bathrooms=to_int(first(prop.get("bathrooms"), raw.get("bathrooms"))),
        living_area=to_int(first(prop.get("livingArea"), raw.get("livingArea"))),
        land_area=to_int(first(prop.get("groundArea"), prop.get("plotArea"), raw.get("groundArea"))),
        garden_area=to_int(first(prop.get("gardenArea"), raw.get("gardenArea"))),
        has_garden=first(prop.get("hasGarden"), raw.get("hasGarden")),
        condition=condition,
        postal_code=str(postal) if postal else None,
        locality=locality,
        province=first(dig(prop, "province"), raw.get("province")),
        image_url=image,
        title=" ".join(str(x) for x in ["House", locality, postal] if x).strip() or None,
        extra={},
    )
