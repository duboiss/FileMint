export type PlatformOS = 'windows' | 'macos' | 'linux';

/**
 * Detects the host operating system synchronously based on browser/WebView environment.
 */
export function getPlatformOS(): PlatformOS {
  if (typeof window === 'undefined') return 'windows';

  const ua = (navigator.userAgent || '').toLowerCase();
  const platform = (navigator.platform || '').toLowerCase();

  if (ua.includes('mac') || platform.includes('mac') || platform.includes('darwin')) {
    return 'macos';
  }
  if (ua.includes('linux') || platform.includes('linux')) {
    return 'linux';
  }
  return 'windows';
}
