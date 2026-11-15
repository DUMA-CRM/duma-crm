import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { ChimeSound } from '@/lib/utils/chime';

/** Three lanes by stage, or one tiled grid (oldest first) with the stage on each ticket. */
export type KdsLayout = 'lanes' | 'tiles';
/** One size setting scales the whole ticket, header and items together — read from 1–3 m. */
export type KdsTextSize = 'standard' | 'large' | 'xlarge';
/** Compact fits more tickets on a small screen: tighter spacing, options on one line. */
export type KdsCardSize = 'comfortable' | 'compact';

export interface KdsDisplay {
  layout: KdsLayout;
  textSize: KdsTextSize;
  /** Hold a screen wake lock so a wall tablet never dims mid-service. */
  keepAwake: boolean;
  /** The all-day rail: every item still to make, totalled. */
  showAllDay: boolean;
  cardSize: KdsCardSize;
  /** Tap an item to strike it off (this screen only). Off where items get tapped by accident. */
  tapToStrike: boolean;
  /** Modifiers under each item. Allergens and "No …" lines show regardless. */
  showModifiers: boolean;
  /** Which sound plays for a new order. */
  sound: ChimeSound;
}

export const DEFAULT_KDS_DISPLAY: KdsDisplay = {
  layout: 'lanes',
  textSize: 'standard',
  keepAwake: true,
  showAllDay: false,
  cardSize: 'comfortable',
  tapToStrike: true,
  showModifiers: true,
  sound: 'chime',
};

// KDS display preferences, per device — the pass and the bar can be set up
// differently. Persisted so they survive navigation and reloads on the tablet.
interface KdsStore extends KdsDisplay {
  soundOn: boolean;
  setSoundOn: (soundOn: boolean) => void;
  setDisplay: (patch: Partial<KdsDisplay>) => void;
  resetDisplay: () => void;
}

export const useKdsStore = create<KdsStore>()(
  persist(
    (set) => ({
      soundOn: false,
      ...DEFAULT_KDS_DISPLAY,
      setSoundOn: (soundOn) => set({ soundOn }),
      setDisplay: (patch) => set(patch),
      resetDisplay: () => set(DEFAULT_KDS_DISPLAY),
    }),
    {
      name: 'kds-settings',
      version: 5,
      // v1 held only the chime; the display starts at the defaults. v3 dropped
      // darkScreen — the kitchen screen follows the app’s own dark mode. v5
      // (2026-11-12) dropped showToolbar: the controls moved into the app header.
      migrate: (persisted) => {
        const state = { ...DEFAULT_KDS_DISPLAY, ...(persisted as object) } as Record<string, unknown>;
        delete state.darkScreen;
        delete state.showToolbar;
        return state as unknown as KdsStore;
      },
    },
  ),
);
