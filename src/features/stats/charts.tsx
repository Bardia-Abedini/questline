/**
 * Small, calm charts for the Stats page (Recharts). Every chart:
 * - has a visible title and a one-line summary in words (the main way to read it),
 * - hides the SVG from screen readers and ships the same numbers as a visually hidden table,
 * - follows the reading direction (axes mirror in Persian) and the language's digits,
 * - takes its colors from the theme tokens, re-read when the theme changes.
 */
import type { ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useFormat } from '@/i18n/useFormat';
import { Card, cx } from '@/ui';
import { useChartColors, useRtl } from './chartTheme';

import type { ChartTone } from './chartTheme';

export type { ChartTone };

/** Title, summary, chart and its table, in one card. */
export function ChartCard({
  title,
  summary,
  children,
  table,
  testId,
  decorative = true,
}: {
  title: ReactNode;
  summary: ReactNode;
  children?: ReactNode;
  /** The data as a table, for screen readers. */
  table?: ReactNode;
  testId?: string;
  /** The visual repeats the summary and table (hidden from screen readers). False when it is readable text. */
  decorative?: boolean;
}) {
  return (
    <Card as="section" className="flex min-w-0 flex-col gap-3" data-testid={testId}>
      <div>
        <h2 className="text-lg font-semibold text-text">{title}</h2>
        <p className="text-sm text-muted">{summary}</p>
      </div>
      {children && (
        <div aria-hidden={decorative || undefined} className="min-w-0">
          {children}
        </div>
      )}
      {table}
    </Card>
  );
}

export interface DataTableProps {
  caption: string;
  headers: [string, string];
  rows: Array<[string, string]>;
}

export function DataTable({ caption, headers, rows }: DataTableProps) {
  return (
    <div className="ql-visually-hidden">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{headers[0]}</th>
            <th scope="col">{headers[1]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([a, b], i) => (
            <tr key={i}>
              <th scope="row">{a}</th>
              <td>{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TooltipBox({
  active,
  payload,
  label,
  labelOf,
  valueOf,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: unknown }>;
  label?: unknown;
  labelOf: (label: string) => string;
  valueOf: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const v = Number(payload[0]?.value ?? 0);
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm shadow-md">
      <p className="font-bold text-text">{labelOf(String(label ?? ''))}</p>
      <p className="text-muted">{valueOf(v)}</p>
    </div>
  );
}

export interface SeriesPoint {
  key: string;
  value: number;
}

const AXIS_FONT = { fontSize: 12 };

/** Vertical columns over time (one series). */
export function ColumnChart({
  data,
  tone,
  labelOf,
  tickOf,
  valueOf,
  height = 180,
}: {
  data: SeriesPoint[];
  tone: ChartTone;
  /** Full label for the tooltip. */
  labelOf: (key: string) => string;
  /** Short label for the axis. */
  tickOf: (key: string) => string;
  valueOf: (v: number) => string;
  height?: number;
}) {
  const colors = useChartColors();
  const rtl = useRtl();
  const { number } = useFormat();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 14, left: 14, bottom: 0 }}
        accessibilityLayer={false}
      >
        <CartesianGrid vertical={false} stroke={colors.grid} strokeWidth={1} />
        <XAxis
          dataKey="key"
          reversed={rtl}
          tickFormatter={tickOf}
          tick={{ ...AXIS_FONT, fill: colors.axis }}
          tickLine={false}
          axisLine={{ stroke: colors.grid }}
          interval={data.length <= 8 ? 0 : 'preserveStartEnd'}
          minTickGap={18}
        />
        <YAxis
          orientation={rtl ? 'right' : 'left'}
          allowDecimals={false}
          tickFormatter={(v: number) => number(v)}
          tick={{ ...AXIS_FONT, fill: colors.axis }}
          tickLine={false}
          axisLine={false}
          width={36}
        />
        <Tooltip
          cursor={{ fill: colors.grid, opacity: 0.35 }}
          content={(p) => (
            <TooltipBox
              active={p.active}
              payload={p.payload}
              label={p.label}
              labelOf={labelOf}
              valueOf={valueOf}
            />
          )}
        />
        <Bar
          dataKey="value"
          fill={colors[tone]}
          radius={[4, 4, 0, 0]}
          maxBarSize={24}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Horizontal bars for a few named categories (parts of the day, weekdays). Plain HTML, so
 * labels never collide and the bars grow from the start edge in both reading directions.
 */
export function BarList({
  data,
  tone,
  labelOf,
  valueOf,
}: {
  data: SeriesPoint[];
  tone: ChartTone;
  labelOf: (key: string) => string;
  valueOf: (v: number) => string;
}) {
  const colors = useChartColors();
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="flex flex-col gap-1.5">
      {data.map((d) => (
        <li key={d.key} className="flex min-w-0 items-center gap-2 text-sm">
          <span className="w-24 shrink-0 break-words text-muted sm:w-28">{labelOf(d.key)}</span>
          <span className="min-w-0 flex-1">
            {d.value > 0 && (
              <span
                className="block h-3 rounded-e-[4px]"
                style={{ inlineSize: `${(d.value / max) * 100}%`, backgroundColor: colors[tone] }}
              />
            )}
          </span>
          <span className="w-16 shrink-0 text-end font-bold text-text tabular-nums">
            {d.value > 0 ? valueOf(d.value) : ''}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** A line that only climbs (lifetime XP). */
export function ClimbChart({
  data,
  tone,
  labelOf,
  tickOf,
  valueOf,
}: {
  data: SeriesPoint[];
  tone: ChartTone;
  labelOf: (key: string) => string;
  tickOf: (key: string) => string;
  valueOf: (v: number) => string;
}) {
  const colors = useChartColors();
  const rtl = useRtl();
  const { compact } = useFormat();
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart
        data={data}
        margin={{ top: 8, right: 16, left: 16, bottom: 0 }}
        accessibilityLayer={false}
      >
        <CartesianGrid vertical={false} stroke={colors.grid} strokeWidth={1} />
        <XAxis
          dataKey="key"
          reversed={rtl}
          tickFormatter={tickOf}
          tick={{ ...AXIS_FONT, fill: colors.axis }}
          tickLine={false}
          axisLine={{ stroke: colors.grid }}
          interval={data.length <= 8 ? 0 : 'preserveStartEnd'}
          minTickGap={18}
        />
        <YAxis
          orientation={rtl ? 'right' : 'left'}
          allowDecimals={false}
          tickFormatter={(v: number) => compact(v)}
          tick={{ ...AXIS_FONT, fill: colors.axis }}
          tickLine={false}
          axisLine={false}
          width={40}
          domain={['dataMin', 'auto']}
        />
        <Tooltip
          cursor={{ stroke: colors.axis, strokeWidth: 1 }}
          content={(p) => (
            <TooltipBox
              active={p.active}
              payload={p.payload}
              label={p.label}
              labelOf={labelOf}
              valueOf={valueOf}
            />
          )}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={colors[tone]}
          strokeWidth={2}
          fill={colors[tone]}
          fillOpacity={0.12}
          isAnimationActive={false}
          dot={false}
          activeDot={{ r: 5, stroke: colors.surface, strokeWidth: 2, fill: colors[tone] }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Guess vs real time as two thin bars per quest, labelled in words (not color alone). */
export function GuessBars({
  rows,
  guessLabel,
  actualLabel,
}: {
  rows: Array<{
    title: string;
    guess: number;
    actual: number;
    guessText: string;
    actualText: string;
  }>;
  guessLabel: string;
  actualLabel: string;
}) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.guess, r.actual]));
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r, i) => (
        <li key={i} className="flex min-w-0 flex-col gap-1">
          <p className="truncate text-sm font-bold text-text">{r.title}</p>
          <Meter
            value={r.guess}
            max={max}
            className="bg-border-strong"
            text={r.guessText}
            label={guessLabel}
          />
          <Meter
            value={r.actual}
            max={max}
            className="bg-primary"
            text={r.actualText}
            label={actualLabel}
          />
        </li>
      ))}
    </ul>
  );
}

function Meter({
  value,
  max,
  className,
  text,
  label,
}: {
  value: number;
  max: number;
  className: string;
  text: string;
  label: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="w-20 shrink-0 text-xs text-muted">{label}</span>
      <span className="min-w-0 flex-1">
        <span
          className={cx('block h-2 rounded-full', className)}
          style={{ inlineSize: `${Math.max(3, (value / max) * 100)}%` }}
        />
      </span>
      <span className="shrink-0 text-xs font-bold text-text tabular-nums">{text}</span>
    </div>
  );
}
