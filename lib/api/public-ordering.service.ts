import { apiFetch } from './client';

export interface PublicModifierOption {
  id: string;
  label: string;
  priceAdjust: string;
  isDefault: boolean;
}

export interface PublicModifierGroup {
  id: string;
  name: string;
  minSelections: number;
  maxSelections: number | null;
  options: PublicModifierOption[];
}

export interface PublicMenuItem {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: string;
  featured: boolean;
  modifierGroups: PublicModifierGroup[];
}

export interface PublicMenuCategory {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  items: PublicMenuItem[];
}

export interface PublicQrMenu {
  brand: { name: string };
  location: { name: string; address: string; phone: string | null; timeZone: string };
  content: {
    schemaVersion: 1;
    welcomeMessage: string;
    collectionInstructions: string;
    coverImageUrl: string | null;
    featuredItemIds: string[];
    categoryOrder: string[];
  };
  ordering: {
    paused: boolean;
    isOpenNow: boolean;
    canCheckout: boolean;
    cardEnabled: boolean;
    cashEnabled: boolean;
    minimumOrderAmount: string;
    slots: Array<{ value: string; label: string; dateLabel: string }>;
  };
  categories: PublicMenuCategory[];
  publishedAt: string | null;
}

export const getPublicQrMenu = (token: string) => apiFetch<PublicQrMenu>(`/qr-ordering/public/${encodeURIComponent(token)}`);

export const requestQrCustomerCode = (token: string, email: string) =>
  apiFetch<{ challengeToken: string; expiresInSeconds: number }>(`/qr-ordering/public/${encodeURIComponent(token)}/customer-code`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  });

export type QrCustomerVerification =
  | { linked: false; verifiedEmail: string }
  | {
      linked: true;
      verifiedEmail: string;
      customer: { firstName: string; pointsBalance: number; tier: string };
      customerLinkToken: string;
      expiresAt: string;
    };

export const verifyQrCustomerCode = (token: string, challengeToken: string, code: string) =>
  apiFetch<QrCustomerVerification>(`/qr-ordering/public/${encodeURIComponent(token)}/customer-code/verify`, {
    method: 'POST',
    body: JSON.stringify({ challengeToken, code }),
  });

export interface PublicQrOrder {
  orderNumber: string;
  trackingToken: string;
  status: 'pending' | 'preparing' | 'ready' | 'done' | 'cancelled' | 'expired';
  paymentStatus: 'awaiting_payment' | 'awaiting_cash_approval' | 'paid' | 'expired' | 'failed' | 'cancelled' | 'refunded';
  paymentMethod: 'stripe_online' | 'cash';
  customerName: string;
  collectionTime: string | null;
  kitchenReleaseAt: string | null;
  totalAmount: string;
  currency: string;
  expiresAt: string | null;
  acceptedAt: string | null;
  checkoutUrl: string | null;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    subtotal: string;
    modifiers: Array<{ name: string; priceAdjust: string }>;
  }>;
}

export interface CreatePublicQrOrderInput {
  idempotencyKey: string;
  customerName: string;
  collectionTime: string;
  paymentMethod: 'card' | 'cash';
  customerLinkToken?: string;
  items: Array<{ menuItemId: string; quantity: number; modifiers: Array<{ modifierId: string }> }>;
}

export const createPublicQrOrder = (token: string, input: CreatePublicQrOrderInput) =>
  apiFetch<PublicQrOrder>(`/qr-ordering/public/${encodeURIComponent(token)}/orders`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const getPublicQrOrder = (token: string, trackingToken: string) =>
  apiFetch<PublicQrOrder>(`/qr-ordering/public/${encodeURIComponent(token)}/orders/${encodeURIComponent(trackingToken)}`);
