# Release Note Template

Use this template for GitHub release notes. Write for the person who downloaded the exe and wants to know what changed — not for developers reading a commit log.

**Tone:** Plain English. Lead with what the user can now do differently, not what code changed.
**Avoid:** Library names, technical jargon, internal implementation details.
**Include:** What it looked like before (if relevant), what it looks like now, and why it matters.

---

## [vX.Y.Z] — YYYY-MM-DD

### What's new

- **[Feature name]** — One or two sentences describing what you can do now that you couldn't before. Write it from the user's point of view, not the developer's. Bad example: "Added POST /api/quit endpoint with process.exit(0)." Good example: "A new Quit button in the top-right corner lets you stop the app cleanly from the browser before deleting or moving the exe."

- **[Another feature]** — Same format. If it's only visible to admins, say so.

### What's fixed

- **[Bug description]** — Describe the problem as the user would have experienced it, then what's fixed. Bad example: "Fixed EADDRINUSE error on second process launch." Good example: "Double-clicking the exe after closing the browser tab now reopens the browser instead of silently doing nothing."

- **[Another fix]** — Same format.

---

*Remove sections that don't apply. It's fine to have only "What's new" or only "What's fixed."*
