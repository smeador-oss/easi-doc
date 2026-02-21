# Contributing to easi-doc

Thanks for your interest in contributing! Here's how to get started.

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

The app will start and open in your browser at `http://127.0.0.1:3000`.

## 5. Submit a pull request

Push your branch and open a pull request **targeting the `dev` branch** (not `main`):

- Keep PRs focused — one feature or fix per PR
- Write a clear title and description explaining what changed and why
- If you're fixing a bug, reference the issue number (e.g. `Fixes #12`)

`main` is the stable release branch. Changes land there only via merges from `dev`.

## Questions?

Open an [issue](https://github.com/smeador-oss/easi-doc/issues) and we'll help you out.
