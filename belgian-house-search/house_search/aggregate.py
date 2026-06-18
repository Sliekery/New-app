"""Run several providers, combine their results, and de-duplicate.

The same physical house often appears on more than one portal. We can't rely
on a shared id across sites, so we de-duplicate with a fingerprint built from
the stable-ish attributes (locality, price, bedrooms, living area). When two
listings collide we keep the first and record the other's source/url so the
report can show "also on zimmo, realo".

Each provider runs independently: if one site is down or blocks us, the others
still produce results and the error is collected and reported.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Tuple

from .criteria import Criteria
from .models import Listing
from .providers import REGISTRY


@dataclass
class SearchOutcome:
    listings: List[Listing] = field(default_factory=list)
    errors: Dict[str, str] = field(default_factory=dict)   # source -> message
    counts: Dict[str, int] = field(default_factory=dict)   # source -> raw count


def _fingerprint(l: Listing) -> Tuple:
    """A key that should match the same property across different portals."""
    locality = (l.locality or "").strip().lower()
    # Round price to the nearest 1000 to absorb tiny cross-site differences.
    price_bucket = round(l.price / 1000) if l.price else None
    return (locality, price_bucket, l.bedrooms, l.living_area)


def dedupe(listings: List[Listing]) -> List[Listing]:
    seen: Dict[Tuple, Listing] = {}
    out: List[Listing] = []
    for l in listings:
        fp = _fingerprint(l)
        # Listings with no useful fingerprint are always kept.
        if fp == ("", None, None, None):
            out.append(l)
            continue
        if fp in seen:
            primary = seen[fp]
            primary.extra.setdefault("also_on", []).append(
                {"source": l.source, "url": l.url}
            )
            continue
        seen[fp] = l
        out.append(l)
    return out


def search_sources(
    source_names: List[str],
    criteria: Criteria,
    *,
    max_pages: int = 10,
    delay: float = 1.5,
) -> SearchOutcome:
    outcome = SearchOutcome()
    combined: List[Listing] = []

    for name in source_names:
        provider_cls = REGISTRY[name]
        try:
            # SampleProvider takes no args; live providers take paging args.
            if name == "sample":
                provider = provider_cls()
            else:
                provider = provider_cls(max_pages=max_pages, delay=delay)
            results = provider.search(criteria)
            outcome.counts[name] = len(results)
            combined.extend(results)
        except Exception as exc:  # isolate each source
            outcome.errors[name] = str(exc)

    outcome.listings = dedupe(combined)
    return outcome
