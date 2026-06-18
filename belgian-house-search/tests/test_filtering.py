"""Tests for the filtering logic, using the sample provider."""

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from house_search.criteria import Criteria
from house_search.filtering import filter_listings, matches, sort_listings
from house_search.models import Listing
from house_search.providers import SampleProvider


def default_criteria():
    return Criteria()  # Borgloon defaults: 300-500k, 3 bed, garden 1500m², finished


def test_sample_matches_expected_count():
    c = default_criteria()
    listings = SampleProvider().search(c)
    matched = filter_listings(listings, c)
    ids = {l.listing_id for l in matched}
    # demo-1, demo-2, demo-7 should pass; the rest are rejected for a reason.
    assert ids == {"demo-1", "demo-2", "demo-7"}, ids


def test_rejects_unfinished():
    c = default_criteria()
    l = Listing(source="x", listing_id="r", url="", price=400000,
                property_type="HOUSE", bedrooms=4, land_area=2000,
                garden_area=2000, has_garden=True, condition="TO_RENOVATE")
    ok, reason = matches(l, c)
    assert not ok and "move-in" in reason


def test_rejects_small_garden():
    c = default_criteria()
    l = Listing(source="x", listing_id="r", url="", price=400000,
                property_type="HOUSE", bedrooms=4, garden_area=500,
                has_garden=True, condition="GOOD")
    ok, reason = matches(l, c)
    assert not ok and "garden" in reason


def test_rejects_too_few_bedrooms():
    c = default_criteria()
    l = Listing(source="x", listing_id="r", url="", price=400000,
                property_type="HOUSE", bedrooms=2, garden_area=2000,
                has_garden=True, condition="GOOD")
    ok, _ = matches(l, c)
    assert not ok


def test_price_bounds():
    c = default_criteria()
    over = Listing(source="x", listing_id="o", url="", price=600000,
                   property_type="HOUSE", bedrooms=4, garden_area=2000,
                   has_garden=True, condition="GOOD")
    under = Listing(source="x", listing_id="u", url="", price=200000,
                    property_type="HOUSE", bedrooms=4, garden_area=2000,
                    has_garden=True, condition="GOOD")
    assert not matches(over, c)[0]
    assert not matches(under, c)[0]


def test_sort_by_garden_descending():
    c = default_criteria()
    matched = sort_listings(filter_listings(SampleProvider().search(c), c), c)
    gardens = [(l.garden_area or l.land_area or 0) for l in matched]
    assert gardens == sorted(gardens, reverse=True)
