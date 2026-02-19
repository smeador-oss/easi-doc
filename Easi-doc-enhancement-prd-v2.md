# easi-doc — Enhancement PRD v2.0

**Status**: Final Draft — All decisions locked  
**Scope**: Auth, Full CRUD, Drag-and-Drop UX, Search, BYOK LLM (Ask My Docs + Librarian), Skill Command System

---

## Table of Contents

1. [Context & Goals](#1-context--goals)
2. [Decision Log](#2-decision-log)
3. [Enhancement 1 — Username/Password Authentication](#3-enhancement-1--usernamepassword-authentication)
4. [Enhancement 2 — ID-Based Link System](#4-enhancement-2--id-based-link-system)
5. [Enhancement 3 — Full CRUD for Portals, Sections & Pages](#5-enhancement-3--full-crud-for-portals-sections--pages)
6. [Enhancement 4 — Drag-and-Drop Page Upload UX](#6-enhancement-4--drag-and-drop-page-upload-ux)
7. [Enhancement 5 — Full-Text Search Bar](#7-enhancement-5--full-text-search-bar)
8. [Enhancement 6 — BYOK LLM Integration](#8-enhancement-6--byok-llm-integration)
9. [Enhancement 7 — Librarian Skill Command System](#9-enhancement-7--librarian-skill-command-system)
10. [API Changes Summary](#10-api-changes-summary)
11. [File & Data Structure Changes](#11-file--data-structure-changes)
12. [Out of Scope](#12-out-of-scope)

---

## 1. Context & Goals

easi-doc is a zero-infrastructure documentation portal distributed as a standalone Windows executable. The target user is a non-technical individual or small-business owner who needs to manage and share internal documentation without DevOps involvement.

This PRD addresses five compounding problems with the current state:

- **Auth is not real**: the `email` mode stores no password. It provides no meaningful security.
- **CRUD is incomplete**: users can create but cannot edit or delete anything. Content degrades the moment it needs updating.
- **Renaming breaks links**: the current path-based internal link system means renaming a section or portal invalidates all links into it.
- **Content ingestion requires technical skill**: non-technical users cannot convert `.docx` or `.pdf` files and do not know markdown.
- **The app is document-storage without intelligence**: no cross-document search, no way to query content, no help placing or converting third-party files.

---

## 2. Decision Log

All decisions made during PRD development, recorded for implementation clarity.

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | `email` auth mode completely removed — no backward compat | App not yet deployed; clean break is better than legacy debt |
| 2 | Links use internal IDs, not file paths | Enables safe rename/move of portals, sections, and pages |
| 3 | Drag-and-drop multi-file: sequential processing (dialog per file) | Safer UX; batch review adds complexity without clear benefit for target user |
| 4 | Search bar uses SQLite FTS5; Ask My Docs uses hybrid FTS5 + flat-file embeddings | Option C — degrades gracefully without LLM key, gets smarter when configured |
| 5 | Embeddings re-generated on every page save, async/non-blocking | Auto Option A — negligible cost for small-business scale, keeps index correct |
| 6 | BYOK cloud providers only (OpenAI, Anthropic, compatible endpoint) | No local/Ollama support; scope bounded |
| 7 | Same API key used for both Ask My Docs and Librarian | Single config entry; both features are controlled by the same `llm` block |
| 8 | `copilotUrl` iframe feature completely removed | Superseded by first-party Ask My Docs |
| 9 | CodeMirror included in page editor | Bundle already large from vendored libs; non-technical UX benefit outweighs size |
| 10 | Last-updated timestamps added to all content | Essentially free with full CRUD in scope |
| 11 | Admin panel UI is the only way to configure LLM settings | Prevents config.json hand-editing from getting out of sync |
| 12 | All 4 token cost mitigations implemented | Hard cap + token estimate + provider pricing display + per-feature limits |

---

## 3. Enhancement 1 — Username/Password Authentication

### Problem

The existing `email` auth mode uses an email address as a username with no password. It is being replaced entirely. The new `credentials` mode is the only auth option beyond `none`.

### Config

```json
"auth": {
  "mode": "credentials",
  "passwordMinLength": 8,
  "sessionDays": 365
}
```

### Setup Flow (First Run)

- First visitor sees a setup screen before any other content.
- Required fields: display name, username, password, confirm password.
- Password validated client-side and server-side against `passwordMinLength`.
- Credentials stored as a bcrypt-hashed record in `data/admins.json`.
- On success, user is automatically logged in and redirected to dashboard.

### Sign-In Flow

- "Sign In" button in header for unauthenticated visitors.
- Dialog accepts username and password.
- Failed attempts return a generic "Invalid credentials" error — no username enumeration.
- Brute-force protection: account locked for 5 minutes after 10 consecutive failures (in-memory; resets on server restart — acceptable for local use).
- Successful login sets an httpOnly session cookie (`sessionDays` duration).

### Admin Management

- Authenticated admins can add admins from the admin panel.
- Adding an admin requires: username, display name, temporary password.
- New admin must change password on first login (`mustChangePassword` flag in `admins.json`).
- Removing an admin is blocked if they are the last remaining admin.

### Data Model

```json
[
  {
    "username": "admin",
    "displayName": "Site Admin",
    "passwordHash": "<bcrypt>",
    "mustChangePassword": false,
    "createdAt": "2025-01-01T00:00:00Z"
  }
]
```

### Security Requirements

- Passwords hashed with bcrypt, minimum 10 salt rounds.
- No plain-text password ever written to disk or logged.
- API key stored in `config.json` — masked in all API responses (last 4 chars only).

---

## 4. Enhancement 2 — ID-Based Link System

### Problem

Currently, internal links between pages are file-path-based (e.g., `guides/overview.md`). Renaming a section directory or moving a page invalidates any link pointing to it — silently, with no error visible until a user clicks a broken link.

### Solution

Assign a stable `pageId` (UUID v4) to every content file, every section, and every portal at creation time. Internal links use IDs, not paths. The server resolves IDs to paths at serve time.

### Implementation

**Page ID storage**: Each `.md` and `.json` content file gets a companion entry in the portal's content index (`portals/{id}/content-index.json`) mapping `pageId → relativePath`. The file itself does not need modification.

**Content index schema (updated)**:

```json
{
  "sections": [
    {
      "sectionId": "uuid-v4",
      "name": "guides",
      "displayName": "Guides",
      "pages": [
        {
          "pageId": "uuid-v4",
          "title": "Overview",
          "filename": "overview.md",
          "path": "guides/overview.md",
          "createdAt": "2025-01-01T00:00:00Z",
          "modifiedAt": "2025-01-15T10:00:00Z"
        }
      ]
    }
  ]
}
```

**Link syntax in markdown**: Authors use a custom link syntax for internal links:

```markdown
[See the overview](easidoc://pageId/uuid-here)
```

The markdown renderer resolves `easidoc://pageId/{uuid}` to the correct `#/{portalId}/{path}` route at render time using the content index. Broken references (page deleted) render as a styled broken-link indicator rather than a dead `<a>` tag.

**Existing links**: Existing relative `.md` path links continue to work via the current rewrite logic. They are not retroactively converted — new links created through the UI use IDs, old manually-authored links continue to resolve by path.

**On rename/move**: The content index updates the `path` and `name` fields. The `pageId` and `sectionId` do not change. All ID-based links continue to resolve correctly.

---

## 5. Enhancement 3 — Full CRUD for Portals, Sections & Pages

### 5.1 — Edit Portal

**Trigger**: Pencil icon next to portal name in sidebar header and on dashboard card. Admin only.

**Dialog fields** (pre-populated from `portal.json`):
- Title
- Subtitle / description
- Icon (8-option visual picker, current value highlighted)
- Display order (integer)
- Primary color override (hex input + live preview swatch)

**On save**: PATCH updates `portals/{portalId}/portal.json`. Server refreshes cache. UI updates without page reload.

**API**: `PATCH /api/portals/:id`

---

### 5.2 — Delete Portal

**Trigger**: Overflow menu on dashboard card or sidebar portal header. Admin only.

**Confirmation**: Two-step.
1. Inline warning: _"This will permanently delete the portal and all its content."_
2. User must type the portal name to activate the Delete button.

**On confirm**: Server deletes `portals/{portalId}/` recursively and removes associated embeddings from `data/embeddings/`. UI removes portal from sidebar and dashboard without page reload.

**API**: `DELETE /api/portals/:id`

---

### 5.3 — Rename Section

**Trigger**: Overflow menu on section name in sidebar. Admin only.

**Dialog**: Single text input pre-populated with current name.

**On save**: Server renames the directory, updates `sectionId → name` mapping in content index. All ID-based links resolve correctly (IDs unchanged). Path-based legacy links to pages inside this section will break — server logs a warning listing affected page paths and displays it in the admin panel as a dismissable notification.

**API**: `PATCH /api/portals/:id/sections/:sectionId`

---

### 5.4 — Delete Section

**Trigger**: Overflow menu on section name in sidebar. Admin only.

**Confirmation**: Two-step, same pattern as portal delete. Warning explicitly states all pages inside will be permanently deleted.

**On confirm**: Server removes directory, updates content index, removes associated embeddings.

**API**: `DELETE /api/portals/:id/sections/:sectionId`

---

### 5.5 — Edit Markdown Page

**Trigger**: "Edit" button in the markdown viewer toolbar (top right of content area). Admin only.

**Editor behavior**:
- Inline split-pane view replaces the content viewer in place — no modal, no route change.
- Left pane: CodeMirror instance with markdown syntax mode, tab key support, line numbers.
- Right pane: live preview rendered through the existing `marked.js` pipeline on a 300ms debounce. Includes Mermaid diagram rendering.
- Toolbar actions: Save, Discard, Rename Page (renames `.md` file and updates content index — `pageId` unchanged).

**On save**: PUT sends full markdown content. Server writes file, updates `modifiedAt` in content index. Async re-embedding triggered for this page (non-blocking).

**API**: `PUT /api/portals/:id/content/*`

---

### 5.6 — Delete Page

**Trigger**: "Delete" option in the editor toolbar or overflow menu on the sidebar nav item. Admin only.

**Confirmation**: Single dialog — _"Delete [page title]? This cannot be undone."_

**On confirm**: Server deletes the file, removes entry from content index, removes associated embeddings. User is redirected to the portal welcome page. Nav tree removes the item.

**API**: `DELETE /api/portals/:id/content/*`

---

### 5.7 — Edit JSON Catalogue Table

**Trigger**: Edit icon on each table card in the catalogue viewer. Admin only.

**Structured form editor** (not raw JSON):
- Fields per column: name, type (dropdown of known types), description, PK toggle, nullable toggle, FK toggle.
- Add column: inline "Add row" button at bottom of the column list.
- Remove column: trash icon per row.
- Add table: existing "Add Table" button.
- Remove table: delete icon in table card header with single-step confirmation.

**Raw JSON mode**: Toggle in the form to switch to a CodeMirror JSON editor for power users.

**On save**: PUT overwrites the `.json` file. Async re-embedding triggered. Catalogue view refreshes.

---

### 5.8 — Last-Updated Timestamps

Every page and table in the nav tree and content viewer displays a `Last updated: [relative time]` label (e.g., "3 days ago"). The timestamp is read from `modifiedAt` in the content index and updated on every PUT. `createdAt` is set once at creation and never changed.

---

## 6. Enhancement 4 — Drag-and-Drop Page Upload UX

### Problem

Adding a page currently requires navigating a dialog, typing a title manually, and pasting markdown into a plain textarea. Non-technical users with existing files have no natural entry point.

### Drop Zone

- The entire main content area acts as a drop zone for authenticated admins.
- A full-viewport overlay appears on drag-enter: dashed border, icon, and _"Drop to add page"_ label.
- Drop zone is completely invisible and non-interactive to non-admins and unauthenticated users.

### Supported File Types

| File type | Handling |
|-----------|----------|
| `.md` | Read as-is, pass to placement dialog |
| `.txt` | Read as-is, treated as markdown |
| `.docx` | Client-side conversion via `mammoth.js` to markdown before dialog |
| `.pdf` | Text extraction via `pdf.js` client-side. If extraction quality is acceptable (heuristic: >80% printable chars), route to placement dialog. If quality is low, offer _"Let Librarian process this"_ (requires LLM configured). |
| `.json` | Detect if it matches catalogue schema structure. If yes, route to catalogue upload flow. If no, treat as a plain text page. |

### Pre-population Logic (No LLM Configured)

On drop, before the dialog opens:

1. **Portal**: default to the portal currently active in the sidebar.
2. **Section**: default to the section currently active in the sidebar.
3. **Page title**: derived from the filename (strip extension, replace hyphens/underscores with spaces, title-case).
4. **Filename slug**: auto-generated from title, same logic as the existing Add Page dialog.

### Pre-population Logic (Librarian Enabled)

If LLM is configured and the file is a `.docx`, `.pdf`, or has ambiguous placement, the extracted content is passed to the Librarian's `classify-document` skill before the dialog opens. Librarian returns suggested portal, section, title, filename, confidence level, and a rationale string. These values pre-fill the dialog. The user is always in control and can override any field.

If Librarian confidence is `"low"`, a yellow badge reads: _"Librarian wasn't certain — please review before saving."_

### Placement Dialog Fields

- Portal (dropdown of existing portals)
- Section (dropdown of existing sections within selected portal + "New section…" option)
- Page title (text input)
- Filename (auto-derived, editable, shown as secondary field)
- Content preview (read-only, first 500 characters of parsed markdown)
- Librarian rationale (collapsible, shown only if Librarian was used)

### Multi-File Drop

Files processed sequentially. Complete the dialog for file 1, then open for file 2. A progress indicator shows "File 2 of 3" in the dialog header.

### On Save

POST to `/api/portals/:id/content/:sectionId/:filename` with markdown body. Nav tree refreshes. Async re-embedding triggered.

---

## 7. Enhancement 5 — Full-Text Search Bar

### Placement

A search input in the app header, always visible. Distinct from Ask My Docs — this is a traditional document search, not a chatbot.

### Implementation: SQLite FTS5

A SQLite database (`data/search.db`) maintained by the server, using the FTS5 extension for BM25-ranked full-text search.

**Schema**:

```sql
CREATE VIRTUAL TABLE pages_fts USING fts5(
  pageId,
  portalId,
  portalTitle,
  sectionId,
  sectionName,
  pageTitle,
  path,
  content,
  tokenize = 'porter unicode61'
);
```

**Index maintenance**:
- Built on first startup if `search.db` does not exist.
- Updated on every page save (PUT), page creation (POST), and page deletion (DELETE).
- Admin "Rebuild Search Index" action in the admin panel for full resync.

### Search Behavior

- Real-time results as the user types (300ms debounce).
- Results displayed as a dropdown panel under the search bar.
- Each result shows: page title, portal name → section name breadcrumb, and a highlighted excerpt of the matching text.
- Click navigates to the page and highlights the matched terms.
- Keyboard navigation (↑↓ to move, Enter to navigate, Escape to dismiss).
- Empty query clears results and closes the panel.

### Scope

Search is global — crosses all portals and all sections. Results are sorted by BM25 relevance score.

---

## 8. Enhancement 6 — BYOK LLM Integration

### Overview

Two LLM features share a single provider + API key configuration:

| Feature | Access | Purpose |
|---------|--------|---------|
| **Ask My Docs** | All users | Conversational Q&A grounded in portal content |
| **Librarian** | Admin only | Agentic document ingestion, classification, and conversion |

Both features are disabled until an API key is configured in the admin panel. When disabled, their UI entry points are hidden entirely — not greyed out, not visible.

---

### 8.0 — Configuration (Admin Panel Only)

The admin panel contains an "LLM Settings" section. This is the **only** way to configure LLM settings. The server writes changes back to `config.json`. Users should never need to hand-edit `config.json` for LLM setup.

```json
"llm": {
  "provider": "openai | anthropic | compatible",
  "model": "gpt-4o | claude-opus-4-5 | ...",
  "apiKey": "",
  "baseUrl": "",
  "enabled": false,
  "maxContextTokens": 8000,
  "maxDocumentTokens": 16000,
  "features": {
    "askMyDocs": true,
    "librarian": true
  }
}
```

**Admin panel LLM Settings UI**:
- Provider selector (OpenAI, Anthropic, Compatible Endpoint)
- Model name input (free text — models change too frequently to hard-code a list)
- API key input (masked after save, shows last 4 characters only)
- Base URL input (for `compatible` provider type)
- Per-feature toggles (Ask My Docs on/off, Librarian on/off)
- Token limit inputs for `maxContextTokens` and `maxDocumentTokens`
- Live connection test: "Test Connection" button — sends a minimal API call and reports success or the error message
- Estimated cost-per-query display (see §8.3)

**API key handling**: The key is stored in `config.json` (local flat file, same trust boundary as all other app data). It is never exposed in any frontend API response — all LLM calls are proxied through the Express server.

---

### 8.1 — Ask My Docs

**Purpose**: A chat panel where any user can ask natural-language questions and receive answers grounded in the app's documentation, with every answer citing its source.

**Access**: All users when `askMyDocs: true`. Controlled independently from Librarian.

**UI**:
- A persistent chat button in the bottom-right corner of the screen. Replaces and removes the existing `copilotUrl` iframe system entirely.
- Opens a slide-in panel (not a new page or modal) with a scrollable chat thread and a message input.
- Each assistant message includes a "Sources" section listing portal → section → page for every document cited.
- The input area shows an estimated token count for the about-to-be-sent query (see §8.3).

**Retrieval Strategy (Hybrid FTS5 + Embeddings)**:

The app does not use a vector database. Context retrieval works in two stages:

**Stage 1 — FTS5 Keyword Recall**: The user's query runs against the SQLite FTS5 index (shared with the search bar). Returns top 20 candidate pages ranked by BM25 score.

**Stage 2 — Embedding Re-rank**: Candidate pages are scored for cosine similarity against the query embedding. Embeddings are stored as float arrays in `data/embeddings/{pageId}.json`. The top 5 pages by combined score are selected for context injection.

**Embedding generation**:
- Generated via the configured provider's embeddings API (e.g., `text-embedding-3-small` for OpenAI).
- One embedding file per page, stored flat in `data/embeddings/`.
- Generated on page creation/save, async and non-blocking.
- If no embedding exists for a page (LLM was configured after the page was created), Stage 1 results are used directly without re-ranking.
- Admin panel includes "Rebuild Embeddings" button which re-generates all embeddings in batch.

**Without LLM configured**: Ask My Docs is hidden. Search bar (FTS5 only) still works — this is intentional and important. The app must be useful without an API key.

**Context injection prompt skeleton**:

```
You are a helpful documentation assistant for [app name].
Answer the user's question using ONLY the documents provided below.
For EVERY claim in your answer, you MUST cite the source as:
  [Portal Name > Section Name > Page Title]
If the answer is not found in the provided documents, say:
  "I couldn't find information about that in the documentation."
Do not invent or infer information not present in the documents.

DOCUMENTS:
[1] Portal: {portalTitle} | Section: {sectionName} | Page: {pageTitle}
---
{pageContent (truncated to fit token budget)}
---
... (up to 5 documents)
```

**Conversation state**: Stateless. Each query is independent. No session memory between messages. This is a deliberate limitation to control token cost and complexity for v1.

---

### 8.2 — Librarian (Agentic Content Ingestion)

**Purpose**: An LLM agent that helps non-technical admins convert, classify, and place documents — without requiring knowledge of markdown or the app's folder structure.

**Access**: Admin only.

**Entry Points**:
1. Drag-and-drop (Enhancement 4): activated automatically for `.docx`/`.pdf` files when LLM is configured.
2. Dedicated "Librarian" button in the admin panel.
3. "Use Librarian" toggle in the Add Page dialog.

**Librarian Workflow**:

```
Step 1: File ingestion
  Server receives file. Extracts text:
  - .docx → mammoth.js → raw text + structure hints (headings detected)
  - .pdf  → pdfjs → raw text (quality scored; low-quality flagged to user)
  Raw text passed to Librarian pipeline.

Step 2: App context snapshot
  Server assembles Knowledge Catalogue (§8.4) into a compact JSON summary.
  Injected into Librarian system prompt.

Step 3: Classification (classify-document skill)
  Librarian reads document content + catalogue snapshot.
  Returns structured JSON:
  {
    "suggestedPortal": "hr",
    "suggestedSection": "policies",
    "suggestedTitle": "Remote Work Policy",
    "suggestedFilename": "remote-work-policy.md",
    "confidence": "high | medium | low",
    "rationale": "This document describes remote work rules..."
  }

Step 4: Admin review
  Dialog opens with pre-filled fields from classification.
  Rationale shown as collapsible block.
  Confidence "low" → yellow warning badge.
  Admin can modify any field.

Step 5: Markdown conversion (convert-to-markdown skill)
  Admin confirms placement.
  Librarian converts extracted text to clean markdown.
  Preserves headings, lists, tables, bold/italic from original.
  Admin sees a side-by-side diff: raw extraction (left) vs converted markdown (right).

Step 6: Write
  Admin clicks final "Save" button.
  Server writes markdown to correct path.
  Content index updated. Nav tree refreshes. Async re-embedding triggered.
  Knowledge Catalogue updated via update-knowledge-catalogue skill (§8.4).
```

**Token cost estimate shown before Steps 3 and 5** (see §8.3).

---

### 8.3 — Token Cost Visibility

Four mitigations implemented to prevent unexpected API costs:

**1. Hard cap on context injection**
`maxContextTokens` (default: 8,000) sets the total token budget for all injected pages in an Ask My Docs query. Pages are truncated to fit. `maxDocumentTokens` (default: 16,000) sets the limit for a single document processed by Librarian. Both are configurable in admin panel LLM Settings.

**2. Token estimate before submit (Ask My Docs)**
Before the user sends a message, the input area shows a token estimate: _"~3,200 tokens"_ calculated as `(query length + injected context length) / 4`. Rough but directionally accurate. Shown subtly in a small muted label near the send button. Does not block sending.

**3. Provider cost transparency (Admin Panel)**
The LLM Settings section displays a static cost reference table for common models, shipping with the app and updatable via skill file:

| Provider | Model | Input (per 1M tokens) | Output (per 1M tokens) |
|----------|-------|----------------------|------------------------|
| OpenAI | gpt-4o | $2.50 | $10.00 |
| OpenAI | gpt-4o-mini | $0.15 | $0.60 |
| Anthropic | claude-opus-4-5 | $15.00 | $75.00 |
| Anthropic | claude-haiku-4-5 | $0.80 | $4.00 |
| ... | ... | ... | ... |

Below the table: _"Estimated cost per Ask My Docs query at current settings: ~$0.003"_ (calculated from `maxContextTokens` × input rate + average output × output rate).

**4. Per-feature token limits**
`maxContextTokens` and `maxDocumentTokens` are independently configurable per the config schema above. Admin can lower these to further reduce cost at the expense of answer quality.

---

### 8.4 — Knowledge Catalogue (Librarian's Memory)

For Librarian to classify new documents accurately, it needs to understand the existing content — not just file names.

**What it is**: A machine-readable summary file at `data/knowledge-catalogue.json` describing each portal's purpose, sections, and key content themes.

**Bootstrap**: On first Librarian action, if the file does not exist, Librarian generates it by reading a sample of pages from each portal (up to 3 pages per section). This is a one-time batch API call.

**Schema**:

```json
{
  "generatedAt": "2025-01-01T00:00:00Z",
  "portals": [
    {
      "id": "hr",
      "title": "HR Portal",
      "inferredPurpose": "Employee policies, onboarding guides, and HR procedures.",
      "sections": [
        {
          "sectionId": "uuid-v4",
          "name": "policies",
          "inferredPurpose": "Formal policy documents covering employment, conduct, and remote work.",
          "pageCount": 4,
          "keyThemes": ["remote work", "conduct", "leave", "benefits"]
        }
      ]
    }
  ]
}
```

**Admin visibility**: The knowledge catalogue is viewable and editable in the admin panel. Admins can correct or refine `inferredPurpose` and `keyThemes` entries. Accurate catalogue entries directly improve Librarian classification quality — this is worth surfacing to the admin as a setting they should review.

**Automatic updates**: After every Librarian ingestion, the `update-knowledge-catalogue` skill revises the relevant section's `keyThemes` and `inferredPurpose` if the new content meaningfully extends existing entries.

**Manual rebuild**: Admin panel button: "Rebuild Knowledge Catalogue" — triggers full re-generation from current content.

---

## 9. Enhancement 7 — Librarian Skill Command System

### Problem

LLM output is non-deterministic. The same prompt produces different structures across model versions, providers, and context sizes. For Librarian — which writes files and places content — inconsistent output is a hard failure, not a quality issue. A classification result that isn't valid JSON with the expected fields cannot be acted upon.

The skill system makes Librarian's behavior reliable across all supported providers.

### Skill Structure

Skills are stored as JSON files in `data/skills/`. Built-in skills ship with the app. User overrides are stored in `data/skills/overrides/` and never modify the originals.

```json
{
  "id": "classify-document",
  "version": "1.2",
  "description": "Classify an ingested document and suggest portal, section, title, and filename.",
  "systemPrompt": "...",
  "outputSchema": {
    "type": "object",
    "required": ["suggestedPortal", "suggestedSection", "suggestedTitle", "suggestedFilename", "confidence", "rationale"],
    "properties": {
      "suggestedPortal":   { "type": "string" },
      "suggestedSection":  { "type": "string" },
      "suggestedTitle":    { "type": "string" },
      "suggestedFilename": { "type": "string" },
      "confidence":        { "type": "string", "enum": ["high", "medium", "low"] },
      "rationale":         { "type": "string" }
    }
  },
  "userPromptTemplate": "Document content:\n\n{documentContent}\n\nApp catalogue:\n\n{catalogueSnapshot}"
}
```

### Skill Catalogue

| Skill ID | Purpose | Output |
|----------|---------|--------|
| `classify-document` | Classify a document into portal/section/title | `{suggestedPortal, suggestedSection, suggestedTitle, suggestedFilename, confidence, rationale}` |
| `convert-to-markdown` | Convert extracted text to clean markdown | `{markdown, warnings[]}` |
| `generate-section-summary` | Generate `inferredPurpose` and `keyThemes` for a section | `{inferredPurpose, keyThemes[]}` |
| `generate-portal-summary` | Generate `inferredPurpose` for a portal | `{inferredPurpose}` |
| `answer-question` | Answer a question from document context (Ask My Docs) | `{answer, sources[{portalTitle, sectionName, pageTitle, pageId}]}` |
| `update-knowledge-catalogue` | Revise a section's catalogue entry after new content | `{updatedInferredPurpose, updatedKeyThemes[]}` |

### Enforced Output Validation Pipeline

Every LLM call in the app (both features) goes through this pipeline:

```
1. Build prompt — fill {template slots} with runtime values
2. Call LLM — via provider adapter (see below)
3. Parse response — attempt JSON.parse() on the response text
4. Validate — run parsed object against skill's outputSchema (AJV or equivalent lightweight validator)
5a. Validation passes → return parsed object to caller
5b. Validation fails (attempt 1) →
    Send correction prompt:
    "Your response did not match the required schema.
     Schema: {schema}
     Your response: {response}
     Please correct your response to match the schema exactly."
    Retry once.
5c. Retry fails → return structured error to UI:
    "Librarian was unable to process this file. You can still place it manually."
    Log the raw LLM response for admin inspection in the admin panel event log.
```

The server **never acts on LLM output that fails schema validation** — not on first attempt, not after retry. This is non-negotiable for a system that writes files.

### Provider Adapter

A single server-side module (`server/services/llm-adapter.js`) handles all provider differences:

```js
// Interface (provider-agnostic)
async function callLLM({ systemPrompt, userPrompt, model, provider, apiKey, baseUrl })
  → { text, inputTokens, outputTokens }
```

Internal branching by `config.llm.provider`:
- `openai` → OpenAI Chat Completions API
- `anthropic` → Anthropic Messages API
- `compatible` → OpenAI-compatible endpoint using `baseUrl`

Skills are completely provider-agnostic. Changing the provider in admin settings requires no skill changes.

### Admin UI for Skills

Viewable in the admin panel under "LLM Settings → Skills":

- List of all skills: ID, version, description.
- "View Prompt" — read-only view of the current system prompt (override if exists, built-in otherwise).
- "Edit Prompt" — opens a CodeMirror editor to create/modify a user override.
- "Reset to Default" — deletes the user override, restores built-in.
- Version badge — flags when a built-in skill has been updated and a user override exists ("Override may be outdated — review recommended").
- "Test Skill" — runs the skill with sample input and shows the raw LLM response and validation result.

---

## 10. API Changes Summary

### Auth Endpoints (Changed)

| Endpoint | Method | Change |
|----------|--------|--------|
| `/api/setup` | POST | Now accepts `{ username, displayName, password }`. Removed email field. |
| `/api/login` | POST | Now accepts `{ username, password }`. |
| `/api/admins` | POST | Now accepts `{ username, displayName, temporaryPassword }`. |

### Portal & Content CRUD (New)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/portals/:id` | PATCH | Admin | Update portal metadata |
| `/api/portals/:id` | DELETE | Admin | Delete portal and all content |
| `/api/portals/:id/sections/:sectionId` | PATCH | Admin | Rename section |
| `/api/portals/:id/sections/:sectionId` | DELETE | Admin | Delete section |
| `/api/portals/:id/content/*` | PUT | Admin | Overwrite existing content file |
| `/api/portals/:id/content/*` | DELETE | Admin | Delete content file |

### Search (New)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/search` | GET | — | Full-text search across all portals. Query params: `q`, `limit` (default 10). Returns `{ results: [{ pageId, portalTitle, sectionName, pageTitle, path, excerpt }] }` |
| `/api/search/rebuild` | POST | Admin | Rebuild FTS5 index from all current content |

### LLM (New)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/llm/config` | GET | Admin | Get LLM config (key masked to last 4 chars) |
| `/api/llm/config` | PUT | Admin | Update LLM config |
| `/api/llm/test` | POST | Admin | Test LLM connection |
| `/api/llm/ask` | POST | — | Ask My Docs query. Body: `{ query }`. Returns `{ answer, sources[] }` |
| `/api/llm/librarian/classify` | POST | Admin | Classify document. Body: `{ content, filename }`. Returns classification JSON. |
| `/api/llm/librarian/convert` | POST | Admin | Convert content to markdown. Body: `{ content, format }`. Returns `{ markdown, warnings[] }`. |

### Knowledge Catalogue (New)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/knowledge-catalogue` | GET | Admin | Get knowledge catalogue |
| `/api/knowledge-catalogue` | PUT | Admin | Update knowledge catalogue (manual edit) |
| `/api/knowledge-catalogue/rebuild` | POST | Admin | Trigger full catalogue rebuild |

### Skills (New)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/skills` | GET | Admin | List all skills with version and override status |
| `/api/skills/:id` | GET | Admin | Get skill detail including active system prompt |
| `/api/skills/:id/override` | PUT | Admin | Set user override for skill system prompt |
| `/api/skills/:id/override` | DELETE | Admin | Remove override, restore built-in |
| `/api/skills/:id/test` | POST | Admin | Run skill with sample input, return raw result + validation |

### Embeddings (New)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/embeddings/rebuild` | POST | Admin | Rebuild all embeddings in batch |
| `/api/embeddings/status` | GET | Admin | Show count of pages with/without current embeddings |

---

## 11. File & Data Structure Changes

```
easi-doc/
├── config.json                        ← Updated: credentials auth + llm block, copilotUrl removed
├── data/
│   ├── admins.json                    ← Updated: username + passwordHash, no email
│   ├── search.db                      ← NEW: SQLite FTS5 search index
│   ├── knowledge-catalogue.json       ← NEW: Librarian's app understanding
│   ├── embeddings/
│   │   └── {pageId}.json              ← NEW: One embedding file per page
│   └── skills/
│       ├── classify-document.json     ← NEW: Built-in skill
│       ├── convert-to-markdown.json   ← NEW: Built-in skill
│       ├── generate-section-summary.json
│       ├── generate-portal-summary.json
│       ├── answer-question.json
│       ├── update-knowledge-catalogue.json
│       └── overrides/                 ← NEW: User overrides (never touch built-ins)
│           └── {skill-id}.json
├── portals/
│   └── {portal-id}/
│       ├── portal.json                ← Unchanged schema
│       └── content-index.json         ← UPDATED: Adds sectionId, pageId, createdAt, modifiedAt
├── server/
│   ├── services/
│   │   ├── llm-adapter.js             ← NEW: Provider-agnostic LLM caller
│   │   ├── skill-runner.js            ← NEW: Skill load + template fill + validate pipeline
│   │   ├── embedding-service.js       ← NEW: Generate + store + query embeddings
│   │   └── search-service.js          ← NEW: SQLite FTS5 index management
│   └── routes/api.js                  ← Updated: All new endpoints added
└── public/assets/
    └── vendor/
        └── codemirror/                ← NEW: CodeMirror for page editor + JSON editor
```

### New Dependencies

| Package | Purpose | Packaging note |
|---------|---------|---------------|
| `bcrypt` | Password hashing | Native addon — must be included in pkg snapshot assets |
| `better-sqlite3` | FTS5 search index | Native addon — must be included in pkg snapshot assets |
| `ajv` | JSON Schema validation for skill outputs | Pure JS — no packaging concerns |
| `uuid` | Generate pageId / sectionId UUIDs | Pure JS — no packaging concerns |
| `mammoth` (server-side) | `.docx` text extraction for Librarian | Pure JS |
| `pdfjs-dist` (server-side) | `.pdf` text extraction for Librarian | Pure JS |

**Note on native addons (bcrypt, better-sqlite3)**: Both require pre-built `.node` binaries for `node18-win-x64` to be included as pkg snapshot assets. This is the primary build complexity introduced by this PRD. The `build.bat` script must be updated to copy the correct `.node` files into the pkg snapshot.

---

## 12. Out of Scope

Explicitly excluded to keep scope manageable. Candidates for a future enhancement cycle.

- **Content versioning / history** — no git-style diff or undo. Backups are the admin's responsibility.
- **Mobile / responsive layout** — still desktop-first. Drag-and-drop upload assumes a desktop browser.
- **HTTPS** — still HTTP only. Reverse proxy configuration remains the operator's responsibility for network deployments.
- **Granular permissions** — all admins have equal access. No per-portal or per-section access control.
- **Mac/Linux exe packaging** — still `node18-win-x64` only. Mac/Linux users run via `npm start`.
- **Image/media upload** — images must still be externally hosted or base64 embedded.
- **Multi-user conflict resolution** — last write wins. Simultaneous admin edits remain an unhandled edge case.
- **LLM streaming responses** — Ask My Docs returns complete responses only. No token-by-token streaming in v1.
- **Ask My Docs conversation memory** — each query is stateless. No persistent chat history across sessions.
- **Ollama / local model support** — BYOK cloud providers only (OpenAI, Anthropic, compatible endpoint).