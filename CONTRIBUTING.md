# Contributing to easi-doc

Contributions are welcome from everyone — not just developers. If you want to improve the documentation, report a bug, or suggest a feature, that's just as valuable as code. For bugs and feature requests, open an [issue](https://github.com/smeador-oss/easi-doc/issues) and describe what you're seeing or what you'd like. For code or docs changes, follow the steps below.

## 1. Fork and clone

Fork the repo on GitHub, then clone your fork locally:

```bash
git clone https://github.com/YOUR_USERNAME/easi-doc.git
cd easi-doc
```

## 2. Install dependencies

```bash
npm install
```

## 3. Work on the `dev` branch

All contributions go into `dev`, not `main`. Switch to it before making changes:

```bash
git checkout dev
```

Create a feature branch off `dev` for your work:

```bash
git checkout -b your-feature-name
```

## 4. Run the app locally

```bash
npm run dev
```

The app will start and open in your browser at `http://127.0.0.1:4242`.

## 5. Submit a pull request

Push your branch and open a pull request **targeting the `dev` branch** (not `main`):

- Keep PRs focused — one feature or fix per PR
- Write a clear title and description explaining what changed and why
- If you're fixing a bug, reference the issue number (e.g. `Fixes #12`)

`main` is the stable release branch. Changes land there only via merges from `dev`.

## Testing

There are currently no automated tests. Before submitting a PR, manually test your changes end-to-end by running `npm start` and verifying that the affected feature works as expected. If you're touching auth, test both `"none"` and `"credentials"` modes. If you're touching content, test with at least one portal and a mix of markdown and JSON files.

## Code style

easi-doc uses vanilla JavaScript with no frontend framework and no TypeScript. Keep it that way. Match the style of the file you're editing — indentation, naming conventions, and module patterns are consistent throughout the codebase. No build tools are used for the frontend; what you write is what the browser runs.

## Questions?

Open an [issue](https://github.com/smeador-oss/easi-doc/issues) and we'll help you out.
