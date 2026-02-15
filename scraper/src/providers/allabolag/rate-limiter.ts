import { RateLimitConfig, RequestResult } from '../base';

export class AdaptiveRateLimiter {
  private concurrent: number;
  private requestDelay: number;
  private backoffMultiplier: number;
  private maxDelay: number;
  private maxRetries: number;
  private nightMode: RateLimitConfig['nightMode'];

  // Track success/failure rates
  private recentRequests: RequestResult[] = [];
  private activeRequests: number = 0;
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue: boolean = false;

  constructor(config: RateLimitConfig) {
    this.concurrent = config.concurrent;
    this.requestDelay = config.delay;
    this.backoffMultiplier = config.backoffMultiplier;
    this.maxDelay = config.maxDelay;
    this.maxRetries = config.maxRetries;
    this.nightMode = config.nightMode;
  }

  /**
   * Execute a function with adaptive rate limiting
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await this.executeWithRetry(fn);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      this.processQueue();
    });
  }

  /**
   * Process the request queue with concurrency control
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0 && this.activeRequests < this.concurrent) {
      const request = this.requestQueue.shift();
      if (request) {
        this.activeRequests++;
        request().finally(() => {
          this.activeRequests--;
          this.processQueue();
        });
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Execute function with retry logic and rate limiting
   */
  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      const startTime = Date.now();

      try {
        // Apply delay before request (except first attempt)
        if (attempt > 1) {
          const delay = this.calculateDelay(attempt);
          await this.sleep(delay);
        }

        // Execute the function
        const result = await fn();
        const duration = Date.now() - startTime;

        // Record successful request
        this.recordRequest({
          success: true,
          status: 200,
          timestamp: startTime,
          duration,
        });

        // Apply delay after successful request
        await this.sleep(this.requestDelay);

        return result;
      } catch (error: any) {
        const duration = Date.now() - startTime;
        const status = error.status || error.response?.status || 500;

        // Record failed request
        this.recordRequest({
          success: false,
          status,
          timestamp: startTime,
          duration,
          error: error.message,
        });

        lastError = error;

        // Don't retry on certain errors
        if (status === 404 || status === 403) {
          break;
        }

        // Adjust rates based on error type
        if (status === 429) {
          this.handleRateLimit();
        }

        // If this is the last attempt, throw the error
        if (attempt === this.maxRetries) {
          break;
        }
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Record a request result for adaptive learning
   */
  private recordRequest(result: RequestResult): void {
    this.recentRequests.push(result);

    // Keep only last 100 requests for analysis
    if (this.recentRequests.length > 100) {
      this.recentRequests = this.recentRequests.slice(-100);
    }

    // Adjust rates periodically
    if (this.recentRequests.length % 10 === 0) {
      this.adjustRates();
    }
  }

  /**
   * Adjust rates based on recent performance
   */
  private adjustRates(): void {
    const recentFailures = this.recentRequests
      .slice(-50) // Look at last 50 requests
      .filter(r => !r.success || r.status === 429).length;

    const failureRate = recentFailures / Math.min(50, this.recentRequests.length);

    if (failureRate > 0.2) {
      // Too many failures, back off
      this.concurrent = Math.max(1, Math.floor(this.concurrent * 0.7));
      this.requestDelay = Math.min(this.maxDelay, this.requestDelay * this.backoffMultiplier);
      
      console.log(`Rate limiting: Backing off - concurrent: ${this.concurrent}, delay: ${this.requestDelay}ms`);
    } else if (failureRate === 0 && this.recentRequests.length >= 50) {
      // All success, speed up cautiously
      this.concurrent = Math.min(10, this.concurrent + 1);
      this.requestDelay = Math.max(100, this.requestDelay * 0.9);
      
      console.log(`Rate limiting: Speeding up - concurrent: ${this.concurrent}, delay: ${this.requestDelay}ms`);
    }
  }

  /**
   * Handle rate limit (429) responses
   */
  private handleRateLimit(): void {
    // Aggressive backoff on rate limit
    this.concurrent = Math.max(1, Math.floor(this.concurrent * 0.5));
    this.requestDelay = Math.min(this.maxDelay, this.requestDelay * 3);
    
    console.log(`Rate limit detected: Backing off aggressively - concurrent: ${this.concurrent}, delay: ${this.requestDelay}ms`);
  }

  /**
   * Calculate delay for retry attempts
   */
  private calculateDelay(attempt: number): number {
    const baseDelay = this.requestDelay;
    const exponentialDelay = baseDelay * Math.pow(this.backoffMultiplier, attempt - 1);
    const jitter = Math.random() * 0.1 * exponentialDelay; // Add 10% jitter
    
    return Math.min(this.maxDelay, exponentialDelay + jitter);
  }

  /**
   * Check if we're in night mode and adjust settings
   */
  private checkNightMode(): void {
    if (!this.nightMode?.enabled) {
      return;
    }

    const now = new Date();
    const currentHour = now.getHours();
    const { startHour, endHour, concurrent, delay } = this.nightMode;

    const isNightTime = currentHour >= startHour || currentHour < endHour;

    if (isNightTime) {
      // Use night mode settings
      this.concurrent = concurrent;
      this.requestDelay = delay;
    }
  }

  /**
   * Get current rate limiting statistics
   */
  getStats(): {
    concurrent: number;
    requestDelay: number;
    activeRequests: number;
    queueLength: number;
    recentSuccessRate: number;
    recentErrorRate: number;
    averageResponseTime: number;
  } {
    const recent = this.recentRequests.slice(-20);
    const successCount = recent.filter(r => r.success).length;
    const errorCount = recent.filter(r => !r.success).length;
    const avgResponseTime = recent.length > 0 
      ? recent.reduce((sum, r) => sum + r.duration, 0) / recent.length 
      : 0;

    return {
      concurrent: this.concurrent,
      requestDelay: this.requestDelay,
      activeRequests: this.activeRequests,
      queueLength: this.requestQueue.length,
      recentSuccessRate: recent.length > 0 ? successCount / recent.length : 1,
      recentErrorRate: recent.length > 0 ? errorCount / recent.length : 0,
      averageResponseTime: avgResponseTime,
    };
  }

  /**
   * Reset rate limiter to initial state
   */
  reset(): void {
    this.recentRequests = [];
    this.activeRequests = 0;
    this.requestQueue = [];
    this.isProcessingQueue = false;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
