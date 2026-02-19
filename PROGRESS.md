# easi-doc — Implementation Progress

Tracking document for the easi-doc Enhancement PRD v2.0 implementation plan.

Full plan: see `.claude/plans/structured-wondering-fairy.md`

---

## Status Summary

| Phase | Enhancement | Status | Notes |
|-------|-------------|--------|-------|
| **0** | Route Splitting | **Complete** | Monolithic `api.js` split into `auth.js`, `portals.js`, `content.js`, `search.js` + `validation.js` |
| **1** | Username/Password Auth | **Complete** | bcryptjs hashing, brute-force lockout (10 attempts / 5 min), forced password change for new admins |
| **2** | UUID-Based Content Index | **Complete** | Persisted `content-index.json` per portal, UUID v4 on all sections/pages, `easidoc://` link syntax |
| **3** | Full CRUD | **Complete** | Edit/delete portals, sections, pages. Split-pane CodeMirror 5 editor with live preview. Context menus on nav tree. |
| **4** | Drag-and-Drop Upload | **Complete** | Drop `.md`, `.txt`, `.docx`, `.pdf`, `.json` onto content area. Client-side conversion via mammoth.js + pdf.js. Inline portal/section creation. |
| **5** | Full-Text Search | **Complete** | MiniSearch-powered search-as-you-type. Persisted index. Ctrl+K shortcut. Keyboard navigation. Incremental updates on CRUD. |
| **6** | Skill Command System | Not Started | JSON skill definitions, AJV validation, retry pipeline (framework only, no LLM) |
| **7** | BYOK LLM Integration | Not Started | Ask My Docs chat, Librarian ingestion, LLM config admin panel |

---

## Completed Work — Details

### Phase 0 — Route Splitting

Split the monolithic 481-line `server/routes/api.js` into focused modules:

- `server/routes/auth.js` — Auth strategies, login/logout, admin CRUD endpoints
- `server/routes/portals.js` — Portal listing, creation, PATCH/DELETE, content index
- `server/routes/content.js` — Content serving, creation, update, deletion
- `server/utils/validation.js` — Shared validators (`isValidPortalId`, `isValidContentPath`, `humanize`)
- `server/routes/api.js` — Reduced to ~30-line assembler that mounts sub-routers

### Phase 1 — Username/Password Auth

Replaced the `email` auth mode with `credentials`:

- **bcryptjs** for password hashing (pure JS, pkg-compatible)
- **uuid** for admin record IDs
- Admin schema: `{ id, username, displayName, passwordHash, mustChangePassword, addedBy, addedAt, failedAttempts, lockedUntil }`
- Brute-force lockout: 10 failed attempts → 5-minute lockout (HTTP 423)
- New admins get a temporary password and are forced to change on first login
- Last admin cannot be deleted
- Client-side: new setup screen, login dialog (handles lockout), admin panel with username/displayName management, change-password dialog

### Phase 2 — UUID-Based Content Index

Replaced dynamic filesystem scanning with persisted content indices:

- Each portal gets `content-index.json` with UUID v4 assigned to every section and page
- Auto-generated from filesystem on first startup (migration)
- `server/services/content-index-store.js` — Full CRUD for index entries (add/update/remove sections and pages)
- `easidoc://pageId/{uuid}` links resolve via content index in markdown-viewer
- Broken links get `.broken-link` CSS class (strikethrough + visual indicator)

### Phase 3 — Full CRUD

Complete create/edit/delete for all content types:

- **Portals**: PATCH (title, subtitle, icon, order) and DELETE (two-step confirmation — type portal name)
- **Sections**: PATCH (rename) and DELETE via context menu on sidebar section headers
- **Pages**: PUT (update) and DELETE via context menu; edit button on page header for admins
- **Page Editor**: Split-pane with CodeMirror 5 (left) and live markdown preview (right), 300ms debounce
- **JSON Catalogue**: Structured form editor with inline column editing + raw JSON mode toggle
- **Timestamps**: `createdAt`/`modifiedAt` tracked in content-index, displayed in nav tree and page headers
- Vendored CodeMirror 5 into `public/assets/vendor/codemirror/` (JS + CSS + markdown/xml/javascript modes)

### Phase 4 — Drag-and-Drop Upload

File upload via drag-and-drop onto the main content area:

- **Drop zone** on `#main-content` — blue overlay with pulse animation, admin-only
- **File conversion** (client-side, lazy-loaded):
  - `.md`/`.txt` — read as-is
  - `.docx` — mammoth.js → HTML → custom `htmlToMarkdown()` DOMParser walker
  - `.pdf` — pdf.js text extraction (capped at 50 pages)
  - `.json` — parse + auto-detect catalogue format
- **Upload dialog**: portal dropdown, section dropdown (dynamic), title input, content preview
- **Inline creation**: `+ New Portal...` and `+ New Section...` options create resources via API before upload
- **Multi-file**: sequential processing with "File X of Y" progress badge, Skip/Cancel per file
- **LLM hook**: `llmLibrarianProcess()` stub returns `null` (will be wired in Phase 7)
- Vendored mammoth.js (~636KB) and pdf.js (~1.6MB total) into `public/assets/vendor/`

### Phase 5 — Full-Text Search

MiniSearch-powered full-text search (chosen over sql.js WASM for pkg compatibility):

- **Server**: `server/services/search-store.js` — MiniSearch instance with field boosting (title ×3, section ×2, body ×1), prefix search + fuzzy matching (0.2)
- **API**: `GET /api/search?q=&portal=&limit=` — returns results with score, snippet (120 chars with `<mark>` highlights)
- **Persistence**: Index serialized to `portals/_search-index.json`, auto-rebuilt on startup if missing
- **Incremental updates**: Content CRUD operations (create/update/delete) update the search index in real-time
- **Client**: `search-bar.js` — compact input in header, expands on focus, 300ms debounce, dropdown with keyboard navigation (↑↓ Enter Esc)
- **Global shortcut**: Ctrl+K or `/` focuses search (when not in another input)
- **Index stats**: 18 documents across 5 portals (with mock data)

---

## What's Next

### Phase 6 — Skill Command System (Enhancement 7)

Builds the skill execution framework — no LLM calls, just the infrastructure:

- Install `ajv` for JSON schema validation
- `server/services/skill-store.js` — CRUD for skill definitions + user overrides
- `server/services/skill-runner.js` — template interpolation → LLM call → JSON parse → AJV validate → retry once → fail gracefully
- `server/services/llm-adapter.js` — provider-agnostic LLM interface (OpenAI, Anthropic, compatible). Returns `{ ok: false, error: 'LLM not configured' }` when no key set.
- Seed 6 built-in skills on startup
- Admin routes: `GET/PUT /api/admin/skills/:id`, test, reset
- Admin UI: skills list, edit prompt, test with sample input, reset to default

### Phase 7 — BYOK LLM Integration (Enhancement 6)

Wires the LLM adapter to skills and enables AI features (all optional — hidden when unconfigured):

- **LLM config admin panel** — provider, model, API key (masked), base URL, token limits, test connection
- **Ask My Docs** — chat panel with RAG (search → context assembly → answer-question skill → response with sources)
- **Librarian** — AI-powered document classification and conversion during drag-and-drop upload
- **Knowledge catalogue** — `data/knowledge-catalogue.json`, admin viewable/editable
- **Token cost visibility** — usage logging, admin cost display, hard cap
- Replace `copilot-panel.js` with new `ask-my-docs.js`

---

## Technical Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Password hashing | `bcryptjs` over `bcrypt` | Pure JS — no native compilation, pkg-safe |
| Full-text search | `minisearch` over `sql.js` | Pure JS, 8KB, no WASM. sql.js `locateFile` breaks in pkg virtual filesystem |
| Editor | CodeMirror 5 (UMD) | Mature, works without build step, markdown mode included |
| DOCX conversion | mammoth.js (client-side) | Small UMD build, clean HTML output |
| PDF extraction | pdf.js (client-side) | ESM build, robust text extraction |
| Vendor loading | Lazy-load on first use | Saves ~800KB initial page load |
| Content IDs | UUID v4 | Stable cross-portal links, no collisions |
| Content index | Persisted JSON per portal | Atomic write via temp+rename, survives restarts |
| Search persistence | JSON serialization | MiniSearch native `toJSON()`/`loadJSON()`, no binary format |
