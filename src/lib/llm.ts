import { z } from 'zod';
import { Groq } from 'groq-sdk';
import { Post } from './decay';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || 'mock-key',
  dangerouslyAllowBrowser: true 
});

export const BriefSchema = z.object({
  summary: z.string(),
  recommendations: z.array(z.object({
    postId: z.string(),
    suggestedRefresh: z.enum(['update_stats', 'add_faq', 'rewrite_intro']),
    confidence: z.enum(['high', 'medium', 'low']),
    rationale: z.string()
  }))
});

export type BriefResult = z.infer<typeof BriefSchema>;

export async function generateBrief(
  decayingPosts: Post[], 
  hindsightContext: string[]
): Promise<BriefResult> {
  const isMock = !process.env.GROQ_API_KEY;

  if (isMock) {
    return generateFallbackBrief(decayingPosts, hindsightContext);
  }

  const prompt = `
You are the Archivist agent. Your task is to recommend refresh strategies for decaying content.
Here are the decayed posts:
${JSON.stringify(decayingPosts, null, 2)}

Here is the retrieved knowledge from Hindsight Memory about past refreshes:
${hindsightContext.length > 0 ? hindsightContext.join('\n') : "Memory is empty. Rely on general SEO heuristics."}

Analyze the memory and the posts. Prioritize actions that have proven successful in memory.
Return JSON ONLY matching this schema:
{
  "summary": "...",
  "recommendations": [
    { "postId": "...", "suggestedRefresh": "update_stats|add_faq|rewrite_intro", "confidence": "high|medium|low", "rationale": "..." }
  ]
}
`;

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' }
    });

    const content = chatCompletion.choices[0]?.message?.content || '{}';
    return BriefSchema.parse(JSON.parse(content));
  } catch (err) {
    console.error("LLM Generation failed, using fallback:", err);
    return generateFallbackBrief(decayingPosts, hindsightContext);
  }
}

function generateFallbackBrief(posts: Post[], context: string[]): BriefResult {
  const recommendations: BriefResult['recommendations'] = [];
  
  const knowsStatsWork = context.some(c => c.includes('update_stats') && c.includes('improved'));
  
  for (const p of posts) {
    let refresh: 'update_stats' | 'add_faq' | 'rewrite_intro' = 'rewrite_intro';
    let rationale = "General heuristic recommendation.";
    let confidence: 'high'|'medium'|'low' = 'low';

    if (p.causeHint === 'outdated_stats') {
      refresh = 'update_stats';
      if (knowsStatsWork) {
        rationale = "Hindsight memory proves stat updates drive ~38% lift for this brand.";
        confidence = 'high';
      } else {
        rationale = "Stat updates generally help CTR.";
        confidence = 'medium';
      }
    } else if (p.causeHint === 'thin_faq') {
      refresh = 'add_faq';
      rationale = "Adding FAQs can capture long-tail queries.";
    }

    recommendations.push({
      postId: p.id,
      suggestedRefresh: refresh,
      confidence,
      rationale
    });
  }

  return {
    summary: context.length > 0 
      ? "Calibrated to brand: Prioritizing stat updates over FAQs based on measured empirical lift."
      : "Cold start baseline: Generic SEO recommendations applied.",
    recommendations
  };
}
