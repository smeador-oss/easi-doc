# easi-doc

easi-doc is for teams who need a shared documentation and data hub but don't have a developer to set one up. It runs as a standalone Windows app — no server, no cloud account, no IT ticket required. Just double-click and go.

![easi-doc running in browser](docs/screenshots/app-preview.png)

## Who is this for?

easi-doc is built for analysts, operations teams, project managers, and data teams — people who need to organize and share documents or data schemas without relying on cloud tools or a development team. It handles two distinct use cases: building internal documentation portals (guides, SOPs, project notes, any markdown content) and hosting a data catalog where database schemas, table definitions, and column-level metadata can be browsed and searched by the whole team.

## Why easi-doc?

**vs. Notion or Confluence** — No subscription, no cloud account, and no data leaving your network. Everything runs locally and works offline.

**vs. a shared drive** — A shared folder is a pile of files. easi-doc is searchable, structured, and browsable like a real documentation site, without anyone having to build one.

**vs. self-hosted tools like Outline or Bookstack** — Those require Docker, a database, a server, and someone who knows how to run them. easi-doc is a single `.exe` file. No setup, no maintenance.

## Is it safe to run?

easi-doc runs a local web server only on `127.0.0.1` — your own machine. It makes no outbound connections, has no telemetry, and never sends your data anywhere. All your content stays as plain files in the folder where you put the exe. The source code is [open on GitHub](https://github.com/smeador-oss/easi-doc).

## Features

### For your whole team

- **Documentation portals** — Content is organized into portals and sections, browsable in a sidebar with search and navigation
- **Data catalog** — JSON files render as interactive, searchable schema tables with layer, table, and column drill-down
- **Instant search** — Search across all content as you type, with keyboard navigation (Ctrl+K)
- **Markdown rendering** — Pages support syntax highlighting, diagrams, auto-generated table of contents, and internal links between pages
- **Dark/light theme** — Theme toggle with saved preference

### For admins

- **Full content management** — Create, edit, and delete portals, sections, and pages from the browser
- **Split-pane editor** — Write markdown with a live preview alongside
- **Drag-and-drop upload** — Drop Word documents, PDFs, plain text, or markdown files onto the page; they're converted and added automatically
- **User management** — Add and remove admin accounts from the browser; new admins are prompted to set their own password on first login
- **Secure login** — Passwords are stored as hashed values; accounts lock temporarily after repeated failed attempts

## Quick Start

No Node.js, no terminal, no install. Just download and run.

1. Download **`easi-doc.exe`**
2. Put it in a folder where you want to keep your content (e.g. `Documents\easi-doc\`)
3. Double-click it — your browser opens automatically
4. On first run, you'll be prompted to set up an admin account
5. From there, create portals, add pages, upload documents, and invite other admins

> **Tip:** To reopen the app after closing the browser tab, just double-click `easi-doc.exe` again. To stop it completely, use the power icon in the top-right corner of the app.

## Authentication

Controlled by `config.json` → `auth.mode`:

| Mode | Description |
|------|-------------|
| `"none"` (default) | Open access. Anyone can view content. Admin features (creating portals, adding pages) are disabled. |
| `"credentials"` | Username/password admin system. First visitor sets up an admin account. Admins can create portals, add content, and manage other admins from the browser. Accounts lock temporarily after 10 failed login attempts. |

To enable admin features, set `"auth": { "mode": "credentials" }` in `config.json`.

### Admin Management

- First admin is created via the setup screen on first run
- Existing admins can add new admins with temporary passwords
- New admins are prompted to change their password on first login
- Last admin cannot be deleted (safety check)

## Rebranding

To customize for your organization:

| What | Where |
|------|-------|
| App name & subtitle | `config.json` → `name`, `subtitle` |
| Logo | Replace `public/assets/images/easi-doc-logo.svg` |
| Colors | `config.json` → `colors` |
| Exe filename | `package.json` → `scripts.build` → change `easi-doc.exe` |
| About page | `public/assets/content/about.md` |

## Content Types

| Extension | Renderer | Features |
|-----------|----------|----------|
| `.md` | Markdown viewer | Syntax highlighting, Mermaid diagrams, auto-generated TOC, internal links |
| `.json` | Data catalog | Searchable schema tables with layer/table/column drill-down |

### Drag-and-Drop Upload

Admins can drag files directly onto the content area. Supported formats:

| Extension | Conversion |
|-----------|-----------|
| `.md` | Direct upload |
| `.txt` | Treated as markdown |
| `.docx` | Converted to markdown automatically |
| `.pdf` | Text extracted automatically |
| `.json` | Parsed; catalog format auto-detected |

## API Reference

### Public Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/me` | GET | Current user identity, admin status, auth mode |
| `/api/portals` | GET | List all discovered portals |
| `/api/portals/:id/content-index` | GET | Navigation tree |
| `/api/portals/:id/content/*` | GET | Serve content file (markdown or JSON) |
| `/api/portals/:id/config` | GET | Merged portal + global config |
| `/api/search?q=&portal=&limit=` | GET | Full-text search with snippets |

### Auth Endpoints (credentials mode only)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/setup` | POST | Create initial admin (first-run only) |
| `/api/login` | POST | Sign in (returns session cookie) |
| `/api/logout` | POST | Clear session |

### Admin Endpoints (require admin session)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admins` | GET | List all admins |
| `/api/admins` | POST | Add admin (temp password + forced change) |
| `/api/admins/:username` | DELETE | Remove admin (blocks last admin) |
| `/api/admins/:username/password` | POST | Change password |
| `/api/quit` | POST | Stop the server cleanly |
| `/api/portals` | POST | Create a new portal |
| `/api/portals/:id` | PATCH | Update portal metadata |
| `/api/portals/:id` | DELETE | Delete portal + all content |
| `/api/portals/:id/sections/:path` | PATCH | Rename section |
| `/api/portals/:id/sections/:path` | DELETE | Delete section + contents |
| `/api/portals/:id/content/*` | POST | Create content file |
| `/api/portals/:id/content/*` | PUT | Update content file |
| `/api/portals/:id/content/*` | DELETE | Delete content file |
| `/api/portals/:id/refresh` | POST | Clear server cache + rebuild index |

## For Developers / Building

You only need Node.js if you want to modify the source or build your own version of the exe.

### Prerequisites

- [Node.js](https://nodejs.org/) 18+

### Build the executable

```
npm install
build.bat
```

This creates `dist/easi-doc.exe` — a single fully self-contained file. Copy it anywhere, double-click to run.

### Run without building (dev mode)

```
npm install
npm start
```

Then open `http://localhost:4242`.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Server | Node.js 18+, Express 4.x |
| Frontend | Vanilla JS (ES modules), no framework |
| Auth | bcryptjs (pure JS, pkg-safe) |
| Markdown | marked.js (vendored) |
| Syntax highlighting | highlight.js (vendored) |
| Diagrams | Mermaid.js (vendored) |
| Editor | CodeMirror 5 (vendored) |
| Search | MiniSearch (pure JS, server-side) |
| DOCX conversion | mammoth.js (vendored, lazy-loaded) |
| PDF extraction | pdf.js (vendored, lazy-loaded) |
| CSS | Custom design system (no framework) |
| Packaging | @yao-pkg/pkg (Node.js → standalone exe) |
| IDs | uuid v4 (content index + admin records) |

## Folder Structure

```
easi-doc/
├── server/                         ← Express backend
│   ├── index.js                    ← Entry point (pkg-aware path resolution)
│   ├── routes/
│   │   ├── api.js                  ← Route assembler (mounts all sub-routers)
│   │   ├── auth.js                 ← Auth endpoints (setup, login, logout, admin CRUD)
│   │   ├── portals.js              ← Portal CRUD + content index endpoints
│   │   ├── content.js              ← Content serving + CRUD
│   │   └── search.js               ← Full-text search endpoint
│   ├── services/
│   │   ├── admin-store.js          ← Admin user persistence (bcrypt, lockout)
│   │   ├── content-index-store.js  ← Persisted content index with UUIDs
│   │   ├── content-indexer.js      ← Filesystem content scanner (fallback)
│   │   ├── portal-discovery.js     ← Portal auto-discovery
│   │   └── search-store.js         ← Full-text search index
│   └── utils/
│       └── validation.js           ← Shared validators (portalId, contentPath)
├── public/                         ← Frontend (vanilla JS, no framework)
│   ├── index.html
│   └── assets/
│       ├── css/styles.css          ← Full design system (light/dark themes)
│       ├── js/
│       │   ├── app.js              ← Main orchestrator (routing, admin UI)
│       │   ├── components/
│       │   │   ├── nav-tree.js         ← Sidebar navigation tree
│       │   │   ├── portal-switcher.js  ← Header portal tabs
│       │   │   ├── markdown-viewer.js  ← Markdown renderer
│       │   │   ├── json-catalogue.js   ← Data catalog table renderer
│       │   │   ├── page-editor.js      ← Split-pane CodeMirror editor
│       │   │   ├── search-bar.js       ← Search-as-you-type with dropdown
│       │   │   ├── drop-zone.js        ← Drag-and-drop file handling
│       │   │   ├── upload-dialog.js    ← Upload placement dialog
│       │   │   ├── admin-modal.js      ← Admin panel overlay
│       │   │   └── about-modal.js      ← About page overlay
│       │   └── services/
│       │       ├── content-loader.js   ← API client with caching
│       │       ├── theme-manager.js    ← Dark/light theme toggle
│       │       └── file-converter.js   ← Client-side file conversion
│       ├── vendor/                     ← Vendored libraries (no CDN)
│       └── images/
├── portals/                        ← Content (one folder per portal)
│   ├── _search-index.json          ← Persisted full-text search index
│   └── <portal-name>/
│       ├── portal.json             ← Portal manifest (title, icon, order)
│       ├── content-index.json      ← Persisted content tree with UUIDs
│       └── <section>/              ← Section folders with content files
├── data/                           ← Created on first run
│   └── admins.json                 ← Admin accounts (bcrypt hashed)
├── assets/
│   ├── icon.svg                    ← Source icon (edit this to change the exe icon)
│   └── icon.ico                    ← Generated exe icon
├── scripts/
│   └── make-icon.js                ← Regenerate icon.ico from icon.svg
├── config.json                     ← Global branding + auth config
├── package.json
└── build.bat                       ← Build script (creates dist/easi-doc.exe)
```
