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
  Settings,
  SlidersHorizontal,
  Sun,
  Type,
  Volume2,
  VolumeX,
} from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { ChangeRow, Switch, ValueAside, ValueMissing } from '@/components/settings/controls';
import { Drawer } from '@/components/shared/Drawer';
import { ChoiceCards } from '@/components/shared/FormParts';
import { Button } from '@/components/ui/button';

import { CHIME_SOUNDS, chime } from '@/lib/utils/chime';
import { cn } from '@/lib/utils/cn';
import { DEFAULT_KDS_DISPLAY, type KdsCardSize, type KdsDisplay, type KdsLayout, type KdsTextSize, useKdsStore } from '@/stores/kdsStore';

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
 * This device's kitchen screen settings, opened from its edit mode: each
 * setting a row whose value is the content — a choice opens under its row and
 * applies on the pick, a switch sits at the row's edge. The board itself is the
 * preview: the drawer isn't modal, so every change shows on the live tickets
 * beside it. Nothing to save: the store applies every change, on this device.
 */
export function KitchenSettingsDrawer({ onClose }: { onClose: () => void }) {
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
    <Drawer
      title="Kitchen screen settings"
      description="This device’s kitchen screen. Changes show on the board as you make them."
      icon={Settings}
      modal={false}
      onClose={onClose}
      bodyClassName="px-5 py-5 sm:px-6"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Saved on this device.</p>
          <Button variant="outline" onClick={settings.resetDisplay} disabled={isDefault} className="gap-2">
            <RotateCcw size={15} aria-hidden="true" /> Reset to defaults
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
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
    </Drawer>
  );
}
