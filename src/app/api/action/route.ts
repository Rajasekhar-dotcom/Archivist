import { NextResponse } from 'next/server';
import { setRefreshes, RefreshSelections } from '@/lib/actions';

const validActions = new Set(['update_stats', 'add_faq', 'rewrite_intro']);

export async function POST(request: Request) {
  try {
    const { refreshes } = await request.json();
    if (!refreshes || typeof refreshes !== 'object') {
      return NextResponse.json({ error: 'Refresh selections are required.' }, { status: 400 });
    }

    const invalid = Object.entries(refreshes).find(([, action]) => !validActions.has(String(action)));
    if (invalid) {
      return NextResponse.json({ error: `Unsupported refresh action: ${invalid[1]}` }, { status: 400 });
    }

    setRefreshes(refreshes as RefreshSelections);
    return NextResponse.json({ accepted: true, refreshes });
  } catch {
    return NextResponse.json({ error: 'Invalid refresh selection payload.' }, { status: 400 });
  }
}