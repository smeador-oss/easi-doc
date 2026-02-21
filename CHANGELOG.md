# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.1.0]: https://github.com/smeador-oss/easi-doc/releases/tag/v1.1.0
[1.0.1]: https://github.com/smeador-oss/easi-doc/releases/tag/v1.0.1
[1.0.0]: https://github.com/smeador-oss/easi-doc/releases/tag/v1.0.0
