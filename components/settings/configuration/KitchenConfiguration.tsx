'use client';

import { useState } from 'react';

import {
  CheckCircle2,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  Play,
  Receipt,
  RotateCcw,
  SlidersHorizontal,
  Sun,
  Type,
  Volume2,
  VolumeX,
} from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { ChangeRow, Switch, ValueAside, ValueMissing } from '@/components/settings/controls';
import { ChoiceCards } from '@/components/shared/FormParts';
import { Button } from '@/components/ui/button';

import { CHIME_SOUNDS, chime } from '@/lib/utils/chime';
import { cn } from '@/lib/utils/cn';
import { DEFAULT_KDS_DISPLAY, type KdsCardSize, type KdsDisplay, type KdsLayout, type KdsTextSize, useKdsStore } from '@/stores/kdsStore';

import { ConfigurationBodySkeleton, ConfigurationFoot, PreviewFrame, useMounted } from './shared';

const LAYOUTS: { value: KdsLayout; label: string; icon: typeof LayoutGrid }[] = [
  { value: 'lanes', label: 'Lanes', icon: LayoutDashboard },
  { value: 'tiles', label: 'Tiles', icon: LayoutGrid },
];
const TEXT_SIZES: { value: KdsTextSize; label: string }[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'large', label: 'Large' },
  { value: 'xlarge', label: 'Extra large' },
];
const CARD_SIZES: { value: KdsCardSize; label: string }[] = [
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'compact', label: 'Compact — options on one line' },
];
const labelOf = <T extends string>(options: readonly { value: T; label: string }[], value: T) =>
  options.find((option) => option.value === value)?.label ?? value;

type Row = 'layout' | 'textSize' | 'cardSize' | 'sound';

/**
 * The kitchen screen on this device. Laid out like Settings → Account: each
 * setting a row whose value is the content — a choice opens under its row and
 * applies on the pick, a switch sits at the row's edge — with the live screen
 * in the rail. Nothing to save: the store applies every change at once.
 */
export function KitchenConfiguration() {
  const mounted = useMounted();
  const settings = useKdsStore();
  const set = (patch: Partial<KdsDisplay>) => settings.setDisplay(patch);
  const isDefault = (Object.keys(DEFAULT_KDS_DISPLAY) as (keyof KdsDisplay)[]).every((key) => settings[key] === DEFAULT_KDS_DISPLAY[key]);
  // One row open at a time; a tap on the open one closes it.
  const [open, setOpen] = useState<Row | null>(null);
  const toggle = (row: Row) => setOpen((current) => (current === row ? null : row));
  /** A choice applies on the pick and folds its row back up. */
  const pick = (patch: Partial<KdsDisplay>) => {
    set(patch);
    setOpen(null);
  };

  if (!mounted) return <ConfigurationBodySkeleton label="Loading kitchen screen settings" />;

  const sound = CHIME_SOUNDS.find((entry) => entry.value === settings.sound) ?? CHIME_SOUNDS[0];
  /** An on/off setting: its state as the value, the switch at the right edge. */
  const switchRow = (
    key: 'tapToStrike' | 'showModifiers' | 'showAllDay' | 'keepAwake',
    icon: typeof Sun,
    label: string,
    on: React.ReactNode,
    off: React.ReactNode,
    switchLabel: string,
  ) => (
    <ChangeRow
      icon={icon}
      label={label}
      value={settings[key] ? on : <ValueMissing>{off}</ValueMissing>}
      trailing={<Switch label={switchLabel} checked={settings[key]} onChange={(next) => set({ [key]: next })} />}
    />
  );

  return (
    <SettingsTabBody narrowAside stickyAside aside={<KitchenPreview display={settings} />}>
      {/* Two stacked columns, not paired rows: a short card never leaves a gap beside a tall one. */}
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-5">
          <SettingsSection title="Screen" footnote="Some browsers can’t keep the screen awake — set the tablet’s auto-lock to Never.">
            <div>
              <ChangeRow
                icon={settings.layout === 'tiles' ? LayoutGrid : LayoutDashboard}
                label="Layout"
                value={labelOf(LAYOUTS, settings.layout)}
                open={open === 'layout'}
                onToggle={() => toggle('layout')}
              >
                <ChoiceCards<KdsLayout>
                  appearance="settings"
                  value={settings.layout}
                  onChange={(layout) => pick({ layout })}
                  options={LAYOUTS}
                />
              </ChangeRow>
              <ChangeRow
                icon={Type}
                label="Text size"
                value={labelOf(TEXT_SIZES, settings.textSize)}
                open={open === 'textSize'}
                onToggle={() => toggle('textSize')}
              >
                <ChoiceCards<KdsTextSize>
                  appearance="settings"
                  columns={3}
                  value={settings.textSize}
                  onChange={(textSize) => pick({ textSize })}
                  options={TEXT_SIZES}
                />
              </ChangeRow>
              {switchRow('showAllDay', ListChecks, 'All-day count', 'Shown', 'Hidden', 'Show the all-day count')}
              {switchRow('keepAwake', Sun, 'Keep awake', 'On', 'Off', 'Keep the screen awake')}
            </div>
          </SettingsSection>

          <SettingsSection title="Alerts" footnote="Tap the kitchen screen once after it loads, so the browser allows sound.">
            <div>
              <ChangeRow
                icon={settings.soundOn ? Volume2 : VolumeX}
                label="New-order chime"
                value={settings.soundOn ? 'On' : <ValueMissing>Off</ValueMissing>}
                trailing={
                  <Switch
                    label="New-order chime"
                    checked={settings.soundOn}
                    onChange={(next) => {
                      settings.setSoundOn(next);
                      if (next) chime(settings.sound);
                    }}
                  />
                }
              />
              <ChangeRow
                icon={Play}
                label="Sound"
                value={
                  <>
                    <span className="truncate">{sound.label}</span>
                    <ValueAside>· {sound.detail.toLowerCase()}</ValueAside>
                  </>
                }
                open={open === 'sound'}
                onToggle={() => toggle('sound')}
                verbs={['Change', 'Done']}
                trailing={
                  <Button variant="ghost" size="sm" onClick={() => chime(settings.sound)} aria-label="Play the order chime">
                    <Play aria-hidden="true" /> Play
                  </Button>
                }
              >
                {/* Stays open on a pick: each one plays, so you can hear them in turn. */}
                <div role="radiogroup" aria-label="Order sound" className="grid grid-cols-2 gap-2">
                  {CHIME_SOUNDS.map((option) => {
                    const selected = settings.sound === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => {
                          set({ sound: option.value });
                          chime(option.value);
                        }}
                        className={cn(
                          'flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-[border-color,background-color,box-shadow] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                          selected
                            ? 'border-primary bg-primary/5 shadow-[inset_0_0_0_1px_var(--primary)]'
                            : 'border-border bg-control hover:border-rule hover:bg-band/45',
                        )}
                      >
                        <Play
                          size={14}
                          aria-hidden="true"
                          className={cn('shrink-0', selected ? 'text-primary' : 'text-muted-foreground')}
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-foreground">{option.label}</span>
                          <span className="block truncate text-xs text-muted-foreground">{option.detail}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </ChangeRow>
            </div>
          </SettingsSection>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <SettingsSection title="Tickets">
            <div>
              <ChangeRow
                icon={Receipt}
                label="Ticket size"
                value={settings.cardSize === 'compact' ? 'Compact' : 'Comfortable'}
                open={open === 'cardSize'}
                onToggle={() => toggle('cardSize')}
              >
                <ChoiceCards<KdsCardSize>
                  appearance="settings"
                  value={settings.cardSize}
                  onChange={(cardSize) => pick({ cardSize })}
                  options={CARD_SIZES}
                />
              </ChangeRow>
              {switchRow('tapToStrike', CheckCircle2, 'Tap an item to mark it done', 'On', 'Off', 'Tap an item to mark it done')}
              {switchRow(
                'showModifiers',
                SlidersHorizontal,
                'Modifiers',
                'Shown',
                <>
                  Hidden
                  <ValueAside>· “No …” lines still show</ValueAside>
                </>,
                'Show modifiers',
              )}
            </div>
          </SettingsSection>
        </div>
      </div>

      <ConfigurationFoot storage="Saved on this device.">
        <Button variant="outline" onClick={settings.resetDisplay} disabled={isDefault} className="gap-2">
          <RotateCcw size={15} aria-hidden="true" /> Reset to defaults
        </Button>
      </ConfigurationFoot>
    </SettingsTabBody>
  );
}

// ── Preview ──────────────────────────────────────────────────────────────────

// A quiet sketch, not a screenshot: soft tints, a few tickets, room between them.
// Theme tokens, so it follows the app's own light or dark mode.
const palette = {
  ground: 'bg-background',
  frame: 'border-border',
  lane: 'bg-background',
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
// The lanes' marks, as on the board (`LANE_DOT`).
const LANE_TOP = ['var(--key-1)', 'var(--key-5)', 'var(--momentum)'];
const TONE_EDGE: Record<Tone, string> = { ok: 'border-border', approaching: 'border-measured/60', crashed: 'border-exception' };
// The header is the status: neutral, then amber, then filled red.
const TONE_HEAD: Record<Tone, string> = { ok: '', approaching: 'bg-measured/18', crashed: 'bg-exception' };
const TONE_BAR: Record<Tone, string> = { ok: 'bg-momentum/45', approaching: 'bg-measured/55', crashed: 'bg-exception/55' };

/** A schematic of the kitchen screen, redrawn as the settings change. */
function KitchenPreview({ display }: { display: KdsDisplay }) {
  const tiles = display.layout === 'tiles';
  const ticket = (sample: Sample, index: number) => (
    <PreviewTicket key={index} {...sample} display={display} strikeFirst={sample.tone === 'approaching'} />
  );
  return (
    <PreviewFrame>
      <div
        aria-hidden="true"
        className={cn('flex aspect-[4/3] flex-col overflow-hidden rounded-lg border shadow-sm', palette.frame, palette.ground)}
      >
        {
          <div className="flex h-5 shrink-0 items-center gap-2 border-b border-border bg-card px-2">
            <div className={cn('h-1.5 w-12 rounded-full', palette.ink)} />
            <div className="ml-auto flex items-center gap-2">
              <div className="size-1.5 rounded-full bg-momentum/60" />
              <div className={cn('h-1.5 w-8 rounded-full', palette.faint)} />
              <div className={cn('h-1.5 w-8 rounded-full', palette.faint)} />
            </div>
          </div>
        }
        <div className="flex min-h-0 flex-1">
          {tiles ? (
            <div className="grid min-w-0 flex-1 grid-cols-3 content-start gap-2 p-2">{SAMPLE.map(ticket)}</div>
          ) : (
            <div className="grid min-w-0 flex-1 grid-cols-3 gap-px bg-border">
              {[0, 1, 2].map((lane) => (
                <div key={lane} className={cn('flex min-h-0 flex-col overflow-hidden', palette.lane)}>
                  <div className="flex h-4 shrink-0 items-center gap-1 border-b border-border bg-card px-1.5">
                    <span className="size-1.5 rounded-[1px]" style={{ backgroundColor: LANE_TOP[lane] }} />
                    <span className={cn('h-1 w-1/3 rounded-full', palette.ink)} />
                  </div>
                  <div className="flex flex-col gap-1.5 p-1.5">
                    {SAMPLE.map((sample, index) => (sample.lane === lane ? ticket(sample, index) : null))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {display.showAllDay && (
            <div className={cn('flex w-[20%] shrink-0 flex-col gap-2.5 border-l border-border p-2', palette.card)}>
              <div className={cn('h-1.5 w-2/3 rounded-full', palette.ink)} />
              {[75, 55, 65].map((width) => (
                <div key={width} className={cn('h-1 rounded-full', palette.faint)} style={{ width: `${width}%` }} />
              ))}
            </div>
          )}
        </div>
      </div>
    </PreviewFrame>
  );
}

function PreviewTicket({ tone, items, age, display, strikeFirst }: Sample & { display: KdsDisplay; strikeFirst: boolean }) {
  const compact = display.cardSize === 'compact';
  // Text size scales the whole ticket on the real screen; here it scales the lines.
  const scale = { standard: 1, large: 1.3, xlarge: 1.6 }[display.textSize];
  const line = 4 * scale;
  return (
    <div className={cn('flex shrink-0 flex-col overflow-hidden rounded-sm border', palette.card, TONE_EDGE[tone])}>
      <div className={cn('border-b border-border', TONE_HEAD[tone], compact ? 'px-1.5 pt-1.5' : 'px-2 pt-2')}>
        <div className="flex items-center justify-between gap-2">
          <div
            className={cn('rounded-full', tone === 'crashed' ? 'bg-on-fill/80' : palette.ink)}
            style={{ height: line * 1.2, width: '45%' }}
          />
          <div
            className={cn('rounded-full', tone === 'crashed' ? 'bg-on-fill/60' : palette.faint)}
            style={{ height: line * 1.2, width: '20%' }}
          />
        </div>
        <div className={cn('mt-1.5 h-0.5 overflow-hidden', compact ? '-mx-1.5' : '-mx-2', palette.faint)}>
          <div className={cn('h-full', tone === 'crashed' ? 'bg-on-fill/70' : TONE_BAR[tone])} style={{ width: `${age}%` }} />
        </div>
      </div>
      <div className={cn('flex flex-col', compact ? 'gap-1.5 p-1.5' : 'gap-2 p-2')}>
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
      </div>
    </div>
  );
}
