# Managing Content

All content management features require you to be signed in as an admin.

## Portals

Portals are the top-level containers for your documentation. Each portal appears as a tab in the header. Examples: "HR Policies", "Engineering Docs", "Training Materials".

### Creating a Portal

1. Click the **+** button next to the portal tabs in the header, or use the **Create Portal** option in the admin panel.
2. Enter a **title**, optional **subtitle**, choose an **icon**, and set a **display order**.
3. Optionally add initial section names (comma-separated). Each section gets a starter `overview.md` file.
4. Click **Create**. The portal appears immediately in the tab bar.

### Editing a Portal

Click the **pencil icon** next to the portal name in the sidebar header or on the dashboard card. You can change the title, subtitle, icon, display order, and primary color.

### Deleting a Portal

Use the **overflow menu** (three dots) on the portal's dashboard card or sidebar header. Deletion requires typing the portal name to confirm. This permanently removes the portal and all its content.

## Sections

Sections are folders within a portal. They appear as expandable groups in the sidebar navigation.

### Creating a Section

Click the **+ Section** button at the bottom of the sidebar navigation for the current portal. Enter a section name. A folder is created with a starter `overview.md` page.

### Renaming a Section

Click the **overflow menu** next to the section name in the sidebar and select **Rename**.

### Deleting a Section

Click the **overflow menu** next to the section name and select **Delete**. This removes the section and all pages inside it.

## Pages

Pages are individual documents within a section. easi-doc supports two content types:

### Markdown Pages (.md)

Standard documentation pages written in markdown. They support:

- Headings, lists, tables, and blockquotes
- Code blocks with syntax highlighting
- Mermaid diagrams
- Internal links to other pages

### JSON Data Catalog Pages (.json)

Structured data catalog files that render as interactive table cards. These document database schemas with tables, columns, types, and descriptions. See [Creating Content with AI](creating-content-with-ai.md) for the schema format.

### Adding a Page

**Option 1 -- Add Page dialog:**
Click the **+ Page** button at the bottom of a section in the sidebar. Enter a title, and write or paste your content.

**Option 2 -- Drag and drop:**
Drag a file onto the main content area. A placement dialog appears where you choose the portal, section, and title. Supported file types:

| File Type | Handling |
|-----------|----------|
| `.md` | Added directly as a markdown page |
| `.txt` | Treated as markdown |
| `.docx` | Converted to markdown automatically |
| `.pdf` | Text extracted and converted to markdown |
| `.json` | Added as a data catalog if it matches the schema, otherwise as a text page |

### Editing a Page

For markdown pages, click the **Edit** button in the top-right corner of the content area. This opens a split-pane editor with the raw markdown on the left and a live preview on the right.

For JSON data catalog pages, click the **Edit** icon on a table card to open a structured form editor. You can also toggle to a raw JSON editor.

### Deleting a Page

Click the **Delete** option in the editor toolbar or from the overflow menu on the page's sidebar entry. Confirm the deletion in the dialog.

## Search

The search bar in the header searches across all portals. Start typing to see results in a dropdown. Each result shows the page title, breadcrumb (portal > section), and a text excerpt. Click a result to navigate to the page.
