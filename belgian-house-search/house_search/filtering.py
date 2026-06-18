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

    if listing.bedrooms is not None and listing.bedrooms < c.min_bedrooms:
        return False, f"{listing.bedrooms} bedrooms < {c.min_bedrooms}"

    if c.min_living_area and listing.living_area is not None:
        if listing.living_area < c.min_living_area:
            return False, f"living area {listing.living_area} < {c.min_living_area}"

    if c.require_garden:
        garden = _effective_garden(listing)
        # Treat an explicit has_garden=False as disqualifying.
        if listing.has_garden is False and not garden:
            return False, "no garden"
        if c.min_garden_area and garden and garden < c.min_garden_area:
            return False, f"garden {garden} m² < {c.min_garden_area}"

    if c.require_finished and listing.condition:
        cond = listing.condition.upper()
        if cond in UNFINISHED_CONDITIONS:
            return False, f"condition {listing.condition} not move-in ready"

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
