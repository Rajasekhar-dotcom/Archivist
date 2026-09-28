import { NextResponse } from 'next/server';
import { generateBrief } from '@/lib/llm';
import { recallMemory } from '@/lib/hindsight';
import { detectDecay } from '@/lib/decay';
import postsData from '../../../../data/posts.json';
import metricsData from '../../../../data/metrics.json';

export async function POST(request: Request) {
  try {
    const { decayingPosts: suppliedPosts, week = 1, clusterFilter } = await request.json();
    const decayingPosts = (suppliedPosts || postsData.map(post => ({
      ...post,
      ...detectDecay((metricsData as any)[post.id].history)
    })).filter(post => post.isDecaying)).filter((post: any) => !clusterFilter || post.cluster === clusterFilter);

    let hindsightContext: string[] = [];
    
    if (week > 1) {
      // In Week 5, we query memory for past outcomes
      hindsightContext = await recallMemory("outcomes of refresh types for decaying pages");
    }

    const brief = await generateBrief(decayingPosts, hindsightContext);

    return NextResponse.json({ brief, context: hindsightContext });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to generate brief' }, { status: 500 });
  }
}
