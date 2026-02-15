import { supabase } from '../lib/db';
import { Checkpoint, JobStage, JobStatus } from '../providers/base';

export class CheckpointManager {
  private jobId: string;
  private stage: JobStage;

  constructor(jobId: string, stage: JobStage) {
    this.jobId = jobId;
    this.stage = stage;
  }

  /**
   * Save a checkpoint with current progress
   */
  async saveCheckpoint(data: {
    lastProcessedPage?: number;
    lastProcessedCompany?: string;
    processedCount: number;
    errorCount: number;
    lastError?: string;
    checkpointData?: any;
  }): Promise<void> {
    try {
      const { error } = await supabase
        .from('scraper_checkpoints')
        .upsert({
          job_id: this.jobId,
          stage: this.stage,
          last_processed_page: data.lastProcessedPage,
          last_processed_company: data.lastProcessedCompany,
          processed_count: data.processedCount,
          error_count: data.errorCount,
          last_error: data.lastError,
          checkpoint_data: data.checkpointData,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'job_id,stage'
        });

      if (error) {
        console.error('Failed to save checkpoint:', error);
        throw error;
      }

      console.log(`Checkpoint saved for job ${this.jobId}, stage ${this.stage}:`, {
        processed: data.processedCount,
        errors: data.errorCount,
        lastPage: data.lastProcessedPage,
        lastCompany: data.lastProcessedCompany,
      });
    } catch (error) {
      console.error('Error saving checkpoint:', error);
      // Don't throw - checkpoint failures shouldn't stop scraping
    }
  }

  /**
   * Load the latest checkpoint for this job and stage
   */
  async loadCheckpoint(): Promise<Checkpoint | null> {
    try {
      const { data, error } = await supabase
        .from('scraper_checkpoints')
        .select('*')
        .eq('job_id', this.jobId)
        .eq('stage', this.stage)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('Failed to load checkpoint:', error);
        return null;
      }

      if (!data) {
        return null;
      }

      return {
        jobId: data.job_id,
        stage: data.stage,
        lastProcessedPage: data.last_processed_page,
        lastProcessedCompany: data.last_processed_company,
        processedCount: data.processed_count || 0,
        errorCount: data.error_count || 0,
        lastError: data.last_error,
        timestamp: data.updated_at,
      };
    } catch (error) {
      console.error('Error loading checkpoint:', error);
      return null;
    }
  }

  /**
   * Update job progress in the main jobs table
   */
  async updateJobProgress(progress: {
    status?: JobStatus;
    lastPage?: number;
    processedCount?: number;
    totalCompanies?: number;
    errorCount?: number;
    lastError?: string;
    rateLimitStats?: any;
  }): Promise<void> {
    try {
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (progress.status) updateData.status = progress.status;
      if (progress.lastPage !== undefined) updateData.last_page = progress.lastPage;
      if (progress.processedCount !== undefined) updateData.processed_count = progress.processedCount;
      if (progress.totalCompanies !== undefined) updateData.total_companies = progress.totalCompanies;
      if (progress.errorCount !== undefined) updateData.error_count = progress.errorCount;
      if (progress.lastError) updateData.last_error = progress.lastError;
      if (progress.rateLimitStats) updateData.rate_limit_stats = progress.rateLimitStats;

      const { error } = await supabase
        .from('scraper_staging_jobs')
        .update(updateData)
        .eq('id', this.jobId);

      if (error) {
        console.error('Failed to update job progress:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error updating job progress:', error);
      // Don't throw - progress update failures shouldn't stop scraping
    }
  }

  /**
   * Get companies that need processing (for resume capability)
   */
  async getCompaniesToProcess(table: 'companies' | 'company_ids' | 'financials'): Promise<any[]> {
    try {
      let query = supabase
        .from(`scraper_staging_${table}`)
        .select('*')
        .eq('job_id', this.jobId);

      // Filter based on stage and status
      switch (this.stage) {
        case 'stage1_segmentation':
          // For segmentation, get all companies
          break;
        case 'stage2_id_resolution':
          // Get companies without company IDs
          query = query.eq('status', 'pending');
          break;
        case 'stage3_financials':
          // Get companies with IDs but without financial data
          query = query.eq('status', 'id_resolved');
          break;
      }

      const { data, error } = await query;

      if (error) {
        console.error(`Failed to get companies to process for ${table}:`, error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error(`Error getting companies to process for ${table}:`, error);
      return [];
    }
  }

  /**
   * Mark a company as processed
   */
  async markCompanyProcessed(
    table: 'companies' | 'company_ids' | 'financials',
    identifier: string,
    status: 'pending' | 'id_resolved' | 'financials_fetched' | 'error',
    errorMessage?: string
  ): Promise<void> {
    try {
      const updateData: any = {
        status,
        last_processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (status === 'error') {
        updateData.error_count = supabase.raw('error_count + 1');
        if (errorMessage) {
          updateData.error_message = errorMessage;
        }
      }

      const { error } = await supabase
        .from(`scraper_staging_${table}`)
        .update(updateData)
        .eq('job_id', this.jobId)
        .eq(table === 'companies' ? 'orgnr' : 'company_id', identifier);

      if (error) {
        console.error(`Failed to mark company as processed in ${table}:`, error);
      }
    } catch (error) {
      console.error(`Error marking company as processed in ${table}:`, error);
    }
  }

  /**
   * Get resume information for a job
   */
  async getResumeInfo(): Promise<{
    canResume: boolean;
    lastStage: JobStage | null;
    lastPage: number;
    processedCount: number;
    totalCompanies: number;
  }> {
    try {
      // Get job info
      const { data: jobData, error: jobError } = await supabase
        .from('scraper_staging_jobs')
        .select('status, stage, last_page, processed_count, total_companies')
        .eq('id', this.jobId)
        .single();

      if (jobError || !jobData) {
        return {
          canResume: false,
          lastStage: null,
          lastPage: 0,
          processedCount: 0,
          totalCompanies: 0,
        };
      }

      // Get latest checkpoint
      const checkpoint = await this.loadCheckpoint();

      return {
        canResume: jobData.status === 'paused' || jobData.status === 'running',
        lastStage: jobData.stage as JobStage,
        lastPage: checkpoint?.lastProcessedPage || jobData.last_page || 0,
        processedCount: checkpoint?.processedCount || jobData.processed_count || 0,
        totalCompanies: jobData.total_companies || 0,
      };
    } catch (error) {
      console.error('Error getting resume info:', error);
      return {
        canResume: false,
        lastStage: null,
        lastPage: 0,
        processedCount: 0,
        totalCompanies: 0,
      };
    }
  }

  /**
   * Clear all checkpoints for a job (when starting fresh)
   */
  async clearCheckpoints(): Promise<void> {
    try {
      const { error } = await supabase
        .from('scraper_checkpoints')
        .delete()
        .eq('job_id', this.jobId);

      if (error) {
        console.error('Failed to clear checkpoints:', error);
        throw error;
      }

      console.log(`Cleared all checkpoints for job ${this.jobId}`);
    } catch (error) {
      console.error('Error clearing checkpoints:', error);
      throw error;
    }
  }
}
