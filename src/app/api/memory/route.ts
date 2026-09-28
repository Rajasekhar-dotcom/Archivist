import { NextResponse } from 'next/server';
import { getAllMockMemories, recallMemory } from '@/lib/hindsight';

export async function GET() {
  const localMemories = getAllMockMemories();
  if (process.env.HINDSIGHT_API_KEY) {
    const recalled = await recallMemory('outcomes of refresh types for decaying pages');
    return NextResponse.json({ memories: recalled.map(content => ({ content, createdAt: new Date().toISOString() })) });
  }
  return NextResponse.json({ memories: localMemories });
}
