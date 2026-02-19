# What is easi-doc?

easi-doc is a simple, portable documentation portal designed for individuals and small businesses. It runs as a standalone application on your computer with no cloud services, no databases to configure, and no DevOps knowledge required.

## Who is it for?

- Small business owners who need to organize internal documentation
- Teams that want a shared knowledge base without complex infrastructure
- Anyone who needs a clean, searchable place for guides, policies, and data catalogs

## Key Features

| Feature | Description |
|---------|-------------|
| **Multi-portal** | Organize content into separate portals (e.g., HR, Engineering, Training) |
| **Markdown pages** | Write documentation in markdown with live preview and syntax highlighting |
| **Data catalogs** | Document database schemas with a structured JSON format |
| **Full-text search** | Find content instantly across all portals |
| **Drag-and-drop upload** | Drop `.md`, `.txt`, `.docx`, or `.pdf` files to add pages |
| **Admin controls** | Password-protected admin access for managing content |
| **Dark/light theme** | Toggle between themes from the header |
| **Portable** | Runs as a single `.exe` on Windows, or via `npm start` anywhere Node.js is available |

## How the Interface Works

The easi-doc interface has four main areas:

### Header
The top bar contains the app name and logo, portal tabs for switching between portals, a search bar, the theme toggle, and the sign-in button.

### Sidebar
The left panel shows the navigation tree for the current portal. Sections are expandable folders, and pages are clickable links within each section. Admins see additional controls for creating and managing content.

### Content Area
The main area displays the selected page. Markdown pages render with full formatting, syntax-highlighted code blocks, and diagram support. Data catalog pages render as structured table cards.

### Welcome Page
Each portal has a welcome page that appears when no specific page is selected. It shows a brief description and cards linking to each section.

## Next Steps

- [Running the App](running-the-app.md) -- How to start easi-doc and configure it
- [Managing Content](managing-content.md) -- Creating portals, sections, and pages
- [Creating Content with AI](creating-content-with-ai.md) -- Using ChatGPT or Claude to generate documentation
