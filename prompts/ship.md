---
description: Verify a deliverable before committing or opening a PR
argument-hint: [deliverable]
---

Prepare to ship: ${1:-the current change}.

1. State the acceptance criteria.
2. Run the narrowest meaningful tests or build checks.
3. Inspect the final diff and repository status.
4. Check for secrets, generated files, unrelated changes, and documentation drift.
5. Report blockers and the exact commit/PR summary.

Do not commit, push, or open a PR until the user explicitly approves that final report.
