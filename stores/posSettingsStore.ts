import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ScannerMode = 'camera' | 'external';
/** Items straight away, or big category tiles that open into their items. */
export type MenuLayout = 'items' | 'categories';
/** Text keys (name, price, category colour) or photo keys. `compact` is the text key. */
export type TileStyle = 'photo' | 'compact';
/** What the Favourites tab holds. */
export type FavouritesMode = 'off' | 'pinned' | 'top';

export interface PosLayout {
  showSearch: boolean;
  showCategories: boolean;
  menuLayout: MenuLayout;
  tileStyle: TileStyle;
  favourites: FavouritesMode;
  /** Best sellers shown, when `favourites` is 'top'. */
  topCount: number;
  /** Colour items whose ingredients are low or out at this location. */
  stockHighlight: boolean;
  /** Swipe a ticket line left to remove it (Undo stays offered for 5 s). */
  swipeToRemove: boolean;
}

export const DEFAULT_POS_LAYOUT: PosLayout = {
  showSearch: false,
  showCategories: true,
  menuLayout: 'items',
  tileStyle: 'compact',
  favourites: 'off',
  topCount: 8,
  stockHighlight: true,
  swipeToRemove: true,
};

// Per-device till preferences (localStorage). A counter tablet keeps its own
// layout and scanner setup regardless of who signs in — the way item-grid
// layouts work on Square: the espresso bar and the pastry counter want
// different keys. Pinned favourites are kept per workspace.
interface PosSettingsStore extends PosLayout {
  /** How loyalty QR codes are read at the POS: the device camera, or a
   *  keyboard-wedge USB/Bluetooth scanner. */
  scannerMode: ScannerMode;
  /** Pinned menu item ids, in order, per workspace. */
  pinned: Record<string, string[]>;
  setScannerMode: (mode: ScannerMode) => void;
  setLayout: (patch: Partial<PosLayout>) => void;
  resetLayout: () => void;
  setPinned: (tenantId: string, ids: string[]) => void;
}

export const usePosSettingsStore = create<PosSettingsStore>()(
  persist(
    (set) => ({
      scannerMode: 'camera',
      ...DEFAULT_POS_LAYOUT,
      pinned: {},
      setScannerMode: (scannerMode) => set({ scannerMode }),
      setLayout: (patch) => set(patch),
      resetLayout: () => set(DEFAULT_POS_LAYOUT),
      setPinned: (tenantId, ids) => set((state) => ({ pinned: { ...state.pinned, [tenantId]: ids } })),
    }),
    {
      name: 'pos-settings',
      version: 5,
      // v1 held only the scanner mode; everything else starts at the defaults.
      // v3 made text keys the default (2026-11-11, pre-launch): every device moves
      // to them once, and can pick photos again in Configuration → Till.
      // v4 hid the search box by default (2026-11-11): the category strip finds
      // things faster at a counter; search is one switch away in the same place.
      // v5 turned swipe-to-remove on by default (2026-11-11); a removed line keeps its Undo.
      migrate: (persisted, version) =>
        ({
          ...DEFAULT_POS_LAYOUT,
          pinned: {},
          ...(persisted as object),
          ...(version < 3 ? { tileStyle: 'compact' } : {}),
          ...(version < 4 ? { showSearch: false } : {}),
          ...(version < 5 ? { swipeToRemove: true } : {}),
        }) as PosSettingsStore,
    },
  ),
);
