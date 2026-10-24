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
  <img src="https://img.shields.io/badge/Vibe%20Coded-with%20AI-8b5cf6?logo=sparkles&logoColor=white" alt="Vibe Coded" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="https://tauri.app/"><img src="https://img.shields.io/badge/Tauri-v2-24c8db?logo=tauri&logoColor=white" alt="Tauri v2" /></a>
  <a href="https://www.rust-lang.org/"><img src="https://img.shields.io/badge/Rust-1.80+-orange?logo=rust&logoColor=white" alt="Rust 1.80+" /></a>
</p>

<p align="center">
  <img src="docs/screenshots/app-main.png" alt="Interface Studio FileMint et comparateur temps réel" width="850" />
</p>

> [!NOTE]
> **✨ Projet Vibe-Codé avec IA**  
> FileMint est une application entièrement conçue et **vibe-codée avec une IA** (Google DeepMind Antigravity). L'intégralité du code (moteurs natifs en Rust, interface React & Tailwind, tests unitaires, intégration système Windows/macOS/Linux) a été développée en pair programming interactif avec l'IA.

---

## 🌟 Principes Fondateurs

1. **🔒 100 % Local & Privé :** Aucune donnée, photo ou document ne quitte jamais votre machine. Aucun compte requis, aucune dépendance cloud, zéro collecte de télémétrie.
2. **⚡ Performance Native :** Moteur d'encodage et de traitement de flux multi-threadé écrit en Rust (`image`, `oxipng`, `lopdf`, `rayon`).
3. **🛡️ Sanctuarisation des Originaux :** Vos fichiers source restent intacts. Les sorties sont enregistrées par défaut dans un sous-dossier sécurisé (personnalisable, ex. `./FileMint/` ou `./Optimisé/`), avec prévention intelligente d'écrasement accidentel.
4. **👁️ Prévisualisation Temps Réel :** Comparateur split et côte à côte avec calcul instantané en mémoire du gain de poids avant tout enregistrement.
5. **🪟 Intégration Système :** Menu contextuel Windows 11 moderne & classique, actions rapides macOS Finder et support Linux universel (`xdg-open`).

---

## 📸 Captures d'Écran & Déroulement

### 1. Dépôt de fichiers ou Menu Contextuel
Glissez-déposez vos fichiers ou ouvrez-les d'un clic droit dans l'Explorateur Windows / Finder :

<p align="center">
  <img src="docs/screenshots/dropzone.png" alt="Écran de dépôt FileMint" width="800" />
</p>

### 2. Studio de Retouche & Optimisation d'Images
Ajustez dimensions, qualité, format et métadonnées avec prévisualisation instantanée avant/après :

<p align="center">
  <img src="docs/screenshots/app-main.png" alt="Studio d'optimisation d'images" width="800" />
</p>

### 3. Profils de Compression PDF
Basculez en un clic entre Lisible, Équilibré et Compact :

<p align="center">
  <img src="docs/screenshots/pdf-compression.png" alt="Profils de compression PDF" width="800" />
</p>

### 4. Bilan du Traitement & Transparence
Visualisez le gain d'espace disque obtenu, les fichiers renommés et ouvrez le dossier en un clic :

<p align="center">
  <img src="docs/screenshots/results-summary.png" alt="Écran de résultats FileMint" width="800" />
</p>

---

## 🚀 Fonctionnalités Clés

### 🖼️ Traitement d'Images
- **Dimensions & Redimensionnement :**
  - Dimensions en pixels, pourcentages, limitation maximale (*Max bounds*, ex. 1920×1080).
  - Préservation du ratio d'aspect, blocage de l'agrandissement (*no upscale*).
- **Retouche & Effets :**
  - Rotation (0°, 90°, 180°, 270°), retournement miroir horizontal/vertical, conversion monochrome (N&B).
- **Compression intelligente :**
  - Curseur de qualité continue (10–100) et préréglages rapides (Léger, Équilibré, Max).
  - Mode sans perte (*Lossless*) pour PNG et WebP.
  - **Débrayage de la compression :** possibilité de désactiver totalement la compression pour conserver les flux d'origine au bit près.
- **Protection de la vie privée (Métadonnées) :**
  - Suppression sélective des coordonnées GPS tout en préservant les paramètres de prise de vue.
  - Nettoyage total des métadonnées (EXIF, GPS, auteur, modèle d'appareil).
- **Conversion multi-format :**
  - Prise en charge JPEG, PNG (avec canal alpha), WebP, AVIF (AV1 haute efficacité), BMP, GIF, TIFF.

### 📄 Documents PDF
- **3 Profils de compression locale :**
  - *Lisible* (~200-250 DPI) : clarté optimale pour documents bureautiques et impression.
  - *Équilibré* (~150 DPI) : parfait pour les envois réguliers par e-mail.
  - *Compact* (~100 DPI) : idéal pour les scans de factures et l'archivage.
- **Optimisation structurelle :** Nettoyage des objets orphelins, recompression FlateDecode sans altérer les textes sélectionnables, liens ou signets.

### 🏷️ Renommage par Lot avec Masques Dynamiques
- Personnalisez vos noms de fichiers exportés grâce à des variables contextuelles :
  - `{nom}` : nom d'origine sans extension
  - `{profil}` / `{profile}` : profil de compression PDF appliqué (*lisible*, *equilibre*, *compact*)
  - `{largeur}` / `{w}` et `{hauteur}` / `{h}` : dimensions réelles finales (images)
  - `{qualite}` / `{q}` : niveau de qualité appliqué (images)
  - `{index}` (`01`, `02`...) ou `{index3}` (`001`, `002`...) : indexation séquentielle
  - `{date}` (`YYYY-MM-DD`) et `{annee}`
  - `{format}` : extension de sortie (images uniquement ; les PDF restent toujours en `.pdf`)
- **Adaptation automatique au contexte :** L'interface adapte dynamiquement les masques et variables suggérés selon que vous traitez des images ou des documents PDF (masquage automatique des variables sans objet et nettoyage automatique des séparateurs orphelins).
- Assainissement strict et automatique des caractères interdits par les systèmes de fichiers.

### 📁 Emplacement d'Exportation Configurable
- Choix de l'emplacement de destination :
  - **Sous-dossier relatif personnalisable :** définissez librement le nom du dossier (par défaut `FileMint`, ou `Optimisé`, `Web`...), à la volée ou de manière permanente dans les Réglages.
  - **Même dossier que l'original :** avec détection automatique des collisions et suffixage sécurisé `(1)`.
  - **Dossier fixe dédié :** choisissez un dossier cible absolu sur votre disque.

### ⚙️ Profils Personnalisés & Export / Import
- Créez, renommez, modifiez et supprimez vos propres profils de traitement.
- Exportez et importez vos profils au format JSON pour les synchroniser entre plusieurs postes.

---

## 💻 Téléchargement & Installation

Rendez-vous sur la page des [**Releases GitHub**](https://github.com/duboiss/FileMint/releases) pour télécharger la dernière version pour votre système d'exploitation.

| Système | Format disponible |
|---|---|
| **Windows** (10 / 11) | Installateur NSIS (`.exe`) & Package MSI (`.msi`) |
| **macOS** (Apple Silicon & Intel) | Image disque (`.dmg`) |
| **Linux** (Debian, Ubuntu, etc.) | Paquet `.deb` & binaire `.AppImage` |

> [!NOTE]
> **Remarque pour Windows (SmartScreen) :**  
> FileMint est un logiciel open-source gratuit. En l'absence de certificat de signature d'entreprise payant (plusieurs centaines d'euros par an), Windows SmartScreen peut afficher un écran d'avertissement bleu au premier lancement (*« Windows a protégé votre ordinateur »*).  
> Pour lancer l'application : cliquez sur **« Informations complémentaires »** puis sur **« Exécuter quand même »**. Le code source est entièrement public, auditable et vérifié par notre pipeline d'intégration continue GitHub Actions.

---

## 🛠️ Développement & Compilation

### Prérequis
- [Node.js](https://nodejs.org/) v22+ (v26 LTS recommandé)
- [Rust](https://rustup.rs/) v1.80+ avec `cargo`
- Outils de compilation C++ selon l'OS (Visual Studio C++ Build Tools sur Windows, Xcode CLT sur macOS, `libwebkit2gtk-4.1-dev` sur Linux).

### Instructions
```bash
# 1. Cloner le dépôt
git clone https://github.com/duboiss/FileMint.git
cd FileMint

# 2. Installer les dépendances frontend
npm install

# 3. Lancer en mode développement (Hot Reload)
npm run tauri dev

# 4. Compiler l'exécutable final optimisé
npm run tauri build
```

---

## 🤝 Contribution & Sécurité

- Pour contribuer, consultez notre [Guide de contribution](CONTRIBUTING.md).
- Pour signaler une vulnérabilité de sécurité, consultez notre [Politique de sécurité](.github/SECURITY.md).

---

## ⚖️ Licence

Ce projet est sous licence open-source [**MIT**](LICENSE).  
Copyright (c) 2026 Steven DUBOIS et les contributeurs de FileMint.
