"""Sample/demo provider.

Returns a fixed set of fictional listings around Borgloon so you can try the
tool, see the report format, and run the tests without any network access.
The data is invented for demonstration — none of these are real listings.
"""

from __future__ import annotations

from typing import List

from ..criteria import Criteria
from ..models import Listing
from .base import Provider

_SAMPLE: List[Listing] = [
    Listing(
        source="sample", listing_id="demo-1",
        url="https://example.com/demo-1",
        price=389_000, property_type="HOUSE", bedrooms=4, bathrooms=2,
        living_area=210, land_area=2200, garden_area=1900, has_garden=True,
        condition="GOOD", postal_code="3840", locality="Borgloon",
        province="Limburg", image_url=None,
        title="Detached house with large garden, Borgloon",
    ),
    Listing(
        source="sample", listing_id="demo-2",
        url="https://example.com/demo-2",
        price=445_000, property_type="VILLA", bedrooms=3, bathrooms=2,
        living_area=240, land_area=3100, garden_area=2700, has_garden=True,
        condition="AS_NEW", postal_code="3870", locality="Heers",
        province="Limburg", image_url=None,
        title="Modern villa, very big plot, Heers",
    ),
    Listing(  # rejected: needs renovation
        source="sample", listing_id="demo-3",
        url="https://example.com/demo-3",
        price=325_000, property_type="HOUSE", bedrooms=4, bathrooms=1,
        living_area=180, land_area=2500, garden_area=2200, has_garden=True,
        condition="TO_RENOVATE", postal_code="3840", locality="Borgloon",
        province="Limburg",
        title="Farmhouse to renovate, Borgloon",
    ),
    Listing(  # rejected: garden too small
        source="sample", listing_id="demo-4",
        url="https://example.com/demo-4",
        price=410_000, property_type="HOUSE", bedrooms=3, bathrooms=2,
        living_area=160, land_area=600, garden_area=400, has_garden=True,
        condition="GOOD", postal_code="3700", locality="Tongeren",
        province="Limburg",
        title="Townhouse with small garden, Tongeren",
    ),
    Listing(  # rejected: too few bedrooms
        source="sample", listing_id="demo-5",
        url="https://example.com/demo-5",
        price=360_000, property_type="HOUSE", bedrooms=2, bathrooms=1,
        living_area=120, land_area=1800, garden_area=1700, has_garden=True,
        condition="GOOD", postal_code="3720", locality="Kortessem",
        province="Limburg",
        title="Cottage, 2 bedrooms, Kortessem",
    ),
    Listing(  # rejected: over budget
        source="sample", listing_id="demo-6",
        url="https://example.com/demo-6",
        price=620_000, property_type="VILLA", bedrooms=5, bathrooms=3,
        living_area=320, land_area=4000, garden_area=3500, has_garden=True,
        condition="AS_NEW", postal_code="3800", locality="Sint-Truiden",
        province="Limburg",
        title="Luxury villa, Sint-Truiden",
    ),
    Listing(
        source="sample", listing_id="demo-7",
        url="https://example.com/demo-7",
        price=475_000, property_type="HOUSE", bedrooms=4, bathrooms=2,
        living_area=230, land_area=1700, garden_area=1600, has_garden=True,
        condition="JUST_RENOVATED", postal_code="3730", locality="Hoeselt",
        province="Limburg",
        title="Renovated house with garden, Hoeselt",
    ),
]


class SampleProvider(Provider):
    name = "sample"

    def search(self, criteria: Criteria) -> List[Listing]:
        return list(_SAMPLE)
