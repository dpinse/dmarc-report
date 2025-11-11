import { NextResponse } from 'next/server'
import { cacheGet, cacheSet } from '../../../lib/redis'

// Get GeoIP cache TTL from environment (default: 30 days)
const GEOIP_CACHE_TTL = parseInt(process.env.GEOIP_CACHE_TTL) || (30 * 24 * 60 * 60)

// Check if IP is IPv6
function isIPv6(ip) {
  return ip.includes(':')
}

// Check if IP is private/local (IPv4 or IPv6)
function isPrivateIP(ip) {
  // IPv6 checks
  if (isIPv6(ip)) {
    const normalized = ip.toLowerCase().replace(/[\[\]]/g, '')

    // ::1 (loopback)
    if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true

    // fe80::/10 (link-local)
    if (normalized.startsWith('fe80:')) return true

    // fc00::/7 (unique local)
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true

    // ::ffff:0:0/96 (IPv4-mapped IPv6)
    if (normalized.includes('::ffff:')) return true

    return false
  }

  // IPv4 checks
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4) return false

  // 10.0.0.0/8
  if (parts[0] === 10) return true

  // 172.16.0.0/12
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true

  // 192.168.0.0/16
  if (parts[0] === 192 && parts[1] === 168) return true

  // 127.0.0.0/8 (localhost)
  if (parts[0] === 127) return true

  return false
}

// Try ip-api.com (free, no key required, 45 requests/minute)
async function tryIPAPI(ip) {
  const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode`)
  const data = await response.json()

  if (data.status === 'success' && data.countryCode) {
    return {
      country: data.country,
      countryCode: data.countryCode
    }
  }
  return null
}

// Try ipwhois.app (free, 10k requests/month)
async function tryIPWhois(ip) {
  const response = await fetch(`http://ipwhois.app/json/${ip}`)
  const data = await response.json()

  if (data.success && data.country_code) {
    return {
      country: data.country,
      countryCode: data.country_code
    }
  }
  return null
}

// Try ipapi.co (free, 1000 requests/day)
async function tryIPAPICo(ip) {
  const response = await fetch(`https://ipapi.co/${ip}/json/`)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)

  const data = await response.json()

  if (data.country_code && data.country_name) {
    return {
      country: data.country_name,
      countryCode: data.country_code
    }
  }
  return null
}

// Get country for IP with fallback services
async function getCountryForIP(ip) {
  // Skip private/local IPs (both IPv4 and IPv6)
  if (isPrivateIP(ip)) {
    return null
  }

  // Try each service in order with timeout
  // Note: Most free GeoIP services support both IPv4 and IPv6
  const services = [tryIPAPI, tryIPWhois, tryIPAPICo]

  for (const service of services) {
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 3000)
      )

      const result = await Promise.race([
        service(ip),
        timeoutPromise
      ])

      if (result) {
        return result
      }
    } catch (error) {
      // Try next service
      continue
    }
  }

  // All services failed
  console.warn(`Failed to lookup IP ${ip} with all services`)
  return null
}

export async function POST(request) {
  try {
    const { ips } = await request.json()

    if (!ips || !Array.isArray(ips)) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const results = {}

    // Process each IP
    for (const ip of ips) {
      // Check cache first
      const cacheKey = `geoip:${ip}`
      const cached = await cacheGet(cacheKey)

      if (cached !== null) {
        results[ip] = cached
      } else {
        // Lookup and cache
        const country = await getCountryForIP(ip)
        results[ip] = country

        // Cache with configured TTL
        await cacheSet(cacheKey, country, GEOIP_CACHE_TTL)
      }

      // Small delay to respect rate limits (only for uncached requests)
      if (cached === null) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Error looking up GeoIP:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
