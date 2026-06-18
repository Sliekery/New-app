"""Email alerts for new listings.

Keeps a small JSON state file of listing ids we've already told you about, so
each run only emails the *new* matches. Designed to be run on a schedule
(cron, Task Scheduler, a GitHub Action, etc.).

SMTP settings come from environment variables so no secrets live in the repo:

  SMTP_HOST       e.g. smtp.gmail.com
  SMTP_PORT       e.g. 587        (default 587, STARTTLS)
  SMTP_USER       your SMTP username / email
  SMTP_PASSWORD   your SMTP password or app-password
  ALERT_FROM      from address     (defaults to SMTP_USER)
  ALERT_TO        recipient(s), comma-separated (or pass --email-to)

For Gmail, create an App Password (Google Account -> Security -> App
passwords) and use that as SMTP_PASSWORD.
"""

from __future__ import annotations

import json
import os
import smtplib
from email.message import EmailMessage
from pathlib import Path
from typing import List, Optional, Set

from .models import Listing


def load_seen(path: str) -> Set[str]:
    p = Path(path)
    if not p.exists():
        return set()
    try:
        return set(json.loads(p.read_text(encoding="utf-8")))
    except (ValueError, OSError):
        return set()


def save_seen(path: str, ids: Set[str]) -> None:
    Path(path).write_text(json.dumps(sorted(ids)), encoding="utf-8")


def _key(l: Listing) -> str:
    return f"{l.source}:{l.listing_id}"


def select_new(listings: List[Listing], seen: Set[str]) -> List[Listing]:
    return [l for l in listings if _key(l) not in seen]


def _eur(value: Optional[int]) -> str:
    return ("€{:,.0f}".format(value)).replace(",", ".") if value else "—"


def _plain_body(listings: List[Listing]) -> str:
    lines = [f"{len(listings)} new house(s) matching your search:\n"]
    for l in listings:
        garden = l.garden_area or l.land_area
        lines.append(
            f"• {l.title or 'House'} — {_eur(l.price)}\n"
            f"  {l.bedrooms or '?'} bed | living {l.living_area or '?'} m² | "
            f"garden {garden or '?'} m² | {l.condition or 'condition n/a'} | {l.source}\n"
            f"  {l.url}\n"
        )
    return "\n".join(lines)


def _html_body(listings: List[Listing]) -> str:
    rows = []
    for l in listings:
        garden = l.garden_area or l.land_area
        rows.append(
            f"<tr>"
            f"<td><a href='{l.url}'>{l.title or 'House'}</a></td>"
            f"<td><b>{_eur(l.price)}</b></td>"
            f"<td>{l.bedrooms or '—'} bed</td>"
            f"<td>{l.living_area or '—'} m²</td>"
            f"<td>{garden or '—'} m² garden</td>"
            f"<td>{l.condition or '—'}</td>"
            f"<td>{l.source}</td>"
            f"</tr>"
        )
    return (
        f"<h2>🏡 {len(listings)} new house(s) matching your search</h2>"
        "<table cellpadding='6' style='border-collapse:collapse' border='1'>"
        "<tr><th>Listing</th><th>Price</th><th>Beds</th><th>Living</th>"
        "<th>Garden</th><th>Condition</th><th>Source</th></tr>"
        + "".join(rows) +
        "</table>"
    )


def send_email(listings: List[Listing], recipients: List[str]) -> None:
    """Send one email summarizing the given listings. Raises on misconfig."""
    host = os.environ.get("SMTP_HOST")
    user = os.environ.get("SMTP_USER")
    password = os.environ.get("SMTP_PASSWORD")
    port = int(os.environ.get("SMTP_PORT", "587"))
    sender = os.environ.get("ALERT_FROM") or user

    if not (host and user and password):
        raise RuntimeError(
            "Email not configured: set SMTP_HOST, SMTP_USER and SMTP_PASSWORD "
            "environment variables (see house_search/notify.py docstring)."
        )
    if not recipients:
        raise RuntimeError("No recipients: pass --email-to or set ALERT_TO.")

    msg = EmailMessage()
    msg["Subject"] = f"🏡 {len(listings)} new house(s) for sale matching your search"
    msg["From"] = sender
    msg["To"] = ", ".join(recipients)
    msg.set_content(_plain_body(listings))
    msg.add_alternative(_html_body(listings), subtype="html")

    with smtplib.SMTP(host, port, timeout=30) as server:
        server.starttls()
        server.login(user, password)
        server.send_message(msg)


def resolve_recipients(cli_value: Optional[str]) -> List[str]:
    raw = cli_value or os.environ.get("ALERT_TO", "")
    return [r.strip() for r in raw.split(",") if r.strip()]
