# VPN Testing Guide

## Quick Start

### 1. Enable VPN

Edit `.env.local`:

```env
VPN_ENABLED="true"
VPN_PROVIDER="manual"
VPN_ROTATION_STRATEGY="manual"
```

### 2. Install VPN Client

Choose a VPN service:
- **NordVPN**: https://nordvpn.com
- **ExpressVPN**: https://expressvpn.com
- **ProtonVPN**: https://protonvpn.com
- Any other VPN service

### 3. Test Manual Rotation

1. Start the scraper:
   ```bash
   cd scraper/allabolag-scraper
   npm run dev
   ```

2. Start a small scraping job (test with small batch)

3. When rotation is needed:
   - System will prompt you
   - Change VPN server manually in your VPN client
   - Press Enter to continue

### 4. Monitor IP Changes

Check the logs for:
- Initial IP: `✅ VPN initialized with IP: xxx.xxx.xxx.xxx`
- Rotation: `✅ IP rotated: old → new`
- Statistics: `VPN Stats: { currentIP, totalRotations, ... }`

## Testing Scenarios

### Scenario 1: Small Batch (Manual VPN)

**Settings:**
```env
VPN_ENABLED="true"
VPN_PROVIDER="manual"
VPN_ROTATION_STRATEGY="manual"
```

**Test:**
- Scrape 10-50 companies
- Manually rotate IP when prompted
- Verify IP change
- Verify scraping continues

### Scenario 2: Request-Based Rotation

**Settings:**
```env
VPN_ENABLED="true"
VPN_PROVIDER="manual"
VPN_ROTATION_STRATEGY="request_count"
VPN_MAX_REQUESTS_PER_IP="10"  # Low for testing
```

**Test:**
- Start scraping
- Make 10 requests
- Verify automatic rotation
- Verify scraping continues

### Scenario 3: Error-Based Rotation

**Settings:**
```env
VPN_ENABLED="true"
VPN_PROVIDER="manual"
VPN_ROTATION_STRATEGY="error_based"
```

**Test:**
- Simulate rate limit (429) or block (403)
- Verify automatic rotation
- Verify retry with new IP

### Scenario 4: Large Scale (50-200M SEK)

**Settings:**
```env
VPN_ENABLED="true"
VPN_PROVIDER="manual"
VPN_ROTATION_STRATEGY="request_count"
VPN_MAX_REQUESTS_PER_IP="500"
```

**Test:**
- Set revenue range: 50-200M SEK
- Start scraping (will be MANY companies)
- Monitor rotations
- Verify progress continues
- Check for rate limits

## Verification Checklist

- [ ] VPN initializes correctly
- [ ] IP is detected correctly
- [ ] Manual rotation works
- [ ] Auto-rotation works (if enabled)
- [ ] IP changes are verified
- [ ] Scraping continues after rotation
- [ ] Rate limits are handled
- [ ] Statistics are tracked
- [ ] No data loss during rotation

## Troubleshooting

### VPN not initializing
- Check `VPN_ENABLED="true"`
- Verify VPN client is running
- Check VPN connection manually

### IP not changing
- Wait longer (5-10 seconds)
- Verify VPN is actually connected
- Check VPN service status

### Rotation not working
- Check rotation strategy
- Verify thresholds are set correctly
- Check logs for errors

### Rate limits still occurring
- Rotate more frequently (lower threshold)
- Use time-based rotation
- Check VPN service quality

## Next Steps

1. Test with small batch
2. Verify rotation works
3. Scale up to larger batches
4. Monitor for rate limits
5. Adjust thresholds as needed
6. Ready for full scrape (50-200M SEK)

