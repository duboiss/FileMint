import React, { useEffect } from 'react';
import { useFileMintStore, isTauriEnv } from './store/useFileMintStore';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { Header } from './components/Header';
import { Dropzone } from './components/Dropzone';
import { FileList } from './components/FileList';
import { ImageConfigPanel } from './components/ActionConfig/ImageConfigPanel';
import { PdfConfigPanel } from './components/ActionConfig/PdfConfigPanel';
import { SideBySidePreview } from './components/LivePreview/SideBySidePreview';
import { DestinationPicker } from './components/DestinationPicker';
import { BatchProgress } from './components/BatchProgress';
import { ResultsSummary } from './components/ResultsSummary';
import { SettingsModal } from './components/SettingsModal';
import { WelcomeLanguageModal } from './components/WelcomeLanguageModal';
import { ProgressEventPayload } from './types';

export const App: React.FC = () => {
  const {
    screen,
    files,
    activePreviewIndex,
    batchRunning,
    addFiles,
    checkUpdates,
    initSettings,
  } = useFileMintStore();

  const activeFile = files[activePreviewIndex];

  useEffect(() => {
    // Reveal window smoothly now that React DOM and initial theme are mounted
    if (isTauriEnv()) {
      import('@tauri-apps/api/window')
        .then(({ getCurrentWindow }) => {
          getCurrentWindow().show().catch(() => {});
        })
        .catch(() => {});
    }

    // Check for updates and load context menu status on startup
    checkUpdates();
    initSettings();

    // Retrieve files passed via initial CLI argument (Windows context menu / launch)
    if (isTauriEnv()) {
      invoke<string[]>('get_cli_files')
        .then((cliFiles) => {
          if (cliFiles && cliFiles.length > 0) {
            addFiles(cliFiles);
          }
        })
        .catch((err) => console.warn('Error reading initial CLI files:', err));
    } else if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const demo = params.get('demo');
      const langParam = params.get('lang');
      const themeParam = params.get('theme');

      if (langParam === 'en' || langParam === 'fr') {
        useFileMintStore.getState().setLanguage(langParam);
      }
      if (themeParam === 'dark' || themeParam === 'light') {
        useFileMintStore.getState().setTheme(themeParam);
      }

      if (demo) {
        useFileMintStore.setState({ showWelcomeModal: false });
      }

      if (demo === 'dropzone' || demo === 'home') {
        useFileMintStore.setState({ screen: 'home', files: [], showWelcomeModal: false });
      } else if (demo === 'image' || demo === 'config') {
        useFileMintStore.getState().addDemoFiles();
        useFileMintStore.setState({ showWelcomeModal: false, activePreviewIndex: 0 });
      } else if (demo === 'pdf') {
        useFileMintStore.getState().addDemoFiles();
        useFileMintStore.setState({ showWelcomeModal: false, activePreviewIndex: 1 });
      } else if (demo === 'results') {
        useFileMintStore.getState().addDemoFiles();
        useFileMintStore.setState({
          screen: 'results',
          showWelcomeModal: false,
          batchSummary: {
            total_items: 3,
            success_count: 3,
            failure_count: 0,
            total_original_bytes: 14670000,
            total_final_bytes: 4700000,
            total_saved_bytes: 9970000,
            items: [
              {
                file_name: 'Montagne-2026.jpg',
                original_size: 4850000,
                final_size: 1420000,
                success: true,
                error: null,
                output_path: 'C:\\Photos\\FileMint\\Montagne-2026.webp',
              },
              {
                file_name: 'Facture-Scanee-2026.pdf',
                original_size: 8900000,
                final_size: 2900000,
                success: true,
                error: null,
                output_path: 'C:\\Documents\\FileMint\\Facture-Scanee-2026 (1).pdf',
              },
              {
                file_name: 'Logo-FileMint.png',
                original_size: 920000,
                final_size: 380000,
                success: true,
                error: null,
                output_path: 'C:\\Design\\FileMint\\Logo-FileMint.webp',
              },
            ],
            cancelled: false,
          },
        });
      }
    }

    // Listen to processing progress events
    const unlistenProgress = listen<ProgressEventPayload>(
      'filemint://batch-progress',
      (event) => {
        useFileMintStore.setState({ batchProgress: event.payload });
      }
    );

    // Listen to files received via CLI or context menu while running
    const unlistenCli = listen<string[]>('filemint://cli-files', (event) => {
      if (event.payload && event.payload.length > 0) {
        addFiles(event.payload);
      }
    });

    // Listen to native window drag-and-drop events
    const unlistenDrop = listen<{ paths: string[] }>('tauri://drag-drop', (event) => {
      if (event.payload.paths && event.payload.paths.length > 0) {
        addFiles(event.payload.paths);
      }
    });

    // Keyboard shortcuts: Ctrl+O (open files), Ctrl+Enter (start batch)
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        try {
          const selected = await openDialog({
            multiple: true,
            filters: [
              {
                name: 'Fichiers supportés',
                extensions: ['jpg', 'jpeg', 'png', 'webp', 'avif', 'heic', 'heif', 'bmp', 'gif', 'tiff', 'pdf'],
              },
            ],
          });
          if (selected && Array.isArray(selected)) {
            useFileMintStore.getState().addFiles(selected);
          } else if (selected && typeof selected === 'string') {
            useFileMintStore.getState().addFiles([selected]);
          }
        } catch {}
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const state = useFileMintStore.getState();
        if (state.screen === 'config' && state.files.length > 0 && !state.batchRunning) {
          e.preventDefault();
          state.startBatch();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      unlistenProgress.then((f) => f());
      unlistenCli.then((f) => f());
      unlistenDrop.then((f) => f());
    };
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
      <Header />

      <main className="flex-1 flex flex-col overflow-hidden relative">
        {screen === 'home' && <Dropzone />}

        {screen === 'config' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <FileList />

            <div className="flex-1 flex overflow-hidden">
              <div className="w-[360px] xl:w-[390px] shrink-0 border-r border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
                {activeFile?.fileType === 'pdf' ? (
                  <PdfConfigPanel />
                ) : (
                  <ImageConfigPanel />
                )}
              </div>

              <SideBySidePreview />
            </div>

            <DestinationPicker />
          </div>
        )}

        {screen === 'results' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {batchRunning ? <BatchProgress /> : <ResultsSummary />}
          </div>
        )}
      </main>

      <SettingsModal />
      <WelcomeLanguageModal />
    </div>
  );
};

export default App;
