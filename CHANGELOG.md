# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.1] - 2026-02-23

### Changed
- On first launch, the exe now creates a single `easi-doc/` folder next to itself instead of extracting `public/`, `portals/`, `config.json`, and `data/` as separate items. Cleaner packaging — one exe in, one folder out.

## [1.2.0] - 2026-02-20

### Added
- **Quit button** — a power icon in the header (visible to admins, or always in open-access mode) lets you cleanly shut down the server from the browser. The page confirms when it is safe to close the tab or delete `easi-doc.exe`.
- **Auto-update of app assets on launch** — dropping a new `easi-doc.exe` into an existing folder automatically replaces the app code (`public/`) on startup. Your portals, config, and data are never touched.
- **Reopen by double-clicking** — if you close the browser tab but leave the server running, double-clicking `easi-doc.exe` again simply reopens the browser to the existing instance instead of crashing.
- **Session invalidation on restart** — stopping and restarting the server requires logging in again, so sessions don't persist beyond the current run.

### Changed
- Default port changed from `3000` to `4242` to avoid conflicts with other common local development tools.

## [1.1.1] - 2026-02-20

### Fixed
- Removed a stale Training portal (containing an internal PRD document) that was accidentally bundled into the v1.1.0 executable.

## [1.1.0] - 2026-02-20

### Changed
- `easi-doc.exe` is now fully self-contained — on first launch it automatically extracts all required assets (`public/`, `portals/`, `config.json`, `data/`) to its directory. No zip archive or extra folders needed.

### Removed
- Separate asset folders are no longer required alongside the executable for new installations.

## [1.0.1] - 2026-02-19

### Fixed
- Eliminated the terminal/console window that appeared when double-clicking `easi-doc.exe`.
- Eliminated the Windows firewall prompt by binding the server to `127.0.0.1` (loopback only) instead of all interfaces.

## [1.0.0] - 2026-02-19

### Added
- Initial release of easi-doc.
- Drag & drop import of Word documents and PDFs.
- Multi-portal organisation for different teams or topics.
- Markdown editor with live preview.
- Data catalogues for documenting databases and systems.
- Full-text search across all content.
- Password-protected admin accounts.
- REST API for AI agent integration.
- Fully portable — the entire app can be zipped and shared.

[1.2.1]: https://github.com/smeador-oss/easi-doc/releases/tag/v1.2.1
[1.2.0]: https://github.com/smeador-oss/easi-doc/releases/tag/v1.2.0
[1.1.1]: https://github.com/smeador-oss/easi-doc/releases/tag/v1.1.1
[1.1.0]: https://github.com/smeador-oss/easi-doc/releases/tag/v1.1.0
[1.0.1]: https://github.com/smeador-oss/easi-doc/releases/tag/v1.0.1
[1.0.0]: https://github.com/smeador-oss/easi-doc/releases/tag/v1.0.0
