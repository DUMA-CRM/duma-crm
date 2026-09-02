import { apiFetch } from './client';

export interface QrOrderingContent {
  schemaVersion: 1;
  welcomeMessage: string;
  collectionInstructions: string;
  coverImageUrl: string | null;
  featuredItemIds: string[];
  categoryOrder: string[];
}

export interface QrOrderingConfig {
  id: string;
  tenantId: string;
  locationId: string;
  publicToken: string;
  isEnabled: boolean;
  isPaused: boolean;
  cardEnabled: boolean;
  cashEnabled: boolean;
  minimumOrderAmount: string;
  minimumNoticeMinutes: number;
  slotIntervalMinutes: number;
  maxOrdersPerSlot: number;
  bookingHorizonDays: number;
  draftContent: QrOrderingContent;
  publishedContent: QrOrderingContent | null;
  publishedAt: string | null;
  itemVisibility: Array<{ menuItemId: string; draftVisible: boolean; publishedVisible: boolean }>;
}

export type SaveQrOrderingConfig = Partial<
  Pick<
    QrOrderingConfig,
    | 'isEnabled'
    | 'isPaused'
    | 'cardEnabled'
    | 'cashEnabled'
    | 'minimumNoticeMinutes'
    | 'slotIntervalMinutes'
    | 'maxOrdersPerSlot'
    | 'bookingHorizonDays'
  >
> & {
  minimumOrderAmount?: number;
  content?: QrOrderingContent;
  itemVisibility?: Array<{ menuItemId: string; visible: boolean }>;
};

export const getQrOrderingConfig = (locationId: string) =>
  apiFetch<QrOrderingConfig | null>(`/qr-ordering/locations/${locationId}`);
export const saveQrOrderingConfig = (locationId: string, data: SaveQrOrderingConfig) =>
  apiFetch<QrOrderingConfig>(`/qr-ordering/locations/${locationId}`, { method: 'PUT', body: JSON.stringify(data) });
export const publishQrOrderingConfig = (locationId: string) =>
  apiFetch<QrOrderingConfig>(`/qr-ordering/locations/${locationId}/publish`, { method: 'POST' });
export const rotateQrOrderingToken = (locationId: string) =>
  apiFetch<QrOrderingConfig>(`/qr-ordering/locations/${locationId}/rotate-token`, { method: 'POST' });
