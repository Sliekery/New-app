"""Apply the user's criteria to a list of listings.

The provider already narrows things server-side where possible (price,
postal code, type), but several requirements — big garden, move-in ready —
have to be checked here because the source data isn't always reliable or the
API doesn't support the filter precisely.
"""

from __future__ import annotations

from typing import List, Tuple

from .criteria import Criteria, FINISHED_CONDITIONS, UNFINISHED_CONDITIONS
from .models import Listing


def _effective_garden(listing: Listing) -> int:
    """Best available estimate of usable outdoor space, in m²."""
    if listing.garden_area:
        return listing.garden_area
    if listing.land_area:
        return listing.land_area
    return 0


def matches(listing: Listing, c: Criteria) -> Tuple[bool, str]:
    """Return (keep?, reason-if-rejected)."""

    if c.property_types and listing.property_type:
        if listing.property_type.upper() not in {t.upper() for t in c.property_types}:
            return False, f"type {listing.property_type} not wanted"

    if c.price_min is not None and listing.price is not None and listing.price < c.price_min:
        return False, f"price {listing.price} below min"
    if c.price_max is not None and listing.price is not None and listing.price > c.price_max:
        return False, f"price {listing.price} above max"

    if c.min_bedrooms and listing.bedrooms is not None and listing.bedrooms < c.min_bedrooms:
        return False, f"{listing.bedrooms} bedrooms < {c.min_bedrooms}"

    if c.min_bathrooms and listing.bathrooms is not None and listing.bathrooms < c.min_bathrooms:
        return False, f"{listing.bathrooms} bathrooms < {c.min_bathrooms}"

    if c.min_living_area and listing.living_area is not None:
        if listing.living_area < c.min_living_area:
            return False, f"living area {listing.living_area} < {c.min_living_area}"

    if c.min_land_area:
        plot = listing.land_area or listing.garden_area
        if not plot or plot < c.min_land_area:
            return False, f"plot {plot or 'unknown'} m² < {c.min_land_area}"

    if c.require_garden:
        garden = _effective_garden(listing)
        has = listing.has_garden
        # Explicitly no garden -> always out.
        if has is False:
            return False, "no garden"
        if c.min_garden_area:
            # We require a known garden/plot of at least the minimum. A listing
            # whose garden size is unknown can't be confirmed to meet it, so
            # it's excluded (this is the fix for "houses with no garden showing").
            if not garden or garden < c.min_garden_area:
                return False, f"garden {garden or 'unknown'} m² < {c.min_garden_area}"
        else:
            # No size requirement: need some evidence of a garden.
            if not garden and has is not True:
                return False, "garden not confirmed"

    if c.require_finished and listing.condition:
        cond = listing.condition.upper()
        if cond in UNFINISHED_CONDITIONS:
            return False, f"condition {listing.condition} not move-in ready"

    text = listing.search_text
    if c.include_keywords:
        wanted = [k.strip().lower() for k in c.include_keywords if k.strip()]
        if wanted and not any(k in text for k in wanted):
            return False, f"none of keywords {wanted} found"
    if c.exclude_keywords:
        for k in c.exclude_keywords:
            kk = k.strip().lower()
            if kk and kk in text:
                return False, f"excluded keyword '{kk}' found"

    return True, ""


def filter_listings(listings: List[Listing], c: Criteria) -> List[Listing]:
    return [l for l in listings if matches(l, c)[0]]


def sort_listings(listings: List[Listing], c: Criteria) -> List[Listing]:
    if c.sort_by == "price":
        return sorted(listings, key=lambda l: (l.price is None, l.price or 0))
    if c.sort_by == "living_area":
        return sorted(listings, key=lambda l: -(l.living_area or 0))
    # default: biggest garden first
    return sorted(listings, key=lambda l: -_effective_garden(l))
