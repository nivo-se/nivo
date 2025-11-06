import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const hasKey = !!process.env.SUPABASE_ANON_KEY;
    
    // First, just verify env vars are set
    if (!supabaseUrl || !hasKey) {
      return NextResponse.json(
        { 
          error: 'Missing Supabase configuration',
          hasUrl: !!supabaseUrl,
          hasKey: hasKey
        },
        { status: 500 }
      );
    }
    
    // Try to create client directly instead of importing (to isolate the issue)
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY!);
    
    // Test client exists
    return NextResponse.json({
      success: true,
      message: 'Supabase client created successfully',
      url: supabaseUrl.substring(0, 40) + '...',
      clientExists: !!supabase,
      note: 'Client created - use other endpoints to test actual queries'
    });
    
  } catch (error) {
    console.error('Connection test error:', error);
    return NextResponse.json(
      { 
        error: 'Connection test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
