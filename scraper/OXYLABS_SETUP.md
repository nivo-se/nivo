# Oxylabs Proxy Setup Guide

## Overview

This guide explains how to set up and use Oxylabs proxy service for large-scale scraping (50-200M SEK turnover range).

## Why Oxylabs?

- ✅ **Automatic IP Rotation**: Residential proxies rotate IPs automatically per request
- ✅ **High Success Rate**: Built-in unblocking and retry logic
- ✅ **Swedish IPs**: Target specific country (Sweden: `se`)
- ✅ **Scalability**: Handle thousands of requests without manual intervention
- ✅ **Professional Solution**: Enterprise-grade proxy infrastructure
- ✅ **No Manual Rotation**: Fully automated IP rotation

## Getting Started

### 1. Get Oxylabs Credentials

1. **Sign up**: https://www.oxylabs.io/
2. **Login to Dashboard**: https://dashboard.oxylabs.io/
3. **Get Credentials**:
   - Go to "Proxy Settings" or "API Integration"
   - Create a proxy user (username and password)
   - Note your username and password

### 2. Configure Environment Variables

Edit `scraper/allabolag-scraper/.env.local`:

```env
# Enable Oxylabs
OXYLABS_ENABLED="true"

# Your Oxylabs credentials
OXYLABS_USERNAME="customer-USERNAME"
OXYLABS_PASSWORD="your-password"

# Proxy Type (residential or isp)
OXYLABS_PROXY_TYPE="residential"

# Country targeting (Sweden)
OXYLABS_COUNTRY="se"

# Session type (rotate = new IP per request, sticky = same IP for session)
OXYLABS_SESSION_TYPE="rotate"
```

### 3. Install Dependencies

```bash
cd scraper/allabolag-scraper
npm install
```

The `https-proxy-agent` package is already in `package.json` and will be installed.

### 4. Start Scraper

```bash
npm run dev
```

The scraper will automatically use Oxylabs proxy if enabled.

## Proxy Types

### Residential Proxies (Recommended)

**Best for:**
- Large-scale scraping
- Maximum anonymity
- High success rates
- Country targeting

**Configuration:**
```env
OXYLABS_PROXY_TYPE="residential"
OXYLABS_COUNTRY="se"
```

**Cost**: ~$2-5 per GB

### ISP Proxies

**Best for:**
- Faster speeds
- Lower cost
- Still good for large-scale scraping

**Configuration:**
```env
OXYLABS_PROXY_TYPE="isp"
OXYLABS_COUNTRY="se"
```

**Cost**: ~$1-3 per GB

## Session Management

### Rotate (Default)

**New IP for each request** - Best for large-scale scraping:

```env
OXYLABS_SESSION_TYPE="rotate"
```

**Use when:**
- Scraping thousands of companies
- Need maximum IP diversity
- Want automatic rotation

### Sticky

**Same IP for session duration** - Best for maintaining sessions:

```env
OXYLABS_SESSION_TYPE="sticky"
```

**Use when:**
- Need to maintain session cookies
- Want consistent IP for related requests

## Country Targeting

Target Swedish IPs for Allabolag.se:

```env
OXYLABS_COUNTRY="se"
```

### Available Countries

See Oxylabs documentation for full list. Common codes:
- `se` - Sweden
- `us` - United States
- `uk` - United Kingdom
- `de` - Germany

## Testing

### 1. Small Batch Test

```env
OXYLABS_ENABLED="true"
OXYLABS_PROXY_TYPE="residential"
OXYLABS_COUNTRY="se"
OXYLABS_SESSION_TYPE="rotate"
```

Test with 10-50 companies to verify:
- ✅ Proxy connection works
- ✅ IP rotation happens
- ✅ Requests succeed
- ✅ Data quality is good

### 2. Monitor Statistics

Check logs for:
- Proxy initialization: `✅ Oxylabs residential proxy initialized`
- Request success rates
- Data usage estimates
- Cost estimates

### 3. Large Scale Test

Once small batch works:
- Set revenue range: 50-200M SEK
- Start scraping (will be many companies)
- Monitor proxy usage
- Watch for rate limits (should be minimal)

## Monitoring

### Statistics Available

The scraper tracks:
- Total requests
- Successful requests
- Failed requests
- Success rate
- Data usage (MB)
- Estimated cost ($)

### View Statistics

Check logs for proxy statistics:
```
Oxylabs Stats:
  Total Requests: 1000
  Successful: 995
  Failed: 5
  Success Rate: 99.5%
  Data Usage: 50.2 MB
  Estimated Cost: $0.18
```

## Cost Estimation

### For 50-200M SEK Range

**Estimated Companies**: 10,000-50,000
**Estimated Requests**: 50,000-200,000
**Estimated Data**: 5-20 GB
**Estimated Cost**: $10-100 (residential) or $5-60 (ISP)

### Tips to Reduce Costs

1. **Use ISP Proxies**: Cheaper than residential
2. **Optimize Requests**: Only fetch needed data
3. **Batch Requests**: Combine requests when possible
4. **Monitor Usage**: Track data usage in real-time

## Troubleshooting

### Proxy Authentication Failed (407)

**Issue**: `407 Proxy Authentication Required`

**Solution**:
- Verify `OXYLABS_USERNAME` and `OXYLABS_PASSWORD` are correct
- Check credentials in Oxylabs dashboard
- Ensure username format is correct

### Bad Gateway (502)

**Issue**: `502 Bad Gateway`

**Solution**:
- Retry the request (automatically handled)
- Check Oxylabs network status
- Try different country or proxy type

### No Exit Found (525)

**Issue**: `525 No Exit Found`

**Solution**:
- Check country code is valid
- Try different country or remove country targeting
- Contact Oxylabs support

### High Failure Rate

**Issue**: Many failed requests

**Solution**:
- Check Oxylabs dashboard for issues
- Try ISP proxies instead of residential
- Verify target site is accessible
- Check rate limits on target site

## Best Practices

1. **Start Small**: Test with small batches first
2. **Monitor Closely**: Watch success rates and costs
3. **Use Appropriate Type**: Residential for maximum anonymity, ISP for speed
4. **Country Targeting**: Use Swedish IPs for Allabolag.se
5. **Rotate Sessions**: Use `rotate` for large-scale scraping
6. **Respect Rate Limits**: Don't overwhelm target site
7. **Save Progress**: Use checkpointing to resume if interrupted

## Configuration Examples

### Production (Large Scale)

```env
OXYLABS_ENABLED="true"
OXYLABS_USERNAME="customer-USERNAME"
OXYLABS_PASSWORD="your-password"
OXYLABS_PROXY_TYPE="residential"
OXYLABS_COUNTRY="se"
OXYLABS_SESSION_TYPE="rotate"
```

### Development (Testing)

```env
OXYLABS_ENABLED="true"
OXYLABS_USERNAME="customer-USERNAME"
OXYLABS_PASSWORD="your-password"
OXYLABS_PROXY_TYPE="isp"
OXYLABS_COUNTRY="se"
OXYLABS_SESSION_TYPE="rotate"
```

### Cost-Optimized

```env
OXYLABS_ENABLED="true"
OXYLABS_USERNAME="customer-USERNAME"
OXYLABS_PASSWORD="your-password"
OXYLABS_PROXY_TYPE="isp"
OXYLABS_COUNTRY="se"
OXYLABS_SESSION_TYPE="rotate"
```

## Next Steps

1. ✅ Get Oxylabs credentials
2. ✅ Configure environment variables
3. ✅ Test with small batch
4. ✅ Verify proxy works
5. ✅ Monitor statistics
6. ✅ Scale up for full scrape (50-200M SEK)

## Resources

- **Oxylabs Dashboard**: https://dashboard.oxylabs.io/
- **Oxylabs Documentation**: https://developers.oxylabs.io/
- **Integration Guides**: https://developers.oxylabs.io/proxies/integration-guides
- **Residential Proxies**: https://developers.oxylabs.io/proxies/residential-proxies
- **ISP Proxies**: https://developers.oxylabs.io/proxies/isp-proxies

