/**
 * Oxylabs Integration with Scraper
 * 
 * Integrates Oxylabs proxy into the scraping request flow
 */

import { initializeOxylabs, getOxylabsProxy, fetchWithOxylabs, getOxylabsStats } from './oxylabs-proxy';
import { loadOxylabsConfig } from './oxylabs-config';

/**
 * Initialize Oxylabs proxy at startup
 * 
 * IMPORTANT: If OXYLABS_ENABLED=true, proxy is REQUIRED
 * Will throw error if proxy cannot be initialized
 */
export async function initOxylabsIntegration(): Promise<void> {
  const config = loadOxylabsConfig();
  
  if (!config) {
    // Proxy not enabled - that's fine
    console.log('ℹ️  Oxylabs proxy not enabled (OXYLABS_ENABLED=false)');
    return;
  }

  // Proxy is enabled - must initialize successfully
  try {
    const proxy = initializeOxylabs(config);
    console.log(`✅ Oxylabs ${config.proxyType} proxy initialized`);
    console.log(`   Country: ${config.country || 'any'}`);
    console.log(`   Session: ${config.sessionType}`);
    console.log(`   Proxy URL: ${proxy.getProxyUrl()}`);
  } catch (error) {
    console.error('❌ Failed to initialize Oxylabs proxy:', error);
    throw new Error(`Oxylabs proxy is required but failed to initialize: ${error instanceof Error ? error.message : 'Unknown error'}. Please check your OXYLABS_USERNAME and OXYLABS_PASSWORD.`);
  }
}

/**
 * Wrap fetch request with Oxylabs proxy
 * 
 * IMPORTANT: No fallback to regular fetch - proxy is required
 * If proxy fails, throws error to stop scraping job
 * Job can be resumed once proxy is working again
 */
export async function fetchWithOxylabsProxy(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  let proxy = getOxylabsProxy();
  
  // Auto-initialize if not already initialized
  if (!proxy) {
    const config = loadOxylabsConfig();
    if (config && config.enabled) {
      console.log('🔄 Auto-initializing Oxylabs proxy...');
      try {
        proxy = initializeOxylabs(config);
        console.log(`✅ Oxylabs ${config.proxyType} proxy auto-initialized`);
        console.log(`   Country: ${config.country || 'any'}`);
        console.log(`   Session: ${config.sessionType}`);
      } catch (error) {
        console.error('❌ Failed to auto-initialize Oxylabs proxy:', error);
        throw new Error(`Oxylabs proxy is required but failed to initialize: ${error instanceof Error ? error.message : 'Unknown error'}. Please check your OXYLABS_USERNAME and OXYLABS_PASSWORD. Scraping stopped.`);
      }
    } else {
      throw new Error('Oxylabs proxy not initialized. Please enable OXYLABS_ENABLED=true and provide credentials. Scraping stopped.');
    }
  }

  // Use Oxylabs proxy - retry on transient errors, fail on auth errors
  try {
    return await fetchWithOxylabs(url, options);
  } catch (error: any) {
    console.error('❌ Oxylabs proxy request failed:', error);
    
    // On 407 (Proxy Auth Required) - stop immediately, credentials are wrong
    if (error.message?.includes('407') || error.status === 407) {
      throw new Error('Oxylabs proxy authentication failed (407). Please check your OXYLABS_USERNAME and OXYLABS_PASSWORD. Scraping stopped. Fix credentials and resume job.');
    }
    
    // On 429 (Rate Limit) - proxy rotation will handle this, but if all proxies are rate-limited, stop
    if (error.message?.includes('429') || error.message?.includes('Too Many Requests') || error.status === 429) {
      // If error mentions "both ports" or "all proxies", all proxies are rate-limited
      if (error.message?.includes('both ports') || error.message?.includes('all proxies') || error.message?.includes('all ports')) {
        throw new Error('Oxylabs proxy rate limit (429) - all proxies are rate-limited. Please wait and resume job later.');
      }
      // Otherwise, proxy rotation should have handled it - this shouldn't happen
      throw new Error(`Oxylabs proxy rate limit (429). Proxy rotation should have handled this. If this persists, wait and resume job.`);
    }
    
    // On 500 (Internal Server Error) - retry once, could be transient
    if (error.message?.includes('500') || error.status === 500) {
      console.log('🔄 Retrying with Oxylabs proxy after 500 error...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      try {
        return await fetchWithOxylabs(url, options);
      } catch (retryError: any) {
        // If retry also fails with 500, might be rate limit - allow it to pass through
        if (retryError.message?.includes('429') || retryError.message?.includes('both ports')) {
          throw retryError; // Let 429 error handling above catch it
        }
        throw new Error(`Oxylabs proxy failed after retry: ${retryError.message}. Scraping stopped. Check proxy status and resume job once proxy is working.`);
      }
    }
    
    // On 502 (Bad Gateway) or 525 (No Exit Found) - retry once, then fail
    if (error.message?.includes('502') || error.message?.includes('525') || error.status === 502 || error.status === 525) {
      console.log('🔄 Retrying with Oxylabs proxy after transient error...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      try {
        return await fetchWithOxylabs(url, options);
      } catch (retryError: any) {
        throw new Error(`Oxylabs proxy failed after retry: ${retryError.message}. Scraping stopped. Check proxy status and resume job once proxy is working.`);
      }
    }
    
    // For other errors, fail immediately
    throw new Error(`Oxylabs proxy error: ${error.message}. Scraping stopped. Fix proxy issue and resume job.`);
  }
}

/**
 * Get Oxylabs statistics for monitoring
 */
export function getOxylabsStatsForMonitoring() {
  return getOxylabsStats();
}

/**
 * Get proxy status
 */
export function getProxyStatus() {
  const proxy = getOxylabsProxy();
  if (!proxy) {
    return { enabled: false, status: 'disabled' };
  }

  const stats = proxy.getStats();
  return {
    enabled: true,
    status: 'active',
    stats: {
      totalRequests: stats.totalRequests,
      successfulRequests: stats.successfulRequests,
      failedRequests: stats.failedRequests,
      successRate: stats.totalRequests > 0 
        ? ((stats.successfulRequests / stats.totalRequests) * 100).toFixed(2) + '%'
        : '0%',
      estimatedDataUsage: `${stats.dataUsage.toFixed(2)} MB`,
      estimatedCost: `$${proxy.estimateCost().toFixed(2)}`,
      lastRequestTime: stats.lastRequestTime
    }
  };
}

