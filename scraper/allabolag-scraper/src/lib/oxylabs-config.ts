/**
 * Oxylabs Configuration
 * 
 * Load and validate Oxylabs proxy configuration from environment variables
 */

import type { OxylabsConfig } from './oxylabs-proxy';

/**
 * Load Oxylabs configuration from environment variables
 */
export function loadOxylabsConfig(): OxylabsConfig | null {
  const enabled = process.env.OXYLABS_ENABLED === 'true';
  
  if (!enabled) {
    return null;
  }

  const username = process.env.OXYLABS_USERNAME;
  const password = process.env.OXYLABS_PASSWORD;

  if (!username || !password) {
    console.warn('⚠️  Oxylabs enabled but credentials missing. Set OXYLABS_USERNAME and OXYLABS_PASSWORD');
    return null;
  }

  // Parse ports - support comma-separated list or single port
  let ports: number | number[] = parseInt(process.env.OXYLABS_PORT || '8000', 10);
  if (process.env.OXYLABS_PORTS) {
    // Multiple ports specified (comma-separated)
    ports = process.env.OXYLABS_PORTS.split(',').map(p => parseInt(p.trim(), 10)).filter(p => !isNaN(p));
  }

  const config: OxylabsConfig = {
    enabled: true,
    username,
    password,
    proxyType: (process.env.OXYLABS_PROXY_TYPE as 'residential' | 'isp' | 'datacenter') || 'datacenter',
    country: process.env.OXYLABS_COUNTRY || 'us', // Default: 'us' for United States, can be 'se' for Sweden, etc.
    sessionType: (process.env.OXYLABS_SESSION_TYPE as 'rotate' | 'sticky') || 'rotate',
    port: ports, // Single port or array of ports for rotation
    countryInUsername: process.env.OXYLABS_COUNTRY_IN_USERNAME === 'true' // If true, country in username format
  };

  return config;
}

/**
 * Default Oxylabs configuration
 */
export const defaultOxylabsConfig: OxylabsConfig = {
  enabled: false,
  username: '',
  password: '',
  proxyType: 'datacenter',
  country: 'us', // United States (default)
  sessionType: 'rotate',
  port: 8000,
  countryInUsername: true // Country targeting in username format
};

