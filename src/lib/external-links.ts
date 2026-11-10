/**
 * Clicking a web link inside the app window would navigate the whole
 * webview away from the app (losing unsaved state). Route http(s)/mailto
 * links to the system browser instead.
 */
import { openUrl } from '@tauri-apps/plugin-opener';

const EXTERNAL = /^(https?:|mailto:)/i;

export function isExternalHref(href: string | null | undefined): href is string {
  return !!href && EXTERNAL.test(href.trim());
}

function onClick(e: MouseEvent) {
  if (e.defaultPrevented || e.button !== 0) return;
  const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
  if (!a) return;
  const href = a.getAttribute('href');
  if (!isExternalHref(href)) return;
  e.preventDefault();
  openUrl(href).catch((err) => console.error('[openUrl]', err));
}

/** Install once at app start; returns an uninstall function. */
export function installExternalLinkHandler(): () => void {
  document.addEventListener('click', onClick, true);
  return () => document.removeEventListener('click', onClick, true);
}
