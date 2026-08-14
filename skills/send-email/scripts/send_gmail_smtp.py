#!/usr/bin/env python3
"""Send one email through Gmail SMTP using the skill's local .env file."""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import re
import smtplib
import ssl
import sys
from email.message import EmailMessage
from email.utils import make_msgid, parseaddr
from pathlib import Path

ENV_PATH = Path.home() / ".pi" / "agent" / "skills" / "send-email" / ".env"
RECIPIENTS_PATH = ENV_PATH.parent / "recipients.txt"


def load_env(path: Path) -> dict[str, str]:
    """Load the small KEY=VALUE format used by this skill without a dependency."""
    values: dict[str, str] = {}
    if not path.is_file():
        raise RuntimeError(f"configuration file not found: {path}")

    for line_number, raw_line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            raise RuntimeError(f"invalid configuration at line {line_number}")
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        values[key] = value
    return values


def load_default_recipients(path: Path) -> list[str]:
    """Load comma- or line-separated default recipients, ignoring blank/comment lines."""
    if not path.is_file():
        return []

    recipients: list[str] = []
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        recipients.extend(part.strip() for part in line.split(",") if part.strip())
    return recipients


def valid_address(address: str) -> bool:
    name, parsed = parseaddr(address)
    return bool(name or parsed) and bool(re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", parsed))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--to",
        action="append",
        help="recipient; repeat for multiple recipients (defaults to recipients.txt)",
    )
    parser.add_argument("--subject", required=True)
    parser.add_argument("--text", help="plain-text body")
    parser.add_argument("--html", help="HTML body")
    parser.add_argument("--attach", action="append", default=[], help="attachment path; repeat for multiple files")
    args = parser.parse_args()

    if bool(args.text) == bool(args.html):
        parser.error("provide exactly one of --text or --html")

    recipients = args.to or load_default_recipients(RECIPIENTS_PATH)
    if not recipients:
        parser.error(f"provide at least one --to recipient or add recipients to {RECIPIENTS_PATH}")

    for address in recipients:
        if not valid_address(address):
            parser.error(f"invalid recipient address: {address}")

    attachment_paths = [Path(path).expanduser() for path in args.attach]
    total_attachment_bytes = 0
    for path in attachment_paths:
        if not path.is_file():
            parser.error(f"attachment is not a file: {path}")
        total_attachment_bytes += path.stat().st_size
    # Keep a safety margin below Gmail's approximately 25 MB message limit.
    if total_attachment_bytes > 20 * 1024 * 1024:
        parser.error("attachments exceed the 20 MiB safety limit")

    config = load_env(ENV_PATH)
    provider = config.get("EMAIL_PROVIDER", "gmail-smtp")
    if provider != "gmail-smtp":
        raise RuntimeError(f"unsupported email provider: {provider}; only gmail-smtp is supported")

    required = ["SMTP_HOST", "SMTP_PORT", "SMTP_USERNAME", "SMTP_PASSWORD", "SMTP_FROM"]
    missing = [key for key in required if not config.get(key)]
    if missing:
        raise RuntimeError("missing Gmail SMTP configuration: " + ", ".join(missing))

    msg = EmailMessage()
    msg["Message-ID"] = make_msgid()
    msg["From"] = config["SMTP_FROM"]
    msg["To"] = ", ".join(recipients)
    msg["Subject"] = args.subject
    if args.text:
        msg.set_content(args.text)
    else:
        msg.set_content("This email contains HTML content. Please use an HTML-capable email client.")
        msg.add_alternative(args.html, subtype="html")

    for path in attachment_paths:
        content_type, _ = mimetypes.guess_type(path.name)
        maintype, subtype = (content_type or "application/octet-stream").split("/", 1)
        msg.add_attachment(
            path.read_bytes(),
            maintype=maintype,
            subtype=subtype,
            filename=path.name,
        )

    # Google displays App Passwords in grouped blocks; whitespace is not part
    # of the credential and is harmlessly removed here.
    smtp_password = "".join(config["SMTP_PASSWORD"].split())

    context = ssl.create_default_context()
    with smtplib.SMTP(config["SMTP_HOST"], int(config["SMTP_PORT"]), timeout=30) as smtp:
        smtp.ehlo()
        smtp.starttls(context=context)
        smtp.ehlo()
        smtp.login(config["SMTP_USERNAME"], smtp_password)
        smtp.send_message(msg)

    print(json.dumps({
        "status": "sent",
        "message_id": msg["Message-ID"],
        "to": recipients,
        "attachments": [path.name for path in attachment_paths],
    }))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, RuntimeError, smtplib.SMTPException) as exc:
        print(f"send-email error: {exc}", file=sys.stderr)
        raise SystemExit(1)
