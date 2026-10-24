# FileMint 🍃

<p align="center">
  <img src="public/logo.svg" alt="FileMint Logo" width="100" height="100" />
</p>

<p align="center">
  <strong>Fast, local, privacy-first desktop converter and batch optimizer.</strong><br>
  <em>100% Offline • AI Vibe-Coded • Zero Telemetry • High-Performance Rust Engine • Windows, macOS & Linux</em>
</p>

<p align="center">
  <a href="README.md"><img src="https://img.shields.io/badge/Language-English-10b981" alt="English version" /></a>
  <a href="README.fr.md"><img src="https://img.shields.io/badge/Langue-Français-lightgrey" alt="Version française" /></a>
</p>

<p align="center">
  <a href="https://github.com/duboiss/FileMint/releases"><img src="https://img.shields.io/github/v/release/duboiss/FileMint?color=10b981&logo=github" alt="Release" /></a>
  <a href="https://github.com/duboiss/FileMint/actions/workflows/ci.yml"><img src="https://github.com/duboiss/FileMint/actions/workflows/ci.yml/badge.svg" alt="CI Status" /></a>
  <img src="https://img.shields.io/badge/Vibe%20Coded-with%20AI-8b5cf6?logo=sparkles&logoColor=white" alt="Vibe Coded" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="https://tauri.app/"><img src="https://img.shields.io/badge/Tauri-v2-24c8db?logo=tauri&logoColor=white" alt="Tauri v2" /></a>
  <a href="https://www.rust-lang.org/"><img src="https://img.shields.io/badge/Rust-1.80+-orange?logo=rust&logoColor=white" alt="Rust 1.80+" /></a>
</p>

<p align="center">
  <img src="docs/screenshots/app-main.png" alt="FileMint Studio Interface & Live Side-by-Side Preview" width="850" />
</p>

> [!NOTE]
> **✨ AI Vibe-Coded Project**  
> FileMint was entirely designed and **vibe-coded with AI** (Google DeepMind Antigravity). All code—native Rust engines, React & Tailwind UI, unit test suites, Windows/macOS/Linux system integrations—was developed through interactive pair programming with the AI.

---

## 🌟 Core Principles

1. **🔒 100% Local & Private:** No data, photo, or document ever leaves your computer. No user account required, no cloud dependencies, zero telemetry or tracking.
2. **⚡ Native Performance:** Multi-threaded encoding and stream processing engine built in Rust (`image`, `oxipng`, `lopdf`, `rayon`).
3. **🛡️ Original Sanctuary:** Your source files remain completely untouched. Output files are saved by default into a dedicated subfolder (customizable, e.g. `./FileMint/` or `./Optimized/`), with intelligent collision resolution (`(1)`) to prevent accidental overwrites.
4. **👁️ Real-time Preview:** Split and side-by-side comparison slider with instant in-memory savings calculation before writing a single byte to disk.
5. **🪟 Native System Integration:** Windows 11 modern and classic context menus, macOS Finder quick actions, and universal Linux file manager support (`xdg-open`).

---

## 📸 Screenshots & Workflow

### 1. Drag & Drop or System Context Menu
Drop files directly or open them via right-click in Windows Explorer or macOS Finder:

<p align="center">
  <img src="docs/screenshots/dropzone.png" alt="FileMint Drag & Drop Screen" width="800" />
</p>

### 2. Live Studio & Image Optimization
Fine-tune dimensions, quality, format, and metadata with instantaneous side-by-side split visual diff:

<p align="center">
  <img src="docs/screenshots/app-main.png" alt="FileMint Live Studio" width="800" />
</p>

### 3. PDF Compression Profiles
Choose between Readable, Balanced, or Compact local optimization:

<p align="center">
  <img src="docs/screenshots/pdf-compression.png" alt="FileMint PDF Compression Profiles" width="800" />
</p>

### 4. Batch Results & Transparency
Review disk space saved, renamed files, and reveal files in one click:

<p align="center">
  <img src="docs/screenshots/results-summary.png" alt="FileMint Batch Results" width="800" />
</p>

---

## 🚀 Key Features

### 🖼️ Image Processing & Optimization
- **Dimensions & Resizing:**
  - Exact pixel dimensions, scale percentages, or maximum bounding box (*Max bounds*, e.g., 1920×1080).
  - Aspect ratio preservation, intelligent "no upscale" guard.
- **Transformations & Effects:**
  - Rotation (0°, 90°, 180°, 270°), horizontal & vertical mirror flipping, monochrome grayscale conversion.
- **Smart Compression:**
  - Continuous quality slider (10–100) and instant presets (Light, Balanced, Max).
  - Lossless compression mode for PNG and WebP.
  - **Bypass compression toggle:** Option to disable compression entirely to preserve bit-exact source streams when only resizing, rotating, or converting formats.
- **Privacy Protection (Metadata):**
  - Selective GPS stripping: removes geotags while preserving camera exposure and shooting data.
  - Complete EXIF/GPS scrubbing: full privacy sanitization.
- **Multi-Format Conversion:**
  - Full support for JPEG, PNG (with full alpha channel), WebP, AVIF (high-efficiency AV1), BMP, GIF, and TIFF.

### 📄 PDF Documents
- **3 Local Compression Profiles:**
  - *Readable* (~200–250 DPI): optimal clarity for office documents, contracts, and printing.
  - *Balanced* (~150 DPI): recommended balance for routine email distribution.
  - *Compact* (~100 DPI): aggressive compression designed for scanned invoices, receipts, and archiving.
- **Structural Optimization:** Orphan object removal, xref table restructuring, and FlateDecode recompression without altering selectable text, links, or bookmarks.

### 🏷️ Context-Aware Batch Renaming (Masks)
- Customize exported filenames with dynamic variables:
  - `{name}` / `{nom}`: Original source filename without extension.
  - `{profile}` / `{profil}`: Applied PDF profile (`readable`, `balanced`, `compact`).
  - `{width}` / `{largeur}` & `{height}` / `{hauteur}`: Actual output dimensions (images).
  - `{quality}` / `{qualite}`: Applied quality factor (images).
  - `{index}` (`01`, `02`...) or `{index3}` (`001`, `002`...): Sequential item counter.
  - `{date}` (`YYYY-MM-DD`), `{year}` / `{annee}`, `{month}` / `{mois}`, `{day}` / `{jour}`.
  - `{ext}` / `{format}`: Target file extension (images only; PDFs are strictly `.pdf`).
- **Context Sensitivity:** The UI automatically adapts shown variables and presets based on whether you are working with images or PDF documents. Image-specific tags (`{width}`, `{quality}`) are automatically hidden for PDFs, and dangling separators (`_x_`, `_q`) are cleanly stripped during processing.
- Strict filesystem sanitization for illegal characters (`/ \ : * ? " < > |`).

### 📁 Customizable Output Destinations
- Flexible destination modes:
  - **Relative Subfolder (Default):** Customize the subfolder name on the fly or permanently in Settings (e.g. `./FileMint/`, `./Optimized/`, `./Web/`).
  - **Same folder as original:** Automatic collision detection creates suffixed filenames (`doc (1).pdf`) without overwriting sources.
  - **Custom fixed directory:** Choose an absolute destination directory anywhere on your computer.

### ⚙️ Custom Profiles & JSON Import/Export
- Create, rename, edit, and delete your own processing profiles.
- Export and import your profile presets as JSON files to share across workstations.

---

## 💻 Download & Installation

Visit the [**GitHub Releases**](https://github.com/duboiss/FileMint/releases) page to download the latest installer for your operating system.

| Operating System | Available Formats |
|---|---|
| **Windows** (10 / 11) | NSIS Installer (`.exe`) & MSI Package (`.msi`) |
| **macOS** (Apple Silicon & Intel) | Disk Image (`.dmg`) |
| **Linux** (Debian, Ubuntu, etc.) | `.deb` package & standalone `.AppImage` |

> [!NOTE]
> **Notice for Windows Users (SmartScreen):**  
> FileMint is free and open-source software. Because it is not signed with an expensive enterprise certificate (costing hundreds of dollars per year), Windows SmartScreen may display a blue warning screen on first run (*"Windows protected your PC"*).  
> To launch FileMint: click **"More info"** and then **"Run anyway"**. The source code is 100% public, open-source, and verified by our automated GitHub Actions CI pipeline.

---

## 🛠️ Development & Building

### Prerequisites
- [Node.js](https://nodejs.org/) v22+ (v26 LTS recommended)
- [Rust](https://rustup.rs/) v1.80+ with `cargo`
- Platform C++ build tools (Visual Studio C++ Build Tools on Windows, Xcode CLT on macOS, `libwebkit2gtk-4.1-dev` on Linux).

### Instructions
```bash
# 1. Clone the repository
git clone https://github.com/duboiss/FileMint.git
cd FileMint

# 2. Install frontend dependencies
npm install

# 3. Start development mode (Hot Reload)
npm run tauri dev

# 4. Build optimized release binaries
npm run tauri build
```

---

## 🤝 Contributing & Security

- To contribute, please read our [Contributing Guide](CONTRIBUTING.md).
- To report a security vulnerability, please see our [Security Policy](.github/SECURITY.md).

---

## ⚖️ License

This project is licensed under the open-source [**MIT License**](LICENSE).  
Copyright (c) 2026 Steven DUBOIS and FileMint contributors.
