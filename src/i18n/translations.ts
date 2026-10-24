export type Language = 'fr' | 'en';

export interface TranslationDictionary {
  // App & Common
  appName: string;
  tagline: string;
  cancel: string;
  close: string;
  confirm: string;
  continue: string;
  save: string;
  back: string;
  delete: string;
  reset: string;
  systemLanguage: string;
  french: string;
  english: string;

  // Welcome / First Run Modal
  welcomeTitle: string;
  welcomeSubtitle: string;
  chooseLanguage: string;
  chooseLanguageDesc: string;
  getStarted: string;

  // Header
  settingsTooltip: string;
  themeLight: string;
  themeDark: string;
  themeSystem: string;
  themeSystemDesc: string;
  themeSystemWindows: string;
  chooseTheme: string;
  defaultLabel: string;

  // Dropzone
  dropTitle: string;
  dropSubtitle: string;
  selectFiles: string;
  imagesCardTitle: string;
  imagesCardSubtitle: string;
  pdfCardTitle: string;
  pdfCardSubtitle: string;
  privacyBadge: string;

  // FileList
  fileQueue: string;
  fileCountSingle: string;
  fileCountPlural: string;
  clearAll: string;
  addMore: string;
  removeFileTooltip: string;

  // Image Config Panel
  tabPresets: string;
  tabManipulate: string;
  tabResize: string;
  tabCompress: string;
  tabConvert: string;
  manipulationTitle: string;
  rotationTitle: string;
  rotate0: string;
  rotate90: string;
  rotate180: string;
  rotate270: string;
  rotateCwQuick: string;
  flipTitle: string;
  flipHorizontal: string;
  flipVertical: string;
  flipHorizontalLabel: string;
  flipVerticalLabel: string;
  colorEffectsTitle: string;
  grayscale: string;
  grayscaleDesc: string;
  resetManipulations: string;
  presetWeb: string;
  presetWebDesc: string;
  presetQuality: string;
  presetQualityDesc: string;
  presetLight: string;
  presetLightDesc: string;
  presetCustom: string;
  customProfilesTitle: string;
  createProfile: string;
  saveCurrentAsProfile: string;
  profileNamePlaceholder: string;
  profileNameRequired: string;
  maxProfilesReached: string;
  deleteProfile: string;
  renameProfile: string;
  updateProfileWithCurrent: string;
  restoreDefaultProfiles: string;
  profileUpdated: string;
  noCustomProfiles: string;
  noCustomProfilesDesc: string;
  exportProfiles: string;
  importProfiles: string;
  exportImportTitle: string;
  exportSuccess: string;
  importSuccess: string;
  importOverwriteWarning: string;
  importConfirmTitle: string;
  importConfirmMessage: string;
  importConfirmButton: string;
  importErrorInvalidJson: string;
  importErrorNoValidProfiles: string;
  detectedProfilesInFile: string;
  resizeMode: string;
  resizeNone: string;
  resizePercentage: string;
  resizeMaxBounds: string;
  resizeExact: string;
  targetPercentage: string;
  maxDimensions: string;
  maxWidth: string;
  maxHeight: string;
  exactDimensions: string;
  width: string;
  height: string;
  maintainAspect: string;
  doNotUpscale: string;
  compressionLevel: string;
  enableCompression: string;
  enableCompressionDesc: string;
  noCompression: string;
  noCompressionDesc: string;
  noCompressionTitle: string;
  noCompressionNotice: string;
  noCompressionBadge: string;
  encodingQuality: string;
  qualityLight: string;
  qualityBalanced: string;
  qualityMax: string;
  lossless: string;
  losslessDesc: string;
  metadataPrivacyTitle: string;
  metadataPrivacyDesc: string;
  metadataRemoveGps: string;
  metadataRemoveGpsDesc: string;
  metadataRemoveAll: string;
  metadataRemoveAllDesc: string;
  metadataKeepAll: string;
  metadataKeepAllDesc: string;
  gpsDetectedBadge: string;
  gpsCleanBadge: string;
  gpsDetectedNotice: string;
  outputFormatTitle: string;
  keepOriginal: string;
  keepOriginalDesc: string;
  webpDesc: string;
  avifDesc: string;
  jpegDesc: string;
  pngDesc: string;
  formatAvif: string;
  transparencyWarning: string;
  transparencyWarningDesc: string;

  // PDF Config Panel
  pdfProfileTitle: string;
  profileBalanced: string;
  profileBalancedDesc: string;
  profileReadable: string;
  profileReadableDesc: string;
  profileCompact: string;
  profileCompactDesc: string;
  advancedOptions: string;
  optimizeStructure: string;
  optimizeStructureDesc: string;
  recompressStreams: string;
  recompressStreamsDesc: string;
  pdfBadgeRecommended: string;
  pdfBadgeOffice: string;
  pdfBadgeScans: string;
  pdfSafetyNote: string;

  // Preview
  noFileSelected: string;
  initial: string;
  result: string;
  projected: string;
  calculating: string;
  previewLoading: string;
  previewUnavailable: string;
  viewSideBySide: string;
  viewSplit: string;
  viewSingle: string;
  enlarge: string;
  clickToEnlarge: string;
  zoomIn: string;
  zoomOut: string;
  resetZoom: string;
  dragToPan: string;
  shortcuts: string;
  shortcutEsc: string;
  shortcutZoom: string;
  shortcutReset: string;
  pdfProfileSelected: string;
  pdfExplanation: string;
  initialWeight: string;
  estimatedWeight: string;
  savings: string;

  // Destination & Launch
  destinationFolder: string;
  destinationAndNaming: string;
  namingPatternTitle: string;
  namingPatternDesc: string;
  namingPatternPlaceholder: string;
  namingPatternPreview: string;
  namingPresetDefault: string;
  tagOriginalName: string;
  tagWidth: string;
  tagHeight: string;
  tagQuality: string;
  tagIndex: string;
  tagDate: string;
  tagFormat: string;
  tagPdfProfile: string;
  subfolderNameLabel: string;
  subfolderNamePlaceholder: string;
  exportLocationSection: string;
  defaultExportMode: string;
  defaultSubfolderName: string;
  defaultCustomFolder: string;
  renamedNotice: string;
  sourceFile: string;
  namingPatternPdfPlaceholder: string;
  modeSubfolder: string;
  modeSubfolderDesc: string;
  modeSame: string;
  modeSameDesc: string;
  modeCustom: string;
  chooseCustom: string;
  suffixLabel: string;
  overwriteModalTitle: string;
  overwriteModalWarning: string;
  overwriteCheckbox: string;
  launchBatch: string;

  // Batch Progress & Summary
  processingTitle: string;
  cancelBatch: string;
  cancelling: string;
  batchCompleted: string;
  batchCancelled: string;
  totalFiles: string;
  spaceSaved: string;
  successRate: string;
  openDestination: string;
  newBatch: string;

  // Settings
  settingsTitle: string;
  appearance: string;
  themeDarkLabel: string;
  themeLightLabel: string;
  languageSection: string;
  defaultTabSection: string;
  defaultPresetSection: string;
  systemIntegration: string;
  contextMenuLabel: string;
  contextMenuDesc: string;
  contextMenuLevelTitle: string;
  contextMenuDisabled: string;
  contextMenuDisabledDesc: string;
  contextMenuModern: string;
  contextMenuModernDesc: string;
  contextMenuClassic: string;
  contextMenuClassicDesc: string;
  contextMenuRefreshNotice: string;
  contextMenuApplying: string;
  contextMenuBadgeRecommended: string;
  contextMenuWelcomeTitle: string;
  contextMenuWelcomeSubtitle: string;
  updatesSection: string;
  updateCheckLabel: string;
  updateCheckDesc: string;
  checkForUpdatesNow: string;
  checking: string;
  upToDate: string;
  updateAvailable: string;
  openDownloadPage: string;
  privacySection: string;
  privacyP1: string;
  privacyItem1: string;
  privacyItem2: string;
  privacyItem3: string;
  madeWithLove: string;
}

export const translations: Record<Language, TranslationDictionary> = {
  fr: {
    appName: 'FileMint',
    tagline: 'Optimiseur & convertisseur local pour images et PDF',
    cancel: 'Annuler',
    close: 'Fermer',
    confirm: 'Confirmer',
    continue: 'Continuer',
    save: 'Enregistrer',
    back: 'Retour',
    delete: 'Supprimer',
    reset: 'Réinitialiser',
    systemLanguage: 'Langue système',
    french: 'Français',
    english: 'English',

    welcomeTitle: 'Bienvenue sur FileMint',
    welcomeSubtitle: 'Traitement 100% local, hors ligne et respectueux de votre vie privée.',
    chooseLanguage: 'Choisissez la langue de l\'application :',
    chooseLanguageDesc: 'Vous pourrez modifier ce choix à tout moment dans les réglages.',
    getStarted: 'Commencer',

    settingsTooltip: 'Paramètres et préférences',
    themeLight: 'Clair',
    themeDark: 'Sombre',
    themeSystem: 'Système',
    themeSystemDesc: 'Suit automatiquement le thème de Windows',
    themeSystemWindows: 'Réglage Windows',
    chooseTheme: 'Choisissez le thème de l\'application :',
    defaultLabel: 'Défaut',

    dropTitle: 'Glissez-déposez vos fichiers ici',
    dropSubtitle: 'Prend en charge les images (JPEG, PNG, WebP, AVIF, HEIC, GIF, BMP, TIFF) et les documents PDF. Traitement par lot jusqu\'à 500 fichiers.',
    selectFiles: 'Sélectionner des fichiers',
    imagesCardTitle: 'Images & Photos',
    imagesCardSubtitle: 'Redimensionner, pivoter, miroirs, niveaux de gris et convertir vers WebP, AVIF, JPEG, PNG.',
    pdfCardTitle: 'Documents PDF',
    pdfCardSubtitle: 'Optimisation structurelle et compression locale des flux sans perte de clarté.',
    privacyBadge: '100% local & hors ligne : aucun fichier n\'est transmis à un serveur.',

    fileQueue: 'File de traitement',
    fileCountSingle: 'fichier',
    fileCountPlural: 'fichiers',
    clearAll: 'Tout effacer',
    addMore: 'Ajouter',
    removeFileTooltip: 'Retirer ce fichier',

    tabPresets: 'Profils',
    tabManipulate: 'Retouche',
    tabResize: 'Dimensions',
    tabCompress: 'Compression',
    tabConvert: 'Format',
    manipulationTitle: 'Retouche & Effets',
    rotationTitle: 'Rotation de l\'image',
    rotate0: '0° (Normale)',
    rotate90: '90° (Droite)',
    rotate180: '180° (Demi-tour)',
    rotate270: '270° (Gauche)',
    rotateCwQuick: 'Pivoter de 90°',
    flipTitle: 'Retournement (Effet miroir)',
    flipHorizontal: 'Miroir horizontal',
    flipVertical: 'Miroir vertical',
    flipHorizontalLabel: 'Horizontal',
    flipVerticalLabel: 'Vertical',
    colorEffectsTitle: 'Effets de couleur',
    grayscale: 'Niveaux de gris (Noir & Blanc)',
    grayscaleDesc: 'Convertit l\'image en monochrome pur sans altérer la netteté.',
    resetManipulations: 'Réinitialiser les retouches',
    presetWeb: 'Web',
    presetWebDesc: 'Max 1920×1080 px, format WebP, qualité 75%',
    presetQuality: 'Qualité',
    presetQualityDesc: 'Dimensions d\'origine préservées, format source, qualité 92%',
    presetLight: 'Léger',
    presetLightDesc: 'Échelle 75%, format WebP, compression renforcée (qualité 60%)',
    presetCustom: 'Personnalisé',
    customProfilesTitle: 'Profils personnalisés',
    createProfile: 'Créer un profil',
    saveCurrentAsProfile: 'Enregistrer la configuration actuelle',
    profileNamePlaceholder: 'Nom du profil (ex. : Pour mon blog 1200px)',
    profileNameRequired: 'Veuillez saisir un nom pour ce profil',
    maxProfilesReached: 'Limite maximale de 20 profils atteinte',
    deleteProfile: 'Supprimer ce profil',
    renameProfile: 'Renommer ce profil',
    updateProfileWithCurrent: 'Mettre à jour avec les réglages actuels',
    restoreDefaultProfiles: 'Rétablir les profils par défaut',
    profileUpdated: 'Profil mis à jour !',
    noCustomProfiles: 'Aucun profil personnalisé',
    noCustomProfilesDesc: 'Ajustez vos réglages (dimensions, compression, format), puis enregistrez votre profil pour le réutiliser en un clic.',
    exportProfiles: 'Exporter (JSON)',
    importProfiles: 'Importer (JSON)',
    exportImportTitle: 'Export / Import des profils',
    exportSuccess: 'Profils exportés avec succès !',
    importSuccess: 'Profils importés avec succès !',
    importOverwriteWarning: 'L\'importation écrase et remplace tous vos profils actuels.',
    importConfirmTitle: 'Écraser et importer les profils ?',
    importConfirmMessage: 'Cette opération va définitivement écraser vos profils actuels pour les remplacer par les {count} profil(s) du fichier JSON. Voulez-vous continuer ?',
    importConfirmButton: 'Écraser et importer',
    importErrorInvalidJson: 'Le fichier sélectionné n\'est pas un JSON valide.',
    importErrorNoValidProfiles: 'Aucun profil d\'image valide n\'a été trouvé dans ce fichier.',
    detectedProfilesInFile: 'Profil(s) détecté(s) dans le fichier :',
    resizeMode: 'Mode de redimensionnement',
    resizeNone: 'Conserver d\'origine',
    resizePercentage: 'Pourcentage',
    resizeMaxBounds: 'Limite maximale',
    resizeExact: 'Largeur × Hauteur',
    targetPercentage: 'Pourcentage cible :',
    maxDimensions: 'Dimensions maximales admissibles :',
    maxWidth: 'Largeur max (px)',
    maxHeight: 'Hauteur max (px)',
    exactDimensions: 'Dimensions exactes cibles :',
    width: 'Largeur (px)',
    height: 'Hauteur (px)',
    maintainAspect: 'Conserver les proportions de l\'image',
    doNotUpscale: 'Ne jamais agrandir une image plus petite',
    compressionLevel: 'Niveau de compression',
    enableCompression: 'Activer la compression',
    enableCompressionDesc: 'Optimise le poids des fichiers selon le niveau de qualité choisi',
    noCompression: 'Sans compression',
    noCompressionDesc: 'Conserve la qualité source intacte à 100% sans compression destructrice',
    noCompressionTitle: 'Compression désactivée',
    noCompressionNotice: 'Les images ne subiront aucune compression destructrice. Si aucun redimensionnement ou effet n\'est appliqué, les fichiers originaux restent strictement intacts.',
    noCompressionBadge: 'Qualité source',
    encodingQuality: 'Qualité d\'encodage :',
    qualityLight: 'Léger',
    qualityBalanced: 'Équilibré',
    qualityMax: 'Max',
    lossless: 'Compression sans perte (Lossless)',
    losslessDesc: 'Optimise les chunks PNG et WebP sans modifier un seul pixel.',
    metadataPrivacyTitle: 'Protection de la vie privée & Métadonnées',
    metadataPrivacyDesc: 'Gérez les données sensibles enregistrées dans vos photos (localisation GPS, appareil, date).',
    metadataRemoveGps: 'Supprimer le GPS uniquement',
    metadataRemoveGpsDesc: 'Recommandé : efface les coordonnées géographiques privées tout en préservant l\'appareil, la date et les réglages.',
    metadataRemoveAll: 'Supprimer toutes les métadonnées',
    metadataRemoveAllDesc: 'Nettoyage total (EXIF, GPS, auteur, appareil) pour une confidentialité maximale et des fichiers plus légers.',
    metadataKeepAll: 'Conserver toutes les métadonnées',
    metadataKeepAllDesc: 'Garde l\'intégralité des métadonnées EXIF et GPS d\'origine.',
    gpsDetectedBadge: 'GPS détecté',
    gpsCleanBadge: 'GPS anonymisé',
    gpsDetectedNotice: 'Coordonnées GPS détectées dans cette photo',
    outputFormatTitle: 'Format de fichier de sortie',
    keepOriginal: 'Conserver original',
    keepOriginalDesc: 'Même format source (GIF, BMP, etc.)',
    webpDesc: 'Moderne & ultra compact',
    avifDesc: 'Nouvelle génération AV1, compression maximale & fidélité extrême',
    jpegDesc: 'Universel pour photos',
    pngDesc: 'Gère la transparence',
    formatAvif: 'AVIF (Haute efficacité)',
    transparencyWarning: 'Attention : perte de transparence',
    transparencyWarningDesc: 'Le format JPEG ne prend pas en charge la transparence. Le fond transparent sera remplacé par du blanc.',

    pdfProfileTitle: 'Profil d\'optimisation PDF',
    profileBalanced: 'Équilibré',
    profileBalancedDesc: 'Compression standard (~45% d\'économie) sans perte visuelle de texte.',
    profileReadable: 'Lisible',
    profileReadableDesc: 'Qualité supérieure (~25% d\'économie) pour documents officiels ou archivage.',
    profileCompact: 'Compact',
    profileCompactDesc: 'Compression maximale (~65% d\'économie) recommandée pour gros scans.',
    advancedOptions: 'Optimisations structurelles',
    optimizeStructure: 'Optimisation structurelle du PDF',
    optimizeStructureDesc: 'Suppression des objets orphelins, flux dupliqués et métadonnées inutiles.',
    recompressStreams: 'Recompression des flux graphiques Flate',
    recompressStreamsDesc: 'Ré-encodage interne sans perte des flux de contenu.',
    pdfBadgeRecommended: 'Recommandé',
    pdfBadgeOffice: 'Qualité bureau',
    pdfBadgeScans: 'Scans & archives',
    pdfSafetyNote: 'Le texte sélectionnable, les liens et la mise en page sont rigoureusement préservés.',

    noFileSelected: 'Aucun fichier sélectionné.',
    initial: 'Initial :',
    result: 'Résultat :',
    projected: 'Projeté :',
    calculating: 'Calcul...',
    previewLoading: 'Génération de l\'aperçu local...',
    previewUnavailable: 'Aperçu indisponible',
    viewSideBySide: 'Vue côte à côte',
    viewSplit: 'Curseur split',
    viewSingle: 'Résultat seul',
    enlarge: 'Agrandir',
    clickToEnlarge: 'Cliquer pour afficher en grand',
    zoomIn: 'Zoom avant',
    zoomOut: 'Zoom arrière',
    resetZoom: 'Réinitialiser zoom',
    dragToPan: 'Glissez pour vous déplacer dans l\'image',
    shortcuts: 'Raccourcis :',
    shortcutEsc: 'Fermer',
    shortcutZoom: 'Zoomer',
    shortcutReset: 'Réinitialiser',
    pdfProfileSelected: 'Profil sélectionné :',
    pdfExplanation: 'Les pages vectorielles et les textes sont optimisés localement sans perte de lisibilité.',
    initialWeight: 'Poids initial',
    estimatedWeight: 'Poids estimé',
    savings: 'Économie',

    destinationFolder: 'Dossier de destination',
    destinationAndNaming: 'Dossier & Renommage',
    namingPatternTitle: 'Règle de renommage par lot (Masques)',
    namingPatternDesc: 'Utilisez des variables dynamiques pour renommer automatiquement vos fichiers.',
    namingPatternPlaceholder: 'ex. : {nom}_{largeur}x{hauteur}_q{qualite}',
    namingPatternPreview: 'Aperçu du nom généré :',
    namingPresetDefault: 'Défaut ({nom})',
    tagOriginalName: 'Nom source',
    tagWidth: 'Largeur',
    tagHeight: 'Hauteur',
    tagQuality: 'Qualité',
    tagIndex: 'Numéro (01)',
    tagDate: 'Date',
    tagFormat: 'Format',
    tagPdfProfile: 'Profil PDF',
    subfolderNameLabel: 'Nom du sous-dossier',
    subfolderNamePlaceholder: 'ex. : FileMint ou Optimisé',
    exportLocationSection: 'Emplacement d\'exportation',
    defaultExportMode: 'Comportement d\'exportation par défaut',
    defaultSubfolderName: 'Nom du sous-dossier relatif',
    defaultCustomFolder: 'Dossier fixe personnalisé',
    renamedNotice: 'Renommé automatiquement pour préserver l\'existant',
    sourceFile: 'Source',
    namingPatternPdfPlaceholder: 'ex. : {nom}_{profil}',
    modeSubfolder: 'Sous-dossier relatif (Recommandé)',
    modeSubfolderDesc: 'Crée un dossier FileMint à côté de vos fichiers sans risque d\'écrasement.',
    modeSame: 'Même dossier que l\'original',
    modeSameDesc: 'Les fichiers modifiés seront créés au même endroit avec un suffixe si besoin.',
    modeCustom: 'Dossier personnalisé...',
    chooseCustom: 'Parcourir...',
    suffixLabel: 'Suffixe optionnel (ex: _optimisé) :',
    overwriteModalTitle: 'Attention : Remplacement des fichiers originaux',
    overwriteModalWarning: 'Vous avez activé l\'écrasement direct des originaux. Cette opération est irréversible et remplacera définitivement vos fichiers sources.',
    overwriteCheckbox: 'Je comprends que les fichiers d\'origine seront définitivement écrasés',
    launchBatch: 'Lancer le traitement',

    processingTitle: 'Traitement en cours...',
    cancelBatch: 'Arrêter',
    cancelling: 'Annulation en cours...',
    batchCompleted: 'Traitement terminé avec succès !',
    batchCancelled: 'Traitement interrompu',
    totalFiles: 'Fichiers traités',
    spaceSaved: 'Espace économisé',
    successRate: 'Réussite',
    openDestination: 'Ouvrir le dossier',
    newBatch: 'Nouveau traitement',

    settingsTitle: 'Réglages de FileMint',
    appearance: 'Apparence & Thème',
    themeDarkLabel: 'Thème Sombre',
    themeLightLabel: 'Thème Clair',
    languageSection: 'Langue de l\'application',
    defaultTabSection: 'Onglet par défaut au chargement d\'image',
    defaultPresetSection: 'Profil image appliqué par défaut',
    systemIntegration: 'Intégration système (Windows)',
    contextMenuLabel: 'Menu contextuel de l\'Explorateur Windows',
    contextMenuDesc: 'Accédez à FileMint d\'un clic droit sur vos images et PDF.',
    contextMenuLevelTitle: 'Style d\'intégration dans Windows :',
    contextMenuDisabled: 'Désactivé',
    contextMenuDisabledDesc: 'Aucun raccourci au clic droit dans l\'Explorateur.',
    contextMenuModern: 'Moderne (Windows 11)',
    contextMenuModernDesc: 'Menu principal direct au clic droit.',
    contextMenuClassic: 'Classique (Windows 10)',
    contextMenuClassicDesc: 'Sous-menu « Afficher plus d\'options » ou Windows 10.',
    contextMenuRefreshNotice: 'L\'intégration classique est immédiate. L\'extension moderne s\'applique à la prochaine ouverture de l\'Explorateur ou au redémarrage.',
    contextMenuApplying: 'Configuration du menu contextuel Windows en cours...',
    contextMenuBadgeRecommended: 'Recommandé',
    contextMenuWelcomeTitle: 'Intégration au clic droit :',
    contextMenuWelcomeSubtitle: 'Choisissez comment accéder à FileMint depuis vos fichiers.',
    updatesSection: 'Mises à jour logicielles',
    updateCheckLabel: 'Vérification automatique au démarrage',
    updateCheckDesc: 'Consulte discrètement GitHub Releases (sans télémétrie ni envoi de données privées).',
    checkForUpdatesNow: 'Vérifier maintenant',
    checking: 'Vérification en cours...',
    upToDate: 'FileMint est à jour',
    updateAvailable: 'Nouvelle version disponible !',
    openDownloadPage: 'Télécharger',
    privacySection: 'Engagement de confidentialité & Traitement local',
    privacyP1: 'FileMint est conçu dès sa conception pour respecter scrupuleusement votre vie privée :',
    privacyItem1: 'Zéro télémétrie, zéro traceur, zéro cookie, aucun compte utilisateur requis.',
    privacyItem2: '100% Hors-Ligne : vos images, documents et données restent exclusivement sur votre machine.',
    privacyItem3: 'Seule une requête de lecture publique vers GitHub Releases est effectuée si la recherche de mises à jour est activée.',
    madeWithLove: 'FileMint v1.0 • Moteur natif Rust & Tauri • Conçu pour Windows 11 & macOS',
  },

  en: {
    appName: 'FileMint',
    tagline: 'Local image and PDF optimizer and converter',
    cancel: 'Cancel',
    close: 'Close',
    confirm: 'Confirm',
    continue: 'Continue',
    save: 'Save',
    back: 'Back',
    delete: 'Delete',
    reset: 'Reset',
    systemLanguage: 'System language',
    french: 'Français',
    english: 'English',

    welcomeTitle: 'Welcome to FileMint',
    welcomeSubtitle: '100% local, offline, and privacy-first file optimization.',
    chooseLanguage: 'Choose your preferred language:',
    chooseLanguageDesc: 'You can change this choice at any time in the settings.',
    getStarted: 'Get Started',

    settingsTooltip: 'Settings and preferences',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeSystem: 'System',
    themeSystemDesc: 'Automatically follows Windows theme',
    themeSystemWindows: 'Windows setting',
    chooseTheme: 'Choose application theme:',
    defaultLabel: 'Default',

    dropTitle: 'Drag and drop your files here',
    dropSubtitle: 'Supports images (JPEG, PNG, WebP, AVIF, HEIC, GIF, BMP, TIFF) and PDF documents. Batch processing up to 500 files.',
    selectFiles: 'Select files',
    imagesCardTitle: 'Images & Photos',
    imagesCardSubtitle: 'Resize, rotate, flip, grayscale, and convert to WebP, AVIF, JPEG, or PNG.',
    pdfCardTitle: 'PDF Documents',
    pdfCardSubtitle: 'Structural optimization and local stream compression without text degradation.',
    privacyBadge: '100% local & offline: no files are ever uploaded or transmitted.',

    fileQueue: 'Processing Queue',
    fileCountSingle: 'file',
    fileCountPlural: 'files',
    clearAll: 'Clear all',
    addMore: 'Add files',
    removeFileTooltip: 'Remove this file',

    tabPresets: 'Profiles',
    tabManipulate: 'Adjust',
    tabResize: 'Dimensions',
    tabCompress: 'Compression',
    tabConvert: 'Format',
    manipulationTitle: 'Adjustments & Effects',
    rotationTitle: 'Image rotation',
    rotate0: '0° (Normal)',
    rotate90: '90° (Right)',
    rotate180: '180° (Half-turn)',
    rotate270: '270° (Left)',
    rotateCwQuick: 'Rotate 90°',
    flipTitle: 'Flip (Mirror)',
    flipHorizontal: 'Flip horizontal',
    flipVertical: 'Flip vertical',
    flipHorizontalLabel: 'Horizontal',
    flipVerticalLabel: 'Vertical',
    colorEffectsTitle: 'Color effects',
    grayscale: 'Grayscale (Black & White)',
    grayscaleDesc: 'Converts image to pure monochrome while retaining crisp details.',
    resetManipulations: 'Reset adjustments',
    presetWeb: 'Web',
    presetWebDesc: 'Max 1920×1080 px, WebP format, 75% quality',
    presetQuality: 'Quality',
    presetQualityDesc: 'Original dimensions preserved, source format, 92% quality',
    presetLight: 'Light',
    presetLightDesc: '75% scale, WebP format, aggressive compression (60% quality)',
    presetCustom: 'Custom',
    customProfilesTitle: 'Custom profiles',
    createProfile: 'Create profile',
    saveCurrentAsProfile: 'Save current settings as profile',
    profileNamePlaceholder: 'Profile name (e.g., For my blog 1200px)',
    profileNameRequired: 'Please enter a name for this profile',
    maxProfilesReached: 'Maximum limit of 20 profiles reached',
    deleteProfile: 'Delete this profile',
    renameProfile: 'Rename this profile',
    updateProfileWithCurrent: 'Update with current settings',
    restoreDefaultProfiles: 'Restore default profiles',
    profileUpdated: 'Profile updated!',
    noCustomProfiles: 'No custom profiles yet',
    noCustomProfilesDesc: 'Adjust your settings (resize, compression, format), then save your profile to reuse it in a single click.',
    exportProfiles: 'Export (JSON)',
    importProfiles: 'Import (JSON)',
    exportImportTitle: 'Profiles Export / Import',
    exportSuccess: 'Profiles exported successfully!',
    importSuccess: 'Profiles imported successfully!',
    importOverwriteWarning: 'Importing will overwrite and replace all of your existing profiles.',
    importConfirmTitle: 'Overwrite and import profiles?',
    importConfirmMessage: 'This will permanently overwrite your current profiles with the {count} profile(s) from the JSON file. Do you want to continue?',
    importConfirmButton: 'Overwrite & Import',
    importErrorInvalidJson: 'The selected file is not a valid JSON file.',
    importErrorNoValidProfiles: 'No valid image profiles were found in this file.',
    detectedProfilesInFile: 'Profile(s) detected in file:',
    resizeMode: 'Resize mode',
    resizeNone: 'Keep original size',
    resizePercentage: 'Percentage',
    resizeMaxBounds: 'Maximum bounds',
    resizeExact: 'Width × Height',
    targetPercentage: 'Target percentage:',
    maxDimensions: 'Maximum allowed dimensions:',
    maxWidth: 'Max width (px)',
    maxHeight: 'Max height (px)',
    exactDimensions: 'Exact target dimensions:',
    width: 'Width (px)',
    height: 'Height (px)',
    maintainAspect: 'Maintain aspect ratio',
    doNotUpscale: 'Never upscale smaller images',
    compressionLevel: 'Compression level',
    enableCompression: 'Enable compression',
    enableCompressionDesc: 'Optimizes file size based on the chosen quality level',
    noCompression: 'No compression',
    noCompressionDesc: 'Keeps source quality 100% intact with no lossy compression',
    noCompressionTitle: 'Compression disabled',
    noCompressionNotice: 'Images will not undergo any lossy compression. If no resizing or effect is applied, original files remain strictly bit-exact.',
    noCompressionBadge: 'Source quality',
    encodingQuality: 'Encoding quality:',
    qualityLight: 'Light',
    qualityBalanced: 'Balanced',
    qualityMax: 'Max',
    lossless: 'Lossless compression',
    losslessDesc: 'Optimizes PNG and WebP chunks without altering a single pixel.',
    metadataPrivacyTitle: 'Privacy & Metadata Protection',
    metadataPrivacyDesc: 'Manage sensitive data embedded in your photos (GPS location, camera, date).',
    metadataRemoveGps: 'Remove GPS only',
    metadataRemoveGpsDesc: 'Recommended: strips private geographic coordinates while keeping camera, date, and shooting settings.',
    metadataRemoveAll: 'Remove all metadata',
    metadataRemoveAllDesc: 'Full scrub (EXIF, GPS, author, camera) for maximum privacy and lighter files.',
    metadataKeepAll: 'Keep all metadata',
    metadataKeepAllDesc: 'Keeps original EXIF and GPS metadata intact.',
    gpsDetectedBadge: 'GPS detected',
    gpsCleanBadge: 'GPS stripped',
    gpsDetectedNotice: 'GPS coordinates detected in this photo',
    outputFormatTitle: 'Output file format',
    keepOriginal: 'Keep original',
    keepOriginalDesc: 'Same source format (GIF, BMP, etc.)',
    webpDesc: 'Modern & ultra compact',
    avifDesc: 'Next-gen AV1 format, maximum compression & extreme fidelity',
    jpegDesc: 'Universal for photos',
    pngDesc: 'Supports transparency',
    formatAvif: 'AVIF (High-Efficiency)',
    transparencyWarning: 'Warning: transparency loss',
    transparencyWarningDesc: 'JPEG does not support transparency. Transparent areas will be replaced with white.',

    pdfProfileTitle: 'PDF optimization profile',
    profileBalanced: 'Balanced',
    profileBalancedDesc: 'Standard compression (~45% savings) without visible text loss.',
    profileReadable: 'Readable',
    profileReadableDesc: 'Higher quality (~25% savings) for official documents or archiving.',
    profileCompact: 'Compact',
    profileCompactDesc: 'Maximum compression (~65% savings) recommended for large scans.',
    advancedOptions: 'Structural optimizations',
    optimizeStructure: 'PDF structural optimization',
    optimizeStructureDesc: 'Remove orphan objects, duplicate streams, and unused metadata.',
    recompressStreams: 'Recompress Flate graphic streams',
    recompressStreamsDesc: 'Lossless internal re-encoding of content streams.',
    pdfBadgeRecommended: 'Recommended',
    pdfBadgeOffice: 'Office quality',
    pdfBadgeScans: 'Scans & archives',
    pdfSafetyNote: 'Selectable text, hyperlinks, and document layout are strictly preserved.',

    noFileSelected: 'No file selected.',
    initial: 'Initial:',
    result: 'Result:',
    projected: 'Projected:',
    calculating: 'Calculating...',
    previewLoading: 'Generating local preview...',
    previewUnavailable: 'Preview unavailable',
    viewSideBySide: 'Side by side',
    viewSplit: 'Split slider',
    viewSingle: 'Result only',
    enlarge: 'Enlarge',
    clickToEnlarge: 'Click to view full screen',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    resetZoom: 'Reset zoom',
    dragToPan: 'Drag to pan around the image',
    shortcuts: 'Shortcuts:',
    shortcutEsc: 'Close',
    shortcutZoom: 'Zoom',
    shortcutReset: 'Reset',
    pdfProfileSelected: 'Selected profile:',
    pdfExplanation: 'Vector pages and typography are locally optimized without text degradation.',
    initialWeight: 'Initial size',
    estimatedWeight: 'Estimated size',
    savings: 'Savings',

    destinationFolder: 'Destination folder',
    destinationAndNaming: 'Folder & Renaming',
    namingPatternTitle: 'Batch Renaming Pattern (Masks)',
    namingPatternDesc: 'Use dynamic variables to automatically rename your files.',
    namingPatternPlaceholder: 'e.g.: {name}_{width}x{height}_q{quality}',
    namingPatternPreview: 'Generated name preview:',
    namingPresetDefault: 'Default ({name})',
    tagOriginalName: 'Source name',
    tagWidth: 'Width',
    tagHeight: 'Height',
    tagQuality: 'Quality',
    tagIndex: 'Index (01)',
    tagDate: 'Date',
    tagFormat: 'Format',
    tagPdfProfile: 'PDF Profile',
    subfolderNameLabel: 'Subfolder name',
    subfolderNamePlaceholder: 'e.g.: FileMint or Optimized',
    exportLocationSection: 'Export Destination',
    defaultExportMode: 'Default export behavior',
    defaultSubfolderName: 'Relative subfolder name',
    defaultCustomFolder: 'Custom fixed folder',
    renamedNotice: 'Automatically renamed to preserve existing original',
    sourceFile: 'Source',
    namingPatternPdfPlaceholder: 'e.g.: {name}_{profile}',
    modeSubfolder: 'Relative subfolder (Recommended)',
    modeSubfolderDesc: 'Creates a FileMint folder alongside your files without overwrite risk.',
    modeSame: 'Same folder as original',
    modeSameDesc: 'Modified files will be created in the same place with a suffix if needed.',
    modeCustom: 'Custom folder...',
    chooseCustom: 'Browse...',
    suffixLabel: 'Optional suffix (e.g. _optimized):',
    overwriteModalTitle: 'Warning: Overwriting original files',
    overwriteModalWarning: 'You have enabled direct overwrite of original files. This operation is irreversible and will permanently replace your source files.',
    overwriteCheckbox: 'I understand that original files will be permanently overwritten',
    launchBatch: 'Start processing',

    processingTitle: 'Processing files...',
    cancelBatch: 'Stop',
    cancelling: 'Cancelling...',
    batchCompleted: 'Processing completed successfully!',
    batchCancelled: 'Processing cancelled',
    totalFiles: 'Files processed',
    spaceSaved: 'Space saved',
    successRate: 'Success rate',
    openDestination: 'Open folder',
    newBatch: 'New batch',

    settingsTitle: 'FileMint Settings',
    appearance: 'Appearance & Theme',
    themeDarkLabel: 'Dark Theme',
    themeLightLabel: 'Light Theme',
    languageSection: 'Application Language',
    defaultTabSection: 'Default tab on image upload',
    defaultPresetSection: 'Default image profile',
    systemIntegration: 'System Integration (Windows)',
    contextMenuLabel: 'Windows Explorer Context Menu',
    contextMenuDesc: 'Access FileMint with a right-click on your images and PDFs.',
    contextMenuLevelTitle: 'Windows integration style:',
    contextMenuDisabled: 'Disabled',
    contextMenuDisabledDesc: 'No right-click shortcuts in Windows Explorer.',
    contextMenuModern: 'Modern (Windows 11)',
    contextMenuModernDesc: 'Direct top-level right-click menu.',
    contextMenuClassic: 'Classic (Windows 10)',
    contextMenuClassicDesc: 'Inside "Show more options" sub-menu or Windows 10.',
    contextMenuRefreshNotice: 'Classic integration is immediate. Modern extension applies upon next Explorer launch or restart.',
    contextMenuApplying: 'Configuring Windows context menu...',
    contextMenuBadgeRecommended: 'Recommended',
    contextMenuWelcomeTitle: 'Right-click integration:',
    contextMenuWelcomeSubtitle: 'Choose how to access FileMint from your files.',
    updatesSection: 'Software Updates',
    updateCheckLabel: 'Automatic check on startup',
    updateCheckDesc: 'Discreetly checks GitHub Releases (no telemetry, no private data sent).',
    checkForUpdatesNow: 'Check now',
    checking: 'Checking...',
    upToDate: 'FileMint is up to date',
    updateAvailable: 'New version available!',
    openDownloadPage: 'Download',
    privacySection: 'Privacy Commitment & Local Processing',
    privacyP1: 'FileMint is engineered from the ground up to scrupulously respect your privacy:',
    privacyItem1: 'Zero telemetry, zero trackers, zero cookies, no user account required.',
    privacyItem2: '100% Offline: your images, documents, and data remain strictly on your device.',
    privacyItem3: 'Only a single read request to GitHub Releases is performed if update check is enabled.',
    madeWithLove: 'FileMint v1.0 • Native Rust & Tauri Engine • Built for Windows 11 & macOS',
  },
};

export const getSystemLanguage = (): Language => {
  if (typeof navigator !== 'undefined' && navigator.language) {
    const lang = navigator.language.toLowerCase();
    if (lang.startsWith('fr')) {
      return 'fr';
    }
  }
  return 'en';
};

