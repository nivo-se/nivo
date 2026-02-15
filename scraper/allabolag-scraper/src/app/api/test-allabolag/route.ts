import { NextRequest, NextResponse } from 'next/server';
import { getBuildId } from '@/lib/allabolag';

export async function GET(request: NextRequest) {
  try {
    console.log('Testing Allabolag.se connection...');
    
    // Try to get buildId from Allabolag.se
    const buildId = await getBuildId();
    
    return NextResponse.json({
      success: true,
      message: 'Allabolag.se connection successful',
      buildId: buildId
    });
    
  } catch (error) {
    console.error('Allabolag.se connection error:', error);
    return NextResponse.json(
      { 
        error: 'Allabolag.se connection failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
