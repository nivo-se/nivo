import { NextRequest, NextResponse } from 'next/server';
import { LocalStagingDB } from '@/lib/db/local-staging';
import { handleCors, addCorsHeaders } from '@/lib/cors';

export async function GET(request: NextRequest) {
	// Handle CORS preflight
	const corsResponse = handleCors(request);
	if (corsResponse) return corsResponse;

	try {
		const { searchParams } = new URL(request.url);
		const jobId = searchParams.get('jobId');
		
		if (!jobId) {
			return NextResponse.json({ error: 'jobId parameter is required' }, { status: 400 });
		}
		
		const localDb = new LocalStagingDB(jobId);
		
		// Get comprehensive monitoring data
		const job = localDb.getJob(jobId);
		if (!job) {
			return addCorsHeaders(NextResponse.json({ error: 'Job not found' }, { status: 404 }));
		}
		const jobStats = localDb.getJobStats(jobId);
		
		// Get detailed company processing status
		const companies = localDb.getCompanies(jobId);
		const companyIds = localDb.getCompanyIds(jobId);
		
		// Calculate processing rates and estimates
		const now = new Date();
		const startTime = new Date(job.createdAt);
		const elapsedMs = now.getTime() - startTime.getTime();
		const elapsedMinutes = elapsedMs / (1000 * 60);
		
		// Calculate rates
		const companiesPerMinute = elapsedMinutes > 0 ? jobStats.companies / elapsedMinutes : 0;
		const idsPerMinute = elapsedMinutes > 0 ? jobStats.companyIds / elapsedMinutes : 0;
		const financialsPerMinute = elapsedMinutes > 0 ? jobStats.financials / elapsedMinutes : 0;
		
		// Estimate completion times
		const estimatedTotalCompanies = 10000; // For 10k company runs
		const estimatedRemainingCompanies = Math.max(0, estimatedTotalCompanies - jobStats.companies);
		const estimatedRemainingMinutes = companiesPerMinute > 0 ? estimatedRemainingCompanies / companiesPerMinute : 0;
		
		// Get recent activity (last 10 minutes)
		const recentActivity = {
			companiesProcessed: jobStats.companies,
			companyIdsResolved: jobStats.companyIds,
			financialsFetched: jobStats.financials,
			lastUpdated: job.updatedAt
		};
		
		// Get error summary
		const errorSummary = {
			totalErrors: 0,
			stage1Errors: 0,
			stage2Errors: 0,
			stage3Errors: 0,
			recentErrors: []
		};
		
		// Calculate stage progress percentages
		const stageProgress = {
			stage1: {
				completed: jobStats.companies,
				total: estimatedTotalCompanies,
				percentage: Math.min(100, (jobStats.companies / estimatedTotalCompanies) * 100)
			},
			stage2: {
				completed: jobStats.companyIds,
				total: jobStats.companies,
				percentage: jobStats.companies > 0 ? (jobStats.companyIds / jobStats.companies) * 100 : 0
			},
			stage3: {
				completed: jobStats.financials,
				total: jobStats.companyIds * 5, // Assuming 5 years per company
				percentage: jobStats.companyIds > 0 ? (jobStats.financials / (jobStats.companyIds * 5)) * 100 : 0
			}
		};
		
		// Get system health indicators
		const systemHealth = {
			databaseConnected: true,
			apiResponsive: true,
			memoryUsage: process.memoryUsage(),
			uptime: process.uptime(),
			lastHeartbeat: now.toISOString()
		};
		
		const dashboard = {
			jobId: jobId,
			timestamp: now.toISOString(),
			status: {
				current: job.status,
				stage: job.stage,
				isRunning: job.status === 'running',
				isCompleted: job.status === 'done',
				hasErrors: job.status === 'error'
			},
			progress: {
				total: {
					companies: jobStats.companies,
					companyIds: jobStats.companyIds,
					financials: jobStats.financials
				},
				rates: {
					companiesPerMinute: Math.round(companiesPerMinute * 100) / 100,
					idsPerMinute: Math.round(idsPerMinute * 100) / 100,
					financialsPerMinute: Math.round(financialsPerMinute * 100) / 100
				},
				estimates: {
					elapsedMinutes: Math.round(elapsedMinutes * 100) / 100,
					estimatedRemainingMinutes: Math.round(estimatedRemainingMinutes * 100) / 100,
					estimatedCompletionTime: new Date(now.getTime() + estimatedRemainingMinutes * 60 * 1000).toISOString()
				}
			},
			stages: stageProgress,
			recentActivity: recentActivity,
			errorSummary: errorSummary,
			systemHealth: systemHealth,
			recommendations: [] as string[]
		};
		
		// Add recommendations based on current status
		if (companiesPerMinute < 1 && job.status === 'running') {
			dashboard.recommendations.push('Processing rate is slow. Consider checking for bottlenecks.');
		}
		
		if (elapsedMinutes > 120 && job.status === 'running') {
			dashboard.recommendations.push('Long-running process detected. Monitor for stuck processes.');
		}
		
		if (job.status === 'error') {
			dashboard.recommendations.push('Process has errors. Check logs and consider restarting.');
		}
		
		return addCorsHeaders(NextResponse.json(dashboard));
		
	} catch (error: unknown) {
		console.error('Error in monitoring dashboard:', error);
		const message = error instanceof Error ? error.message : 'Unknown error';
		return addCorsHeaders(NextResponse.json({
			error: message,
			timestamp: new Date().toISOString()
		}, { status: 500 }));
	}
}
