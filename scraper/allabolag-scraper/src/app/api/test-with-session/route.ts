import { NextResponse } from 'next/server';
import { withSession, getBuildId } from '@/lib/allabolag';

export async function GET() {
  try {
    console.log('Testing withSession wrapper...');
    
    const result = await withSession(async (session) => {
      console.log('Inside withSession, getting build ID...');
      const buildId = await getBuildId(session);
      console.log('Build ID retrieved:', buildId);
      return { buildId, sessionId: session.sessionId };
    });
    
    console.log('withSession completed successfully:', result);
    
    return NextResponse.json({
      success: true,
      result: result
    });
    
  } catch (error) {
    console.error('Error in withSession test:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
