# VPN Setup for Large-Scale Scraping

## Overview

This guide explains how to set up VPN/IP rotation for large-scale scraping (50-200M SEK turnover range, potentially thousands of companies).

## Why VPN?

For large-scale scraping:
- **IP Rotation**: Avoid rate limiting by changing IP addresses
- **Anonymity**: Protect your origin IP
- **Distribution**: Spread requests across multiple IPs
- **Resilience**: Continue scraping if one IP gets blocked

## Configuration

### Environment Variables

Add to `.env.local`:

```env
# Enable VPN
VPN_ENABLED="true"

# VPN Provider (manual, nordvpn, expressvpn, protonvpn, custom)
VPN_PROVIDER="manual"

# Rotation Strategy (request_count, time_based, error_based, manual)
VPN_ROTATION_STRATEGY="request_count"

# Rotation Threshold
VPN_ROTATION_THRESHOLD="1000"
VPN_MAX_REQUESTS_PER_IP="1000"
VPN_MAX_TIME_PER_IP="60"

# Custom Proxy (if using custom proxy)
VPN_CUSTOM_PROXY_URL="http://proxy:port"

# VPN API Key (if using VPN service API)
VPN_API_KEY=""
```

## VPN Providers

### 1. Manual VPN (Recommended for Testing)

**Setup:**
1. Install VPN client (NordVPN, ExpressVPN, ProtonVPN, etc.)
2. Set `VPN_PROVIDER="manual"`
3. Set `VPN_ROTATION_STRATEGY="manual"`
4. Manually change VPN server when needed

**Usage:**
- Start scraper
- When rotation is needed, the system will prompt you
- Change VPN server manually
- Press Enter to continue

**Pros:**
- Simple setup
- Works with any VPN service
- Full control

**Cons:**
- Requires manual intervention
- Not automated

### 2. NordVPN (CLI)

**Setup:**
1. Install NordVPN CLI: `brew install nordvpn` (macOS) or `apt install nordvpn` (Linux)
2. Login: `nordvpn login`
3. Set `VPN_PROVIDER="nordvpn"`

**Automation:**
- The scraper will automatically rotate NordVPN servers
- Connects to different countries/servers

**Pros:**
- Automated rotation
- Large server network
- Reliable

**Cons:**
- Requires NordVPN subscription
- CLI must be installed

### 3. Custom Proxy

**Setup:**
1. Set up rotating proxy service (e.g., Bright Data, Smartproxy)
2. Set `VPN_PROVIDER="custom"`
3. Set `VPN_CUSTOM_PROXY_URL="http://username:password@proxy:port"`

**Pros:**
- Fully automated
- High performance
- Professional solution

**Cons:**
- Costs money
- Requires proxy service setup

## Rotation Strategies

### Request-Based Rotation

Rotate IP after N requests:

```env
VPN_ROTATION_STRATEGY="request_count"
VPN_MAX_REQUESTS_PER_IP="500"
```

**Best for:**
- Consistent request patterns
- Predictable load

### Time-Based Rotation

Rotate IP after N minutes:

```env
VPN_ROTATION_STRATEGY="time_based"
VPN_MAX_TIME_PER_IP="30"
```

**Best for:**
- Long-running jobs
- Time-based distribution

### Error-Based Rotation

Rotate IP on errors (429, 403, etc.):

```env
VPN_ROTATION_STRATEGY="error_based"
```

**Best for:**
- Reactive handling
- When errors indicate IP blocking

### Manual Rotation

Rotate only when manually triggered:

```env
VPN_ROTATION_STRATEGY="manual"
```

**Best for:**
- Testing
- Full control

## Integration with Scraper

The VPN manager is automatically integrated into the scraping flow:

1. **Initialization**: VPN connects at startup
2. **Request Tracking**: Each request is tracked
3. **Auto-Rotation**: IP rotates when threshold reached
4. **Error Handling**: Rotates on errors
5. **Statistics**: Tracks IP usage and rotations

## Usage Example

```typescript
import { initializeVPN, loadVPNConfig, getVPNManager } from '@/lib/vpn';
import { loadVPNConfig } from '@/lib/vpn-config';

// Initialize VPN
const config = loadVPNConfig();
await initializeVPN(config);

// Get current IP
const vpn = getVPNManager();
const currentIP = await vpn?.getCurrentIP();
console.log(`Current IP: ${currentIP}`);

// Record requests (automatic in scraper)
vpn?.recordRequest(true);

// Manual rotation
await vpn?.rotateIP('manual rotation');

// Get statistics
const stats = vpn?.getStats();
console.log('VPN Stats:', stats);
```

## Large-Scale Scraping Strategy

For 50-200M SEK turnover range (potentially 10,000+ companies):

### Recommended Settings

```env
VPN_ENABLED="true"
VPN_PROVIDER="manual"
VPN_ROTATION_STRATEGY="request_count"
VPN_MAX_REQUESTS_PER_IP="500"
```

### Rotation Schedule

- **Every 500 requests**: Rotate IP
- **Every 30 minutes**: Rotate IP (backup)
- **On errors**: Immediate rotation

### Monitoring

- Track IP usage in real-time
- Monitor rotation frequency
- Watch for errors/blocking
- Adjust thresholds as needed

## Testing

1. **Start with manual VPN:**
   ```env
   VPN_ENABLED="true"
   VPN_PROVIDER="manual"
   VPN_ROTATION_STRATEGY="manual"
   ```

2. **Test rotation:**
   - Start scraper
   - Wait for rotation prompt
   - Change VPN manually
   - Verify IP change

3. **Test auto-rotation:**
   ```env
   VPN_ROTATION_STRATEGY="request_count"
   VPN_MAX_REQUESTS_PER_IP="10"  # Test with low threshold
   ```

4. **Monitor statistics:**
   - Check VPN stats in logs
   - Verify rotations are working
   - Adjust thresholds

## Best Practices

1. **Start Small**: Test with small batches first
2. **Monitor Closely**: Watch for errors and rate limits
3. **Adjust Thresholds**: Find the right balance for your use case
4. **Use Multiple IPs**: Rotate frequently for large jobs
5. **Respect Rate Limits**: Don't overwhelm the target site
6. **Save Progress**: Use checkpointing to resume if interrupted

## Troubleshooting

### VPN not rotating
- Check `VPN_ENABLED="true"`
- Verify provider is correct
- Check VPN connection manually

### IP not changing
- Wait longer after rotation
- Verify VPN is actually connected
- Check VPN service status

### Too many rotations
- Increase `VPN_MAX_REQUESTS_PER_IP`
- Change to `time_based` strategy
- Adjust thresholds

### Errors after rotation
- Wait longer after rotation (2-5 seconds)
- Verify new IP is working
- Check VPN service status

## Next Steps

1. Set up VPN service
2. Configure environment variables
3. Test with small batch
4. Monitor and adjust
5. Scale up for full scrape

