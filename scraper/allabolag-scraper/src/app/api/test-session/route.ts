import { NextRequest, NextResponse } from 'next/server';
import { getAllabolagSession } from '@/lib/allabolag';

export async function POST(request: NextRequest) {
  try {
    console.log('🔐 Testing session management...');
    
    const session = await getAllabolagSession();
    
    console.log('Session result:', {
      hasCookies: !!session.cookies,
      hasToken: !!session.token,
      cookiesLength: session.cookies?.length || 0,
      tokenLength: session.token?.length || 0
    });
    
    return NextResponse.json({
      success: true,
      session: {
        hasCookies: !!session.cookies,
        hasToken: !!session.token,
        cookiesLength: session.cookies?.length || 0,
        tokenLength: session.token?.length || 0,
        cookies: session.cookies?.substring(0, 100) + '...', // First 100 chars
        token: session.token?.substring(0, 20) + '...' // First 20 chars
      }
    });
  } catch (error) {
    console.error('❌ Session test failed:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
