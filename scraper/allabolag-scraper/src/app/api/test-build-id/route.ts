import { NextResponse } from 'next/server';
import { getBuildId, withSession } from '@/lib/allabolag';

export async function GET() {
  try {
    const buildId = await withSession(async (session) => {
      return await getBuildId(session);
    });
    
    return NextResponse.json({ buildId });
  } catch (error) {
    console.error('Error getting build ID:', error);
    return NextResponse.json(
      { error: 'Failed to get build ID', details: error.message },
      { status: 500 }
    );
  }
}
