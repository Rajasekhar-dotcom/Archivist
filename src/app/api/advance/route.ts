import { NextResponse } from 'next/server';
import { calculateDiD } from '@/lib/did';
import { retainMemory } from '@/lib/hindsight';
import { getRefreshes } from '@/lib/actions';
import metricsData from '../../../../data/metrics.json';
import postsData from '../../../../data/posts.json';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const refreshes = body.refreshes && Object.keys(body.refreshes).length > 0 ? body.refreshes : getRefreshes();
    if (!refreshes || typeof refreshes !== 'object' || Object.keys(refreshes).length === 0) {
      return NextResponse.json({ error: 'Select at least one refresh action.' }, { status: 400 });
    }
    // refreshes is a Record<postId, refreshType>

    const results = [];

    for (const [postId, refreshType] of Object.entries(refreshes)) {
      const targetPost = postsData.find(p => p.id === postId);
      if (!targetPost) continue;

      const targetMetrics = (metricsData as any)[postId];
      const targetPostTrajectory = targetMetrics.counterfactual_refreshed[refreshType as string] || targetMetrics.counterfactual_untouched;

      const candidateControls = postsData
        .filter(p => p.cluster === targetPost.cluster && p.id !== postId)
        .map(p => ({
          id: p.id,
          pre: (metricsData as any)[p.id].history,
          post: (metricsData as any)[p.id].counterfactual_untouched,
          touched: !!refreshes[p.id] 
        }));

      const did = calculateDiD(
        targetMetrics.history,
        targetPostTrajectory,
        candidateControls
      );

      // Create sentence for Hindsight
      const effectPct = (did.effect * 100).toFixed(1);
      const sentence = `Refresh type ${refreshType} on '${targetPost.cluster}' post '${targetPost.title}' (cause: ${targetPost.causeHint}) yielded ${effectPct}% effect vs ${did.controlCount} controls over 4 weeks (${did.label}).`;

      // Retain in Hindsight
      await retainMemory(sentence);

      results.push({
        postId,
        refreshType,
        did,
        sentence
      });
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to compute DiD' }, { status: 500 });
  }
}
