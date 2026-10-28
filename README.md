# FileMint 🍃

<p align="center">
  <img src="public/logo.svg" alt="FileMint Logo" width="100" height="100" />
</p>

<p align="center">
  <strong>Fast, local, privacy-first desktop converter and batch optimizer.</strong><br>
  <em>100% Offline • AI Vibe-Coded • Zero Telemetry • Native Rust Engine • Windows, macOS & Linux</em>
</p>

<p align="center">
  <a href="README.md"><img src="https://img.shields.io/badge/Language-English-10b981" alt="English version" /></a>
  <a href="README.fr.md"><img src="https://img.shields.io/badge/Langue-Français-lightgrey" alt="Version française" /></a>
</p>

<p align="center">
  <a href="https://github.com/duboiss/FileMint/releases"><img src="https://img.shields.io/github/v/release/duboiss/FileMint?color=10b981&logo=github" alt="Release" /></a>
  <a href="https://github.com/duboiss/FileMint/actions/workflows/ci.yml"><img src="https://github.com/duboiss/FileMint/actions/workflows/ci.yml/badge.svg" alt="CI Status" /></a>
  <a href="https://github.com/duboiss/FileMint/actions/workflows/codeql.yml"><img src="https://github.com/duboiss/FileMint/actions/workflows/codeql.yml/badge.svg" alt="CodeQL" /></a>
  <img src="https://img.shields.io/badge/Vibe%20Coded-with%20AI-8b5cf6?logo=sparkles&logoColor=white" alt="Vibe Coded" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="https://tauri.app/"><img src="https://img.shields.io/badge/Tauri-v2-24c8db?logo=tauri&logoColor=white" alt="Tauri v2" /></a>
  <a href="https://www.rust-lang.org/"><img src="https://img.shields.io/badge/Rust-1.80+-orange?logo=rust&logoColor=white" alt="Rust 1.80+" /></a>
</p>

<p align="center">
  <img src="docs/screenshots/app-main.png" alt="FileMint Studio Interface & Live Side-by-Side Preview" width="850" />
</p>

> [!NOTE]
> **✨ AI Vibe-Coded Project** — FileMint was designed and **vibe-coded with AI** (Google DeepMind Antigravity). All native Rust engines, React & Tailwind UI, and system integrations were developed through pair programming with the AI.

---

## 🌟 Core Principles

- **🔒 100% Local & Private:** No cloud, no account, zero telemetry. Files never leave your machine.
- **⚡ Native Rust Engine:** Multi-threaded image & PDF optimization (`image`, `oxipng`, `lopdf`, `rayon`).
- **🛡️ Non-Destructive:** Source files are untouched; outputs go to dedicated subfolders with collision detection.
- **👁️ Live Visual Diff:** Real-time side-by-side comparison slider with in-memory savings calculation.
- **🪟 Deep OS Integration:** Windows context menu (modern & classic), watch folders, macOS & Linux support.

---

## 📸 Interface Overview

| Drag & Drop Home | PDF Compression Profiles | Batch Results & Savings |
|:---:|:---:|:---:|
| <img src="docs/screenshots/dropzone.png" alt="Dropzone" width="280" /> | <img src="docs/screenshots/pdf-compression.png" alt="PDF Profiles" width="280" /> | <img src="docs/screenshots/results-summary.png" alt="Batch Results" width="280" /> |

---

## 🚀 Key Features

### 🖼️ Image Optimization & Conversion
- **Smart Sizing & Effects:** Pixel dimensions, percentages, max bounds, rotation (90°/180°/270°), flips, and color effects (Grayscale, Sepia, Invert, Pure B&W thresholding).
- **Target Size Mode (Max KB/MB):** Set a strict file ceiling (200 KB, 500 KB, 1 MB, 2 MB, 5 MB, or custom). FileMint automatically determines optimal quality and Lanczos downscaling via binary search.
- **Quality & Lossless:** Continuous slider (10–100), quick presets (Light, Balanced, Max), lossless PNG/WebP, or bypass compression toggle for bit-exact conversions.
- **Privacy Sanitization:** Selective GPS stripping (keeps camera settings) or complete EXIF scrub.
- **Formats:** JPEG, PNG (with alpha), WebP, AVIF, BMP, GIF, and TIFF.

### 📄 PDF Document Compression
- **3 Compression Profiles:** *Readable* (~200–250 DPI), *Balanced* (~150 DPI), and *Compact* (~100 DPI).
- **Target Size Optimization:** Fit PDFs under upload thresholds for government or career portals.
- **Structural Optimization:** FlateDecode recompression and object cleanup without altering selectable text or links.

### 📂 Automatic Watch Folders
- **Multi-Folder Background Monitoring:** Configure unlimited watched folders running concurrently in the background.
- **Per-Folder Profiles & Destinations:** Assign dedicated optimization profiles (Web, Quality, Light, or custom presets) and custom destination folders to each watched folder.
- **Drop Box Mode:** Optionally delete source files upon success (ideal for temporary drop boxes).
- **Per-Rule Control & Status:** Name, toggle, or delete rules individually, with live counter and animated pulse in the app header (`Watching active (2)`).

### 📊 Lifetime Storage Stats & Renaming
- **Lifetime Impact:** Tracks cumulative disk space saved and total files optimized (100% local, reset anytime).
- **Context-Aware Dynamic Masks:** Rename batches with `{name}`, `{profile}`, `{width}`, `{quality}`, `{date}`, `{index}`.
- **Flexible Destinations:** Subfolder (default), same directory with `(1)` collision handling, or custom path.

---

## 💻 Download & Installation

Visit [**GitHub Releases**](https://github.com/duboiss/FileMint/releases) to download the latest installer:

| Operating System | Available Formats |
|---|---|
| **Windows** (10 / 11) | NSIS Installer (`.exe`) & MSI Package (`.msi`) |
| **macOS** (Apple Silicon & Intel) | Disk Image (`.dmg`) |
| **Linux** (Debian, Ubuntu, etc.) | `.deb` package & standalone `.AppImage` |

> [!TIP]
> **Windows SmartScreen Notice:** As open-source software without an expensive enterprise certificate, Windows may show a standard SmartScreen prompt on first run. Click **"More info"** then **"Run anyway"**.

---

## 🛠️ Development & Building

```bash
# Clone and install
git clone https://github.com/duboiss/FileMint.git && cd FileMint
npm install

# Start development (Hot Reload)
npm run tauri dev

# Build production binaries
npm run tauri build
```

---

## ⚖️ License

Licensed under the open-source [**MIT License**](LICENSE). Copyright (c) 2026 Steven DUBOIS and FileMint contributors.
