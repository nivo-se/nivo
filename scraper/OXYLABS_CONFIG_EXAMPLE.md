# Oxylabs Configuration Example

## Your Configuration (US Proxy)

Based on your credentials and dashboard:

```env
OXYLABS_ENABLED="true"
OXYLABS_USERNAME="user-jason_Z2AvH"
OXYLABS_PASSWORD="DGREF56ge+iun_654"
OXYLABS_PROXY_TYPE="datacenter"
OXYLABS_COUNTRY="us"  # United States (as shown in your dashboard)
OXYLABS_SESSION_TYPE="rotate"
OXYLABS_COUNTRY_IN_USERNAME="true"
OXYLABS_PORT="8000"  # or 8001-8005 as shown in your proxy list
```

## How It Works

### Username Format

When `OXYLABS_COUNTRY_IN_USERNAME="true"`:
- Username: `user-jason_Z2AvH`
- Country: `us`
- Final username: `user-jason_Z2AvH-country-US`

### Proxy URL

```
http://user-jason_Z2AvH-country-US:DGREF56ge+iun_654@dc.oxylabs.io:8000
```

### Your Current Configuration (US Proxy)

```env
OXYLABS_ENABLED="true"
OXYLABS_USERNAME="user-jason_Z2AvH"
OXYLABS_PASSWORD="DGREF56ge+iun_654"
OXYLABS_PROXY_TYPE="datacenter"
OXYLABS_COUNTRY="us"  # United States
OXYLABS_SESSION_TYPE="rotate"
OXYLABS_COUNTRY_IN_USERNAME="true"
OXYLABS_PORT="8000"
```

This will create: `user-jason_Z2AvH-country-US@dc.oxylabs.io:8000`

### For Sweden (Optional - if you want Swedish IPs for Allabolag.se)

```env
OXYLABS_ENABLED="true"
OXYLABS_USERNAME="user-jason_Z2AvH"
OXYLABS_PASSWORD="DGREF56ge+iun_654"
OXYLABS_PROXY_TYPE="datacenter"
OXYLABS_COUNTRY="se"  # Sweden
OXYLABS_SESSION_TYPE="rotate"
OXYLABS_COUNTRY_IN_USERNAME="true"
OXYLABS_PORT="8000"
```

This will create: `user-jason_Z2AvH-country-SE@dc.oxylabs.io:8000`

## Testing

Test your proxy connection (US):

```bash
curl -x dc.oxylabs.io:8000 \
  -U "user-jason_Z2AvH-country-US:DGREF56ge+iun_654" \
  https://ip.oxylabs.io/location
```

Or test with any port from your proxy list (8001-8005):

```bash
curl -x dc.oxylabs.io:8001 \
  -U "user-jason_Z2AvH-country-US:DGREF56ge+iun_654" \
  https://ip.oxylabs.io/location
```

## Proxy Types

### Datacenter (Your Current Setup)
- Host: `dc.oxylabs.io`
- Port: `8000`
- Fast, cost-effective
- Good for large-scale scraping

### Residential
- Host: `pr.oxylabs.io`
- Port: `7777`
- More expensive, better success rates
- Good for sensitive sites

### ISP
- Host: `isp.oxylabs.io`
- Port: `7777`
- Balance of speed and legitimacy

## Country Targeting

### In Username (Your Setup)
```env
OXYLABS_COUNTRY_IN_USERNAME="true"
OXYLABS_COUNTRY="se"
```
Result: `username-country-SE`

### Via Header (Alternative)
```env
OXYLABS_COUNTRY_IN_USERNAME="false"
OXYLABS_COUNTRY="se"
```
Result: Header `X-Oxylabs-Country: se`

## Quick Start

1. Copy your credentials to `.env.local`:
```env
OXYLABS_ENABLED="true"
OXYLABS_USERNAME="user-jason_Z2AvH"
OXYLABS_PASSWORD="DGREF56ge+iun_654"
OXYLABS_PROXY_TYPE="datacenter"
OXYLABS_COUNTRY="us"  # United States (as per your dashboard)
OXYLABS_COUNTRY_IN_USERNAME="true"
OXYLABS_PORT="8000"  # or 8001-8005 from your proxy list
```

2. Start scraper:
```bash
cd scraper/allabolag-scraper
npm run dev
```

3. Check logs for:
```
✅ Oxylabs datacenter proxy initialized
   Country: us
   Session: rotate
   Proxy URL: http://user-jason_Z2AvH-country-US:***@dc.oxylabs.io:8000
```

**Note**: Your dashboard shows multiple ports (8001-8005). You can use any of these ports. The system will automatically use the configured port.

