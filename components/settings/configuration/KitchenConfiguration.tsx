'use client';

import {
  CheckCircle2,
  Eye,
  EyeOff,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Sun,
  Volume2,
  VolumeX,
} from '@/components/icons';
import { ChoiceGrid } from '@/components/onboarding/ChoiceGrid';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { SettingRow, SettingRows, Switch } from '@/components/settings/controls';
import { ChoiceCards } from '@/components/shared/FormParts';
import { Button } from '@/components/ui/button';

import { CHIME_SOUNDS, chime } from '@/lib/utils/chime';
import { cn } from '@/lib/utils/cn';
import { DEFAULT_KDS_DISPLAY, type KdsCardSize, type KdsDisplay, type KdsLayout, type KdsTextSize, useKdsStore } from '@/stores/kdsStore';

import { ConfigurationHeader, useMounted } from './shared';

const LAYOUTS = [
  { value: 'lanes', label: 'Lanes', detail: 'New, Preparing and Ready side by side.', icon: LayoutDashboard },
  { value: 'tiles', label: 'Tiles', detail: 'One grid, oldest first, the stage on each ticket.', icon: LayoutGrid },
] as const;

export function KitchenConfiguration() {
  const mounted = useMounted();
  const settings = useKdsStore();
  const set = (patch: Partial<KdsDisplay>) => settings.setDisplay(patch);
  const isDefault = (Object.keys(DEFAULT_KDS_DISPLAY) as (keyof KdsDisplay)[]).every((key) => settings[key] === DEFAULT_KDS_DISPLAY[key]);

  if (!mounted) return <div className="h-60 animate-pulse rounded-lg bg-band/50" aria-busy="true" />;

  return (
    <div className="space-y-5">
      <ConfigurationHeader
        title="Kitchen screen"
        description="How the kitchen display on this device looks and alerts the team. Changes apply straight away."
      />
      <SettingsTabBody stickyAside aside={<KitchenPreview display={settings} />}>
        <SettingsSection title="Layout">
          <ChoiceGrid<KdsLayout>
            label="Layout"
            shortcuts={false}
            selected={[settings.layout]}
            onChange={(layout) => set({ layout })}
            choices={LAYOUTS}
          />
        </SettingsSection>

        <SettingsSection title="Tickets" description="Sized for reading across a kitchen. Larger text fits fewer tickets on screen.">
          <p className="mb-2 text-label uppercase text-muted-foreground">Text size</p>
          <ChoiceCards<KdsTextSize>
            columns={3}
            value={settings.textSize}
            onChange={(textSize) => set({ textSize })}
            options={[
              { value: 'standard', label: 'Standard' },
              { value: 'large', label: 'Large' },
              { value: 'xlarge', label: 'Extra large' },
            ]}
          />
          <p className="mb-2 mt-5 text-label uppercase text-muted-foreground">Ticket size</p>
          <ChoiceCards<KdsCardSize>
            value={settings.cardSize}
            onChange={(cardSize) => set({ cardSize })}
            options={[
              { value: 'comfortable', label: 'Comfortable' },
              { value: 'compact', label: 'Compact — options on one line' },
            ]}
          />
          <div className="mt-5 border-t border-rule/40 pt-4">
            <SettingRows>
              <SettingRow
                icon={CheckCircle2}
                title="Tap an item to mark it done"
                description="Strikes the item through on this screen while the rest is made. Turn off if items get tapped by accident."
              >
                <Switch
                  label="Tap an item to mark it done"
                  checked={settings.tapToStrike}
                  onChange={(tapToStrike) => set({ tapToStrike })}
                />
              </SettingRow>
              <SettingRow
                icon={SlidersHorizontal}
                title="Show modifiers"
                description="Milk, size and extras under each item. “No …” lines always show."
              >
                <Switch label="Show modifiers" checked={settings.showModifiers} onChange={(showModifiers) => set({ showModifiers })} />
              </SettingRow>
              <SettingRow icon={ListChecks} title="All-day count" description="A side rail totalling every item still to make.">
                <Switch label="Show the all-day count" checked={settings.showAllDay} onChange={(showAllDay) => set({ showAllDay })} />
              </SettingRow>
            </SettingRows>
          </div>
        </SettingsSection>

        <SettingsSection title="Screen">
          <SettingRows>
            <SettingRow
              icon={settings.showToolbar ? Eye : EyeOff}
              title="Show the toolbar"
              description="Live status, All day, Recall, sound and full screen. Off leaves only the tickets — an offline warning still shows."
            >
              <Switch label="Show the toolbar" checked={settings.showToolbar} onChange={(showToolbar) => set({ showToolbar })} />
            </SettingRow>
            <SettingRow
              icon={Sun}
              title="Keep the screen awake"
              description="Stops a wall tablet dimming mid-service. Some browsers can’t — set auto-lock to Never there."
            >
              <Switch label="Keep the screen awake" checked={settings.keepAwake} onChange={(keepAwake) => set({ keepAwake })} />
            </SettingRow>
          </SettingRows>
        </SettingsSection>

        <SettingsSection title="Alerts">
          <SettingRows>
            <SettingRow
              icon={settings.soundOn ? Volume2 : VolumeX}
              title="Order chime"
              description="Plays when a new order arrives. Tap the screen once after it loads so the browser allows sound."
            >
              <Button variant="ghost" size="sm" onClick={() => chime(settings.sound)} aria-label="Play the order chime">
                <Play aria-hidden="true" /> Preview
              </Button>
              <Switch
                label="New-order chime"
                checked={settings.soundOn}
                onChange={(next) => {
                  settings.setSoundOn(next);
                  if (next) chime(settings.sound);
                }}
              />
            </SettingRow>
          </SettingRows>
          <p className="mb-2 mt-5 text-label uppercase text-muted-foreground">Sound</p>
          <div role="radiogroup" aria-label="Order sound" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {CHIME_SOUNDS.map((sound) => {
              const selected = settings.sound === sound.value;
              return (
                <button
                  key={sound.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    set({ sound: sound.value });
                    chime(sound.value);
                  }}
                  className={cn(
                    'flex min-h-16 items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
                    selected ? 'border-foreground bg-band/60' : 'border-rule/70 bg-background hover:bg-band/40',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-md',
                      selected ? 'bg-foreground text-background' : 'bg-band text-muted-foreground',
                    )}
                    aria-hidden="true"
                  >
                    <Play size={15} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground">{sound.label}</span>
                    <span className="block text-xs text-muted-foreground">{sound.detail}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </SettingsSection>

        <div className="flex justify-end">
          <Button variant="outline" onClick={settings.resetDisplay} disabled={isDefault} className="gap-2">
            <RotateCcw size={15} aria-hidden="true" /> Reset to defaults
          </Button>
        </div>
      </SettingsTabBody>
    </div>
  );
}

// ── Preview ──────────────────────────────────────────────────────────────────

// A quiet sketch, not a screenshot: soft tints, a few tickets, room between them.
// Theme tokens, so it follows the app's own light or dark mode.
const palette = {
  ground: 'bg-band/30',
  frame: 'border-rule/50',
  lane: 'bg-band/50',
  card: 'bg-card',
  ink: 'bg-foreground/20',
  faint: 'bg-foreground/10',
};

type Tone = 'ok' | 'approaching' | 'crashed';
type Sample = { tone: Tone; lane: number; items: number; age: number };
const SAMPLE: Sample[] = [
  { tone: 'approaching', lane: 0, items: 2, age: 70 },
  { tone: 'ok', lane: 0, items: 1, age: 20 },
  { tone: 'crashed', lane: 1, items: 2, age: 100 },
  { tone: 'ok', lane: 2, items: 1, age: 35 },
];
const LANE_TOP = ['bg-measured/50', 'bg-reference/50', 'bg-momentum/50'];
const TONE_EDGE: Record<Tone, string> = { ok: '', approaching: 'ring-1 ring-measured/45', crashed: 'ring-1 ring-exception/45' };
const TONE_BAR: Record<Tone, string> = { ok: 'bg-momentum/45', approaching: 'bg-measured/55', crashed: 'bg-exception/55' };

/** A schematic of the kitchen screen, redrawn as the settings change. */
function KitchenPreview({ display }: { display: KdsDisplay }) {
  const tiles = display.layout === 'tiles';
  const ticket = (sample: Sample, index: number) => (
    <PreviewTicket key={index} {...sample} display={display} strikeFirst={sample.tone === 'approaching'} />
  );
  return (
    <SettingsSection title="Preview" description="The kitchen screen on a landscape tablet.">
      <div
        aria-hidden="true"
        className={cn('flex aspect-[4/3] flex-col gap-2.5 overflow-hidden rounded-lg border p-2.5', palette.frame, palette.ground)}
      >
        {display.showToolbar && (
          <div className="flex h-3 shrink-0 items-center gap-2">
            <div className={cn('h-1.5 w-12 rounded-full', palette.ink)} />
            <div className="ml-auto flex items-center gap-2">
              <div className="size-1.5 rounded-full bg-momentum/60" />
              <div className={cn('h-1.5 w-8 rounded-full', palette.faint)} />
              <div className={cn('h-1.5 w-8 rounded-full', palette.faint)} />
            </div>
          </div>
        )}
        <div className="flex min-h-0 flex-1 gap-2.5">
          {tiles ? (
            <div className="grid min-w-0 flex-1 grid-cols-3 content-start gap-2.5">{SAMPLE.map(ticket)}</div>
          ) : (
            <div className="grid min-w-0 flex-1 grid-cols-3 gap-2.5">
              {[0, 1, 2].map((lane) => (
                <div key={lane} className={cn('flex min-h-0 flex-col gap-2.5 overflow-hidden rounded-md p-2', palette.lane)}>
                  <div className={cn('h-1 w-1/3 shrink-0 rounded-full', LANE_TOP[lane])} />
                  {SAMPLE.map((sample, index) => (sample.lane === lane ? ticket(sample, index) : null))}
                </div>
              ))}
            </div>
          )}
          {display.showAllDay && (
            <div className={cn('flex w-[20%] shrink-0 flex-col gap-2.5 rounded-md p-2', palette.card)}>
              <div className={cn('h-1.5 w-2/3 rounded-full', palette.ink)} />
              {[75, 55, 65].map((width) => (
                <div key={width} className={cn('h-1 rounded-full', palette.faint)} style={{ width: `${width}%` }} />
              ))}
            </div>
          )}
        </div>
      </div>
      <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
        <li>{tiles ? 'One grid, oldest first, filtered by stage tabs.' : 'New, Preparing and Ready side by side.'}</li>
        {display.cardSize === 'compact' && <li>Compact tickets — options on one line.</li>}
        {display.textSize !== 'standard' && <li>{display.textSize === 'xlarge' ? 'Extra large' : 'Large'} text — fewer tickets fit.</li>}
        <li>{display.tapToStrike ? 'Tap an item to strike it off.' : 'Items can’t be tapped — only the bump button acts.'}</li>
        {!display.showModifiers && <li>Modifiers hidden; “No …” lines still show.</li>}
        {!display.showToolbar && <li>No toolbar — just the tickets.</li>}
      </ul>
    </SettingsSection>
  );
}

function PreviewTicket({ tone, items, age, display, strikeFirst }: Sample & { display: KdsDisplay; strikeFirst: boolean }) {
  const compact = display.cardSize === 'compact';
  // Text size scales the whole ticket on the real screen; here it scales the lines.
  const scale = { standard: 1, large: 1.3, xlarge: 1.6 }[display.textSize];
  const line = 4 * scale;
  return (
    <div
      className={cn(
        'flex shrink-0 flex-col overflow-hidden rounded-md',
        palette.card,
        TONE_EDGE[tone],
        compact ? 'gap-1.5 p-1.5' : 'gap-2 p-2',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div
          className={cn('rounded-full', tone === 'crashed' ? 'bg-exception/45' : palette.ink)}
          style={{ height: line * 1.2, width: '45%' }}
        />
        <div
          className={cn('rounded-full', tone === 'crashed' ? 'bg-exception/45' : palette.faint)}
          style={{ height: line * 1.2, width: '20%' }}
        />
      </div>
      <div className={cn('h-0.5 overflow-hidden rounded-full', palette.faint)}>
        <div className={cn('h-full', TONE_BAR[tone])} style={{ width: `${age}%` }} />
      </div>
      {Array.from({ length: items }).map((_, index) => {
        const struck = display.tapToStrike && strikeFirst && index === 0;
        return (
          <div key={index} className={cn('space-y-1', struck && 'opacity-35')}>
            <div className={cn('relative rounded-full', palette.ink)} style={{ height: line, width: index === 0 ? '70%' : '55%' }}>
              {struck && <div className="absolute inset-x-0 top-1/2 h-px bg-foreground/60" />}
            </div>
            {index === 0 && !compact && display.showModifiers && <div className={cn('h-1 w-2/5 rounded-full', palette.faint)} />}
            {index === 0 && <div className="h-1 w-1/4 rounded-full bg-exception/35" />}
          </div>
        );
      })}
      <div className="rounded bg-primary/30" style={{ height: (compact ? 5 : 7) * scale }} />
    </div>
  );
}
