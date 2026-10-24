# Security Policy 🛡️

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

---

## Security Model & Principles

1. **Zero Cloud / 100% Offline**: FileMint does not transmit any images, PDF contents, file names, or metadata to external servers or cloud services. All file operations occur entirely on the local device.
2. **Safe Memory Operations**: The core image and PDF processing engines are written in safe Rust, reducing vulnerability risks related to buffer overflows or memory safety.
3. **No Unwanted Overwrite**: FileMint never overwrites original source files by default; processed items are saved in an isolated subfolder or given a distinct collision-resistant filename.
4. **Discreet Network Access**: The application performs only a single optional network request at startup to check for newer GitHub releases (`https://api.github.com/repos/duboiss/FileMint/releases/latest`). This check can be fully disabled in **Settings**.

---

## Reporting a Vulnerability

If you discover a security vulnerability in FileMint:

1. **Please do not open a public issue.**
2. Send an advisory report via [GitHub Private Vulnerability Reporting](https://github.com/duboiss/FileMint/security/advisories/new) or directly contact the maintainer at `git@duboiss.fr`.
3. Include details of the vulnerability, steps or files required to reproduce it, and the potential impact.
4. You will receive an acknowledgment within 48 hours and regular updates on fix progress.
