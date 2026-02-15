/**
 * VPN Configuration
 * 
 * Configure VPN settings for large-scale scraping
 */

import type { VPNConfig } from './vpn';

/**
 * Default VPN configuration
 */
export const defaultVPNConfig: VPNConfig = {
  enabled: false, // Set to true to enable VPN
  provider: 'manual', // 'manual', 'nordvpn', 'expressvpn', 'protonvpn', 'custom'
  rotationStrategy: 'request_count', // 'request_count', 'time_based', 'error_based', 'manual'
  rotationThreshold: 1000,
  maxRequestsPerIP: 1000, // Rotate after 1000 requests
  maxTimePerIP: 60, // Rotate after 60 minutes
  customProxyUrl: undefined, // Set if using custom proxy
  vpnApiKey: undefined // API key for VPN service
};

/**
 * Load VPN configuration from environment variables
 */
export function loadVPNConfig(): VPNConfig {
  const config: VPNConfig = {
    enabled: process.env.VPN_ENABLED === 'true',
    provider: (process.env.VPN_PROVIDER as any) || 'manual',
    rotationStrategy: (process.env.VPN_ROTATION_STRATEGY as any) || 'request_count',
    rotationThreshold: parseInt(process.env.VPN_ROTATION_THRESHOLD || '1000', 10),
    maxRequestsPerIP: parseInt(process.env.VPN_MAX_REQUESTS_PER_IP || '1000', 10),
    maxTimePerIP: parseInt(process.env.VPN_MAX_TIME_PER_IP || '60', 10),
    customProxyUrl: process.env.VPN_CUSTOM_PROXY_URL,
    vpnApiKey: process.env.VPN_API_KEY
  };

  return config;
}

/**
 * Example configurations for different scenarios
 */
export const vpnConfigs = {
  /**
   * Manual VPN rotation - User manually changes VPN
   */
  manual: {
    ...defaultVPNConfig,
    enabled: true,
    provider: 'manual' as const,
    rotationStrategy: 'manual' as const
  },

  /**
   * Request-based rotation - Rotate after N requests
   */
  requestBased: {
    ...defaultVPNConfig,
    enabled: true,
    provider: 'manual' as const,
    rotationStrategy: 'request_count' as const,
    maxRequestsPerIP: 500 // Rotate every 500 requests
  },

  /**
   * Time-based rotation - Rotate after N minutes
   */
  timeBased: {
    ...defaultVPNConfig,
    enabled: true,
    provider: 'manual' as const,
    rotationStrategy: 'time_based' as const,
    maxTimePerIP: 30 // Rotate every 30 minutes
  },

  /**
   * Error-based rotation - Rotate on errors
   */
  errorBased: {
    ...defaultVPNConfig,
    enabled: true,
    provider: 'manual' as const,
    rotationStrategy: 'error_based' as const
  },

  /**
   * Custom proxy configuration
   */
  customProxy: {
    ...defaultVPNConfig,
    enabled: true,
    provider: 'custom' as const,
    customProxyUrl: process.env.VPN_CUSTOM_PROXY_URL || 'http://proxy:port'
  }
};

