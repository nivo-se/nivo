/**
 * VPN and IP Rotation Module
 * 
 * Handles VPN connection management and IP rotation for large-scale scraping
 * Supports multiple VPN services and manual IP rotation
 */

export interface VPNConfig {
  enabled: boolean;
  provider?: 'manual' | 'nordvpn' | 'expressvpn' | 'protonvpn' | 'custom';
  rotationStrategy?: 'request_count' | 'time_based' | 'error_based' | 'manual';
  rotationThreshold?: number; // requests or minutes
  maxRequestsPerIP?: number;
  maxTimePerIP?: number; // minutes
  customProxyUrl?: string;
  vpnApiKey?: string;
}

export interface IPInfo {
  ip: string;
  country?: string;
  city?: string;
  provider?: string;
  lastChanged: Date;
  requestCount: number;
  errorCount: number;
}

export class VPNManager {
  private config: VPNConfig;
  private currentIP: IPInfo | null = null;
  private ipHistory: IPInfo[] = [];
  private requestCount = 0;
  private lastRotation: Date = new Date();

  constructor(config: VPNConfig) {
    this.config = {
      enabled: config.enabled || false,
      rotationStrategy: config.rotationStrategy || 'request_count',
      rotationThreshold: config.rotationThreshold || 1000,
      maxRequestsPerIP: config.maxRequestsPerIP || 1000,
      maxTimePerIP: config.maxTimePerIP || 60, // 60 minutes default
      ...config
    };
  }

  /**
   * Initialize VPN connection
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      console.log('🔓 VPN not enabled - using direct connection');
      return;
    }

    console.log(`🔐 Initializing VPN (${this.config.provider || 'manual'})...`);
    
    try {
      await this.rotateIP();
      console.log(`✅ VPN initialized with IP: ${this.currentIP?.ip}`);
    } catch (error) {
      console.error('❌ Failed to initialize VPN:', error);
      throw error;
    }
  }

  /**
   * Get current IP address
   */
  async getCurrentIP(): Promise<string> {
    if (!this.config.enabled) {
      return await this.detectIP();
    }

    if (!this.currentIP) {
      await this.rotateIP();
    }

    return this.currentIP!.ip;
  }

  /**
   * Check if IP rotation is needed
   */
  shouldRotate(): boolean {
    if (!this.config.enabled || !this.currentIP) {
      return false;
    }

    const now = new Date();
    const timeSinceRotation = (now.getTime() - this.lastRotation.getTime()) / 1000 / 60; // minutes

    switch (this.config.rotationStrategy) {
      case 'request_count':
        return this.currentIP.requestCount >= (this.config.maxRequestsPerIP || 1000);
      
      case 'time_based':
        return timeSinceRotation >= (this.config.maxTimePerIP || 60);
      
      case 'error_based':
        return this.currentIP.errorCount >= 10;
      
      case 'manual':
        return false;
      
      default:
        return this.currentIP.requestCount >= (this.config.maxRequestsPerIP || 1000);
    }
  }

  /**
   * Rotate to a new IP address
   */
  async rotateIP(reason?: string): Promise<void> {
    if (!this.config.enabled) {
      console.log('⚠️  VPN rotation requested but VPN is not enabled');
      return;
    }

    const oldIP = this.currentIP?.ip || 'unknown';
    console.log(`🔄 Rotating IP${reason ? ` (${reason})` : ''}...`);

    try {
      // Save old IP to history
      if (this.currentIP) {
        this.ipHistory.push({ ...this.currentIP });
      }

      // Get new IP based on provider
      let newIP: string;
      switch (this.config.provider) {
        case 'manual':
          newIP = await this.manualRotation();
          break;
        
        case 'nordvpn':
          newIP = await this.rotateNordVPN();
          break;
        
        case 'expressvpn':
          newIP = await this.rotateExpressVPN();
          break;
        
        case 'protonvpn':
          newIP = await this.rotateProtonVPN();
          break;
        
        case 'custom':
          newIP = await this.rotateCustomProxy();
          break;
        
        default:
          newIP = await this.detectIP();
      }

      // Verify IP change
      await this.verifyIPChange(oldIP, newIP);

      // Update current IP
      this.currentIP = {
        ip: newIP,
        lastChanged: new Date(),
        requestCount: 0,
        errorCount: 0
      };

      this.lastRotation = new Date();
      this.requestCount = 0;

      console.log(`✅ IP rotated: ${oldIP} → ${newIP}`);
      
      // Wait a bit after rotation to avoid immediate detection
      await this.sleep(2000);
    } catch (error) {
      console.error('❌ Failed to rotate IP:', error);
      throw error;
    }
  }

  /**
   * Record a request made with current IP
   */
  recordRequest(success: boolean = true): void {
    if (!this.config.enabled || !this.currentIP) {
      return;
    }

    this.requestCount++;
    this.currentIP.requestCount++;
    
    if (!success) {
      this.currentIP.errorCount++;
    }

    // Auto-rotate if threshold reached
    if (this.shouldRotate()) {
      this.rotateIP('threshold reached').catch(err => {
        console.error('Failed to auto-rotate IP:', err);
      });
    }
  }

  /**
   * Get IP rotation statistics
   */
  getStats() {
    return {
      currentIP: this.currentIP,
      totalRotations: this.ipHistory.length,
      totalRequests: this.requestCount,
      ipHistory: this.ipHistory.slice(-10) // Last 10 IPs
    };
  }

  /**
   * Manual IP rotation (wait for user to change VPN manually)
   */
  private async manualRotation(): Promise<string> {
    console.log('⏳ Waiting for manual VPN change...');
    console.log('Please change your VPN connection and press Enter when done.');
    
    // In a real implementation, you might want to poll for IP change
    // For now, we'll just wait and detect the new IP
    await this.sleep(5000);
    
    const newIP = await this.detectIP();
    return newIP;
  }

  /**
   * Rotate NordVPN (if API available)
   */
  private async rotateNordVPN(): Promise<string> {
    // NordVPN CLI or API integration
    // Example: nordvpn connect --country sweden
    console.log('🔄 Rotating NordVPN connection...');
    
    // This would require NordVPN CLI or API integration
    // For now, detect new IP after manual change
    await this.sleep(10000); // Wait for VPN to reconnect
    return await this.detectIP();
  }

  /**
   * Rotate ExpressVPN (if API available)
   */
  private async rotateExpressVPN(): Promise<string> {
    console.log('🔄 Rotating ExpressVPN connection...');
    // ExpressVPN API integration
    await this.sleep(10000);
    return await this.detectIP();
  }

  /**
   * Rotate ProtonVPN (if API available)
   */
  private async rotateProtonVPN(): Promise<string> {
    console.log('🔄 Rotating ProtonVPN connection...');
    // ProtonVPN API integration
    await this.sleep(10000);
    return await this.detectIP();
  }

  /**
   * Rotate custom proxy
   */
  private async rotateCustomProxy(): Promise<string> {
    if (!this.config.customProxyUrl) {
      throw new Error('Custom proxy URL not configured');
    }

    console.log(`🔄 Using custom proxy: ${this.config.customProxyUrl}`);
    // Use proxy for requests
    return await this.detectIP();
  }

  /**
   * Detect current IP address
   */
  private async detectIP(): Promise<string> {
    try {
      const response = await fetch('https://api.ipify.org?format=json', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      });
      const data = await response.json();
      return data.ip;
    } catch (error) {
      console.error('Failed to detect IP:', error);
      // Fallback to another service
      try {
        const response = await fetch('https://ifconfig.me/ip');
        return await response.text();
      } catch (e) {
        throw new Error('Failed to detect IP address from any service');
      }
    }
  }

  /**
   * Verify IP change was successful
   */
  private async verifyIPChange(oldIP: string, newIP: string): Promise<void> {
    if (oldIP === newIP && oldIP !== 'unknown') {
      console.warn(`⚠️  IP did not change: ${oldIP}`);
      // Wait longer and try again
      await this.sleep(5000);
      const verifyIP = await this.detectIP();
      if (verifyIP === oldIP) {
        throw new Error('IP rotation failed - IP did not change');
      }
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get proxy configuration for fetch requests
   */
  getProxyConfig(): { proxy?: string } | {} {
    if (!this.config.enabled || !this.config.customProxyUrl) {
      return {};
    }

    return {
      proxy: this.config.customProxyUrl
    };
  }
}

/**
 * Global VPN manager instance
 */
let vpnManagerInstance: VPNManager | null = null;

/**
 * Initialize VPN manager
 */
export function initializeVPN(config: VPNConfig): Promise<void> {
  vpnManagerInstance = new VPNManager(config);
  return vpnManagerInstance.initialize();
}

/**
 * Get VPN manager instance
 */
export function getVPNManager(): VPNManager | null {
  return vpnManagerInstance;
}

/**
 * Check if VPN rotation is needed
 */
export function shouldRotateVPN(): boolean {
  return vpnManagerInstance?.shouldRotate() || false;
}

/**
 * Rotate VPN IP
 */
export async function rotateVPNIP(reason?: string): Promise<void> {
  if (vpnManagerInstance) {
    return await vpnManagerInstance.rotateIP(reason);
  }
}

/**
 * Record VPN request
 */
export function recordVPNRequest(success: boolean = true): void {
  vpnManagerInstance?.recordRequest(success);
}

/**
 * Get VPN statistics
 */
export function getVPNStats() {
  return vpnManagerInstance?.getStats() || null;
}

