import { NextRequest, NextResponse } from 'next/server';
import { LocalStagingDB } from '@/lib/db/local-staging';
import { handleCors, addCorsHeaders } from '@/lib/cors';

export async function POST(request: NextRequest) {
	// Handle CORS preflight
	const corsResponse = handleCors(request);
	if (corsResponse) return corsResponse;

	try {
		const { jobId, action, stage } = await request.json();
		
		if (!jobId || !action) {
			return NextResponse.json({ 
				error: 'jobId and action are required' 
			}, { status: 400 });
		}
		
		const localDb = new LocalStagingDB(jobId);
		const job = localDb.getJob(jobId);
		
		if (!job) {
			return NextResponse.json({ 
				error: 'Job not found' 
			}, { status: 404 });
		}
		
		const now = new Date().toISOString();
		
		switch (action) {
			case 'stop':
				// Stop the current process
				localDb.updateJob(jobId, {
					status: 'stopped',
					updatedAt: now,
					lastError: 'Process stopped by user'
				});
				
				return addCorsHeaders(NextResponse.json({
					success: true,
					message: 'Process stopped successfully',
					jobId: jobId,
					status: 'stopped',
					timestamp: now
				}));
				
			case 'pause':
				// Pause the current process
				localDb.updateJob(jobId, {
					status: 'paused',
					updatedAt: now
				});
				
				return NextResponse.json({
					success: true,
					message: 'Process paused successfully',
					jobId: jobId,
					status: 'paused',
					timestamp: now
				});
				
			case 'resume':
				// Resume the process from where it left off
				const currentStats = localDb.getJobStats(jobId);
				
				// Determine which stage to resume based on current progress
				let resumeStage = 'stage1_segmentation';
				if (currentStats.financials > 0) {
					resumeStage = 'stage3_financials';
				} else if (currentStats.companyIds > 0) {
					resumeStage = 'stage2_enrichment';
				} else if (currentStats.companies > 0) {
					resumeStage = 'stage2_enrichment';
				}
				
				localDb.updateJob(jobId, {
					status: 'running',
					stage: resumeStage,
					updatedAt: now
				});
				
				return NextResponse.json({
					success: true,
					message: 'Process resumed successfully',
					jobId: jobId,
					status: 'running',
					stage: resumeStage,
					timestamp: now,
					resumeFrom: {
						companies: currentStats.companies,
						companyIds: currentStats.companyIds,
						financials: currentStats.financials
					}
				});
				
			case 'restart':
				// Restart the process from the beginning
				localDb.updateJob(jobId, {
					status: 'running',
					stage: 'stage1_segmentation',
					updatedAt: now,
					processedCount: 0
				});
				
				return NextResponse.json({
					success: true,
					message: 'Process restarted successfully',
					jobId: jobId,
					status: 'running',
					stage: 'stage1_segmentation',
					timestamp: now
				});
				
			case 'status':
				// Get current status
				const stats = localDb.getJobStats(jobId);
				const currentJob = localDb.getJob(jobId);
				if (!currentJob) {
					return NextResponse.json({ error: 'Job not found' }, { status: 404 });
				}
				
				return NextResponse.json({
					success: true,
					jobId: jobId,
					status: currentJob.status,
					stage: currentJob.stage,
					stats: stats,
					timestamp: now
				});
				
			default:
				return NextResponse.json({ 
					error: 'Invalid action. Supported actions: stop, pause, resume, restart, status' 
				}, { status: 400 });
		}
		
	} catch (error: unknown) {
		console.error('Error in monitoring control:', error);
		const message = error instanceof Error ? error.message : 'Unknown error';
		return NextResponse.json({
			success: false,
			error: message,
			timestamp: new Date().toISOString()
		}, { status: 500 });
	}
}
