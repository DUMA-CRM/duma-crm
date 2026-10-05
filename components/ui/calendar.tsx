'use client';

import * as React from 'react';
import { type DayButton, DayPicker, type Locale, type MonthCaptionProps, getDefaultClassNames } from 'react-day-picker';
import { enGB } from 'react-day-picker/locale';

import { ChevronDown, ChevronLeft, ChevronRight } from '@/components/icons';
import { Button, buttonVariants } from '@/components/ui/button';

import { cn } from '@/lib/utils/cn';

/**
 * The one calendar — shadcn's `Calendar` on react-day-picker, in the app's own
 * tokens. Every date picked anywhere goes through it: the `DatePicker` field
 * (and so every `<Input type="date">`), the rota's "go to a date", and the
 * attendance month, which supplies its own `DayButton`.
 *
 * Changed from the shadcn source (https://ui.shadcn.com/docs/components/calendar):
 * - British by default (`enGB`, so weeks start on Monday), with the app's chevrons.
 * - The caption is the month and year as plain text, as Apple Calendar draws it.
 *   Tapping it swaps the days for a month picker, and the year there for a year
 *   picker; choosing steps back down. No bordered dropdowns.
 * - Ranges are one continuous band: only the outer ends are rounded, so a week
 *   reads as a week rather than seven separate days.
 * - Today in primary ink with a dot, the selection in the primary fill.
 */

type View = 'days' | 'months' | 'years';

const monthStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

const CalendarViewContext = React.createContext<{ open: (view: Exclude<View, 'days'>) => void } | null>(null);

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  buttonVariant = 'ghost',
  locale = enGB,
  formatters,
  components,
  month: monthProp,
  defaultMonth,
  onMonthChange,
  startMonth,
  endMonth,
  hideNavigation,
  // The dropdown layouts are replaced by the picker views; anything passed is ignored.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  captionLayout: _captionLayout,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>['variant'];
}) {
  const defaultClassNames = getDefaultClassNames();
  const selectedDate = 'selected' in props && props.selected instanceof Date ? props.selected : undefined;

  // The shown month, kept here so the picker views and the day grid agree. A
  // controlled `month` from the caller always wins.
  const [ownMonth, setOwnMonth] = React.useState(() => monthStart(monthProp ?? defaultMonth ?? selectedDate ?? new Date()));
  const month = monthProp ? monthStart(monthProp) : ownMonth;
  const setMonth = (next: Date) => {
    setOwnMonth(monthStart(next));
    onMonthChange?.(monthStart(next));
  };
  const [view, setView] = React.useState<View>('days');

  if (view !== 'days' && !hideNavigation) {
    return (
      <MonthYearPicker
        view={view}
        month={month}
        selected={selectedDate}
        startMonth={startMonth}
        endMonth={endMonth}
        locale={locale}
        onView={setView}
        onPick={(next) => {
          setMonth(next);
          setView('days');
        }}
        className={className}
      />
    );
  }

  return (
    <CalendarViewContext.Provider value={{ open: setView }}>
      <DayPicker
        showOutsideDays={showOutsideDays}
        className={cn(
          'group/calendar bg-transparent [--cell-radius:var(--radius-md)] [--cell-size:--spacing(9)]',
          String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
          String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
          className,
        )}
        captionLayout="label"
        locale={locale}
        month={month}
        onMonthChange={setMonth}
        startMonth={startMonth}
        endMonth={endMonth}
        hideNavigation={hideNavigation}
        formatters={formatters}
        classNames={{
          root: cn('w-fit', defaultClassNames.root),
          months: cn('relative flex flex-col gap-4 md:flex-row', defaultClassNames.months),
          month: cn('flex w-full flex-col gap-3', defaultClassNames.month),
          nav: cn('absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1', defaultClassNames.nav),
          button_previous: cn(
            buttonVariants({ variant: buttonVariant }),
            'size-(--cell-size) rounded-(--cell-radius) p-0 text-muted-foreground select-none hover:text-foreground aria-disabled:opacity-40',
            defaultClassNames.button_previous,
          ),
          button_next: cn(
            buttonVariants({ variant: buttonVariant }),
            'size-(--cell-size) rounded-(--cell-radius) p-0 text-muted-foreground select-none hover:text-foreground aria-disabled:opacity-40',
            defaultClassNames.button_next,
          ),
          month_caption: cn('flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)', defaultClassNames.month_caption),
          caption_label: cn('text-sm font-semibold text-foreground select-none', defaultClassNames.caption_label),
          month_grid: cn('w-full border-collapse', defaultClassNames.month_grid),
          weekdays: cn('flex', defaultClassNames.weekdays),
          weekday: cn('flex-1 pb-1 text-label font-normal uppercase text-muted-foreground select-none', defaultClassNames.weekday),
          week: cn('mt-1 flex w-full', defaultClassNames.week),
          week_number_header: cn('w-(--cell-size) select-none', defaultClassNames.week_number_header),
          week_number: cn('text-label text-muted-foreground select-none', defaultClassNames.week_number),
          // The cell carries no rounding of its own: a wash laid on a run of
          // cells (a range, a highlighted week) then joins into one band, and
          // only its ends are rounded — by the range classes below, or by
          // `first:`/`last:` on a modifier class.
          day: cn('group/day relative aspect-square h-full w-full p-0 text-center select-none', defaultClassNames.day),
          range_start: cn('rounded-l-(--cell-radius) bg-primary/10', defaultClassNames.range_start),
          range_middle: cn('rounded-none bg-primary/10', defaultClassNames.range_middle),
          range_end: cn('rounded-r-(--cell-radius) bg-primary/10', defaultClassNames.range_end),
          today: cn('', defaultClassNames.today),
          outside: cn('text-muted-foreground/50 aria-selected:text-muted-foreground', defaultClassNames.outside),
          disabled: cn('text-muted-foreground opacity-35', defaultClassNames.disabled),
          hidden: cn('invisible', defaultClassNames.hidden),
          ...classNames,
        }}
        components={{
          Root: ({ className, rootRef, ...rootProps }) => (
            <div data-slot="calendar" ref={rootRef} className={cn(className)} {...rootProps} />
          ),
          Chevron: ({ className, orientation, ...chevronProps }) => {
            const Icon = orientation === 'left' ? ChevronLeft : orientation === 'right' ? ChevronRight : ChevronDown;
            return <Icon size={16} className={cn('size-4', className)} {...chevronProps} />;
          },
          MonthCaption: CalendarMonthCaption,
          DayButton: (dayProps) => <CalendarDayButton locale={locale} {...dayProps} />,
          WeekNumber: ({ children, ...weekProps }) => (
            <td {...weekProps}>
              <div className="flex size-(--cell-size) items-center justify-center text-center">{children}</div>
            </td>
          ),
          ...components,
        }}
        {...props}
      />
    </CalendarViewContext.Provider>
  );
}

/** "October 2026" as plain text that opens the month picker — no border, no arrow. */
// `displayIndex` is taken out so it never reaches the DOM.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function CalendarMonthCaption({ calendarMonth, displayIndex: _displayIndex, children, ...props }: MonthCaptionProps) {
  const context = React.useContext(CalendarViewContext);
  const monthName = calendarMonth.date.toLocaleDateString('en-GB', { month: 'long' });
  const year = calendarMonth.date.getFullYear();
  const word =
    'relative z-10 rounded-md px-1.5 py-1 text-sm font-semibold text-foreground transition-colors select-none hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring';
  return (
    <div {...props}>
      {context ? (
        // Two words, two doors: the month opens the months, the year the years.
        <span className="flex items-center">
          <button type="button" onClick={() => context.open('months')} aria-label={`${monthName} — choose month`} className={word}>
            {monthName}
          </button>
          <button
            type="button"
            onClick={() => context.open('years')}
            aria-label={`${year} — choose year`}
            className={cn(word, 'tabular-nums')}
          >
            {year}
          </button>
        </span>
      ) : (
        children
      )}
    </div>
  );
}

const inMonths = (date: Date, start?: Date, end?: Date) =>
  (!start || monthStart(date) >= monthStart(start)) && (!end || monthStart(date) <= monthStart(end));

/**
 * The month and year views that replace the day grid while open. The title is
 * plain text again — the year in the months view, the twelve-year span in the
 * years view — in primary ink, Apple's cue that you are in a picker. Tapping
 * the year steps up to the years; choosing steps back down. Escape returns to
 * the days without a change.
 */
function MonthYearPicker({
  view,
  month,
  selected,
  startMonth,
  endMonth,
  locale,
  onView,
  onPick,
  className,
}: {
  view: Exclude<View, 'days'>;
  month: Date;
  selected?: Date;
  startMonth?: Date;
  endMonth?: Date;
  locale?: Partial<Locale>;
  onView: (view: View) => void;
  onPick: (month: Date) => void;
  className?: string;
}) {
  const [year, setYear] = React.useState(month.getFullYear());
  const pageStart = Math.floor(year / 12) * 12;
  const today = new Date();
  const code = locale?.code ?? 'en-GB';

  const firstYear = startMonth?.getFullYear();
  const lastYear = endMonth?.getFullYear();
  const canStep = (direction: -1 | 1) =>
    view === 'months'
      ? direction < 0
        ? firstYear === undefined || year - 1 >= firstYear
        : lastYear === undefined || year + 1 <= lastYear
      : direction < 0
        ? firstYear === undefined || pageStart - 1 >= firstYear
        : lastYear === undefined || pageStart + 12 <= lastYear;

  const cells =
    view === 'months'
      ? Array.from({ length: 12 }, (_, index) => {
          const date = new Date(year, index, 1);
          return {
            key: `m-${index}`,
            label: date.toLocaleDateString(code, { month: 'short' }),
            fullLabel: date.toLocaleDateString(code, { month: 'long', year: 'numeric' }),
            disabled: !inMonths(date, startMonth, endMonth),
            current: date.getFullYear() === month.getFullYear() && index === month.getMonth(),
            chosen: !!selected && selected.getFullYear() === year && selected.getMonth() === index,
            today: today.getFullYear() === year && today.getMonth() === index,
            pick: () => onPick(date),
          };
        })
      : Array.from({ length: 12 }, (_, index) => {
          const value = pageStart + index;
          return {
            key: `y-${value}`,
            label: String(value),
            fullLabel: String(value),
            disabled: (firstYear !== undefined && value < firstYear) || (lastYear !== undefined && value > lastYear),
            current: value === month.getFullYear(),
            chosen: selected?.getFullYear() === value,
            today: today.getFullYear() === value,
            // Keep the month you were on; only the year changes.
            pick: () => onPick(new Date(value, month.getMonth(), 1)),
          };
        });

  return (
    <div
      data-slot="calendar"
      className={cn('w-[calc(var(--spacing)*9*7)] [--cell-radius:var(--radius-md)]', className)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onView('days');
        }
      }}
    >
      <div className="flex h-9 items-center justify-between gap-1">
        <button
          type="button"
          aria-label={view === 'months' ? 'Previous year' : 'Previous twelve years'}
          disabled={!canStep(-1)}
          onClick={() => setYear((value) => value - (view === 'months' ? 1 : 12))}
          className={cn(buttonVariants({ variant: 'ghost' }), 'size-9 p-0 text-muted-foreground hover:text-foreground disabled:opacity-40')}
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        {view === 'months' ? (
          <button
            type="button"
            onClick={() => onView('years')}
            aria-label={`${year} — choose year`}
            className="rounded-md px-2 py-1 text-sm font-semibold text-primary tabular-nums focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
          >
            {year}
          </button>
        ) : (
          <span className="px-2 py-1 text-sm font-semibold text-primary tabular-nums" aria-live="polite">
            {pageStart}–{pageStart + 11}
          </span>
        )}
        <button
          type="button"
          aria-label={view === 'months' ? 'Next year' : 'Next twelve years'}
          disabled={!canStep(1)}
          onClick={() => setYear((value) => value + (view === 'months' ? 1 : 12))}
          className={cn(buttonVariants({ variant: 'ghost' }), 'size-9 p-0 text-muted-foreground hover:text-foreground disabled:opacity-40')}
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1.5" role="grid" aria-label={view === 'months' ? `Months of ${year}` : 'Years'}>
        {cells.map((cell) => (
          <button
            key={cell.key}
            type="button"
            role="gridcell"
            disabled={cell.disabled}
            aria-selected={cell.current}
            aria-label={cell.fullLabel}
            onClick={cell.pick}
            className={cn(
              'h-12 rounded-(--cell-radius) text-sm tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
              cell.current
                ? 'bg-primary font-semibold text-primary-foreground hover:bg-primary/90'
                : cell.chosen
                  ? 'bg-primary/10 font-semibold text-primary hover:bg-primary/15'
                  : cell.today
                    ? 'font-semibold text-primary hover:bg-band'
                    : 'text-foreground hover:bg-band',
              'disabled:pointer-events-none disabled:opacity-35',
            )}
          >
            {cell.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex justify-center">
        <button
          type="button"
          onClick={() => onView('days')}
          className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          Back to days
        </button>
      </div>
    </div>
  );
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  locale,
  ...props
}: React.ComponentProps<typeof DayButton> & { locale?: Partial<Locale> }) {
  const defaultClassNames = getDefaultClassNames();

  const ref = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString(locale?.code)}
      data-today={modifiers.today && !modifiers.selected}
      data-selected-single={modifiers.selected && !modifiers.range_start && !modifiers.range_end && !modifiers.range_middle}
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        'relative isolate z-10 flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-1 rounded-(--cell-radius) border-0 text-sm leading-none font-normal tabular-nums',
        'hover:bg-band hover:text-foreground',
        'group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:outline-2 group-data-[focused=true]/day:outline-offset-1 group-data-[focused=true]/day:outline-ring',
        // Today: primary ink and a dot beneath, so it reads without a fill that would compete with the selection.
        'data-[today=true]:font-semibold data-[today=true]:text-primary data-[today=true]:after:absolute data-[today=true]:after:bottom-1 data-[today=true]:after:size-1 data-[today=true]:after:rounded-full data-[today=true]:after:bg-primary',
        'data-[selected-single=true]:bg-primary data-[selected-single=true]:font-semibold data-[selected-single=true]:text-primary-foreground data-[selected-single=true]:hover:bg-primary/90',
        // A range is one band: the ends take the fill and round outward only;
        // the days between are square and sit on the band's wash.
        'data-[range-start=true]:rounded-r-none data-[range-start=true]:bg-primary data-[range-start=true]:font-semibold data-[range-start=true]:text-primary-foreground',
        'data-[range-end=true]:rounded-l-none data-[range-end=true]:bg-primary data-[range-end=true]:font-semibold data-[range-end=true]:text-primary-foreground',
        // A one-day range is both ends: round it all the way again.
        'data-[range-start=true]:data-[range-end=true]:rounded-(--cell-radius)',
        'data-[range-middle=true]:rounded-none data-[range-middle=true]:bg-transparent data-[range-middle=true]:text-foreground data-[range-middle=true]:hover:bg-primary/10',
        '[&>span]:text-xs [&>span]:opacity-70',
        defaultClassNames.day,
        className,
      )}
      {...props}
    />
  );
}

export { Calendar, CalendarDayButton };
