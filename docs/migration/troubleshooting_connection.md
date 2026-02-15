# Troubleshooting Database Connection

## Issue: "No route to host" error

This typically indicates a network/firewall issue, not an authentication problem.

## Solutions

### 1. Verify Connection String in Supabase Dashboard

Go to: https://supabase.com/dashboard/project/clysgodrmowieximfaab/settings/database

Under **Connection string**, check:
- **Direct connection** (port 5432) - may be blocked by firewall
- **Connection pooling** (port 6543) - recommended for external connections

### 2. Try Connection Pooling

The pooler connection string format is:
```
postgresql://postgres.clysgodrmowieximfaab:[PASSWORD]@aws-0-eu-north-1.pooler.supabase.com:6543/postgres?sslmode=require
```

### 3. Check Firewall/VPN

- Ensure your IP is allowed in Supabase dashboard (Settings → Database → Connection Pooling → Allowed IPs)
- Try disabling VPN if active
- Check if your network blocks port 5432 or 6543

### 4. Alternative: Use Supabase Dashboard SQL Editor

If direct connection fails, you can:
1. Use the Supabase Dashboard SQL Editor to run the COPY commands
2. Or use the Supabase CLI with `supabase db push` (for migrations)

### 5. Verify Password

The password might need to be reset. Check in:
- Supabase Dashboard → Project Settings → Database → Database password
- Or reset it if needed

