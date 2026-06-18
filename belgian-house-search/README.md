# 🏡 Belgian House Search

A small Python tool that finds **houses for sale in Belgium** matching your
requirements and produces a clean, browsable report (HTML) plus a spreadsheet
(CSV).

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

# 2) Run a real search (uses config.json) and open the report:
python3 search.py --open --csv results.csv
```

`--open` opens the generated `report.html` in your browser. Without it, just
open `report.html` manually.

> **Heads-up about running it:** the live search pulls from **Immoweb**, the
> biggest Belgian property portal. Immoweb sits behind Cloudflare bot
> protection. From a normal home internet connection it generally works; from
> a server / datacenter IP it may return **403**. If that happens, see
> [Troubleshooting](#troubleshooting). The `--demo` mode always works with no
> network at all, so you can see the output format right away.

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

## How it works

```
search.py            ← command-line entry point
house_search/
  criteria.py        ← your requirements (loaded from config.json)
  models.py          ← Listing: one normalized house, regardless of source
  filtering.py       ← applies your criteria + sorts results
  report.py          ← writes the HTML report and CSV
  providers/
    base.py          ← provider interface
    immoweb.py       ← live data from Immoweb
    sample.py        ← built-in demo data (used by --demo and tests)
```

The design is **pluggable**: each listing site is a "provider" that maps its
raw data into a common `Listing`. To add Zimmo, Immovlan, Realo, etc., write a
new provider in `house_search/providers/` implementing `search()` and the rest
of the tool (filtering, reporting) works unchanged.

---

## Troubleshooting

**Immoweb returns 403 / blocked by Cloudflare**

1. Run from your own computer (home connection), not a server.
2. Increase the delay between requests: `--delay 3`.
3. Provide a fresh browser cookie:
   - Open immoweb.be in your browser, open DevTools → Network, copy the
     `Cookie` request header from any request.
   - `export IMMOWEB_COOKIE='<paste the cookie string here>'`
   - Run the search again.

**"Immoweb did not return JSON"** — Immoweb changed its endpoint shape or
served an HTML challenge. The mapping lives in `house_search/providers/immoweb.py`
(`_parse`) and is easy to adjust.

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
