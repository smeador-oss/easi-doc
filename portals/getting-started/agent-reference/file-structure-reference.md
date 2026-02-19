# easi-doc File Structure Reference

This document describes everything you need to know to create portals and content for easi-doc by writing files directly to the filesystem. You know, just in case you're the type that wants to know.

## Directory Layout

```
easi-doc/
├── config.json                        # Global app configuration
├── portals/                           # All portal content lives here
│   ├── {portal-id}/                   # One folder per portal
│   │   ├── portal.json                # Portal manifest (required)
│   │   ├── {section-name}/            # One folder per section
│   │   │   ├── overview.md            # Section intro page (recommended)
│   │   │   ├── page-name.md           # Markdown documentation page
│   │   │   ├── another-page.md
│   │   │   └── data-catalog.json      # JSON data catalog file
│   │   └── {another-section}/
│   │       └── ...
│   └── {another-portal}/
│       └── ...
└── data/
    └── admins.json                    # Admin user accounts (do not edit)
```

## Naming Conventions

| Item | Rule | Examples |
|------|------|---------|
| Portal folder | Lowercase, hyphens only, no spaces | `hr-policies`, `engineering`, `data-catalog` |
| Section folder | Lowercase, hyphens only, no spaces | `getting-started`, `policies`, `api-reference` |
| Markdown files | Lowercase, hyphens, `.md` extension | `overview.md`, `leave-policy.md`, `setup-guide.md` |
| JSON catalog files | Lowercase, hyphens, `.json` extension | `core-erp.json`, `inventory-system.json` |

The server converts folder and file names to display titles automatically:
- `hr-policies` becomes "Hr Policies"
- `getting-started` becomes "Getting Started"
- `leave-policy.md` becomes "Leave Policy"

## Portal Manifest (portal.json)

Every portal folder must contain a `portal.json` file. This is the only required file.

```json
{
  "title": "Portal Display Title",
  "subtitle": "A short description shown in the portal config",
  "icon": "book",
  "order": 1,
  "welcome": {
    "title": "Welcome Page Title",
    "subtitle": "Welcome page description text.",
    "cards": [
      {
        "title": "Section Name",
        "description": "What this section covers.",
        "icon": "file",
        "link": "section-folder/overview.md"
      }
    ]
  }
}
```

### Fields

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `title` | Yes | string | Portal name shown in the tab bar |
| `subtitle` | No | string | Short description |
| `icon` | No | string | Icon identifier (see list below) |
| `order` | No | number | Display order in the tab bar (lower = earlier) |
| `welcome` | No | object | Welcome page configuration |
| `welcome.title` | No | string | Heading on the welcome page |
| `welcome.subtitle` | No | string | Subheading on the welcome page |
| `welcome.cards` | No | array | Cards linking to sections |

### Available Icons

- `book` -- General documentation
- `database` -- Data-related content
- `layers` -- Architecture and systems
- `getting-started` -- Clock icon for guides
- `framework` -- Grid icon
- `processes` -- Activity/pulse icon
- `help` -- Question mark icon
- `file` -- Generic file icon (used for welcome cards)

### Example: Minimal portal.json

```json
{
  "title": "HR Policies",
  "order": 2
}
```

### Example: Full portal.json

```json
{
  "title": "HR Policies",
  "subtitle": "Employee handbooks, policies, and procedures",
  "icon": "book",
  "order": 2,
  "welcome": {
    "title": "HR Policies",
    "subtitle": "Find company policies, onboarding guides, and HR procedures.",
    "cards": [
      {
        "title": "Policies",
        "description": "Leave, conduct, remote work, and benefits policies.",
        "icon": "file",
        "link": "policies/overview.md"
      },
      {
        "title": "Onboarding",
        "description": "Step-by-step guides for new employees.",
        "icon": "file",
        "link": "onboarding/overview.md"
      }
    ]
  }
}
```

## Markdown Pages

Markdown pages are `.md` files placed inside section folders. They are rendered with full formatting support.

### Formatting Support

- Headings (`#` through `######`)
- Bold, italic, strikethrough
- Ordered and unordered lists (nested)
- Tables
- Code blocks with syntax highlighting (use triple backticks with a language identifier)
- Blockquotes
- Horizontal rules
- Links and images
- Mermaid diagrams (use a `mermaid` code block)

### Conventions

- Use a single `# Heading` at the top of the page as the title
- Use `##` for main sections and `###` for subsections
- Use code blocks with language identifiers for syntax highlighting:

````
```sql
SELECT * FROM customers WHERE active = true;
```

```bash
npm install
npm start
```

```json
{ "key": "value" }
```
````

### Example Markdown Page

```markdown
# Remote Work Policy

This policy outlines the guidelines for remote work at our company.

## Eligibility

All full-time employees who have completed their probation period are eligible for remote work.

- Minimum 3 months of employment
- Manager approval required
- Role must be compatible with remote work

## Equipment

The company provides the following for remote workers:

| Item | Provided | Notes |
|------|----------|-------|
| Laptop | Yes | Standard issue |
| Monitor | Yes | On request |
| Keyboard/Mouse | Yes | On request |
| Internet stipend | Yes | $50/month |

## Working Hours

> Core hours are 10:00 AM to 3:00 PM in your local timezone. Outside of core hours, you may set your own schedule.

1. Log in to Slack by 10:00 AM
2. Attend all scheduled meetings
3. Update your status when away
4. Log at least 8 hours per day
```

## JSON Data Catalog Schema

JSON data catalog files document database schemas. They render as structured table cards in the UI.

### Schema

```json
{
  "layer": "Layer Name",
  "description": "Description of this data layer and its source system.",
  "tables": [
    {
      "name": "table_name",
      "description": "What this table contains",
      "domain": "Business Domain",
      "columns": [
        {
          "name": "column_name",
          "type": "SQL_TYPE",
          "description": "What this column represents",
          "primary_key": false,
          "nullable": true
        }
      ]
    }
  ]
}
```

### Field Reference

**Top level:**

| Field | Type | Description |
|-------|------|-------------|
| `layer` | string | Name of the data layer (e.g., "Core ERP", "Analytics Warehouse") |
| `description` | string | What this layer contains and where it comes from |
| `tables` | array | List of table definitions |

**Table object:**

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Table name as it appears in the database |
| `description` | string | Business-friendly description of the table's purpose |
| `domain` | string | Business domain (e.g., "Sales", "HR", "Finance") |
| `columns` | array | List of column definitions |

**Column object:**

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Column name |
| `type` | string | SQL data type (INT, VARCHAR(N), DECIMAL(N,M), DATE, TIMESTAMP, BOOLEAN, TEXT) |
| `description` | string | Business-friendly description |
| `primary_key` | boolean | `true` if this column is part of the primary key |
| `nullable` | boolean | `true` if NULL values are allowed |

### Example Data Catalog File

```json
{
  "layer": "Inventory System",
  "description": "Product inventory tracking across warehouses. Source: internal WMS.",
  "tables": [
    {
      "name": "products",
      "description": "Master product catalog with pricing and categorization",
      "domain": "Product",
      "columns": [
        {
          "name": "product_id",
          "type": "INT",
          "description": "Unique product identifier",
          "primary_key": true,
          "nullable": false
        },
        {
          "name": "name",
          "type": "VARCHAR(200)",
          "description": "Product display name",
          "primary_key": false,
          "nullable": false
        },
        {
          "name": "sku",
          "type": "VARCHAR(50)",
          "description": "Stock keeping unit code",
          "primary_key": false,
          "nullable": false
        },
        {
          "name": "category",
          "type": "VARCHAR(100)",
          "description": "Product category for grouping and filtering",
          "primary_key": false,
          "nullable": true
        },
        {
          "name": "unit_price",
          "type": "DECIMAL(10,2)",
          "description": "Current unit price in local currency",
          "primary_key": false,
          "nullable": false
        },
        {
          "name": "created_at",
          "type": "TIMESTAMP",
          "description": "Record creation timestamp",
          "primary_key": false,
          "nullable": false
        }
      ]
    },
    {
      "name": "warehouses",
      "description": "Physical warehouse locations and capacity",
      "domain": "Logistics",
      "columns": [
        {
          "name": "warehouse_id",
          "type": "INT",
          "description": "Unique warehouse identifier",
          "primary_key": true,
          "nullable": false
        },
        {
          "name": "name",
          "type": "VARCHAR(100)",
          "description": "Warehouse display name",
          "primary_key": false,
          "nullable": false
        },
        {
          "name": "location",
          "type": "VARCHAR(200)",
          "description": "Physical address or region",
          "primary_key": false,
          "nullable": false
        },
        {
          "name": "capacity",
          "type": "INT",
          "description": "Maximum storage units",
          "primary_key": false,
          "nullable": true
        }
      ]
    }
  ]
}
```

## Content Index (Auto-Generated)

The `content-index.json` file inside each portal folder is **auto-generated by the server**. Do not create or edit it manually. When the server starts, it scans the portal's folder structure and generates the index automatically, assigning UUIDs and timestamps to each section and page.

If you add files directly to the filesystem, restart the server to trigger index generation.

## Complete Example: Creating a Portal

To create an "HR Policies" portal with two sections, create this folder structure:

```
portals/
└── hr-policies/
    ├── portal.json
    ├── policies/
    │   ├── overview.md
    │   ├── leave-policy.md
    │   ├── code-of-conduct.md
    │   └── remote-work.md
    └── onboarding/
        ├── overview.md
        ├── first-day-checklist.md
        └── systems-access.md
```

With this `portal.json`:

```json
{
  "title": "HR Policies",
  "subtitle": "Employee handbooks, policies, and procedures",
  "icon": "book",
  "order": 2,
  "welcome": {
    "title": "HR Policies",
    "subtitle": "Find company policies, onboarding guides, and HR procedures.",
    "cards": [
      {
        "title": "Policies",
        "description": "Leave, conduct, remote work, and benefits policies.",
        "icon": "file",
        "link": "policies/overview.md"
      },
      {
        "title": "Onboarding",
        "description": "Step-by-step guides for new employees.",
        "icon": "file",
        "link": "onboarding/overview.md"
      }
    ]
  }
}
```

Start the server. The portal appears in the tab bar with both sections in the sidebar, and all pages are discoverable and searchable.
