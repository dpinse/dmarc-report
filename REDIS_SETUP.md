# Redis/Valkey Caching Setup

This application supports Redis or Valkey for persistent caching of IP resolution and GeoIP lookups, significantly reducing API calls and improving performance.

## Features

- **Persistent Caching**: IP resolutions and GeoIP lookups are cached in Redis/Valkey
- **Required Connection**: Redis/Valkey connection is required - the app will fail to start if unavailable
- **Configurable TTLs**:
  - DNS records: 30 days by default (configurable via `DNS_CACHE_TTL`)
  - GeoIP data: 30 days by default (configurable via `GEOIP_CACHE_TTL`)
- **Cost Savings**: Dramatically reduces external API calls after initial lookups

## Setup Instructions

### Option 1: Local Redis/Valkey

1. Install Redis or Valkey locally:
   ```bash
   # On Windows (using Chocolatey)
   choco install redis-64

   # On macOS (using Homebrew)
   brew install redis
   # or
   brew install valkey

   # On Linux (using apt)
   sudo apt install redis-server
   ```

2. Start Redis/Valkey:
   ```bash
   # Redis
   redis-server

   # Valkey
   valkey-server
   ```

3. Set environment variables:
   ```bash
   # Create .env.local file
   REDIS_URL=redis://localhost:6379

   # Optional: Configure cache TTL (in seconds)
   DNS_CACHE_TTL=2592000      # 30 days (default)
   GEOIP_CACHE_TTL=2592000    # 30 days (default)
   ```

### Option 2: External Valkey/Redis Host

1. Get your Valkey/Redis connection URL from your hosting provider

2. Create `.env.local` file in the project root:
   ```env
   REDIS_URL=redis://username:password@your-host.com:6379/0

   # Optional: Configure cache TTL (in seconds)
   DNS_CACHE_TTL=2592000      # 30 days (default)
   GEOIP_CACHE_TTL=2592000    # 30 days (default)
   ```

   Common formats:
   - **Basic**: `redis://localhost:6379`
   - **With auth**: `redis://:password@host:6379`
   - **With user and password**: `redis://username:password@host:6379`
   - **With database**: `redis://host:6379/2`
   - **TLS/SSL**: `rediss://host:6379` (note the double 's')

## Verifying Setup

Before starting your application, test the Redis connection:

```bash
node scripts/test-redis.js
```

If successful, you'll see:
```
Testing Redis connection...
Connecting to Redis...
✓ Redis connected successfully
✓ Redis connection tested successfully

✓ Redis is configured correctly!
The application will use Redis for caching.
```

Then start your application:
```bash
npm run dev
```

Upload a DMARC report and observe:
- First load: IPs are resolved and cached
- Subsequent loads: Results are instant (from cache)

## Cache Statistics

To monitor cache performance:

1. **Redis CLI**:
   ```bash
   redis-cli
   > KEYS geoip:*    # View all GeoIP cache keys
   > KEYS dns:*      # View all DNS cache keys
   > TTL geoip:1.2.3.4  # Check remaining TTL for specific IP
   ```

2. **Clear cache** (if needed):
   ```bash
   redis-cli FLUSHDB
   ```

## Benefits

- **Reduced API Calls**: After first lookup, subsequent requests are instant
- **Cost Savings**: Free tier APIs have strict rate limits - caching helps stay within limits
- **Better Performance**: Sub-millisecond response times from cache vs seconds from API
- **Reliability**: Less dependent on external API availability

## Cache Keys

- GeoIP: `geoip:{ip_address}` (e.g., `geoip:8.8.8.8`)
- DNS: `dns:{ip_address}` (e.g., `dns:8.8.8.8`)

## Configuration Options

### Cache TTL Settings

You can customize how long data is cached by setting these environment variables in your `.env.local` file:

- **DNS_CACHE_TTL**: Time to live for DNS reverse lookups (IP → hostname)
  - Default: `2592000` (30 days)
  - Example: `DNS_CACHE_TTL=604800` (7 days)

- **GEOIP_CACHE_TTL**: Time to live for GeoIP lookups (IP → country)
  - Default: `2592000` (30 days)
  - Example: `GEOIP_CACHE_TTL=7776000` (90 days)

Values are in seconds. Common durations:
- 1 hour: `3600`
- 1 day: `86400`
- 7 days: `604800`
- 30 days: `2592000`
- 90 days: `7776000`

## Troubleshooting

### Redis connection fails

If you see connection errors:
1. Run the test script: `node scripts/test-redis.js`
2. Check Redis/Valkey is running: `redis-cli ping` (should return PONG)
3. Check `REDIS_URL` format is correct in `.env.local`
4. Verify firewall rules allow connection to Redis port (default: 6379)
5. The app requires Redis - it will not start without a successful connection

### Slow performance despite Redis

If performance is still slow:
1. Check Redis memory: `redis-cli INFO memory`
2. Verify cache hits: `redis-cli MONITOR` (watch for GET commands)
3. Check network latency to Redis host

### Cache not clearing

To force cache refresh:
```bash
# Clear all GeoIP cache
redis-cli --scan --pattern 'geoip:*' | xargs redis-cli DEL

# Clear all DNS cache
redis-cli --scan --pattern 'dns:*' | xargs redis-cli DEL
```
