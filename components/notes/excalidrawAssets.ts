// Imported before @excalidraw/excalidraw, so its fonts load from this app
// (copied there by scripts/copy-excalidraw-fonts.mjs) instead of a CDN the CSP refuses.
declare global {
  interface Window {
    EXCALIDRAW_ASSET_PATH?: string;
  }
}

if (typeof window !== 'undefined') window.EXCALIDRAW_ASSET_PATH = '/excalidraw-assets/';

export {};
