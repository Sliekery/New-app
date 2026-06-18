"""Listing providers and the registry used to look them up by name."""

from typing import Dict, List, Type

from .base import Provider
from .immoweb import ImmowebProvider
from .immovlan import ImmovlanProvider
from .realo import RealoProvider
from .sample import SampleProvider
from .zimmo import ZimmoProvider

# Name -> provider class. "sample" is intentionally excluded from "all".
REGISTRY: Dict[str, Type[Provider]] = {
    "immoweb": ImmowebProvider,
    "zimmo": ZimmoProvider,
    "immovlan": ImmovlanProvider,
    "realo": RealoProvider,
    "sample": SampleProvider,
}

# The live sources used when the user asks for "all".
LIVE_SOURCES: List[str] = ["immoweb", "zimmo", "immovlan", "realo"]


def resolve_sources(value: str) -> List[str]:
    """Turn a --sources value ('all' or 'immoweb,zimmo') into a name list."""
    if not value or value.lower() == "all":
        return list(LIVE_SOURCES)
    names = [v.strip().lower() for v in value.split(",") if v.strip()]
    unknown = [n for n in names if n not in REGISTRY]
    if unknown:
        raise ValueError(
            f"Unknown source(s): {', '.join(unknown)}. "
            f"Available: {', '.join(REGISTRY)} (or 'all')."
        )
    return names


__all__ = [
    "Provider",
    "ImmowebProvider",
    "ZimmoProvider",
    "ImmovlanProvider",
    "RealoProvider",
    "SampleProvider",
    "REGISTRY",
    "LIVE_SOURCES",
    "resolve_sources",
]
