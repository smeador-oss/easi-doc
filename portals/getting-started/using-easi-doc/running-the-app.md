# Running the App

## Starting easi-doc

There are two ways to run easi-doc:

### Option 1: Standalone Executable (Windows)

Double-click `easi-doc.exe`. The app starts and opens your browser automatically to `http://localhost:3000`.

### Option 2: Node.js

If you have Node.js installed, run from the project directory:

```bash
npm start
```

Then open `http://localhost:3000` in your browser.

> To use a different port, set the `PORT` environment variable before starting:
> `PORT=8080 npm start`

## Configuration

The main configuration file is `config.json` in the project root.

```json
{
  "name": "easi-doc",
  "subtitle": "Simple Documentation Portal",
  "logo": "assets/images/easi-doc-logo.svg",
  "auth": {
    "mode": "credentials"
  },
  "colors": {
    "primary": "#0052FF",
    "accent": "#00D4FF"
  }
}
```

| Field | Purpose |
|-------|---------|
| `name` | App name shown in the header |
| `subtitle` | Tagline shown below the app name |
| `logo` | Path to your logo image (relative to `public/`) |
| `auth.mode` | `"credentials"` for password-protected admin, or `"none"` for open access |
| `colors.primary` | Primary brand color (hex) |
| `colors.accent` | Accent color used for highlights (hex) |

## Authentication

### First-Time Setup

When `auth.mode` is set to `"credentials"` and no admin account exists, the first visitor sees a setup screen. Fill in:

1. **Display name** -- Your name as shown in the app
2. **Username** -- Your login username
3. **Password** -- Must meet the minimum length (default: 8 characters)
4. **Confirm password**

After setup, you are automatically logged in and redirected to the dashboard.

### Signing In

Click the **Sign In** button in the top-right corner of the header. Enter your username and password.

> After 10 failed login attempts, the account is locked for 5 minutes. This resets when the server restarts.

### Adding More Admins

From the admin panel (gear icon in the header), you can add additional admin accounts. New admins receive a temporary password and must change it on their first login.

### Open Access Mode

If you don't need admin controls, set `auth.mode` to `"none"` in `config.json`. This disables the sign-in button, admin panel, and all content editing features. The app becomes a read-only documentation viewer.

## Data Storage

All data is stored locally in flat files:

| Location | Contents |
|----------|----------|
| `portals/` | All portal content (markdown, JSON, portal configs) |
| `data/admins.json` | Admin user accounts (passwords are hashed) |
| `config.json` | Global app configuration |

There is no database. To back up your documentation, copy the entire project folder.
