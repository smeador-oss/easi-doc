# easi-doc — Product Context for Enhancement PRD

## What Is easi-doc?

easi-doc is a simple, portable documentation and data catalog portal that runs as a standalone Windows executable. No Node.js, no terminal, no setup required for end users. Recipients unzip a folder and double-click `easi-doc.exe`.

**Target audience**: Individuals and small businesses who need to publish and share structured documentation and data dictionaries without deploying infrastructure.

**Distribution**: GitHub open-source project. Built with `npm install && build.bat`, produces a self-contained `dist/` folder ready to zip and share.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Server | Node.js 18+, Express 4.x |
| Frontend | Vanilla JS (ES modules), no framework, no build step |
| Markdown | marked.js (vendored) |
| Syntax highlighting | highlight.js (vendored) |
| Diagrams | Mermaid.js (vendored) |
| CSS | Custom design system with CSS custom properties (no framework) |
| Packaging | @yao-pkg/pkg — compiles Node.js into a standalone `.exe` |
| Dependencies | `express` + `dotenv` — that's it |
| Storage | Flat files (JSON + Markdown). No database. |

---

## Current Feature Set

### Content Viewing

| Feature | Details |
|---------|---------|
| **Markdown rendering** | Full GFM support — headings, tables, lists, code blocks, blockquotes, task lists, strikethrough |
| **Syntax highlighting** | 200+ languages via highlight.js with auto-detection, light/dark theme switching |
| **Mermaid diagrams** | Flowcharts, sequence, class, state diagrams rendered inline from fenced code blocks |
| **Auto-generated TOC** | Right rail shows H2/H3 headings with click-to-scroll and active-section highlighting |
| **Heading anchors** | `#` link appears on hover for each heading |
| **Relative links** | Internal `.md` and `.json` links automatically rewrite to app routes |
| **SharePoint embeds** | `::sharepoint[URL]` syntax renders a sandboxed iframe |
| **JSON data catalogue** | Interactive schema explorer — collapsible table cards, column metadata, type badges, PK/FK/NOT NULL constraints |
| **Catalogue search** | Real-time filter-by-table-name across the catalogue |
| **Catalogue stats** | Summary cards showing table count, column count, domain count |
| **Raw JSON toggle** | Switch between structured view and raw JSON |

### Navigation & Layout

| Feature | Details |
|---------|---------|
| **Multi-portal support** | Each folder in `portals/` with a `portal.json` becomes an independent portal |
| **Auto-discovery** | Drop a folder in `portals/` and it appears automatically — no code changes |
| **Dashboard** | Grid of portal cards with icons, titles, descriptions, and section lists |
| **Portal switcher tabs** | Header center shows tabs for each portal |
| **Sidebar navigation** | Always-visible three-level tree: Portal > Section > Page |
| **Welcome pages** | Per-portal configurable cards with icons, descriptions, and links |
| **Hash-based SPA routing** | `#/{portalId}/{contentPath}` — deep-linkable, bookmarkable |

### Theming & Branding

| Feature | Details |
|---------|---------|
| **Dark/light toggle** | Button in header, persists to localStorage |
| **System preference detection** | Defaults to OS preference if no saved choice |
| **Full CSS variable system** | Colors, spacing, typography, layout all tokenized |
| **Configurable branding** | App name, subtitle, logo, primary/accent colors via `config.json` |
| **Per-portal overrides** | Each portal can override title, subtitle, copilot URL, colors |

### Admin / Content Management

| Feature | Details |
|---------|---------|
| **Create portal** | Dialog: name (→ URL slug), description, icon (8 options), comma-separated sections |
| **Add markdown page** | Dialog: title, paste markdown OR upload `.md` file. Auto-generates filename from title. |
| **Add JSON table** | Dialog: table name, layer selector (Bronze/Silver/Warehouse), upload `.json` file |
| **Sidebar "+" buttons** | Quick-add page button next to each section in the nav tree |
| **Catalogue "+" button** | Add table button in JSON catalogue toolbar |
| **Refresh** | Header button clears server + client caches, re-discovers portals |

### Authentication

Two modes controlled by `config.json → auth.mode`:

| Mode | Behavior |
|------|----------|
| `"none"` (default) | Open access. Everyone sees all features including create/upload. No login needed. |
| `"email"` | Cookie-based admin system. First visitor creates admin account (setup flow). Only authenticated admins can create portals, add content, manage other admins. Non-admins see read-only view with a "Sign In" link. |

Email mode includes:
- Setup screen (first-run admin account creation)
- Sign-in dialog
- Admin management panel (add/remove admins by email)
- Session cookies (1-year, httpOnly)
- Prevents removal of last admin

### Copilot Integration (Optional)

- Set `copilotUrl` in config.json to embed an AI assistant panel (iframe)
- Configurable label (default: "Ask the Docs")
- Auto-added as nav link in sidebar per portal
- Placeholder UI shown if not configured

---

## Configuration Reference

### Global `config.json`

```json
{
  "name": "easi-doc",
  "subtitle": "Simple Documentation Portal",
  "logo": "assets/images/easi-doc-logo.svg",
  "copilotUrl": "",
  "copilotLabel": "Ask the Docs",
  "auth": { "mode": "none" },
  "colors": {
    "primary": "#0052FF",
    "accent": "#00D4FF"
  }
}
```

### Per-Portal `portal.json`

```json
{
  "title": "Portal Name",
  "subtitle": "Description shown in header",
  "icon": "book",
  "order": 1,
  "copilotUrl": "",
  "copilotLabel": "",
  "contentDirs": ["guides", "reference"],
  "welcome": {
    "title": "Welcome Title",
    "subtitle": "Welcome message",
    "cards": [
      {
        "title": "Card Title",
        "description": "Card description",
        "icon": "file",
        "link": "guides/overview.md"
      }
    ]
  }
}
```

**Available icons**: `database`, `book`, `chart`, `settings`, `users`, `globe`, `file`, `layers`

### JSON Catalogue Schema

```json
{
  "layer": "Bronze | Silver | Warehouse",
  "description": "Layer description",
  "tables": [
    {
      "name": "table_name",
      "description": "Table description",
      "domain": "domain_name",
      "columns": [
        {
          "name": "column_name",
          "type": "string | int | datetime | ...",
          "description": "Column description",
          "primary_key": false,
          "nullable": true,
          "foreign_key": false
        }
      ]
    }
  ]
}
```

---

## API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/me` | GET | — | Current user identity, admin status, auth mode |
| `/api/portals` | GET | — | List all discovered portals |
| `/api/portals` | POST | Admin | Create a new portal |
| `/api/portals/:id/content-index` | GET | — | Navigation manifest for a portal |
| `/api/portals/:id/content/*` | GET | — | Serve a content file (md/json) |
| `/api/portals/:id/content/*` | POST | Admin | Upload/create a content file |
| `/api/portals/:id/config` | GET | — | Merged global + portal config |
| `/api/portals/:id/refresh` | POST | Admin | Clear server cache for portal |
| `/api/setup` | POST | Email mode only | Create initial admin account |
| `/api/login` | POST | Email mode only | Admin sign-in |
| `/api/logout` | POST | Email mode only | Clear session |
| `/api/admins` | GET | Admin, email only | List all admins |
| `/api/admins` | POST | Admin, email only | Add an admin |
| `/api/admins/:email` | DELETE | Admin, email only | Remove an admin |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│                    Browser (SPA)                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ app.js   │ │ nav-tree │ │ markdown-viewer  │ │
│  │ (router) │ │          │ │ json-catalogue   │ │
│  └────┬─────┘ └──────────┘ │ copilot-panel    │ │
│       │                     │ about/admin modal│ │
│       │ fetch()             └──────────────────┘ │
└───────┼─────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────┐
│           Express.js Server               │
│  ┌─────────────┐  ┌────────────────────┐  │
│  │ api.js      │  │ portal-discovery   │  │
│  │ (routes +   │  │ content-indexer    │  │
│  │  auth)      │  │ admin-store        │  │
│  └──────┬──────┘  └────────┬───────────┘  │
│         │                  │              │
│         ▼                  ▼              │
│  ┌──────────┐     ┌──────────────┐       │
│  │config.json│    │ portals/     │       │
│  │data/     │     │  ├─ portal A │       │
│  │admins.json│    │  └─ portal B │       │
│  └──────────┘     └──────────────┘       │
└───────────────────────────────────────────┘
```

---

## File Structure

```
easi-doc/
├── config.json              ← Global branding + auth config
├── package.json             ← Dependencies + build config
├── build.bat                ← Build script → dist/easi-doc.exe
├── start.bat                ← Launcher (copied to dist/)
├── server/
│   ├── index.js             ← Express entry point
│   ├── routes/api.js        ← All API endpoints + auth strategies
│   └── services/
│       ├── portal-discovery.js  ← Scans portals/ directory
│       ├── content-indexer.js   ← Generates nav from folder structure
│       └── admin-store.js       ← JSON file persistence for admins
├── public/
│   ├── index.html           ← SPA shell
│   ├── assets/
│   │   ├── css/styles.css   ← Full design system (light + dark)
│   │   ├── js/
│   │   │   ├── app.js       ← Main orchestrator
│   │   │   ├── components/  ← nav-tree, portal-switcher, markdown-viewer,
│   │   │   │                   json-catalogue, copilot-panel, about-modal,
│   │   │   │                   admin-modal
│   │   │   └── services/    ← content-loader, theme-manager
│   │   ├── vendor/          ← marked.js, highlight.js, mermaid.js
│   │   ├── images/          ← easi-doc-logo.svg
│   │   └── content/about.md ← About page content
├── portals/                 ← Content (one folder per portal)
│   └── getting-started/
│       ├── portal.json
│       └── guides/overview.md
└── data/                    ← Auto-created on first run
    └── admins.json
```

---

## Known Limitations & Gaps

### Content Management
- **No edit UI** — admin can create pages but not edit existing ones from the browser
- **No delete UI** — no way to remove portals, pages, or tables from the browser
- **No media upload** — only `.md` and `.json` supported; images must be hosted externally or embedded as base64
- **No markdown preview** — add-page dialog is a plain textarea, no live preview
- **No content versioning** — no history, undo, or diff

### Search & Discovery
- **No full-text search** — catalogue search filters by table name only; no cross-portal or cross-page search
- **No recently viewed** — no history of visited pages
- **No breadcrumbs** — navigation relies on sidebar only

### Collaboration & Access
- **No granular permissions** — all admins have equal access to everything
- **No audit trail** — no logs of who created/modified what
- **No multi-user conflict resolution** — simultaneous edits could overwrite

### Responsive & Mobile
- **Desktop-first layout** — sidebar + content + right rail is fixed CSS Grid, no mobile breakpoints
- **No print stylesheet** — print output may not be optimal

### Infrastructure
- **Windows-only exe** — pkg target is `node18-win-x64` (Mac/Linux can run via `npm start`)
- **No HTTPS** — serves HTTP only (fine for localhost, needs reverse proxy for network)
- **5MB upload limit** — Express body parser default
- **No backup/restore** — flat files only, no export mechanism

### Polish
- **No "last updated" timestamps** on pages
- **No loading skeletons** — uses a simple spinner
- **Config colors partially used** — `primary`/`accent` set in config but not fully propagated to all UI elements
- **No favicon** — browser tab shows default icon
