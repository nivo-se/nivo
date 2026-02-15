import { NextRequest, NextResponse } from 'next/server';
import { LocalStagingDB } from '@/lib/db/local-staging';
import { join } from 'path';
import { readdirSync, statSync } from 'fs';
import { handleCors, addCorsHeaders } from '@/lib/cors';

export interface SessionInfo {
  sessionId: string;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'completed' | 'error';
  stages: {
    stage1: {
      status: 'pending' | 'running' | 'completed' | 'error';
      companies: number;
      completedAt?: string;
    };
    stage2: {
      status: 'pending' | 'running' | 'completed' | 'error';
      companyIds: number;
      completedAt?: string;
    };
    stage3: {
      status: 'pending' | 'running' | 'completed' | 'error';
      financials: number;
      completedAt?: string;
    };
  };
  totalCompanies: number;
  totalCompanyIds: number;
  totalFinancials: number;
  filters?: any;
}

export async function GET(request: NextRequest) {
  // Handle CORS preflight
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  try {
    console.log('Fetching all scraping sessions...');
    
    const stagingDir = join(process.cwd(), 'staging');
    const sessions: SessionInfo[] = [];
    
    try {
      const files = readdirSync(stagingDir);
      const dbFiles = files.filter(file => file.startsWith('staging_') && file.endsWith('.db'));
      
      for (const dbFile of dbFiles) {
        const sessionId = dbFile.replace('staging_', '').replace('.db', '');
        const dbPath = join(stagingDir, dbFile);
        const stats = statSync(dbPath);
        
        try {
          const localDb = new LocalStagingDB(sessionId);
          
          // Get job info
          const job = localDb.getJob(sessionId);
          if (!job) continue;
          
          // Get statistics
          const jobStats = localDb.getJobStats(sessionId);
          
          // Determine stage status
          const stages = {
            stage1: {
              status: jobStats.companies > 0 ? 'completed' : 'pending',
              companies: jobStats.companies,
              completedAt: jobStats.companies > 0 ? job.updatedAt : undefined
            },
            stage2: {
              status: jobStats.companyIds > 0 ? 'completed' : (jobStats.companies > 0 ? 'pending' : 'pending'),
              companyIds: jobStats.companyIds,
              completedAt: jobStats.companyIds > 0 ? job.updatedAt : undefined
            },
            stage3: {
              status: jobStats.financials > 0 ? 'completed' : (jobStats.companyIds > 0 ? 'pending' : 'pending'),
              financials: jobStats.financials,
              completedAt: jobStats.financials > 0 ? job.updatedAt : undefined
            }
          };
          
          // Determine overall status
          let status: 'active' | 'completed' | 'error' = 'active';
          if (jobStats.financials > 0) {
            status = 'completed';
          } else if (jobStats.companies > 0 || jobStats.companyIds > 0) {
            status = 'active';
          }
          
          const session: SessionInfo = {
            sessionId,
            createdAt: job.createdAt,
            updatedAt: job.updatedAt,
            status,
            stages,
            totalCompanies: jobStats.companies,
            totalCompanyIds: jobStats.companyIds,
            totalFinancials: jobStats.financials,
            filters: job.params || undefined // Include search parameters from job
          };
          
          sessions.push(session);
          localDb.close();
          
        } catch (error) {
          console.error(`Error reading session ${sessionId}:`, error);
          continue;
        }
      }
      
      // Sort by creation date (newest first)
      sessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      return addCorsHeaders(NextResponse.json({
        success: true,
        sessions,
        total: sessions.length
      }));
      
    } catch (error) {
      console.error('Error reading staging directory:', error);
      return addCorsHeaders(NextResponse.json({
        success: false,
        error: 'Failed to read staging directory',
        sessions: [],
        total: 0
      }));
    }
    
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return addCorsHeaders(NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch sessions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    ));
  }
}
