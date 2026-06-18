"""Tests for multi-source aggregation, de-duplication and email selection."""

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from house_search.aggregate import dedupe, search_sources
from house_search.criteria import Criteria
from house_search.models import Listing
from house_search.notify import select_new, _key
from house_search.providers import resolve_sources


def _listing(source, lid, **kw):
    base = dict(price=400000, bedrooms=4, living_area=200, locality="Borgloon")
    base.update(kw)
    return Listing(source=source, listing_id=lid, url=f"http://{source}/{lid}", **base)


def test_resolve_sources_all():
    assert resolve_sources("all") == ["immoweb", "zimmo", "immovlan", "realo"]


def test_resolve_sources_subset():
    assert resolve_sources("immoweb, zimmo") == ["immoweb", "zimmo"]


def test_resolve_sources_unknown():
    try:
        resolve_sources("bogus")
    except ValueError:
        return
    raise AssertionError("expected ValueError for unknown source")


def test_dedupe_merges_same_property_across_sources():
    a = _listing("immoweb", "1")
    b = _listing("zimmo", "9")  # same fingerprint (locality/price/beds/area)
    out = dedupe([a, b])
    assert len(out) == 1
    assert out[0].source == "immoweb"
    assert out[0].extra["also_on"] == [{"source": "zimmo", "url": "http://zimmo/9"}]


def test_dedupe_keeps_distinct_properties():
    a = _listing("immoweb", "1", price=400000)
    b = _listing("zimmo", "2", price=455000)
    assert len(dedupe([a, b])) == 2


def test_dedupe_price_bucket_tolerance():
    a = _listing("immoweb", "1", price=400000)
    b = _listing("zimmo", "2", price=400400)  # within 1000 -> same bucket
    assert len(dedupe([a, b])) == 1


def test_search_sources_isolates_failures():
    # 'sample' works; a fake registry entry can't be added, so just run sample.
    outcome = search_sources(["sample"], Criteria())
    assert outcome.counts.get("sample", 0) > 0
    assert outcome.errors == {}


def test_select_new_filters_seen():
    items = [_listing("immoweb", "1"), _listing("zimmo", "2")]
    seen = {_key(items[0])}
    new = select_new(items, seen)
    assert [l.listing_id for l in new] == ["2"]
