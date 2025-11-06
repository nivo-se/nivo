import { RateLimitConfig } from '../providers/base';

export const scraperConfig = {
  allabolag: {
    rateLimiting: {
      stage1: {
        concurrent: 5,
        delay: 100,
        maxRetries: 5,
        backoffMultiplier: 2,
        maxDelay: 60000,
      } as RateLimitConfig,
      stage2: {
        concurrent: 5,
        delay: 100,
        maxRetries: 5,
        backoffMultiplier: 2,
        maxDelay: 60000,
      } as RateLimitConfig,
      stage3: {
        concurrent: 10,  // Financial data - more aggressive
        delay: 100,
        maxRetries: 5,
        backoffMultiplier: 2,
        maxDelay: 60000,
        nightMode: {
          enabled: true,
          startHour: 22,  // 10 PM
          endHour: 6,     // 6 AM
          concurrent: 10,
          delay: 200,
        }
      } as RateLimitConfig,
    },
    retry: {
      maxAttempts: 5,
      baseDelay: 2000,
      maxDelay: 60000,
    },
    api: {
      baseUrl: 'https://www.allabolag.se',
      endpoints: {
        segmentation: '/_next/data/{buildId}/segmentation.json',
        search: '/_next/data/{buildId}/search.json',
        company: '/_next/data/{buildId}/{companyId}.json',
      }
    }
  },
  
  // Future providers
  ratsit: {
    rateLimiting: {
      stage1: {
        concurrent: 3,
        delay: 500,
        maxRetries: 3,
        backoffMultiplier: 2,
        maxDelay: 30000,
      } as RateLimitConfig,
    }
  },
  
  mrkoll: {
    rateLimiting: {
      stage1: {
        concurrent: 3,
        delay: 500,
        maxRetries: 3,
        backoffMultiplier: 2,
        maxDelay: 30000,
      } as RateLimitConfig,
    }
  }
};

export type ScraperConfig = typeof scraperConfig;
