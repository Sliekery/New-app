# 🏡 Belgian House Search

A small Python tool that finds **houses for sale in Belgium** matching your
requirements and produces a clean, browsable report (HTML) plus a spreadsheet
(CSV). It searches **four major Belgian portals at once** — Immoweb, Zimmo,
Immovlan and Realo — de-duplicates the same house across sites, and can
**email you only the new matches** on a schedule.

It's pre-configured for the search you described:

- **Area:** around **Borgloon** (Limburg) — postal codes 3840, 3870, 3720, 3730, 3700, 3800
- **Price:** €300,000 – €500,000
- **Type:** house / villa (no apartments)
- **Bedrooms:** 3 or more
- **Garden:** required, **very big** (≥ 1,500 m² plot/garden by default)
- **Condition:** move-in ready only (renovation projects filtered out)

All of these are easy to change — see [Configuration](#configuration).

---

## Quick start

```bash
cd belgian-house-search
python3 -m pip install -r requirements.txt

# 1) Try it offline with built-in sample data:
python3 search.py --demo --open

# 2) Run a real search across ALL sources and open the report:
python3 search.py --sources all --open --csv results.csv

# 3) Or pick specific sources:
python3 search.py --sources immoweb,zimmo --open
```

`--open` opens the generated `report.html` in your browser. Without it, just
open `report.html` manually. Each result card shows a badge per portal it was
found on (e.g. the same house listed on both Immoweb and Zimmo).

> **Heads-up about running it:** the live search pulls from real portals
> (**Immoweb, Zimmo, Immovlan, Realo**), which sit behind bot protection
> (Cloudflare etc.). From a normal home internet connection they generally
> work; from a server / datacenter IP you may get **403**. Each source runs
> independently, so if one is blocked the others still return results, and the
> error is reported at the end. See [Troubleshooting](#troubleshooting). The
> `--demo` mode always works with no network at all.

---

## Configuration

Edit `config.json`:

| Field | Meaning |
|-------|---------|
| `postal_codes` | Belgian postal codes to search (Borgloon + neighbours by default) |
| `price_min` / `price_max` | Price range in € |
| `min_bedrooms` | Minimum number of bedrooms |
| `property_types` | `"HOUSE"`, `"VILLA"` (apartments excluded) |
| `require_garden` | Only houses with a garden |
| `min_garden_area` | Minimum garden / plot size in m² ("very big" = 1500) |
| `require_finished` | Exclude houses that need renovation |
| `min_living_area` | Optional minimum living area in m² (`null` = no limit) |
| `sort_by` | `"garden"`, `"price"`, or `"living_area"` |

You can also override settings on the command line without editing the file:

```bash
python3 search.py --max-price 480000 --min-bedrooms 4 --min-garden 2000
python3 search.py --postal-codes 3840,3870 --sort-by price
```

Run `python3 search.py --help` for all options.

---

## Sources

| Source | Site | Notes |
|--------|------|-------|
| `immoweb` | immoweb.be | Largest BE portal; JSON search API |
| `zimmo` | zimmo.be | JSON search API |
| `immovlan` | immovlan.be | JSON search API |
| `realo` | realo.be | Data extracted from the page's embedded JSON |

Use `--sources all` (default) or a comma-separated subset. The same physical
house is de-duplicated across portals using a fingerprint
(locality + price + bedrooms + living area); the report shows a badge for each
site it appeared on.

> These all hit each portal's **internal** endpoints (the same data your
> browser loads), so they're best-effort: if a site changes its API the
> mapping may need a tweak. The parsing is defensive and each source is
> isolated, so one site breaking never breaks the others. The mappings live in
> `house_search/providers/<name>.py` (`_parse`).

---

## Email alerts (scheduled)

Get an email with **only the new** listings each time it runs — perfect for a
cron job or scheduled task.

```bash
export SMTP_HOST=smtp.gmail.com
export SMTP_USER=you@gmail.com
export SMTP_PASSWORD=your_app_password     # Gmail: use an App Password
export ALERT_TO=you@gmail.com

python3 search.py --sources all --email
```

It tracks which listings it has already emailed in `seen.json` (change with
`--state-file`), so you only ever hear about genuinely new houses. If sending
fails, nothing is marked as seen, so the next run retries.

**Run it on a schedule** — e.g. cron, every morning at 8:00:

```cron
0 8 * * *  cd /path/to/belgian-house-search && /usr/bin/python3 search.py --sources all --email >> alerts.log 2>&1
```

(On Windows use Task Scheduler; on a server you can also use a GitHub Action
with the SMTP_* values stored as repository secrets.)

---

## How it works

```
search.py            ← command-line entry point
house_search/
  criteria.py        ← your requirements (loaded from config.json)
  models.py          ← Listing: one normalized house, regardless of source
  filtering.py       ← applies your criteria + sorts results
  aggregate.py       ← runs several sources, de-duplicates, isolates failures
  report.py          ← writes the HTML report and CSV
  notify.py          ← email alerts + "already seen" tracking
  providers/
    base.py          ← provider interface
    common.py        ← shared HTTP + parsing helpers
    immoweb.py       ← live data from Immoweb
    zimmo.py         ← live data from Zimmo
    immovlan.py      ← live data from Immovlan
    realo.py         ← live data from Realo
    sample.py        ← built-in demo data (used by --demo and tests)
```

The design is **pluggable**: each listing site is a "provider" that maps its
raw data into a common `Listing`. To add another portal, write a new provider
in `house_search/providers/` implementing `search()`, register it in
`providers/__init__.py`, and the rest of the tool (filtering, de-duplication,
reporting, email) works unchanged.

---

## Troubleshooting

**A source returns 403 / blocked**

1. Run from your own computer (home connection), not a server / cloud IP.
2. Increase the delay between requests: `--delay 3`.
3. Provide a fresh browser cookie. Open the site in your browser, open
   DevTools → Network, copy the `Cookie` request header, and export it:
   - `IMMOWEB_COOKIE`, `ZIMMO_COOKIE`, `IMMOVLAN_COOKIE`, or `REALO_COOKIE`
   - e.g. `export ZIMMO_COOKIE='<paste cookie string>'`
4. Drop the blocked source: `--sources immoweb,realo` — the rest still run.

**"… did not return JSON" / 0 results from one source** — that portal changed
its endpoint or response shape. Because the sources are internal endpoints,
this happens occasionally. The mapping for each site lives in
`house_search/providers/<name>.py` (`_parse`) and is straightforward to adjust.
The other sources keep working in the meantime.

**Email not sent** — make sure `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD` are
set, and that recipients are given via `--email-to` or `ALERT_TO`. For Gmail
you must use an **App Password**, not your normal password.

---

## Running the tests

```bash
python3 -m pytest tests/      # if pytest is installed
```

Or without pytest:

```bash
python3 -c "import tests.test_filtering as t; [getattr(t,n)() for n in dir(t) if n.startswith('test_')]; print('ok')"
```

---

## Notes & etiquette

- This tool is for **personal use** to help you find a home. Keep request
  volume low (the default 1.5s delay between pages does this).
- Immoweb's data is its own; respect their terms of service. The tool only
  reads public search results, the same ones you'd see in a browser.
- Sample data in `--demo` mode is **fictional** — not real listings.
