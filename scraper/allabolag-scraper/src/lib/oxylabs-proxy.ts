/**
 * Oxylabs Proxy Integration
 * 
 * Handles proxy requests through Oxylabs residential/ISP proxies
 * Supports automatic IP rotation and country targeting
 */

import { HttpsProxyAgent } from 'https-proxy-agent';

export interface OxylabsConfig {
  enabled: boolean;
  username: string;
  password: string;
  proxyType: 'residential' | 'isp' | 'datacenter';
  country?: string; // ISO country code (e.g., 'se' for Sweden, 'us' for US)
  sessionType?: 'rotate' | 'sticky'; // IP rotation strategy
  port?: number | number[]; // Single port or array of ports for rotation
  // Country targeting can be in username format: username-country-XX
  countryInUsername?: boolean; // If true, country is added to username
}

export interface OxylabsStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  dataUsage: number; // estimated in MB
  lastRequestTime: Date | null;
}

export class OxylabsProxy {
  private config: OxylabsConfig;
  private stats: OxylabsStats;
  private proxyAgents: Map<number, HttpsProxyAgent> = new Map();
  private currentPortIndex: number = 0;
  private ports: number[] = [];
  private host: string;

  constructor(config: OxylabsConfig) {
    this.config = {
      port: 7777,
      sessionType: 'rotate',
      countryInUsername: false,
      ...config
    };

    // Build proxy host based on proxy type
    if (this.config.proxyType === 'datacenter') {
      this.host = 'dc.oxylabs.io';
    } else if (this.config.proxyType === 'residential') {
      this.host = 'pr.oxylabs.io';
    } else {
      // ISP proxy
      this.host = 'isp.oxylabs.io';
    }

    // Determine ports - support array of ports for rotation
    if (Array.isArray(this.config.port)) {
      this.ports = this.config.port;
    } else if (this.config.port) {
      this.ports = [this.config.port];
    } else {
      // Default ports based on proxy type
      if (this.config.proxyType === 'datacenter') {
        this.ports = [8000];
      } else {
        this.ports = [7777];
      }
    }

    // Build username with country targeting if needed
    let username = this.config.username;
    if (this.config.country && this.config.countryInUsername) {
      // Add country to username: username-country-XX
      username = `${username}-country-${this.config.country.toUpperCase()}`;
      console.log(`Using country targeting in username: ${username}`);
    }
    
    // URL encode username and password to handle special characters (like +)
    const encodedUsername = encodeURIComponent(username);
    const encodedPassword = encodeURIComponent(this.config.password);
    
    // Create proxy agents for all ports
    for (const port of this.ports) {
      const proxyUrl = `http://${encodedUsername}:${encodedPassword}@${this.host}:${port}`;
      this.proxyAgents.set(port, new HttpsProxyAgent(proxyUrl));
    }
    
    console.log(`✅ Oxylabs proxy initialized with ${this.ports.length} port(s): ${this.ports.join(', ')}`);
    console.log(`   Host: ${this.host}`);
    console.log(`   Rotation: ${this.ports.length > 1 ? 'Enabled' : 'Single port'}`);
    console.log(`   Username: ${encodedUsername}`);
    console.log(`   Password length: ${this.config.password.length}`);

    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      dataUsage: 0,
      lastRequestTime: null
    };
  }

  /**
   * Get current proxy agent (rotates between available ports)
   */
  private getCurrentProxyAgent(): HttpsProxyAgent {
    const port = this.ports[this.currentPortIndex];
    const agent = this.proxyAgents.get(port);
    if (!agent) {
      throw new Error(`Proxy agent not found for port ${port}`);
    }
    return agent;
  }

  /**
   * Rotate to next proxy port
   */
  private rotateProxy(): void {
    if (this.ports.length > 1) {
      this.currentPortIndex = (this.currentPortIndex + 1) % this.ports.length;
      console.log(`🔄 Rotated to proxy port ${this.ports[this.currentPortIndex]}`);
    }
  }

  /**
   * Get current port
   */
  getCurrentPort(): number {
    return this.ports[this.currentPortIndex];
  }

  /**
   * Make a request through Oxylabs proxy
   */
  async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    // CRITICAL: If proxy is enabled, it MUST be used - NO fallback
    if (!this.config.enabled) {
      throw new Error('Oxylabs proxy is disabled but required. Set OXYLABS_ENABLED=true and provide credentials. Scraping stopped.');
    }

    this.stats.totalRequests++;
    this.stats.lastRequestTime = new Date();

    try {
      // Build headers with Oxylabs-specific options
      const headers = new Headers(options.headers || {});
      
      // Add country targeting via header if NOT in username
      if (this.config.country && !this.config.countryInUsername) {
        headers.set('X-Oxylabs-Country', this.config.country);
      }

      // Add session control if sticky sessions
      if (this.config.sessionType === 'sticky') {
        // Sticky sessions use session_id in URL or headers
        // For now, we'll use rotate (default) which gives new IP per request
      }

      // Make request through proxy
      // Node.js native fetch() doesn't support 'agent' property
      // Use node-fetch v2 which properly supports HttpsProxyAgent
      const fetch = (await import('node-fetch')).default;
      
      // Convert headers to plain object for node-fetch (define outside try for catch block access)
      const headersObj: Record<string, string> = {};
      headers.forEach((value, key) => {
        headersObj[key] = value;
      });
      
      // Convert method to uppercase for node-fetch (if provided) (define outside try for catch block access)
      const method = options.method ? options.method.toUpperCase() : 'GET';
      
      // Get current proxy agent (supports rotation)
      const currentAgent = this.getCurrentProxyAgent();
      
      const response = await fetch(url, {
        ...options,
        method: method,
        agent: currentAgent,
        headers: headersObj
      });
      
      // node-fetch v2 Response is compatible with fetch Response API
      // However, we need to ensure getSetCookie works correctly
      // Add getSetCookie method if it doesn't exist (node-fetch v2 compatibility)
      if (!response.headers.getSetCookie && response.headers.raw) {
        (response.headers as any).getSetCookie = () => {
          const setCookieHeader = response.headers.raw()['set-cookie'] || [];
          return setCookieHeader.map((cookie: string) => {
            // node-fetch returns cookies as strings, need to format properly
            return cookie.split(';')[0].trim();
          });
        };
      }

      // Track success
      if (response.ok) {
        this.stats.successfulRequests++;
        
        // Estimate data usage (rough estimate)
        const contentLength = response.headers.get('content-length');
        if (contentLength) {
          this.stats.dataUsage += parseInt(contentLength, 10) / 1024 / 1024; // MB
        } else {
          // Rough estimate: 50KB per request
          this.stats.dataUsage += 0.05;
        }
        
        // Rotate to next proxy on success (for load balancing)
        if (this.ports.length > 1) {
          this.rotateProxy();
        }
        
        return response;
      } else {
        this.stats.failedRequests++;
        
        // If we get 407 (auth), 403 (forbidden), or 429 (rate limit), retry with next proxy
        if ((response.status === 407 || response.status === 403 || response.status === 429) && this.ports.length > 1) {
          const originalPort = this.getCurrentPort();
          const errorType = response.status === 407 ? 'auth' : response.status === 403 ? 'forbidden' : 'rate limit';
          console.warn(`⚠️  Got ${response.status} (${errorType}) from proxy port ${originalPort} - retrying with next proxy`);
          this.rotateProxy();
          
          // Retry the request with the next proxy (max 1 retry per request)
          // This prevents infinite loops while allowing automatic rotation
          const retryAgent = this.getCurrentProxyAgent();
          const retryResponse = await fetch(url, {
            ...options,
            method: method,
            agent: retryAgent,
            headers: headersObj
          });
          
          if (retryResponse.ok) {
            this.stats.successfulRequests++;
            this.stats.failedRequests--; // Don't count original as failed if retry succeeds
            console.log(`✅ Retry successful with proxy port ${this.getCurrentPort()}`);
            
            // Estimate data usage
            const contentLength = retryResponse.headers.get('content-length');
            if (contentLength) {
              this.stats.dataUsage += parseInt(contentLength, 10) / 1024 / 1024; // MB
            } else {
              this.stats.dataUsage += 0.05;
            }
            
            return retryResponse;
          } else {
            // Retry also failed - throw error
            throw new Error(`Proxy request failed on both ports ${originalPort} and ${this.getCurrentPort()}: ${retryResponse.status} ${retryResponse.statusText}`);
          }
        }
        
        // If no retry or retry failed, return the original error response
        throw new Error(`Proxy request failed: ${response.status} ${response.statusText}`);
      }
    } catch (error: any) {
      this.stats.failedRequests++;
      
      // If error is auth-related (407), rate limit (429), or forbidden (403), retry with next proxy
      if ((error.message?.includes('407') || error.message?.includes('Unauthorized') || 
           error.message?.includes('429') || error.message?.includes('Too Many Requests') ||
           error.message?.includes('403') || error.message?.includes('Forbidden')) && this.ports.length > 1) {
        const originalPort = this.getCurrentPort();
        console.warn(`⚠️  Auth error on proxy port ${originalPort} - retrying with next proxy`);
        this.rotateProxy();
        
        try {
          // Retry the request with the next proxy
          const retryAgent = this.getCurrentProxyAgent();
          const retryResponse = await fetch(url, {
            ...options,
            method: method,
            agent: retryAgent,
            headers: headersObj
          });
          
          if (retryResponse.ok) {
            this.stats.successfulRequests++;
            this.stats.failedRequests--; // Don't count original as failed if retry succeeds
            console.log(`✅ Retry successful with proxy port ${this.getCurrentPort()}`);
            
            // Estimate data usage
            const contentLength = retryResponse.headers.get('content-length');
            if (contentLength) {
              this.stats.dataUsage += parseInt(contentLength, 10) / 1024 / 1024; // MB
            } else {
              this.stats.dataUsage += 0.05;
            }
            
            return retryResponse;
          } else {
            throw new Error(`Proxy retry failed on port ${this.getCurrentPort()}: ${retryResponse.status} ${retryResponse.statusText}`);
          }
        } catch (retryError: any) {
          console.error(`❌ Retry also failed on proxy port ${this.getCurrentPort()}:`, retryError);
          throw new Error(`Proxy request failed on both ports ${originalPort} and ${this.getCurrentPort()}: ${error.message}`);
        }
      }
      
      console.error('Oxylabs proxy request failed:', error);
      throw error;
    }
  }

  /**
   * Get proxy statistics
   */
  getStats(): OxylabsStats {
    return { ...this.stats };
  }

  /**
   * Get proxy URL (for debugging)
   */
  getProxyUrl(): string {
    // Return URL without password for security
    let username = this.config.username;
    if (this.config.country && this.config.countryInUsername) {
      username = `${username}-country-${this.config.country.toUpperCase()}`;
    }
    
    const currentPort = this.getCurrentPort();
    return `http://${username}:***@${this.host}:${currentPort}`;
  }

  /**
   * Get all proxy ports
   */
  getPorts(): number[] {
    return [...this.ports];
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      dataUsage: 0,
      lastRequestTime: null
    };
  }

  /**
   * Estimate cost (rough calculation)
   * Residential: ~$2-5 per GB
   * ISP: ~$1-3 per GB
   */
  estimateCost(): number {
    const gbUsed = this.stats.dataUsage / 1024;
    const costPerGB = this.config.proxyType === 'residential' ? 3.5 : 2.0;
    return gbUsed * costPerGB;
  }
}

/**
 * Global Oxylabs proxy instance
 */
let oxylabsProxyInstance: OxylabsProxy | null = null;

/**
 * Initialize Oxylabs proxy
 */
export function initializeOxylabs(config: OxylabsConfig): OxylabsProxy {
  oxylabsProxyInstance = new OxylabsProxy(config);
  console.log(`✅ Oxylabs ${config.proxyType} proxy initialized`);
  console.log(`   Country: ${config.country || 'any'}`);
  console.log(`   Session: ${config.sessionType || 'rotate'}`);
  return oxylabsProxyInstance;
}

/**
 * Get Oxylabs proxy instance
 */
export function getOxylabsProxy(): OxylabsProxy | null {
  return oxylabsProxyInstance;
}

/**
 * Make request through Oxylabs proxy
 */
export async function fetchWithOxylabs(url: string, options: RequestInit = {}): Promise<Response> {
  if (oxylabsProxyInstance) {
    return await oxylabsProxyInstance.fetch(url, options);
  }
  
  // CRITICAL: NO fallback - proxy is REQUIRED
  // If proxy is not initialized but OXYLABS_ENABLED=true, this is an error
  const config = await import('./oxylabs-config').then(m => m.loadOxylabsConfig());
  if (config && config.enabled) {
    throw new Error('Oxylabs proxy is required but not initialized. Please check your OXYLABS_USERNAME and OXYLABS_PASSWORD. Scraping stopped.');
  }
  
  // Only allow fallback if proxy is explicitly disabled
  throw new Error('Oxylabs proxy is required. Set OXYLABS_ENABLED=true and provide credentials. Scraping stopped.');
}

/**
 * Get Oxylabs statistics
 */
export function getOxylabsStats(): OxylabsStats | null {
  return oxylabsProxyInstance?.getStats() || null;
}

