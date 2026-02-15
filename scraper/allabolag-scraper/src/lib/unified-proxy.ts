/**
 * Unified Proxy Integration
 * 
 * Supports both Oxylabs and ProxyScrape proxies
 * Automatically uses the enabled provider
 */

import { initOxylabsIntegration, fetchWithOxylabsProxy, getProxyStatus as getOxylabsStatus } from './oxylabs-integration';
import { loadOxylabsConfig } from './oxylabs-config';

// Optional ProxyScrape imports (will only be used if ProxyScrape is enabled)
let initProxyScrapeIntegration: any = null;
let fetchWithProxyScrapeProxy: any = null;
let getProxyScrapeStatsForMonitoring: any = null;
let loadProxyScrapeConfig: any = null;

try {
  const proxyscrapeIntegration = require('./proxyscrape-integration');
  const proxyscrapeConfig = require('./proxyscrape-config');
  initProxyScrapeIntegration = proxyscrapeIntegration.initProxyScrapeIntegration;
  fetchWithProxyScrapeProxy = proxyscrapeIntegration.fetchWithProxyScrapeProxy;
  getProxyScrapeStatsForMonitoring = proxyscrapeIntegration.getProxyScrapeStatsForMonitoring;
  loadProxyScrapeConfig = proxyscrapeConfig.loadProxyScrapeConfig;
} catch (error) {
  // ProxyScrape files not available - that's fine, we'll use Oxylabs
  console.log('ℹ️  ProxyScrape integration not available, will use Oxylabs if enabled');
}

type ProxyProvider = 'oxylabs' | 'proxyscrape' | 'vpn' | 'none';

let activeProvider: ProxyProvider = 'none';

/**
 * Check if VPN is enabled (via environment variable)
 */
function isVPNEnabled(): boolean {
  return process.env.VPN_ENABLED === 'true';
}

/**
 * Initialize proxy based on environment variables
 * Priority: VPN > ProxyScrape > Oxylabs
 */
export async function initUnifiedProxy(): Promise<void> {
  // Check VPN first (uses direct connections, assumes VPN is connected manually)
  if (isVPNEnabled()) {
    console.log('🔧 VPN mode enabled - using direct connections');
    console.log('   Make sure NordVPN (or your VPN) is connected manually');
    activeProvider = 'vpn';
    console.log('✅ Using VPN mode (direct connections)');
    return;
  }

  // Check ProxyScrape first (if available)
  if (loadProxyScrapeConfig) {
    try {
      const proxyscrapeConfig = loadProxyScrapeConfig();
      if (proxyscrapeConfig && proxyscrapeConfig.enabled && initProxyScrapeIntegration) {
        console.log('🔧 Initializing ProxyScrape proxy...');
        await initProxyScrapeIntegration();
        activeProvider = 'proxyscrape';
        console.log('✅ Using ProxyScrape as proxy provider');
        return;
      }
    } catch (error) {
      // ProxyScrape not available, continue to Oxylabs
    }
  }

  // Use Oxylabs (primary proxy provider)
  const oxylabsConfig = loadOxylabsConfig();
  if (oxylabsConfig && oxylabsConfig.enabled) {
    console.log('🔧 Initializing Oxylabs proxy...');
    await initOxylabsIntegration();
    activeProvider = 'oxylabs';
    console.log('✅ Using Oxylabs as proxy provider');
    return;
  }

  // No proxy enabled
  activeProvider = 'none';
  console.warn('⚠️  No proxy provider enabled. Set VPN_ENABLED=true, PROXYSCRAPE_ENABLED=true, or OXYLABS_ENABLED=true');
}

/**
 * Get active proxy provider
 */
export function getActiveProvider(): ProxyProvider {
  return activeProvider;
}

/**
 * Make request through active proxy provider or direct (VPN mode)
 */
export async function fetchWithProxy(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // Check VPN first (uses direct connections)
  if (isVPNEnabled()) {
    if (activeProvider !== 'vpn') {
      console.log('🔄 Switching to VPN mode (direct connections)...');
      activeProvider = 'vpn';
    }
    // Use native fetch() - VPN handles routing
    return await fetch(url, options);
  }

  // Check if provider changed (e.g., via environment variable reload)
  let proxyscrapeConfig = null;
  if (loadProxyScrapeConfig) {
    try {
      proxyscrapeConfig = loadProxyScrapeConfig();
    } catch (error) {
      // ProxyScrape not available
    }
  }
  
  const oxylabsConfig = loadOxylabsConfig();

  if (proxyscrapeConfig && proxyscrapeConfig.enabled && fetchWithProxyScrapeProxy) {
    if (activeProvider !== 'proxyscrape') {
      console.log('🔄 Switching to ProxyScrape proxy...');
      if (initProxyScrapeIntegration) {
        await initProxyScrapeIntegration();
      }
      activeProvider = 'proxyscrape';
    }
    return await fetchWithProxyScrapeProxy(url, options);
  }

  if (oxylabsConfig && oxylabsConfig.enabled) {
    if (activeProvider !== 'oxylabs') {
      console.log('🔄 Switching to Oxylabs proxy...');
      await initOxylabsIntegration();
      activeProvider = 'oxylabs';
    }
    return await fetchWithOxylabsProxy(url, options);
  }

  throw new Error('No proxy provider enabled. Set VPN_ENABLED=true, PROXYSCRAPE_ENABLED=true, or OXYLABS_ENABLED=true');
}

/**
 * Get proxy status
 */
export function getProxyStatus() {
  if (activeProvider === 'proxyscrape' && getProxyScrapeStatsForMonitoring) {
    try {
      const stats = getProxyScrapeStatsForMonitoring();
      return {
        provider: 'proxyscrape',
        enabled: true,
        status: 'active',
        stats: stats ? {
          totalRequests: stats.totalRequests,
          successfulRequests: stats.successfulRequests,
          failedRequests: stats.failedRequests,
          successRate: stats.totalRequests > 0 
            ? ((stats.successfulRequests / stats.totalRequests) * 100).toFixed(2) + '%'
            : '0%',
          estimatedDataUsage: `${stats.dataUsage.toFixed(2)} MB`,
          lastRequestTime: stats.lastRequestTime
        } : null
      };
    } catch (error) {
      // ProxyScrape stats not available
    }
  }

  if (activeProvider === 'oxylabs') {
    return {
      ...getOxylabsStatus(),
      provider: 'oxylabs'
    };
  }

  if (activeProvider === 'vpn') {
    return {
      provider: 'vpn',
      enabled: true,
      status: 'active',
      stats: {
        note: 'VPN mode uses direct connections - make sure VPN is connected'
      }
    };
  }

  return {
    provider: 'none',
    enabled: false,
    status: 'disabled'
  };
}

