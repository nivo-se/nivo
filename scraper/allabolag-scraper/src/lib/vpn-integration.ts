/**
 * VPN Integration with Scraper
 * 
 * Integrates VPN manager into the scraping request flow
 */

import { getVPNManager, shouldRotateVPN, rotateVPNIP, recordVPNRequest } from './vpn';
import { loadVPNConfig } from './vpn-config';
import { initializeVPN } from './vpn';

/**
 * Initialize VPN at startup
 */
export async function initVPNIntegration(): Promise<void> {
  try {
    const config = loadVPNConfig();
    if (config.enabled) {
      await initializeVPN(config);
      const vpn = getVPNManager();
      if (vpn) {
        const ip = await vpn.getCurrentIP();
        console.log(`✅ VPN initialized with IP: ${ip}`);
      }
    }
  } catch (error) {
    console.error('Failed to initialize VPN:', error);
    // Don't throw - allow scraping to continue without VPN
    console.warn('⚠️  Continuing without VPN...');
  }
}

/**
 * Wrap fetch request with VPN tracking
 */
export async function fetchWithVPN(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const vpn = getVPNManager();
  
  // Check if rotation is needed before request
  if (vpn && shouldRotateVPN()) {
    console.log('🔄 VPN rotation needed before request');
    await rotateVPNIP('pre-request rotation');
  }

  try {
    // Make request
    const response = await fetch(url, options);
    
    // Record successful request
    recordVPNRequest(response.ok);
    
    // Check for rate limiting (429) or blocking (403)
    if (response.status === 429 || response.status === 403) {
      console.warn(`⚠️  Rate limit/block detected (${response.status})`);
      
      // Rotate IP on rate limit/block
      if (vpn) {
        console.log('🔄 Rotating IP due to rate limit/block');
        await rotateVPNIP(`status ${response.status}`);
        
        // Retry with new IP after rotation
        await new Promise(resolve => setTimeout(resolve, 2000));
        return await fetch(url, options);
      }
    }
    
    return response;
  } catch (error: any) {
    // Record failed request
    recordVPNRequest(false);
    
    // Rotate IP on network errors
    if (vpn && (error.message?.includes('429') || error.message?.includes('403'))) {
      console.log('🔄 Rotating IP due to error');
      await rotateVPNIP('error-based rotation');
      
      // Retry after rotation
      await new Promise(resolve => setTimeout(resolve, 2000));
      return await fetch(url, options);
    }
    
    throw error;
  }
}

/**
 * Get VPN statistics for monitoring
 */
export function getVPNStats() {
  const vpn = getVPNManager();
  return vpn?.getStats() || null;
}

/**
 * Manual VPN rotation trigger
 */
export async function triggerVPNRotation(reason?: string): Promise<void> {
  const vpn = getVPNManager();
  if (vpn) {
    await rotateVPNIP(reason || 'manual trigger');
  } else {
    console.warn('⚠️  VPN not enabled - cannot rotate');
  }
}

