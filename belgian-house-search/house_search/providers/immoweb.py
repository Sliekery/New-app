"""Immoweb provider.

Immoweb (immoweb.be) is the largest property portal in Belgium. Its search
page content-negotiates: requesting the search-results URL with
`Accept: application/json` returns a JSON payload with a `results` array
instead of HTML. We page through that and map each result into a `Listing`.

Notes / caveats
---------------
* This is Immoweb's internal endpoint, not a documented public API, so the
  shape can change. The mapping below is defensive — missing fields just
  become None rather than crashing.
* Immoweb sits behind Cloudflare. From a normal residential connection with
  the headers below it generally works; from datacenter IPs it may return
  403. If you get blocked, run from your own machine, slow the request rate
  (`--delay`), or paste a fresh `cf_clearance` cookie via the IMMOWEB_COOKIE
  environment variable.
* Be a good citizen: this is for personal use. Keep the request volume low.
"""

from __future__ import annotations

import time
from typing import List, Optional

import requests

from ..criteria import Criteria
from ..models import Listing
from .base import Provider
from .common import dig as _dig, make_session, to_int as _to_int

SEARCH_URL = "https://www.immoweb.be/en/search-results/house/for-sale"


class ImmowebProvider(Provider):
    name = "immoweb"

    def __init__(self, max_pages: int = 10, delay: float = 1.5, timeout: int = 20):
        self.max_pages = max_pages
        self.delay = delay
        self.timeout = timeout
        self.session = make_session(
            cookie_env="IMMOWEB_COOKIE",
            referer="https://www.immoweb.be/en/search/house/for-sale",
        )

    def search(self, criteria: Criteria) -> List[Listing]:
        listings: List[Listing] = []
        params_base = {
            "countries": "BE",
            "orderBy": "newest",
        }
        if criteria.postal_codes:
            params_base["postalCodes"] = ",".join(criteria.postal_codes)
        if criteria.price_min is not None:
            params_base["minPrice"] = criteria.price_min
        if criteria.price_max is not None:
            params_base["maxPrice"] = criteria.price_max
        if criteria.min_bedrooms:
            params_base["minBedroomCount"] = criteria.min_bedrooms

        for page in range(1, self.max_pages + 1):
            params = dict(params_base, page=page)
            try:
                resp = self.session.get(SEARCH_URL, params=params, timeout=self.timeout)
            except requests.RequestException as exc:
                raise RuntimeError(f"Immoweb request failed: {exc}") from exc

            if resp.status_code == 403:
                raise RuntimeError(
                    "Immoweb returned 403 (blocked by Cloudflare). Try running "
                    "from your own machine, increasing --delay, or setting the "
                    "IMMOWEB_COOKIE environment variable with a fresh cookie."
                )
            resp.raise_for_status()

            try:
                data = resp.json()
            except ValueError as exc:
                raise RuntimeError(
                    "Immoweb did not return JSON (the endpoint shape may have "
                    "changed, or Cloudflare served an HTML challenge)."
                ) from exc

            results = data.get("results") or []
            if not results:
                break

            for raw in results:
                parsed = _parse(raw)
                if parsed:
                    listings.append(parsed)

            total_pages = _dig(data, "totalPages") or _dig(data, "pages")
            if total_pages and page >= int(total_pages):
                break

            time.sleep(self.delay)

        return listings


# --------------------------------------------------------------------------
# Mapping helpers
# --------------------------------------------------------------------------

def _parse(raw: dict) -> Optional[Listing]:
    listing_id = raw.get("id")
    if listing_id is None:
        return None

    prop = raw.get("property") or {}
    location = prop.get("location") or {}
    price = _dig(raw, "price", "mainValue") or _dig(raw, "transaction", "sale", "price")

    image = None
    media = raw.get("media") or {}
    pictures = media.get("pictures") or []
    if pictures:
        image = pictures[0].get("largeUrl") or pictures[0].get("smallUrl")

    locality = location.get("locality")
    postal = str(location.get("postalCode")) if location.get("postalCode") else None

    return Listing(
        source="immoweb",
        listing_id=str(listing_id),
        url=f"https://www.immoweb.be/en/classified/{listing_id}",
        price=_to_int(price),
        property_type=(prop.get("type") or "").upper() or None,
        bedrooms=_to_int(prop.get("bedroomCount")),
        bathrooms=_to_int(prop.get("bathroomCount")),
        living_area=_to_int(prop.get("netHabitableSurface")),
        land_area=_to_int(prop.get("landSurface")),
        garden_area=_to_int(prop.get("gardenSurface")),
        has_garden=prop.get("hasGarden"),
        condition=_dig(prop, "building", "condition") or prop.get("condition"),
        postal_code=postal,
        locality=locality,
        province=location.get("province"),
        image_url=image,
        title=" ".join(
            x for x in [prop.get("type"), locality, postal] if x
        ).strip() or None,
        extra={},
    )
