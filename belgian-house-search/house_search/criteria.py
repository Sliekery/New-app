"""Search criteria: what counts as a house worth looking at.

Loaded from a JSON config file (see config.json) and/or overridden on the
command line.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import List, Optional

from .models import Listing


# Conditions we consider "move-in ready" (a finished house).
FINISHED_CONDITIONS = {
    "AS_NEW",
    "JUST_RENOVATED",
    "GOOD",
    "NEW",
}

# Conditions that clearly mean "needs work" — excluded when require_finished.
UNFINISHED_CONDITIONS = {
    "TO_RENOVATE",
    "TO_RESTORE",
    "TO_BE_DONE_UP",
}


@dataclass
class Criteria:
    """Everything the user is looking for."""

    # Location: list of Belgian postal codes to search (Borgloon + neighbours).
    postal_codes: List[str] = field(default_factory=lambda: [
        "3840",  # Borgloon
        "3870",  # Heers
        "3720",  # Kortessem
        "3730",  # Hoeselt
        "3700",  # Tongeren
        "3800",  # Sint-Truiden
    ])

    price_min: Optional[int] = 300_000
    price_max: Optional[int] = 500_000

    min_bedrooms: int = 3

    # House only (no apartments / flats).
    property_types: List[str] = field(default_factory=lambda: ["HOUSE", "VILLA"])

    require_garden: bool = True
    # "Very big garden": minimum garden / land surface in m².
    min_garden_area: int = 1500

    # Only finished / move-in-ready houses.
    require_finished: bool = True

    min_living_area: Optional[int] = None  # optional m² floor

    # How to sort results in the report: "price", "garden", "living_area".
    sort_by: str = "garden"

    # ---- loading -------------------------------------------------------

    @classmethod
    def from_file(cls, path: str) -> "Criteria":
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})

    def describe(self) -> str:
        parts = [
            f"Postal codes: {', '.join(self.postal_codes)}",
            f"Price: {_eur(self.price_min)} – {_eur(self.price_max)}",
            f"Min bedrooms: {self.min_bedrooms}",
            f"Type: {', '.join(self.property_types)}",
        ]
        if self.require_garden:
            parts.append(f"Garden required (min {self.min_garden_area} m²)")
        if self.require_finished:
            parts.append("Move-in ready only")
        if self.min_living_area:
            parts.append(f"Min living area: {self.min_living_area} m²")
        return " | ".join(parts)


def _eur(value: Optional[int]) -> str:
    return f"€{value:,.0f}".replace(",", ".") if value else "—"
