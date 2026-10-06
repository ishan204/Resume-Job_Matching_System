// Charts. Every chart names its metric, labels every bar and keeps identity off colour alone.
import {
  Bar, BarChart, CartesianGrid, Cell, ErrorBar, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { fmt } from "../labels";

const INK = "#0b0b0b";
const MUTED = "#6b6a65";
const GRID = "#e6e5df";

export interface BarDatum {
  name: string;
  value: number;
  sd?: number;
  color: string;
}

function TooltipBox({ active, payload, metric }: { active?: boolean; payload?: { payload: BarDatum }[]; metric: string }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <strong>{d.name}</strong>
      <span>{metric}: {fmt(d.value)}{d.sd !== undefined ? ` ± ${fmt(d.sd)} SD` : ""}</span>
    </div>
  );
}

export function MetricBars({ data, metric, domain, reference, height = 260, digits = 3 }: {
  data: BarDatum[]; metric: string; domain: [number, number];
  reference?: { value: number; label: string }; height?: number; digits?: number;
}) {
  const hasSd = data.some((d) => d.sd !== undefined);
  return (
    <figure className="chart" aria-label={`${metric} by model`}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 24, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="name" tick={{ fill: MUTED, fontSize: 12 }} tickLine={false} axisLine={{ stroke: GRID }} interval={0} />
          <YAxis domain={domain} allowDataOverflow tickCount={5} tickFormatter={(v: number) => (domain[1] > 1 ? String(Math.round(v)) : v.toFixed(2))}
                 tick={{ fill: MUTED, fontSize: 12 }} tickLine={false} axisLine={false} width={48}
                 label={{ value: metric, angle: -90, position: "insideLeft", fill: MUTED, fontSize: 12 }} />
          <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} content={<TooltipBox metric={metric} />} />
          {reference && (
            <ReferenceLine y={reference.value} stroke={MUTED} strokeDasharray="4 4" />
          )}
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={64} isAnimationActive={false}>
            {data.map((d) => <Cell key={d.name} fill={d.color} />)}
            {hasSd && <ErrorBar dataKey="sd" stroke={INK} width={6} strokeWidth={1.2} isAnimationActive={false} />}
            {/* With error bars the value sits inside the bar so the SD caps never overprint it */}
            <LabelList dataKey="value" position={hasSd ? "insideBottom" : "top"} offset={hasSd ? 10 : 6}
                       formatter={(v: unknown) => fmt(Number(v), digits)} style={{ fill: INK, fontSize: 12, fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {(reference || hasSd) && (
        <figcaption className="chart-caption">
          {reference && <>Dashed line: {reference.label} {fmt(reference.value)}. </>}
          {hasSd && "Error bars: ± 1 SD across splits."}
        </figcaption>
      )}
    </figure>
  );
}

/** Confidence interval for a difference, drawn as an HTML bar on a shared scale with 0 marked. */
export function IntervalRow({ label, mean, low, high, scale }: {
  label: string; mean: number; low: number; high: number; scale: [number, number];
}) {
  const pos = (v: number) => `${((v - scale[0]) / (scale[1] - scale[0])) * 100}%`;
  return (
    <div className="interval">
      <span className="interval-label">{label}</span>
      <div className="interval-track" aria-hidden="true">
        <span className="interval-zero" style={{ left: pos(0) }} />
        <span className="interval-ci" style={{ left: pos(low), width: `calc(${pos(high)} - ${pos(low)})` }} />
        <span className="interval-mean" style={{ left: pos(mean) }} />
      </div>
      <span className="interval-text">
        {mean >= 0 ? "+" : "−"}{Math.abs(mean).toFixed(3)} <span className="muted">[{low >= 0 ? "+" : "−"}{Math.abs(low).toFixed(3)}, {high >= 0 ? "+" : "−"}{Math.abs(high).toFixed(3)}]</span>
      </span>
    </div>
  );
}
