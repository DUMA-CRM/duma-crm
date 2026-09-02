import { isWithinHours, zonedNow } from './agent-format.ts';

type OpeningHours = Record<string, { open: string; close: string } | null> | null;

export interface QrAvailabilityConfig {
  isEnabled: boolean;
  isPaused: boolean;
  cardEnabled: boolean;
  cashEnabled: boolean;
  publishedContent: unknown | null;
}

export interface QrAvailabilityLocation {
  isActive: boolean;
  timezone?: string | null;
  openingHours?: OpeningHours;
}

export type QrOrderingBlocker =
  | 'not_configured'
  | 'location_inactive'
  | 'disabled'
  | 'not_published'
  | 'paused'
  | 'hours_missing'
  | 'closed_today'
  | 'outside_trading_hours'
  | 'stripe_not_connected'
  | 'no_payment_method';

export interface QrOrderingAvailability {
  canBrowse: boolean;
  canOrder: boolean;
  blocker: QrOrderingBlocker | null;
  explanation: string;
  localDate: string;
  localTime: string;
  weekday: string;
  opens: string | null;
  closes: string | null;
}

export function explainQrOrderingAvailability(
  config: QrAvailabilityConfig | null,
  location: QrAvailabilityLocation,
  stripeConnected: boolean | null,
  now = new Date(),
): QrOrderingAvailability {
  const timeZone = location.timezone || 'Europe/London';
  const { weekday, date: localDate, time: localTime } = zonedNow(timeZone, now);
  const today = location.openingHours?.[weekday] ?? null;
  const base = {
    localDate,
    localTime,
    weekday,
    opens: today?.open ?? null,
    closes: today?.close ?? null,
  };
  const blocked = (blocker: QrOrderingBlocker, explanation: string, canBrowse = false): QrOrderingAvailability => ({
    ...base,
    canBrowse,
    canOrder: false,
    blocker,
    explanation,
  });

  if (!config) return blocked('not_configured', 'QR ordering has not been set up for this location.');
  if (!location.isActive) return blocked('location_inactive', 'This location is inactive.');
  if (!config.isEnabled) return blocked('disabled', 'QR ordering is disabled for this location.');
  if (!config.publishedContent) return blocked('not_published', 'The QR menu has not been published yet.');
  if (config.isPaused) return blocked('paused', 'New QR orders are paused. Customers can still browse the menu.', true);
  if (!location.openingHours) {
    return blocked(
      'hours_missing',
      'Trading hours have not been set for this location, so checkout cannot determine when the store is open.',
      true,
    );
  }
  if (!today) return blocked('closed_today', `The store is closed all day on ${weekday}. Customers can still browse the menu.`, true);
  if (!isWithinHours(localTime, today.open, today.close)) {
    return blocked(
      'outside_trading_hours',
      `The store is closed at ${localTime}. Today’s trading hours are ${today.open}–${today.close}. Customers can still browse the menu.`,
      true,
    );
  }

  const cardAvailable = config.cardEnabled && stripeConnected !== false;
  if (!config.cashEnabled && config.cardEnabled && stripeConnected === false) {
    return blocked(
      'stripe_not_connected',
      'Card ordering is enabled, but there is no active Stripe Online connection for this location.',
      true,
    );
  }
  if (!config.cashEnabled && !cardAvailable) {
    return blocked('no_payment_method', 'No working QR payment method is enabled.', true);
  }

  return {
    ...base,
    canBrowse: true,
    canOrder: true,
    blocker: null,
    explanation: `QR ordering is accepting orders at ${localTime}.`,
  };
}
