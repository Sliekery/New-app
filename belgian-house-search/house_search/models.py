"""Normalized data model for a property listing.

Every provider (Immoweb, etc.) maps its own raw response into a `Listing`
so the rest of the program (filtering, reporting) never has to care where
the data came from.
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Optional


@dataclass
class Listing:
    """A single house for sale, normalized across sources."""

    source: str                      # e.g. "immoweb"
    listing_id: str                  # provider-specific id
    url: str                         # link to the listing page
    price: Optional[int] = None      # asking price in EUR

    property_type: Optional[str] = None   # e.g. "HOUSE", "VILLA"
    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None

    living_area: Optional[int] = None     # netHabitableSurface, m²
    land_area: Optional[int] = None       # total plot, m²
    garden_area: Optional[int] = None     # garden surface, m² (if known)
    has_garden: Optional[bool] = None

    # Move-in readiness, e.g. "GOOD", "AS_NEW", "TO_RENOVATE", "TO_RESTORE".
    condition: Optional[str] = None

    postal_code: Optional[str] = None
    locality: Optional[str] = None
    province: Optional[str] = None

    image_url: Optional[str] = None
    title: Optional[str] = None

    # Anything provider-specific we want to keep around for debugging.
    extra: dict = field(default_factory=dict)

    @property
    def price_per_m2(self) -> Optional[int]:
        if self.price and self.living_area:
            return round(self.price / self.living_area)
        return None

    def to_dict(self) -> dict:
        d = asdict(self)
        d.pop("extra", None)
        d["price_per_m2"] = self.price_per_m2
        return d
