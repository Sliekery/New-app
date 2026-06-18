#!/usr/bin/env python3
"""Belgian house search — command line entry point.

Examples
--------
  # Demo with built-in sample data (no network needed):
  python search.py --demo

  # Real search using config.json, write a report:
  python search.py --config config.json --out report.html --csv results.csv

  # Override a couple of criteria on the fly:
  python search.py --max-price 480000 --min-bedrooms 4 --min-garden 2000
"""

from __future__ import annotations

import argparse
import sys
import webbrowser
from pathlib import Path

from house_search.criteria import Criteria
from house_search.filtering import filter_listings, sort_listings
from house_search.providers import ImmowebProvider, SampleProvider
from house_search.report import write_csv, write_html


def build_criteria(args) -> Criteria:
    if args.config and Path(args.config).exists():
        c = Criteria.from_file(args.config)
    else:
        c = Criteria()

    if args.postal_codes:
        c.postal_codes = [p.strip() for p in args.postal_codes.split(",") if p.strip()]
    if args.min_price is not None:
        c.price_min = args.min_price
    if args.max_price is not None:
        c.price_max = args.max_price
    if args.min_bedrooms is not None:
        c.min_bedrooms = args.min_bedrooms
    if args.min_garden is not None:
        c.min_garden_area = args.min_garden
    if args.sort_by:
        c.sort_by = args.sort_by
    return c


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="Find houses for sale in Belgium that match your requirements.")
    p.add_argument("--config", default="config.json", help="Path to criteria JSON (default: config.json)")
    p.add_argument("--demo", action="store_true", help="Use built-in sample data instead of fetching from Immoweb")
    p.add_argument("--out", default="report.html", help="HTML report output path")
    p.add_argument("--csv", default=None, help="Optional CSV output path")
    p.add_argument("--open", action="store_true", help="Open the HTML report in a browser when done")

    p.add_argument("--postal-codes", help="Comma-separated postal codes (overrides config)")
    p.add_argument("--min-price", type=int)
    p.add_argument("--max-price", type=int)
    p.add_argument("--min-bedrooms", type=int)
    p.add_argument("--min-garden", type=int, help="Minimum garden/plot size in m²")
    p.add_argument("--sort-by", choices=["price", "garden", "living_area"])

    p.add_argument("--max-pages", type=int, default=10, help="Max Immoweb result pages to fetch")
    p.add_argument("--delay", type=float, default=1.5, help="Seconds between Immoweb requests")
    args = p.parse_args(argv)

    criteria = build_criteria(args)
    print("Criteria:", criteria.describe())

    provider = SampleProvider() if args.demo else ImmowebProvider(
        max_pages=args.max_pages, delay=args.delay
    )
    print(f"Searching via: {provider.name} ...")

    try:
        raw = provider.search(criteria)
    except RuntimeError as exc:
        print(f"\nError: {exc}", file=sys.stderr)
        print("Tip: run with --demo to see the tool work offline.", file=sys.stderr)
        return 2

    print(f"Fetched {len(raw)} listings; applying filters ...")
    matched = sort_listings(filter_listings(raw, criteria), criteria)
    print(f"{len(matched)} match your requirements.")

    write_html(matched, args.out, criteria)
    print(f"HTML report: {args.out}")
    if args.csv:
        write_csv(matched, args.csv)
        print(f"CSV: {args.csv}")

    if args.open:
        webbrowser.open(Path(args.out).resolve().as_uri())

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
