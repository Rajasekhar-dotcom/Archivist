'use client';

import React, { useState, useEffect } from 'react';
import { Brain, TrendingDown, Activity, CheckCircle2, ChevronRight, Zap, RefreshCw, Calendar, AlertCircle } from 'lucide-react';
import postsData from '../../data/posts.json';
import metricsData from '../../data/metrics.json';
import groundTruth from '../../data/groundtruth.json';
import { detectDecay } from '@/lib/decay';
import OutcomeChart, { OutcomeSeries } from '@/components/OutcomeChart';
import GroundTruthVerifier from '@/components/GroundTruthVerifier';
import WeekComparisonView from '@/components/WeekComparisonView';

const CLUSTER_GAPS = [{ cluster: 'api-infrastructure', topic: 'Webhook Rate Limits', reason: 'No published page detected' }];

function buildOutcomeSeries(outcome: any): OutcomeSeries[] {
  const metrics = (metricsData as any)[outcome.postId];
  const targetPre = metrics.history.slice(-8);
  const refreshed = metrics.counterfactual_refreshed[outcome.refreshType] || metrics.counterfactual_untouched;
  const untouched = metrics.counterfactual_untouched;
  const postControl = Array.from({ length: 4 }, (_, index) => {
    const controls = postsData
      .filter(post => post.cluster === postsData.find(candidate => candidate.id === outcome.postId)?.cluster && post.id !== outcome.postId)
      .map(post => {
        const controlMetrics = (metricsData as any)[post.id];
        const controlPre = controlMetrics.history.slice(-8).reduce((sum: number, value: number) => sum + value, 0) / 8;
        const targetPreAvg = targetPre.reduce((sum: number, value: number) => sum + value, 0) / 8;
        return controlPre > 0 ? controlMetrics.counterfactual_untouched[index] * targetPreAvg / controlPre : 0;
      })
      .filter(value => value > 0)
      .sort((a, b) => a - b);
    return controls.length ? controls[Math.floor(controls.length / 2)] : undefined;
  });

  return [
    ...targetPre.map((value: number, index: number) => ({ week: `W${index + 1}`, target: value })),
    ...refreshed.slice(0, 4).map((value: number, index: number) => ({
      week: `W${index + 9}`,
      target: value,
      untouched: untouched[index],
      controls: postControl[index]
    }))
  ];
}

export default function Dashboard() {
  const [week, setWeek] = useState<1 | 5>(1);
  const [decayingPosts, setDecayingPosts] = useState<any[]>([]);
  const [refreshes, setRefreshes] = useState<Record<string, string>>({});
  const [brief, setBrief] = useState<any>(null);
  const [briefContext, setBriefContext] = useState<string[]>([]);
  const [weekOneSummary, setWeekOneSummary] = useState('Cold-start recommendations based on generic SEO heuristics.');
  const [weekFiveSummary, setWeekFiveSummary] = useState('Evidence will appear after measured refresh outcomes are retained.');
  const [outcomes, setOutcomes] = useState<any[]>([]);
  const [memories, setMemories] = useState<any[]>([]);
  const [loadingBrief, setLoadingBrief] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const detected = postsData.map(post => {
      const metrics = (metricsData as any)[post.id];
      const decayInfo = detectDecay(metrics.history);
      return { ...post, ...decayInfo };
    }).filter(p => p.isDecaying);
    setDecayingPosts(detected);
  }, []);

  const handleGenerateBrief = async () => {
    setLoadingBrief(true);
    setError('');
    try {
      const res = await fetch('/api/brief', {
        method: 'POST',
        body: JSON.stringify({ decayingPosts, week })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to generate the brief.');
      setBrief(data.brief);
      setBriefContext(data.context || []);
      if (week === 1) setWeekOneSummary(data.brief.summary);
      else setWeekFiveSummary(data.brief.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to generate the brief.');
    }
    setLoadingBrief(false);
  };

  const handleAdvance = async () => {
    setAdvancing(true);
    setError('');
    try {
      const actionRes = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshes })
      });
      const actionData = await actionRes.json();
      if (!actionRes.ok) throw new Error(actionData.error || 'Unable to register refresh actions.');
      const res = await fetch('/api/advance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshes })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to advance the experiment.');
      setOutcomes(data.results);
      setWeek(5);
      
      const memRes = await fetch('/api/memory');
      const memData = await memRes.json();
      setMemories(memData.memories);
      
      setBrief(null); // clear brief so user has to generate week 5 brief
      setBriefContext([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to advance the experiment.');
    }
    setAdvancing(false);
  };

  const applyRecommendation = (postId: string, refreshType: string) => {
    setRefreshes(current => ({ ...current, [postId]: refreshType }));
  };

  const applyAllRecommendations = () => {
    if (!brief) return;
    const recommendations = brief.recommendations.reduce((actions: Record<string, string>, recommendation: any) => {
      actions[recommendation.postId] = recommendation.suggestedRefresh;
      return actions;
    }, {});
    setRefreshes(current => ({ ...current, ...recommendations }));
  };

  const selectedCount = Object.keys(refreshes).length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="bg-white border-b px-4 sm:px-6 py-4 flex flex-wrap gap-4 items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white"><Activity size={20} /></div>
          <h1 className="text-xl font-bold tracking-tight">Archivist</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full text-sm font-medium border">
            <Calendar size={16} className="text-slate-500" />
            <span>Week {week}</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full text-sm font-medium border">
            <Brain size={16} className={week === 5 ? "text-blue-500" : "text-slate-400"} />
            <span>{memories.length === 0 ? 'Memory: Cold Start' : `Memory Active (${memories.length})`}</span>
          </div>
          {week === 1 && (
            <button 
              onClick={handleAdvance}
              disabled={advancing || Object.keys(refreshes).length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {advancing ? <RefreshCw size={16} className="animate-spin" /> : <ChevronRight size={16} />}
              Advance 4 Weeks{selectedCount > 0 ? ` (${selectedCount})` : ''}
            </button>
          )}
        </div>
      </header>

      <main className="p-4 sm:p-6 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        {error && (
          <div className="lg:col-span-12 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        
        <div className="lg:col-span-8 space-y-6">
          <section className="bg-white p-5 rounded-xl border shadow-sm">
            <div className="flex flex-wrap gap-3 justify-between items-center mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2"><TrendingDown size={18} className="text-red-500"/> Decayed Content Audit</h2>
              <span className="text-xs font-medium text-slate-500">{decayingPosts.length} pages need attention</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 border-b">
                  <tr>
                    <th className="px-4 py-3 font-medium">Post Title</th>
                    <th className="px-4 py-3 font-medium">Cluster</th>
                    <th className="px-4 py-3 font-medium">Peak vs Current</th>
                    <th className="px-4 py-3 font-medium">Drop</th>
                    {week === 1 && <th className="px-4 py-3 font-medium">Action</th>}
                    {week === 5 && <th className="px-4 py-3 font-medium">Outcome</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {decayingPosts.slice(0, 10).map(post => (
                    <tr key={post.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-medium max-w-xs truncate" title={post.title}>{post.title}</td>
                      <td className="px-4 py-3"><span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs">{post.cluster}</span></td>
                      <td className="px-4 py-3 tabular-nums">{Math.round(post.peak)} → {Math.round(post.current)}</td>
                      <td className="px-4 py-3 text-red-600 font-medium">{(post.drop * 100).toFixed(0)}%</td>
                      {week === 1 && (
                        <td className="px-4 py-3">
                          <select 
                            className="text-xs border rounded p-1 bg-white focus:ring-2 focus:ring-blue-500"
                            value={refreshes[post.id] || ''}
                            onChange={(e) => setRefreshes({...refreshes, [post.id]: e.target.value})}
                          >
                            <option value="">No action</option>
                            <option value="update_stats">Update Stats</option>
                            <option value="add_faq">Add FAQ</option>
                            <option value="rewrite_intro">Rewrite Intro</option>
                          </select>
                        </td>
                      )}
                      {week === 5 && (
                        <td className="px-4 py-3">
                          {outcomes.find(o => o.postId === post.id) ? (
                            <span className={`text-xs px-2 py-1 rounded font-medium ${outcomes.find(o => o.postId === post.id).did.label === 'improved' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                              {(outcomes.find(o => o.postId === post.id).did.effect * 100).toFixed(1)}% lift
                            </span>
                          ) : <span className="text-slate-400 text-xs">Untouched</span>}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-white p-5 rounded-xl border shadow-sm">
            <div className="flex flex-wrap gap-3 justify-between items-center mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2"><Zap size={18} className="text-yellow-500"/> Agent Brief (Week {week})</h2>
              <button onClick={handleGenerateBrief} disabled={loadingBrief || decayingPosts.length === 0} className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50">
                {loadingBrief ? 'Generating...' : 'Generate Brief'}
              </button>
            </div>
            
            {!brief ? (
              <div className="py-12 text-center text-slate-400 border-2 border-dashed rounded-lg">
                <p>Click generate to build the LLM strategy brief.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-lg">
                  <div className="flex flex-wrap gap-2 items-center justify-between">
                    <p className="font-semibold text-blue-900">Summary Strategy</p>
                    {week === 1 && <button onClick={applyAllRecommendations} className="text-xs font-semibold text-blue-700 hover:text-blue-900">Apply all recommendations</button>}
                  </div>
                  <p className="text-blue-800 text-sm mt-1">{brief.summary}</p>
                </div>
                <div className="grid gap-3">
                  {brief.recommendations.map((rec: any, idx: number) => {
                    const post = decayingPosts.find(p => p.id === rec.postId);
                    return (
                      <div key={idx} className="flex flex-col border rounded-lg p-3 text-sm">
                        <div className="flex items-center justify-between font-medium">
                          <span className="truncate pr-4">{post?.title}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="bg-slate-100 px-2 py-0.5 rounded">{rec.suggestedRefresh}</span>
                            {week === 1 && <button onClick={() => applyRecommendation(rec.postId, rec.suggestedRefresh)} className="text-xs font-semibold text-blue-700 hover:text-blue-900">Use</button>}
                          </div>
                        </div>
                        <p className="text-slate-500 mt-1">{rec.rationale}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-medium text-slate-500">
                          <span className="rounded bg-slate-100 px-2 py-0.5">Confidence: {rec.confidence}</span>
                          {week === 5 && <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-700">Evidence-backed</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <section className="bg-white p-5 rounded-xl border shadow-sm h-full max-h-[800px] flex flex-col">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-4"><Brain size={18} className="text-purple-500"/> Hindsight Memory Bank</h2>
            {memories.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 space-y-3">
                <Brain size={48} className="text-slate-200" />
                <p className="text-sm">No empirical outcomes measured yet.<br/>Memory bank is cold.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                {memories.map((mem, idx) => (
                  <div key={idx} className="bg-purple-50 border border-purple-100 p-3 rounded-lg text-sm text-purple-900 shadow-sm">
                    <p>{mem.content}</p>
                    <p className="text-xs text-purple-500 mt-2 font-medium">{new Date(mem.createdAt).toLocaleTimeString()}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="lg:col-span-12 space-y-6">
          <WeekComparisonView week={week} weekOneSummary={weekOneSummary} weekFiveSummary={weekFiveSummary} memoryCount={memories.length} />

          {week === 5 && outcomes[0] && (
            <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
              <OutcomeChart data={buildOutcomeSeries(outcomes[0])} title={`Measured outcome: ${outcomes[0].refreshType}`} />
              <section className="rounded-xl border bg-white p-5 shadow-sm">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><CheckCircle2 size={18} className="text-emerald-600" /> DiD evidence</h2>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">Target pre average</dt><dd className="mt-1 font-semibold">{Math.round(outcomes[0].did.targetPreAvg).toLocaleString()}</dd></div>
                  <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">Target post average</dt><dd className="mt-1 font-semibold">{Math.round(outcomes[0].did.targetPostAvg).toLocaleString()}</dd></div>
                  <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">Measured effect</dt><dd className="mt-1 font-semibold text-emerald-700">{(outcomes[0].did.effect * 100).toFixed(1)}%</dd></div>
                  <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">Valid controls</dt><dd className="mt-1 font-semibold">{outcomes[0].did.controlCount}</dd></div>
                </dl>
                {outcomes[0].did.flaggedControls.length > 0 && <p className="mt-4 text-xs text-amber-700">Excluded contaminated controls: {outcomes[0].did.flaggedControls.join(', ')}</p>}
              </section>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border bg-white p-5 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><TrendingDown size={18} className="text-amber-500" /> Cluster gap table</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm"><thead className="border-b text-xs uppercase text-slate-500"><tr><th className="px-2 py-2">Cluster</th><th className="px-2 py-2">Missing topic</th><th className="px-2 py-2">Signal</th></tr></thead><tbody className="divide-y">{CLUSTER_GAPS.map(gap => <tr key={gap.topic}><td className="px-2 py-3 font-medium">{gap.cluster}</td><td className="px-2 py-3">{gap.topic}</td><td className="px-2 py-3 text-slate-500">{gap.reason}</td></tr>)}</tbody></table>
              </div>
            </section>
            <GroundTruthVerifier cases={(groundTruth as any).cases} outcomes={outcomes} />
          </div>

          {week === 5 && briefContext.length > 0 && (
            <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-emerald-950"><Brain size={18} /> Recalled evidence</h2>
              <ul className="grid gap-2 text-sm text-emerald-900 md:grid-cols-2">{briefContext.map((item, index) => <li key={index} className="rounded-lg border border-emerald-100 bg-white/70 p-3">{item}</li>)}</ul>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

