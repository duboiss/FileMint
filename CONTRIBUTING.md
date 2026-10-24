# Contributing to FileMint 🍃

Thank you for your interest in contributing to FileMint! We welcome bug reports, feature requests, documentation improvements, and code contributions.

---

## 🛠️ Development Setup

FileMint is built with **Tauri v2**, **Rust** (native engines), and **React 18 / TypeScript / Tailwind CSS** (frontend).

### Prerequisites

- **Node.js**: v22 or later (v26 LTS recommended)
- **Rust**: 1.80+ (`rustup`, `cargo`)
- **OS specific build tools**:
  - **Windows**: Visual Studio 2022 C++ Build Tools (`x86_64-pc-windows-msvc`)
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
  - **Linux (Ubuntu/Debian)**:
    ```bash
    sudo apt-get update
    sudo apt-get install -y libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
    ```

### Clone & Install

```bash
git clone https://github.com/duboiss/FileMint.git
cd FileMint
npm install
```

### Running in Development

```bash
# Start Vite frontend and Tauri desktop window
npm run tauri dev
```

---

## 🧪 Testing & Quality Standards

Before submitting a pull request, ensure all checks pass:

1. **Frontend Type Check & Build**:
   ```bash
   npm run build
   ```
2. **Rust Unit Tests**:
   ```bash
   cargo test --manifest-path src-tauri/Cargo.toml
   ```
3. **Rust Clippy (Linter)**:
   ```bash
   cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
   ```
4. **Rust Formatting**:
   ```bash
   cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
   ```

---

## 📜 Architectural Guidelines

- **100% Offline Processing**: FileMint must never send user images, documents, or personal data to remote servers. All transformations must be executed locally on the device.
- **Documentation & Comments**: Maintain code comments in English. Focus comments on core architecture, safety considerations, or subtle algorithms.
- **Git Commit Convention**: Follow [Conventional Commits](https://www.conventionalcommits.org/) (e.g., `feat:`, `fix:`, `docs:`, `refactor:`, `perf:`).

---

## ⚖️ License

By contributing to FileMint, you agree that your contributions will be licensed under the [MIT License](LICENSE).
