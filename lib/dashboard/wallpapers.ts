/** The dashboard's wallpapers, behind the widgets. Each is a soft gradient that starts near the page's own ground,
 *  so the banners and controls at the top stay readable; the widgets themselves are opaque cards. */
export interface DashboardWallpaper {
  id: string;
  label: string;
  src: string;
}

export const DASHBOARD_WALLPAPERS: DashboardWallpaper[] = [
  { id: 'terracotta', label: 'Terracotta', src: '/dashboard/wallpapers/terracotta.webp' },
  { id: 'sage', label: 'Sage', src: '/dashboard/wallpapers/sage.webp' },
  { id: 'dusk', label: 'Dusk', src: '/dashboard/wallpapers/dusk.webp' },
];

/** A stored id that is no longer offered (a wallpaper was removed) falls back to none. */
export function dashboardWallpaper(id: string | null): DashboardWallpaper | null {
  return DASHBOARD_WALLPAPERS.find((wallpaper) => wallpaper.id === id) ?? null;
}
