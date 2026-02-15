import { NextRequest, NextResponse } from 'next/server';
import { LocalStagingDB } from '@/lib/db/local-staging';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, stage, action } = body;
    
    if (!sessionId || !stage || !action) {
      return NextResponse.json(
        { error: 'Missing required parameters: sessionId, stage, action' },
        { status: 400 }
      );
    }
    
    if (!['2', '3'].includes(stage.toString())) {
      return NextResponse.json(
        { error: 'Stage must be 2 or 3' },
        { status: 400 }
      );
    }
    
    if (!['start', 'retry'].includes(action)) {
      return NextResponse.json(
        { error: 'Action must be start or retry' },
        { status: 400 }
      );
    }
    
    const localDb = new LocalStagingDB(sessionId);
    
    // Check if session exists
    const jobDetails = localDb.getJob(sessionId);
    if (!jobDetails) {
      localDb.close();
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    
    // Get session stats to determine readiness
    const stats = localDb.getJobStats(sessionId);
    localDb.close();
    
    let targetUrl = '';
    let estimatedDuration = '';
    
    if (stage === '2') {
      if (stats.companies === 0) {
        return NextResponse.json(
          { error: 'Stage 1 must be completed before starting Stage 2' },
          { status: 400 }
        );
      }
      targetUrl = '/api/enrich/company-ids';
      estimatedDuration = `${Math.ceil(stats.companies / 100)} minutes`;
    } else if (stage === '3') {
      if (stats.companyIds === 0) {
        return NextResponse.json(
          { error: 'Stage 2 must be completed before starting Stage 3' },
          { status: 400 }
        );
      }
      targetUrl = '/api/financial/fetch';
      estimatedDuration = `${Math.ceil(stats.companyIds / 50)} minutes`;
    }
    
    // For now, just return success - the actual stage execution will be handled by the frontend
    // or by calling the endpoints directly
    return NextResponse.json({
      success: true,
      message: `Stage ${stage} ${action} initiated successfully`,
      sessionId,
      stage,
      action,
      estimatedDuration,
      targetUrl,
      note: 'Please call the target endpoint directly to start the stage'
    });
    
  } catch (error) {
    console.error('Error in stage control:', error);
    return NextResponse.json({ error: 'Failed to process stage control request' }, { status: 500 });
  }
}
