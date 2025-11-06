/**
 * ProxyScrape Configuration
 * 
 * Load and validate ProxyScrape proxy configuration from environment variables
 */

import type { ProxyScrapeConfig } from './proxyscrape-proxy';

/**
 * Load ProxyScrape configuration from environment variables
 */
export function loadProxyScrapeConfig(): ProxyScrapeConfig | null {
  const enabled = process.env.PROXYSCRAPE_ENABLED === 'true';
  
  if (!enabled) {
    return null;
  }

  const username = process.env.PROXYSCRAPE_USERNAME;
  const password = process.env.PROXYSCRAPE_PASSWORD;

  if (!username || !password) {
    console.warn('⚠️  ProxyScrape enabled but credentials missing. Set PROXYSCRAPE_USERNAME and PROXYSCRAPE_PASSWORD');
    return null;
  }

  // ProxyScrape endpoint (defaults to proxy.scraperapi.com, but can be customized)
  const endpoint = process.env.PROXYSCRAPE_ENDPOINT || 'proxy.scraperapi.com';
  
  // Port (defaults to 8000, but ProxyScrape may use different ports)
  const port = parseInt(process.env.PROXYSCRAPE_PORT || '8000', 10);
  
  // Proxy type: HTTP or Socks5
  const proxyType = (process.env.PROXYSCRAPE_TYPE as 'http' | 'socks5') || 'http';
  
  // Optional: Provide list of proxy IPs directly (comma-separated)
  let proxyList: string[] | undefined;
  if (process.env.PROXYSCRAPE_PROXY_LIST) {
    proxyList = process.env.PROXYSCRAPE_PROXY_LIST.split(',').map(p => p.trim()).filter(p => p.length > 0);
  }

  const config: ProxyScrapeConfig = {
    enabled: true,
    username,
    password,
    proxyType,
    endpoint,
    port,
    proxyList
  };

  return config;
}

/**
 * Default ProxyScrape configuration
 */
export const defaultProxyScrapeConfig: ProxyScrapeConfig = {
  enabled: false,
  username: '',
  password: '',
  proxyType: 'http',
  endpoint: 'proxy.scraperapi.com',
  port: 8000
};

