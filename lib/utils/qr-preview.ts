// ---------------------------------------------------------------------------
// The QR settings' phone preview shows the real guest page with the unsaved
// draft laid over what was published — the welcome screen, the ordering
// switches, the minimum, which items show. Pickup slots stay as published:
// the server works them out. Pure and tested; the page only applies it.
// ---------------------------------------------------------------------------
import type { PublicQrMenu } from '@/lib/api/public-ordering.service';
import type { QrOrderingContent } from '@/lib/api/qr-ordering.service';

/** The message the settings page sends its preview frame, and the one the frame answers with when it's ready. */
export const QR_PREVIEW_MESSAGE = 'duma:qr-preview';
export const QR_PREVIEW_READY = 'duma:qr-preview-ready';

export interface QrPreviewDraft {
  isEnabled: boolean;
  isPaused: boolean;
  cardEnabled: boolean;
  cashEnabled: boolean;
  minimumOrderAmount: string;
  content: QrOrderingContent;
  /** Item id → shown. Absent means shown. */
  visibility: Record<string, boolean>;
}

export function applyQrPreview(menu: PublicQrMenu, draft: QrPreviewDraft): PublicQrMenu {
  const taking = draft.isEnabled && !draft.isPaused && (draft.cardEnabled || draft.cashEnabled);
  return {
    ...menu,
    content: { ...menu.content, ...draft.content },
    ordering: {
      ...menu.ordering,
      paused: draft.isPaused || !draft.isEnabled,
      cardEnabled: draft.cardEnabled,
      cashEnabled: draft.cashEnabled,
      minimumOrderAmount: draft.minimumOrderAmount,
      canCheckout: menu.ordering.isOpenNow && taking,
    },
    categories: menu.categories
      .map((category) => ({ ...category, items: category.items.filter((item) => draft.visibility[item.id] !== false) }))
      .filter((category) => category.items.length > 0),
  };
}
