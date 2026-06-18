"""Shared helpers for HTTP-based providers."""

from __future__ import annotations

import os
from typing import Any, Optional

import requests

BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9,nl;q=0.8,fr;q=0.7",
}


def make_session(cookie_env: Optional[str] = None, referer: Optional[str] = None) -> requests.Session:
    """Build a requests session with browser-like headers.

    If `cookie_env` names an environment variable that is set, its value is
    sent as the Cookie header (handy for pasting a fresh Cloudflare cookie).
    """
    s = requests.Session()
    s.headers.update(BROWSER_HEADERS)
    if referer:
        s.headers["Referer"] = referer
    if cookie_env:
        cookie = os.environ.get(cookie_env)
        if cookie:
            s.headers["Cookie"] = cookie
    return s


def dig(obj: Any, *path) -> Any:
    """Safely walk nested dict/list structures; None if any step is missing."""
    cur = obj
    for key in path:
        if isinstance(cur, dict):
            cur = cur.get(key)
        elif isinstance(cur, list) and isinstance(key, int):
            cur = cur[key] if -len(cur) <= key < len(cur) else None
        else:
            return None
    return cur


def to_int(value: Any) -> Optional[int]:
    """Coerce loosely-typed numbers ('395.000', '395000', 395000.0) to int."""
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        try:
            return int(round(value))
        except (TypeError, ValueError):
            return None
    if isinstance(value, str):
        cleaned = (
            value.replace(" ", "")
            .replace("\xa0", "")
            .replace("€", "")
            .replace(" ", "")
            .replace(".", "")
            .replace(",", ".")
            .strip()
        )
        try:
            return int(round(float(cleaned)))
        except ValueError:
            return None
    return None


def first(*values) -> Any:
    """Return the first non-None, non-empty value."""
    for v in values:
        if v not in (None, "", []):
            return v
    return None
