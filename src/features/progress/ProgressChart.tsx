import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatLongDate, formatShortDate, formatWeight } from '../../lib/format';
import type { SessionPoint } from '../../lib/stats';

export type Metric = 'maxWeight' | 'best1RM' | 'volume';

export const METRIC_LABELS: Record<Metric, string> = {
  maxWeight: 'Peso máximo',
  best1RM: '1RM estimado',
  volume: 'Volumen',
};

// Single series: brand accent on the dark card; grid and axes stay recessive.
const SERIES = '#84cc16';
const GRID = '#262626';
const AXIS_TEXT = '#a3a3a3';
const SURFACE = '#171717';

const round1 = (n: number) => Math.round(n * 10) / 10;

/** One-series line chart of a per-session metric, with crosshair tooltip. */
export function ProgressChart({ data, metric, unit }: { data: SessionPoint[]; metric: Metric; unit: string }) {
  const points = data.map((p) => ({ date: p.date, value: round1(p[metric]) }));
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // Pad the domain so a flat series doesn't sit on the axis.
  const pad = max === min ? Math.max(1, max * 0.1) : (max - min) * 0.15;
  const domain: [number, number] = [Math.max(0, Math.floor(min - pad)), Math.ceil(max + pad)];

  return (
    <div className="h-56 w-full" role="img" aria-label={`${METRIC_LABELS[metric]} por sesión`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 12, right: 12, bottom: 0, left: -8 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatShortDate}
            tick={{ fill: AXIS_TEXT, fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: GRID }}
            minTickGap={24}
          />
          <YAxis
            domain={domain}
            tickFormatter={(v: number) => formatWeight(v)}
            tick={{ fill: AXIS_TEXT, fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <Tooltip
            content={(props) => <ChartTooltip active={props.active} payload={props.payload} metric={metric} unit={unit} />}
            cursor={{ stroke: AXIS_TEXT, strokeWidth: 1, strokeDasharray: '3 3' }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={SERIES}
            strokeWidth={2}
            dot={{ r: 4, fill: SERIES, stroke: SURFACE, strokeWidth: 2 }}
            activeDot={{ r: 6, fill: SERIES, stroke: SURFACE, strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  metric,
  unit,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
  metric: Metric;
  unit: string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as { date: string; value: number };
  return (
    <div className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm shadow-lg">
      <div className="text-neutral-400">{formatLongDate(point.date)}</div>
      <div className="font-semibold text-neutral-100">
        {METRIC_LABELS[metric]}: {formatWeight(point.value)} {unit}
      </div>
    </div>
  );
}
