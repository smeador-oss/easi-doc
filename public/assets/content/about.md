# About easi-doc

easi-doc is a simple, portable documentation and data catalog portal. It provides a centralized place for your team's documentation, data dictionaries, and knowledge base content.

---

## Getting Around

- **Portals** -- Use the tabs at the top or the sidebar to switch between portals. Each portal is an independent collection of docs.
- **Sidebar** -- Click a section to expand it, then click a page to view it. The sidebar stays visible as you read.
- **Table of Contents** -- Long pages show a "On this page" outline on the right. Click a heading to jump to it.
- **Data Catalogues** -- JSON catalogue pages are interactive — expand tables to see columns, types, and descriptions.
- **Theme** -- Toggle dark/light mode with the sun/moon icon in the top-right corner.
- **Refresh** -- The refresh icon reloads navigation and content from the server.

## Reading vs. Editing

easi-doc has two authentication modes, set in `config.json`:

- **`"credentials"`** -- All documentation is readable by everyone. A sign-in icon appears in the header; admins log in only when they need to make changes. When signed out, the portal is read-only.
- **`"none"`** -- No login required. Everyone has full admin access. This is ideal for personal use or local installations where access control isn't needed.

In credentials mode, once signed in you can:

- **Create portals** -- From the dashboard, click "+ New Portal"
- **Edit/delete portals** -- Hover a portal name in the sidebar or dashboard and click the "..." menu
- **Add pages** -- Hover a section header in the sidebar, click "..." then "Add page"
- **Edit pages** -- Open any page and click the "Edit" button at the top
- **Rename/delete sections** -- Hover a section header in the sidebar and use the "..." menu
- **Manage admins** -- Click the people icon in the header to add/remove admin users

When you sign out, all admin controls disappear and the portal returns to read-only mode.

## Features

- **Markdown Documentation** -- Rich rendering with syntax highlighting, Mermaid diagrams, tables, and auto-generated navigation
- **Data Catalogues** -- Interactive JSON-based schema viewers with table/column drill-down
- **Multi-Portal Support** -- Host multiple independent documentation portals, each with its own navigation and content
- **Auto-Discovery** -- Add a folder with a `portal.json` and it appears automatically
- **Flat-File Storage** -- All content is Markdown and JSON files on disk. No database required.
- **Portable** -- Runs as a single executable or via `node server/index.js`. No build step.
