#!/usr/bin/env python3
"""Belgian house search — command line entry point.

Searches one or more Belgian property portals (Immoweb, Zimmo, Immovlan,
Realo), applies your requirements, and writes an HTML report + CSV. Can also
email you only the *new* matches, for scheduled runs.

Examples
--------
  # Demo with built-in sample data (no network needed):
  python search.py --demo

  # Search ALL sources, write a report, open it:
  python search.py --sources all --open --csv results.csv

  # Just two sources, override a couple of criteria:
  python search.py --sources immoweb,zimmo --max-price 480000 --min-garden 2000

  # Scheduled email alerts: only emails listings not seen before.
  python search.py --sources all --email --email-to you@example.com
"""

from __future__ import annotations

import argparse
import sys
import webbrowser
from pathlib import Path

from house_search.aggregate import search_sources
from house_search.criteria import Criteria
from house_search.filtering import filter_listings, sort_listings
from house_search.providers import resolve_sources
from house_search.report import write_csv, write_html
from house_search import notify


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
    p = argparse.ArgumentParser(
        description="Find houses for sale in Belgium that match your requirements."
    )
    p.add_argument("--config", default="config.json", help="Path to criteria JSON (default: config.json)")
    p.add_argument("--demo", action="store_true", help="Use built-in sample data instead of live sites")
    p.add_argument(
        "--sources", default="all",
        help="Comma-separated sources or 'all': immoweb,zimmo,immovlan,realo (default: all)",
    )
    p.add_argument("--out", default="report.html", help="HTML report output path")
    p.add_argument("--csv", default=None, help="Optional CSV output path")
    p.add_argument("--open", action="store_true", help="Open the HTML report in a browser when done")

    p.add_argument("--postal-codes", help="Comma-separated postal codes (overrides config)")
    p.add_argument("--min-price", type=int)
    p.add_argument("--max-price", type=int)
    p.add_argument("--min-bedrooms", type=int)
    p.add_argument("--min-garden", type=int, help="Minimum garden/plot size in m²")
    p.add_argument("--sort-by", choices=["price", "garden", "living_area"])

    p.add_argument("--max-pages", type=int, default=10, help="Max result pages to fetch per source")
    p.add_argument("--delay", type=float, default=1.5, help="Seconds between requests")

    # Email alerts
    p.add_argument("--email", action="store_true", help="Email new matches (for scheduled runs)")
    p.add_argument("--email-to", help="Recipient(s), comma-separated (or set ALERT_TO)")
    p.add_argument("--state-file", default="seen.json", help="Where to track already-seen listings")
    args = p.parse_args(argv)

    criteria = build_criteria(args)
    print("Criteria:", criteria.describe())

    if args.demo:
        sources = ["sample"]
    else:
        try:
            sources = resolve_sources(args.sources)
        except ValueError as exc:
            print(f"Error: {exc}", file=sys.stderr)
            return 2
    print(f"Sources: {', '.join(sources)}")

    outcome = search_sources(
        sources, criteria, max_pages=args.max_pages, delay=args.delay
    )

    for src, n in outcome.counts.items():
        print(f"  {src}: {n} listings")
    for src, err in outcome.errors.items():
        print(f"  {src}: ERROR — {err}", file=sys.stderr)

    if not outcome.counts and outcome.errors:
        print("\nAll sources failed. Run with --demo to see the tool work offline.", file=sys.stderr)
        return 2

    matched = sort_listings(filter_listings(outcome.listings, criteria), criteria)
    print(f"\n{len(matched)} match your requirements (after de-duplication).")

    write_html(matched, args.out, criteria)
    print(f"HTML report: {args.out}")
    if args.csv:
        write_csv(matched, args.csv)
        print(f"CSV: {args.csv}")

    if args.email:
        _do_email(matched, args)

    if args.open:
        webbrowser.open(Path(args.out).resolve().as_uri())

    return 0


def _do_email(matched, args) -> None:
    recipients = notify.resolve_recipients(args.email_to)
    seen = notify.load_seen(args.state_file)
    new = notify.select_new(matched, seen)
    print(f"Email: {len(new)} new listing(s) since last run.")
    if not new:
        return
    try:
        notify.send_email(new, recipients)
        print(f"Sent email to {', '.join(recipients)}")
        seen.update(f"{l.source}:{l.listing_id}" for l in new)
        notify.save_seen(args.state_file, seen)
    except RuntimeError as exc:
        print(f"Email not sent: {exc}", file=sys.stderr)


if __name__ == "__main__":
    raise SystemExit(main())
