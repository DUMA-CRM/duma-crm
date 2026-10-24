'use client';

import { Toaster } from 'sileo';

import './AppToaster.css';

/**
 * The one sileo viewport, mounted in QueryProvider. Every toast lands
 * top-center. There is deliberately no `theme` prop: that would paint sileo's
 * own black/white fills. The DUMA look, light and dark, comes from the
 * `[data-sileo-*]` rules in AppToaster.css, which read the same tokens as the rest
 * of the app.
 */
export function AppToaster() {
  return <Toaster position="top-center" />;
}
