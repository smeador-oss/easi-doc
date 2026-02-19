# Creating Content with AI

You don't need to know markdown or JSON to create documentation for easi-doc. AI tools like ChatGPT, Claude, or any LLM can generate well-formatted content that you paste or drop directly into the app.

## Writing Markdown Pages

### Basic Approach

1. Open your preferred AI chat tool (ChatGPT, Claude, etc.)
2. Describe what you want documented
3. Copy the output
4. Paste it into the easi-doc page editor, or save it as a `.md` file and drag it into the app

### Example Prompts

**For a policy document:**

> Write a markdown document for our company's remote work policy. Include sections for eligibility, equipment, working hours, and communication expectations. Use headings, bullet points, and a summary table at the top.

**For a how-to guide:**

> Write a step-by-step markdown guide for onboarding a new employee. Include numbered steps, a checklist at the end, and code blocks for any system commands they need to run.

**For a process document:**

> Write a markdown document describing our monthly financial close process. Include a timeline table, responsible parties for each step, and tips in blockquotes.

### Tips for Good Output

- **Ask for markdown explicitly.** Say "Write this in markdown format" to make sure you get headings, lists, and formatting rather than plain text.
- **Specify the structure.** Ask for specific sections, tables, or code blocks. The more structure you request, the better the result.
- **Request a single H1 heading.** easi-doc uses the first `# Heading` as the page title. Ask the AI to use `#` only once at the top.
- **Iterate.** If the first output isn't quite right, ask the AI to adjust specific sections rather than regenerating everything.

## Creating Data Catalog Files

easi-doc has a dedicated viewer for JSON data catalog files that document database schemas. You can ask an AI to generate these in the correct format.

### The JSON Schema Format

```json
{
  "layer": "Layer Name",
  "description": "A description of this data layer and its source.",
  "tables": [
    {
      "name": "table_name",
      "description": "What this table contains",
      "domain": "Business Domain",
      "columns": [
        {
          "name": "column_name",
          "type": "VARCHAR(100)",
          "description": "What this column represents",
          "primary_key": false,
          "nullable": true
        }
      ]
    }
  ]
}
```

### Example Prompt

> I have a database with the following tables for our inventory system:
>
> - **products**: product_id, name, sku, category, price, created_at
> - **warehouses**: warehouse_id, name, location, capacity
> - **stock_levels**: product_id, warehouse_id, quantity, last_updated
>
> Generate a JSON data catalog file in this exact format:
> - Top level: `layer` (string), `description` (string), `tables` (array)
> - Each table: `name`, `description`, `domain`, `columns` (array)
> - Each column: `name`, `type` (SQL type like VARCHAR, INT, DECIMAL, etc.), `description`, `primary_key` (boolean), `nullable` (boolean)
>
> Make the descriptions business-friendly, not technical.

### Using the Output

Save the AI's output as a `.json` file (e.g., `inventory-system.json`) and drag it into easi-doc. The app detects the catalog schema and renders it as interactive table cards with column details, types, and key indicators.

## Generating Content in Bulk

If you need to create many pages at once, you can use the folder structure approach described in the [Agent Reference](../agent-reference/overview.md) section. Give your AI agent the file structure reference and ask it to generate an entire portal's worth of content as files that you place in the `portals/` directory.

### Example Bulk Prompt

> I need to create documentation for our HR department. Create the following markdown files:
>
> 1. `overview.md` -- Introduction to HR policies
> 2. `leave-policy.md` -- Annual leave, sick leave, parental leave rules
> 3. `code-of-conduct.md` -- Workplace behavior expectations
> 4. `onboarding-checklist.md` -- Step-by-step new hire checklist
>
> For each file, use a single H1 title, H2 sections, bullet points, and tables where appropriate. Write in a professional but approachable tone.

Save each file, then place them in a section folder within your portal (e.g., `portals/hr/policies/`). Restart the app or create the pages through the admin UI.
