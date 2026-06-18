"""Turn matched listings into a CSV file and a browsable HTML report."""

from __future__ import annotations

import csv
import datetime as _dt
import html
from typing import List, Optional

from .criteria import Criteria
from .models import Listing

CSV_FIELDS = [
    "source", "listing_id", "price", "price_per_m2", "property_type",
    "bedrooms", "bathrooms", "living_area", "land_area", "garden_area",
    "condition", "postal_code", "locality", "province", "url",
]


def write_csv(listings: List[Listing], path: str) -> None:
    with open(path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=CSV_FIELDS, extrasaction="ignore")
        writer.writeheader()
        for l in listings:
            writer.writerow(l.to_dict())


def _eur(value: Optional[int]) -> str:
    if not value:
        return "—"
    return ("€{:,.0f}".format(value)).replace(",", ".")


def _m2(value: Optional[int]) -> str:
    return f"{value:,} m²".replace(",", ".") if value else "—"


def _source_badges(l: Listing) -> str:
    sources = [l.source] + [a.get("source") for a in l.extra.get("also_on", [])]
    seen, ordered = set(), []
    for s in sources:
        if s and s not in seen:
            seen.add(s)
            ordered.append(s)
    return "".join(f'<span class="badge">{html.escape(s)}</span>' for s in ordered)


def _card(l: Listing) -> str:
    img = (
        f'<img src="{html.escape(l.image_url)}" alt="" loading="lazy">'
        if l.image_url
        else '<div class="noimg">no photo</div>'
    )
    title = html.escape(l.title or f"{l.property_type or 'House'} in {l.locality or ''}")
    facts = [
        ("Price", _eur(l.price)),
        ("Bedrooms", str(l.bedrooms) if l.bedrooms is not None else "—"),
        ("Living", _m2(l.living_area)),
        ("Garden / plot", _m2(l.garden_area or l.land_area)),
        ("Condition", html.escape(l.condition or "—")),
        ("Place", html.escape(f"{l.postal_code or ''} {l.locality or ''}".strip() or "—")),
    ]
    fact_html = "".join(
        f'<div class="fact"><span class="k">{k}</span><span class="v">{v}</span></div>'
        for k, v in facts
    )
    return f"""
    <article class="card">
      <a class="thumb" href="{html.escape(l.url)}" target="_blank" rel="noopener">{img}</a>
      <div class="body">
        <h2><a href="{html.escape(l.url)}" target="_blank" rel="noopener">{title}</a></h2>
        <div class="price">{_eur(l.price)}</div>
        <div class="badges">{_source_badges(l)}</div>
        <div class="facts">{fact_html}</div>
        <a class="btn" href="{html.escape(l.url)}" target="_blank" rel="noopener">View listing →</a>
      </div>
    </article>"""


def write_html(listings: List[Listing], path: str, criteria: Criteria) -> None:
    now = _dt.datetime.now().strftime("%Y-%m-%d %H:%M")
    cards = "\n".join(_card(l) for l in listings) or (
        '<p class="empty">No listings matched your criteria.</p>'
    )
    doc = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>House search — {len(listings)} matches</title>
<style>
  :root {{ --bg:#f5f6f8; --card:#fff; --ink:#1c2530; --muted:#6b7785; --accent:#1f7a5a; }}
  * {{ box-sizing:border-box; }}
  body {{ margin:0; font:15px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
         background:var(--bg); color:var(--ink); }}
  header {{ padding:24px 20px; background:var(--accent); color:#fff; }}
  header h1 {{ margin:0 0 6px; font-size:20px; }}
  header .meta {{ font-size:13px; opacity:.9; }}
  .wrap {{ max-width:1100px; margin:0 auto; padding:20px; }}
  .grid {{ display:grid; gap:16px; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); }}
  .card {{ background:var(--card); border-radius:12px; overflow:hidden;
          box-shadow:0 1px 3px rgba(0,0,0,.08); display:flex; flex-direction:column; }}
  .thumb {{ display:block; aspect-ratio:16/10; background:#e9edf1; }}
  .thumb img {{ width:100%; height:100%; object-fit:cover; }}
  .noimg {{ display:flex; align-items:center; justify-content:center; height:100%;
            color:var(--muted); font-size:13px; }}
  .body {{ padding:14px; display:flex; flex-direction:column; gap:10px; }}
  h2 {{ font-size:16px; margin:0; }}
  h2 a {{ color:var(--ink); text-decoration:none; }}
  .price {{ font-size:18px; font-weight:700; color:var(--accent); }}
  .badges {{ display:flex; gap:6px; flex-wrap:wrap; }}
  .badge {{ font-size:11px; background:#e7f1ec; color:var(--accent); border-radius:999px;
            padding:2px 8px; text-transform:capitalize; }}
  .facts {{ display:grid; grid-template-columns:1fr 1fr; gap:6px 12px; }}
  .fact {{ display:flex; flex-direction:column; }}
  .fact .k {{ font-size:11px; text-transform:uppercase; color:var(--muted); letter-spacing:.03em; }}
  .fact .v {{ font-size:14px; }}
  .btn {{ margin-top:auto; align-self:flex-start; background:var(--accent); color:#fff;
          text-decoration:none; padding:8px 12px; border-radius:8px; font-size:13px; }}
  .empty {{ color:var(--muted); text-align:center; padding:40px; }}
</style>
</head>
<body>
  <header>
    <h1>🏡 {len(listings)} houses match your requirements</h1>
    <div class="meta">{html.escape(criteria.describe())}<br>Generated {now}</div>
  </header>
  <div class="wrap">
    <div class="grid">
      {cards}
    </div>
  </div>
</body>
</html>"""
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(doc)
