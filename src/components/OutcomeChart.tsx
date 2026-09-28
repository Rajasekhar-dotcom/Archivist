'use client';

import { useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

export interface OutcomeSeries {
  week: string;
  target?: number;
  untouched?: number;
  controls?: number;
}

interface OutcomeChartProps {
  data: OutcomeSeries[];
  title: string;
}

export default function OutcomeChart({ data, title }: OutcomeChartProps) {
  const [showUntouched, setShowUntouched] = useState(true);

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500">Eight-week baseline, then four-week measured window</p>
        </div>
        <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <input type="checkbox" checked={showUntouched} onChange={event => setShowUntouched(event.target.checked)} />
          Show counterfactual
        </label>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="week" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} width={42} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="target" name="Target" stroke="#2563eb" strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="controls" name="Median controls" stroke="#64748b" strokeDasharray="5 5" dot={false} />
            {showUntouched && <Line type="monotone" dataKey="untouched" name="What if untouched" stroke="#f59e0b" strokeDasharray="3 3" dot={false} />}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
