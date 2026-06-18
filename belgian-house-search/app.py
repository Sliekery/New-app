#!/usr/bin/env python3
"""Belgian House Search — local web app.

Run this and a friendly page opens in your browser where you fill in a form
(location, price, bedrooms, garden, which sites to search) and click Search.
No command line knowledge needed — use the Start launcher for your computer.

Technically: a tiny web server built on Python's standard library (so the only
thing to install is `requests`). It serves a search form and renders results
using the same card layout as the saved HTML report.
"""

from __future__ import annotations

import html
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from house_search.aggregate import search_sources
from house_search.criteria import Criteria
from house_search.filtering import filter_listings, sort_listings
from house_search.providers import LIVE_SOURCES, resolve_sources
from house_search.report import CARD_STYLE, render_cards

HOST = "127.0.0.1"
PORT = 8765
CONFIG_PATH = str(Path(__file__).resolve().parent / "config.json")

SOURCE_LABELS = {
    "immoweb": "Immoweb",
    "zimmo": "Zimmo",
    "immovlan": "Immovlan",
    "realo": "Realo",
}


# --------------------------------------------------------------------------
# Building criteria from the submitted form
# --------------------------------------------------------------------------

def _load_defaults() -> Criteria:
    if Path(CONFIG_PATH).exists():
        return Criteria.from_file(CONFIG_PATH)
    return Criteria()


def _get(params, key, default=""):
    vals = params.get(key)
    return vals[0].strip() if vals and vals[0].strip() else default


def _get_int(params, key, default=None):
    raw = _get(params, key)
    if raw == "":
        return default
    try:
        return int(float(raw.replace(".", "").replace(",", "")))
    except ValueError:
        return default


def criteria_from_form(params) -> Criteria:
    c = _load_defaults()
    postal = _get(params, "postal_codes")
    if postal:
        c.postal_codes = [p.strip() for p in postal.replace(";", ",").split(",") if p.strip()]
    c.price_min = _get_int(params, "price_min", c.price_min)
    c.price_max = _get_int(params, "price_max", c.price_max)
    c.min_bedrooms = _get_int(params, "min_bedrooms", c.min_bedrooms) or 0
    c.min_garden_area = _get_int(params, "min_garden", c.min_garden_area) or 0
    c.require_garden = "require_garden" in params
    c.require_finished = "require_finished" in params
    sort_by = _get(params, "sort_by")
    if sort_by in {"garden", "price", "living_area"}:
        c.sort_by = sort_by
    return c


# --------------------------------------------------------------------------
# HTML
# --------------------------------------------------------------------------

EXTRA_STYLE = """
  form.search { background:#fff; border-radius:12px; padding:20px; margin-bottom:20px;
                box-shadow:0 1px 3px rgba(0,0,0,.08); }
  .row { display:grid; gap:14px; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); }
  label { display:block; font-size:13px; color:var(--muted); margin-bottom:4px; }
  input[type=text], input[type=number], select {
      width:100%; padding:8px 10px; border:1px solid #d4dae0; border-radius:8px; font-size:14px; }
  fieldset { border:1px solid #e1e6ea; border-radius:8px; margin:14px 0 0; padding:10px 14px; }
  legend { font-size:12px; color:var(--muted); padding:0 6px; }
  .checks { display:flex; flex-wrap:wrap; gap:14px; }
  .checks label { display:flex; align-items:center; gap:6px; margin:0; color:var(--ink); font-size:14px; }
  .actions { margin-top:16px; display:flex; gap:12px; align-items:center; }
  button { background:var(--accent); color:#fff; border:0; border-radius:8px;
           padding:11px 22px; font-size:15px; cursor:pointer; }
  button:hover { filter:brightness(1.05); }
  .hint { font-size:12px; color:var(--muted); }
  .notice { background:#fff5e6; border:1px solid #ffd591; color:#7a4b00;
            padding:10px 14px; border-radius:8px; margin-bottom:16px; font-size:13px; }
  .summary { margin:0 0 14px; font-size:14px; color:var(--muted); }
"""


def _checkbox(name, label, checked):
    c = "checked" if checked else ""
    return f'<label><input type="checkbox" name="{name}" {c}> {label}</label>'


def _source_checks(selected) -> str:
    items = []
    for key in LIVE_SOURCES:
        c = "checked" if key in selected else ""
        items.append(
            f'<label><input type="checkbox" name="sources" value="{key}" {c}> '
            f'{SOURCE_LABELS[key]}</label>'
        )
    items.append(
        '<label title="Use built-in example data — works without internet">'
        '<input type="checkbox" name="sources" value="sample"> Demo (example data)</label>'
    )
    return '<div class="checks">' + "".join(items) + "</div>"


def render_form(c: Criteria, selected_sources) -> str:
    pc = html.escape(", ".join(c.postal_codes))
    return f"""
  <form class="search" method="get" action="/search">
    <div class="row">
      <div>
        <label>Location (Belgian postal codes, comma-separated)</label>
        <input type="text" name="postal_codes" value="{pc}" placeholder="3840, 3870, 3700">
      </div>
      <div>
        <label>Min price (€)</label>
        <input type="number" name="price_min" value="{c.price_min or ''}" step="10000">
      </div>
      <div>
        <label>Max price (€)</label>
        <input type="number" name="price_max" value="{c.price_max or ''}" step="10000">
      </div>
    </div>
    <div class="row" style="margin-top:14px">
      <div>
        <label>Minimum bedrooms</label>
        <input type="number" name="min_bedrooms" value="{c.min_bedrooms}" min="0">
      </div>
      <div>
        <label>Minimum garden / plot (m²)</label>
        <input type="number" name="min_garden" value="{c.min_garden_area}" step="100">
      </div>
      <div>
        <label>Sort results by</label>
        <select name="sort_by">
          <option value="garden" {_sel(c.sort_by,'garden')}>Biggest garden first</option>
          <option value="price" {_sel(c.sort_by,'price')}>Lowest price first</option>
          <option value="living_area" {_sel(c.sort_by,'living_area')}>Most living space first</option>
        </select>
      </div>
    </div>
    <fieldset>
      <legend>Requirements</legend>
      <div class="checks">
        {_checkbox('require_garden', 'Must have a garden', c.require_garden)}
        {_checkbox('require_finished', 'Move-in ready only (no renovation projects)', c.require_finished)}
      </div>
    </fieldset>
    <fieldset>
      <legend>Where to search</legend>
      {_source_checks(selected_sources)}
    </fieldset>
    <div class="actions">
      <button type="submit">🔍 Search houses</button>
      <span class="hint">Searching several sites can take up to a minute.</span>
    </div>
  </form>"""


def _sel(current, value):
    return "selected" if current == value else ""


def page(body: str, title: str = "Belgian House Search") -> bytes:
    doc = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)}</title>
<style>{CARD_STYLE}{EXTRA_STYLE}</style>
</head>
<body>
  <header>
    <h1>🏡 Belgian House Search</h1>
    <div class="meta">Find houses for sale that match your requirements</div>
  </header>
  <div class="wrap">
    {body}
  </div>
</body>
</html>"""
    return doc.encode("utf-8")


def run_search_page(params) -> bytes:
    criteria = criteria_from_form(params)
    selected = params.get("sources") or list(LIVE_SOURCES)

    if "sample" in selected:
        sources = ["sample"]
    else:
        try:
            sources = resolve_sources(",".join(selected))
        except ValueError:
            sources = list(LIVE_SOURCES)

    outcome = search_sources(sources, criteria, max_pages=10, delay=1.5)
    matched = sort_listings(filter_listings(outcome.listings, criteria), criteria)

    notice = ""
    if outcome.errors:
        problems = "; ".join(
            f"{SOURCE_LABELS.get(s, s)}: {msg}" for s, msg in outcome.errors.items()
        )
        notice = (
            f'<div class="notice"><b>Some sites couldn\'t be searched.</b> {html.escape(problems)}'
            "<br>The results below are from the sites that worked. "
            "Tip: try again, untick the failing site, or run from your home internet.</div>"
        )

    summary = (
        f'<p class="summary">Found <b>{len(matched)}</b> matching houses · '
        f'searched: {", ".join(SOURCE_LABELS.get(s, s) for s in sources)}</p>'
    )
    body = (
        render_form(criteria, selected)
        + notice
        + summary
        + render_cards(matched)
    )
    return page(body, f"{len(matched)} houses found")


def home_page() -> bytes:
    c = _load_defaults()
    body = (
        '<p class="summary">Set your filters and click search. '
        "It searches Immoweb, Zimmo, Immovlan and Realo at once and removes duplicates.</p>"
        + render_form(c, list(LIVE_SOURCES))
    )
    return page(body)


# --------------------------------------------------------------------------
# Server
# --------------------------------------------------------------------------

class Handler(BaseHTTPRequestHandler):
    def _send(self, content: bytes, status: int = 200):
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path in ("/", "/index.html"):
            self._send(home_page())
        elif parsed.path == "/search":
            params = parse_qs(parsed.query, keep_blank_values=False)
            try:
                self._send(run_search_page(params))
            except Exception as exc:  # never crash the page
                self._send(page(
                    f'<div class="notice">Something went wrong: {html.escape(str(exc))}</div>'
                    '<p><a href="/">← Back to search</a></p>'
                ), status=500)
        elif parsed.path == "/favicon.ico":
            self._send(b"", status=204)
        else:
            self._send(page('<p>Not found. <a href="/">Go to search</a></p>'), status=404)

    def log_message(self, *args):  # keep the console quiet
        pass


def main():
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    url = f"http://{HOST}:{PORT}/"
    print("=" * 56)
    print("  Belgian House Search is running!")
    print(f"  Open this in your browser:  {url}")
    print("  (Keep this window open while you use it.)")
    print("  To stop: close this window or press Ctrl+C.")
    print("=" * 56)
    threading.Timer(1.0, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped. Goodbye!")
        server.shutdown()


if __name__ == "__main__":
    main()
