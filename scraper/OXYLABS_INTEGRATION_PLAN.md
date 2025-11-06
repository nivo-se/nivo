# Oxylabs Proxy Integration Plan

## Overview

Replace VPN-based IP rotation with Oxylabs proxy service for large-scale scraping (50-200M SEK turnover range).

## Why Oxylabs?

- **Automatic IP Rotation**: Residential proxies rotate IPs automatically
- **High Success Rate**: Built-in unblocking and retry logic
- **Scalability**: Handle thousands of requests without manual intervention
- **Professional Solution**: Enterprise-grade proxy infrastructure
- **Swedish IPs**: Can target specific countries (Sweden)

## Oxylabs Proxy Types

### Recommended: Residential Proxies

**Best for:**
- Large-scale scraping (10,000+ companies)
- Automatic IP rotation
- High success rates
- Country targeting (Sweden)

**Features:**
- Automatic IP rotation
- Built-in retry logic
- Country/ASN targeting
- Session management

### Alternative: ISP Proxies

**Best for:**
- Faster speeds
- Lower cost
- Still good for large-scale scraping

## Integration Plan

### Phase 1: Setup & Configuration

1. **Get Oxylabs Credentials**
   - Username (from Oxylabs dashboard)
   - Password (from Oxylabs dashboard)
   - Proxy endpoint: `pr.oxylabs.io:7777` (residential) or `isp.oxylabs.io:7777` (ISP)

2. **Configure Environment Variables**
   ```env
   # Oxylabs Configuration
   OXYLABS_ENABLED="true"
   OXYLABS_USERNAME="your-username"
   OXYLABS_PASSWORD="your-password"
   OXYLABS_PROXY_TYPE="residential"  # residential or isp
   OXYLABS_COUNTRY="se"  # Sweden
   OXYLABS_SESSION_TYPE="rotate"  # rotate or sticky
   ```

3. **Update Proxy Implementation**
   - Replace VPN manager with Oxylabs proxy client
   - Use Oxylabs proxy format: `http://username:password@pr.oxylabs.io:7777`
   - Add country targeting (Sweden: `se`)

### Phase 2: Implement Oxylabs Proxy Client

**File: `scraper/allabolag-scraper/src/lib/oxylabs-proxy.ts`**

Features:
- Proxy authentication
- Automatic IP rotation
- Country targeting (Sweden)
- Session management
- Request tracking
- Error handling with retry

### Phase 3: Integration with Scraper

1. **Replace VPN calls with Oxylabs proxy**
   - Update `fetchWithVPN` → `fetchWithOxylabs`
   - Remove VPN rotation logic (handled by Oxylabs)
   - Keep request tracking and statistics

2. **Update Allabolag Session**
   - Use Oxylabs proxy for all requests
   - Handle proxy authentication
   - Track requests for monitoring

3. **Update Scraping Routes**
   - All `/api/segment/*` requests through proxy
   - All `/api/enrich/*` requests through proxy
   - All `/api/financial/*` requests through proxy

### Phase 4: Testing

1. **Small Batch Test**
   - Test with 10-50 companies
   - Verify proxy connection
   - Verify IP rotation
   - Check success rates

2. **Medium Batch Test**
   - Test with 100-500 companies
   - Monitor proxy usage
   - Check for rate limits
   - Verify data quality

3. **Large Scale Test**
   - Test with 50-200M SEK range
   - Monitor proxy performance
   - Track costs
   - Verify completion

## Implementation Details

### Oxylabs Proxy Format

```
http://username:password@pr.oxylabs.io:7777
```

### With Country Targeting (Sweden)

```
http://username:password@pr.oxylabs.io:7777
Headers:
  X-Oxylabs-Country: se
```

### Request Format

```typescript
const proxyUrl = `http://${username}:${password}@pr.oxylabs.io:7777`;

const response = await fetch(targetUrl, {
  method: 'GET',
  headers: {
    'User-Agent': '...',
    'X-Oxylabs-Country': 'se',  // Sweden
    // ... other headers
  },
  // Proxy configuration
  // Note: Node.js fetch doesn't support proxy directly
  // Need to use proxy-agent or similar
});
```

### Using Proxy Agent

For Node.js, we'll need a proxy agent library:

```bash
npm install https-proxy-agent
```

```typescript
import { HttpsProxyAgent } from 'https-proxy-agent';

const proxyAgent = new HttpsProxyAgent(proxyUrl);
const response = await fetch(targetUrl, {
  agent: proxyAgent,
  headers: { ... }
});
```

## Configuration Options

### Residential Proxies

```env
OXYLABS_ENABLED="true"
OXYLABS_PROXY_TYPE="residential"
OXYLABS_COUNTRY="se"
OXYLABS_SESSION_TYPE="rotate"  # Automatic rotation
```

### ISP Proxies (Faster, Lower Cost)

```env
OXYLABS_ENABLED="true"
OXYLABS_PROXY_TYPE="isp"
OXYLABS_COUNTRY="se"
```

### Session Management

- **Rotate**: New IP for each request (default)
- **Sticky**: Same IP for session duration

## Cost Considerations

- **Residential Proxies**: ~$2-5 per GB
- **ISP Proxies**: ~$1-3 per GB
- **Large Scale** (50-200M SEK): Estimate 5-10 GB data

## Monitoring & Statistics

Track:
- Total requests made
- Successful requests
- Failed requests
- IP rotations (automatic)
- Data usage
- Cost estimation

## Migration Steps

1. **Keep VPN code** (for fallback or testing)
2. **Add Oxylabs implementation** alongside VPN
3. **Test with small batch**
4. **Switch to Oxylabs for large-scale**
5. **Monitor and optimize**

## Benefits Over VPN

- ✅ **No manual rotation** - Automatic IP changes
- ✅ **Better success rates** - Built-in unblocking
- ✅ **Swedish IPs** - Target specific country
- ✅ **Scalability** - Handle thousands of requests
- ✅ **Monitoring** - Built-in statistics
- ✅ **Reliability** - Enterprise infrastructure

## Next Steps

1. Get Oxylabs credentials from dashboard
2. Install proxy agent library
3. Implement Oxylabs proxy client
4. Update scraper to use Oxylabs
5. Test with small batch
6. Scale up for full scrape

