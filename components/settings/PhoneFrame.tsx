'use client';

/** iPhone 17 in CSS pixels — the viewport a guest's page is actually laid out at. */
export const PHONE_VIEWPORT = { width: 402, height: 874 } as const;

// Device geometry, in the phone's own points; everything is scaled with the screen.
const SCREEN_RADIUS = 55;
const STATUS_BAR = 54;
const ISLAND = { top: 11, width: 125, height: 37 };
const HOME_BAR = { bottom: 8, width: 140, height: 5 };
const BEZEL = 6;
const RIM = 3;

/**
 * A phone around whatever renders inside it, drawn after the current iPhone:
 * a thin even bezel, a metal rim, side buttons, the Dynamic Island, a status
 * bar and the home indicator. `children` get the real viewport size and are
 * scaled down to `width`, so a page inside lays out exactly as on a phone.
 * Solid fills only — DESIGN.md rules out gradients, and the device reads fine without.
 */
export function PhoneFrame({
  width,
  children,
}: {
  width: number;
  children: (viewport: { width: number; height: number }) => React.ReactNode;
}) {
  const scale = width / PHONE_VIEWPORT.width;
  const px = (points: number) => points * scale;
  const content = { width: PHONE_VIEWPORT.width, height: PHONE_VIEWPORT.height - STATUS_BAR };

  return (
    <div className="relative mx-auto w-fit" style={{ padding: `0 ${RIM}px` }}>
      {/* Side buttons sit behind the rim: action and volume on the left, side button on the right. */}
      <SideButton side="left" top={px(150)} height={px(32)} />
      <SideButton side="left" top={px(215)} height={px(62)} />
      <SideButton side="left" top={px(290)} height={px(62)} />
      <SideButton side="right" top={px(240)} height={px(98)} />

      <div
        className="relative bg-[#44474c] shadow-[0_24px_48px_-20px_rgb(0_0_0/0.45),0_2px_6px_rgb(0_0_0/0.18)]"
        style={{ padding: RIM, borderRadius: px(SCREEN_RADIUS) + BEZEL + RIM }}
      >
        <div className="bg-black" style={{ padding: BEZEL, borderRadius: px(SCREEN_RADIUS) + BEZEL }}>
          <div
            className="relative overflow-hidden bg-background"
            style={{ width, height: px(PHONE_VIEWPORT.height), borderRadius: px(SCREEN_RADIUS) }}
          >
            <StatusBar height={px(STATUS_BAR)} scale={scale} />
            <span
              aria-hidden="true"
              className="absolute left-1/2 z-20 -translate-x-1/2 rounded-full bg-black"
              style={{ top: px(ISLAND.top), width: px(ISLAND.width), height: px(ISLAND.height) }}
            />
            <div className="absolute left-0" style={{ top: px(STATUS_BAR), width, height: px(content.height) }}>
              <div className="origin-top-left" style={{ width: content.width, height: content.height, transform: `scale(${scale})` }}>
                {children(content)}
              </div>
            </div>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 rounded-full bg-foreground/80"
              style={{ bottom: px(HOME_BAR.bottom), width: px(HOME_BAR.width), height: px(HOME_BAR.height) }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function SideButton({ side, top, height }: { side: 'left' | 'right'; top: number; height: number }) {
  return (
    <span
      aria-hidden="true"
      className="absolute w-[4px] bg-[#3a3d42]"
      style={{
        top,
        height,
        [side]: 0,
        borderRadius: side === 'left' ? '2px 0 0 2px' : '0 2px 2px 0',
      }}
    />
  );
}

/** 9:41, full signal, wifi, full battery — the picture every phone mock-up agrees on. */
function StatusBar({ height, scale }: { height: number; scale: number }) {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-background text-foreground"
      style={{ height, paddingLeft: 38 * scale, paddingRight: 32 * scale, paddingTop: 4 * scale }}
    >
      <span className="font-sans font-semibold tracking-tight" style={{ fontSize: 17 * scale }}>
        9:41
      </span>
      <span className="flex items-center" style={{ gap: 6 * scale }}>
        <svg width={18 * scale} height={12 * scale} viewBox="0 0 18 12" fill="currentColor">
          <rect x="0" y="8" width="3" height="4" rx="0.8" />
          <rect x="5" y="5.5" width="3" height="6.5" rx="0.8" />
          <rect x="10" y="3" width="3" height="9" rx="0.8" />
          <rect x="15" y="0" width="3" height="12" rx="0.8" />
        </svg>
        <svg width={16 * scale} height={12 * scale} viewBox="0 0 16 12" fill="currentColor">
          <path d="M8 2.2c2.4 0 4.6.9 6.3 2.5l1.2-1.3A10.9 10.9 0 0 0 8 .4 10.9 10.9 0 0 0 .5 3.4l1.2 1.3A9 9 0 0 1 8 2.2Z" />
          <path d="M8 5.6c1.5 0 2.9.6 3.9 1.5l1.2-1.3A7.4 7.4 0 0 0 8 3.8c-2 0-3.8.7-5.1 2l1.2 1.3c1-.9 2.4-1.5 3.9-1.5Z" />
          <path d="M8 9c.6 0 1.1.2 1.5.6L8 11.2 6.5 9.6c.4-.4.9-.6 1.5-.6Z" />
        </svg>
        <svg width={27 * scale} height={13 * scale} viewBox="0 0 27 13" fill="none">
          <rect x="0.5" y="0.5" width="23" height="12" rx="3.8" stroke="currentColor" strokeOpacity="0.4" />
          <rect x="2" y="2" width="20" height="9" rx="2.5" fill="currentColor" />
          <path d="M25 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2Z" fill="currentColor" fillOpacity="0.4" />
        </svg>
      </span>
    </div>
  );
}
