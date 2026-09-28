import { ArrowRight, Brain, Sparkles } from 'lucide-react';

interface WeekComparisonViewProps {
  week: 1 | 5;
  weekOneSummary: string;
  weekFiveSummary: string;
  memoryCount: number;
}

export default function WeekComparisonView({ week, weekOneSummary, weekFiveSummary, memoryCount }: WeekComparisonViewProps) {
  return (
    <section className="rounded-xl border bg-slate-950 p-5 text-white shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Sparkles size={18} className="text-amber-300" /> Recommendation evolution</h2>
        <span className="text-xs text-slate-300">{week === 5 ? 'Learned state' : 'Cold-start state'}</span>
      </div>
      <div className="grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr]">
        <div className={`rounded-lg border p-4 ${week === 1 ? 'border-blue-400 bg-blue-950/60' : 'border-slate-700 bg-slate-900'}`}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Week 1 · Generic</p>
          <p className="text-sm leading-6 text-slate-200">{weekOneSummary}</p>
        </div>
        <div className="flex items-center justify-center text-slate-400"><ArrowRight size={20} /></div>
        <div className={`rounded-lg border p-4 ${week === 5 ? 'border-emerald-400 bg-emerald-950/50' : 'border-slate-700 bg-slate-900'}`}>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400"><Brain size={14} /> Week 5 · Empirical · {memoryCount} memories</div>
          <p className="text-sm leading-6 text-slate-200">{weekFiveSummary}</p>
        </div>
      </div>
    </section>
  );
}
