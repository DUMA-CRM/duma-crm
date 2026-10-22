/** Hidden disclosure fields and inactive layers must not capture keyboard focus. */
export function visibleDrawerControls(panel: HTMLElement): HTMLElement[] {
  return Array.from(
    panel.querySelectorAll<HTMLElement>(
      'summary, a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.closest('[inert], [aria-hidden="true"]') && element.getClientRects().length > 0);
}

export function isTopDrawer(panel: HTMLElement, dialogs: readonly Element[]): boolean {
  const visible = dialogs.filter((dialog) => dialog.getClientRects().length > 0);
  return visible.at(-1) === panel;
}
