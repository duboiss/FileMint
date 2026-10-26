# FileMint 🍃

<p align="center">
  <img src="public/logo.svg" alt="FileMint Logo" width="100" height="100" />
</p>

<p align="center">
  <strong>Convertisseur et optimiseur desktop local, rapide, respectueux de votre vie privée.</strong><br>
  <em>100% Hors-ligne • Vibe-codé avec IA • Aucune télémétrie • Moteur Rust haute performance • Windows, macOS & Linux</em>
</p>

<p align="center">
  <a href="README.md"><img src="https://img.shields.io/badge/Language-English-lightgrey" alt="English version" /></a>
  <a href="README.fr.md"><img src="https://img.shields.io/badge/Langue-Français-10b981" alt="Version française" /></a>
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
  <img src="docs/screenshots/app-main.png" alt="Interface Studio FileMint et comparateur temps réel" width="850" />
</p>

> [!NOTE]
> **✨ Projet Vibe-Codé avec IA** — FileMint est une application conçue et **vibe-codée avec une IA** (Google DeepMind Antigravity). L'ensemble des moteurs Rust, de l'interface React & Tailwind et des intégrations système a été développé en pair programming interactif.

---

## 🌟 Principes Fondateurs

- **🔒 100 % Local & Privé :** Zéro cloud, aucun compte, aucune télémétrie. Vos fichiers ne quittent jamais votre machine.
- **⚡ Performance Native :** Moteur d'optimisation d'images et PDF multi-threadé en Rust (`image`, `oxipng`, `lopdf`, `rayon`).
- **🛡️ Non Destructif :** Vos originaux restent intacts ; sorties vers des sous-dossiers dédiés avec gestion anti-écrasement.
- **👁️ Comparateur Temps Réel :** Curseur avant/après interactif et calcul instantané du gain en mémoire.
- **🪟 Intégration Système Complète :** Menu contextuel Windows (moderne & classique), dossiers surveillés, macOS et Linux.

---

## 📸 Aperçu de l'Interface

| Écran d'accueil & Dépôt | Profils de compression PDF | Bilan & Économies disque |
|:---:|:---:|:---:|
| <img src="docs/screenshots/dropzone.png" alt="Dépôt" width="280" /> | <img src="docs/screenshots/pdf-compression.png" alt="Profils PDF" width="280" /> | <img src="docs/screenshots/results-summary.png" alt="Bilan" width="280" /> |

---

## 🚀 Fonctionnalités Clés

### 🖼️ Optimisation & Conversion d'Images
- **Dimensions & Retouche :** Pixels, pourcentages, limitation maximale (*Max bounds*), rotations (90°/180°/270°), miroirs et noir & blanc.
- **Mode Taille Cible (Ko / Mo max) :** Fixez un plafond strict (200 Ko, 500 Ko, 1 Mo, 2 Mo, 5 Mo, sur-mesure). FileMint détermine la qualité optimale et le sous-échantillonnage Lanczos par dichotomie.
- **Qualité & Sans perte :** Curseur 10–100, préréglages (Léger, Équilibré, Max), mode lossless (PNG/WebP), ou débrayage complet de la compression.
- **Vie privée & Métadonnées :** Suppression sélective des coordonnées GPS ou nettoyage EXIF intégral.
- **Formats :** JPEG, PNG (avec transparence), WebP, AVIF, BMP, GIF et TIFF.

### 📄 Compression de Documents PDF
- **3 Profils Dédiés :** *Lisible* (~200–250 DPI), *Équilibré* (~150 DPI) et *Compact* (~100 DPI).
- **Compression par Taille Cible :** Respectez les limites de poids imposées par les portails administratifs et courriels.
- **Optimisation Structurelle :** Recompression FlateDecode et nettoyage d'objets sans altérer les textes sélectionnables ni les liens.

### 📂 Dossiers de Surveillance Automatique
- **Surveillance Multi-Dossiers :** Configurez autant de dossiers surveillés que vous le souhaitez, avec exécution asynchrone indépendante en arrière-plan.
- **Profils & Destinations Personnalisés :** Associez à chaque dossier surveillé son propre profil d'optimisation (Web, Qualité, Léger ou profil sur-mesure) et son dossier de sortie dédié.
- **Mode Boîte de Dépôt :** Option pour supprimer le fichier source après traitement réussi (idéal pour les dossiers temporaires de transit).
- **Contrôle & Retour Visuel :** Nommez et activez/désactivez chaque règle individuellement, avec pastille animée et compteur dynamique dans l'en-tête (`Surveillance active (2)`).

### 📊 Statistiques d'Impact & Renommage
- **Compteur à Vie :** Suivez le cumul d'espace disque économisé et de fichiers traités (100% local, réinitialisable).
- **Masques Dynamiques Contextuels :** Renommez vos lots avec `{nom}`, `{profil}`, `{largeur}`, `{qualite}`, `{date}`, `{index}`.
- **Destinations Flexibles :** Sous-dossier dédié (par défaut), même dossier avec suffixe `(1)`, ou dossier fixe personnalisé.

---

## 💻 Téléchargement & Installation

Téléchargez la dernière version sur la page [**GitHub Releases**](https://github.com/duboiss/FileMint/releases) :

| Système d'exploitation | Formats disponibles |
|---|---|
| **Windows** (10 / 11) | Installateur NSIS (`.exe`) & Paquet MSI (`.msi`) |
| **macOS** (Apple Silicon & Intel) | Image disque (`.dmg`) |
| **Linux** (Debian, Ubuntu, etc.) | Paquet `.deb` & binaire autonome `.AppImage` |

> [!TIP]
> **Avertissement Windows SmartScreen :** En tant que logiciel open source sans certificat payant d'entreprise, Windows peut afficher un écran bleu au premier lancement. Cliquez sur **« Informations complémentaires »** puis **« Exécuter quand même »**.

---

## 🛠️ Développement & Compilation

```bash
# Cloner et installer
git clone https://github.com/duboiss/FileMint.git && cd FileMint
npm install

# Lancer en mode développement (Hot Reload)
npm run tauri dev

# Compiler les binaires de production
npm run tauri build
```

---

## ⚖️ Licence

Sous licence open source [**MIT**](LICENSE). Copyright (c) 2026 Steven DUBOIS et contributeurs FileMint.
