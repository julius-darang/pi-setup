---
name: send-email
description: Composes, previews, and sends a user-approved email through Gmail SMTP. Use when the user asks to draft, preview, or send an email.
---

# Send Email

Send email only after showing the exact final message and receiving an explicit affirmative confirmation.

## Provider selection

This skill uses Gmail SMTP. Its configuration is stored in:

```text
~/.pi/agent/skills/send-email/.env
```

Set:

```bash
EMAIL_PROVIDER="gmail-smtp"
```

Gmail SMTP uses a Google App Password and STARTTLS on port 587.

## Gmail SMTP configuration

Use a Gmail or Google Workspace address as the SMTP username. The sender should normally be the same address:

```bash
EMAIL_PROVIDER="gmail-smtp"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USERNAME="your-gmail-address@gmail.com"
SMTP_PASSWORD="your-16-character-google-app-password"
SMTP_FROM="Julius <your-gmail-address@gmail.com>"
```

`SMTP_PASSWORD` must be a Google **App Password**, not the user's normal Google password. The user creates it at:

<https://myaccount.google.com/apppasswords>

Google requires 2-Step Verification before an App Password can be created. Store the App Password in the local `.env` file only; never request it in chat or print it.

For Gmail SMTP, use STARTTLS on port 587. The bundled helper uses only Python's standard library:

```text
~/.pi/agent/skills/send-email/scripts/send_gmail_smtp.py
```

## Workflow

Use the `ask_user_question` tool (the `/ask-user-questions` interaction) for every missing required field and for the final send confirmation. Ask one question at a time; do not bundle unrelated missing fields into one prompt.

Default recipients are stored in:

```text
~/.pi/agent/skills/send-email/recipients.txt
```

Read this file without exposing unrelated configuration or credentials. Use its comma- or line-separated addresses as the proposed recipients, but always ask the user to confirm, remove, or add recipients before composing the final preview. An explicit recipient supplied by the user overrides the defaults for that message.

1. Determine the selected provider from `.env` without printing secrets.
2. Load the default recipients from `recipients.txt`, then ask the user to confirm or change them.
3. Gather the subject and body.
4. Ask for missing required fields. Do not invent a recipient or material content.
5. If an attachment name is ambiguous or the requested file is not found, ask the user to choose or provide the exact path before composing the preview.
6. Default to plain text. Use HTML only when explicitly requested.
7. Display the exact final preview:

   ```text
   Provider: Gmail SMTP
   To: recipient@example.com
   From: Julius <your-gmail-address@gmail.com>
   Subject: Subject line
   Attachments:
   - report.pdf (42 KB)

   Message body
   ```

8. Ask `Send this email? (yes/no)`.
9. Only after an unambiguous affirmative confirmation, send the message.
10. Report the result. A successful SMTP submission means Gmail accepted the message; it does not guarantee final inbox delivery.

If the user asks only to draft, compose, or preview an email, do not send anything.

## Sending with Gmail SMTP

After confirmation, validate the required variables without displaying their values, then invoke the helper:

```bash
python3 "$HOME/.pi/agent/skills/send-email/scripts/send_gmail_smtp.py" \
  --subject 'Subject line' \
  --text 'Plain-text body'
```

Repeat `--to` for multiple recipients when overriding the defaults. If `--to` is omitted, the helper loads recipients from `recipients.txt`. Use `--html` instead of `--text` only when HTML was explicitly requested. Add one or more files with repeated `--attach` options:

```bash
python3 "$HOME/.pi/agent/skills/send-email/scripts/send_gmail_smtp.py" \
  --to 'recipient@example.com' \
  --subject 'Report' \
  --text 'The report is attached.' \
  --attach '/path/to/report.pdf' \
  --attach '/path/to/data.csv'
```

The helper reads `.env` directly, opens a TLS connection to `smtp.gmail.com:587`, authenticates with the App Password, and prints only a non-secret result. It validates that attachments exist and keeps their combined size below a conservative 20 MiB safety limit.

For multiline or punctuation-heavy bodies, pass the body as one properly shell-quoted argument; do not put the password in the command.

## Safety

- Never send without showing the exact final recipients, sender, subject, and body first.
- Never treat a draft request as permission to send.
- Display every recipient when there is more than one.
- Validate recipient addresses before asking for confirmation.
- Never print `SMTP_PASSWORD` or any other credential.
- Never ask the user to paste a credential into chat or tool input.
- Do not retry a failed send automatically; ask before retrying.
- Do not add CC, BCC, scheduling, or bulk sending in this version.
- Attach only files the user explicitly identifies or confirms.
- Display each attachment filename and size before sending.
- Do not read or attach credential files, `.env` files, private keys, or other sensitive files unless the user explicitly and knowingly requests it.
- Reject missing files and oversized attachment sets before connecting to the provider.
- If the result is ambiguous, report that the message was not confirmed as sent.

## Troubleshooting

- Missing `SMTP_USERNAME`: use the complete Gmail address, not only the username portion.
- Missing `SMTP_PASSWORD`: create a Google App Password; the normal Gmail password will not work.
- Gmail authentication failure: check 2-Step Verification, App Password status, and account restrictions.
- Gmail connection failure: use `smtp.gmail.com` with port `587` and STARTTLS.
- Gmail Workspace restriction: an administrator may need to permit SMTP or App Passwords.
- Missing or invalid `SMTP_FROM`: use the Gmail account address or a configured Gmail alias.
- Attachment not found: verify the path and filename.
- Attachment size error: reduce the number or size of files; Gmail has a roughly 25 MB total message limit.
- Network failure: report that the message was not confirmed as sent and do not retry automatically.
