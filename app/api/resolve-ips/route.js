import { NextResponse } from 'next/server'
import { cacheGet, cacheSet } from '../../../lib/redis'

// Get DNS cache TTL from environment (default: 30 days)
const DNS_CACHE_TTL = parseInt(process.env.DNS_CACHE_TTL) || (30 * 24 * 60 * 60)

// Check if IP is IPv6
function isIPv6(ip) {
  return ip.includes(':')
}

// Convert IPv6 address to reverse DNS format
function ipv6ToReverseDNS(ipv6) {
  // Remove any brackets and expand the address
  ipv6 = ipv6.replace(/[\[\]]/g, '')

  // Expand IPv6 address to full form (all 8 groups of 4 hex digits)
  const parts = ipv6.split(':')
  const expanded = []
  let zeroGroupIndex = parts.indexOf('')

  if (zeroGroupIndex !== -1) {
    // Handle :: compression
    const before = parts.slice(0, zeroGroupIndex).filter(p => p !== '')
    const after = parts.slice(zeroGroupIndex + 1).filter(p => p !== '')
    const zerosNeeded = 8 - before.length - after.length

    before.forEach(p => expanded.push(p.padStart(4, '0')))
    for (let i = 0; i < zerosNeeded; i++) {
      expanded.push('0000')
    }
    after.forEach(p => expanded.push(p.padStart(4, '0')))
  } else {
    parts.forEach(p => expanded.push(p.padStart(4, '0')))
  }

  // Convert to reverse DNS format: split into nibbles and reverse
  const nibbles = expanded.join('').split('').reverse()
  return nibbles.join('.') + '.ip6.arpa'
}

// Resolve IP address to hostname using DNS-over-HTTPS
async function resolveIP(ipAddress) {
  const isV6 = isIPv6(ipAddress)

  try {
    let reverseDNS

    if (isV6) {
      // IPv6 reverse DNS lookup
      reverseDNS = ipv6ToReverseDNS(ipAddress)
    } else {
      // IPv4 reverse DNS lookup
      reverseDNS = ipAddress.split('.').reverse().join('.') + '.in-addr.arpa'
    }

    // Use Google's DNS-over-HTTPS service for reverse DNS lookup
    const response = await fetch(
      `https://dns.google/resolve?name=${reverseDNS}&type=PTR`,
      {
        signal: AbortSignal.timeout(5000) // 5 second timeout
      }
    )

    if (!response.ok) {
      throw new Error('DNS lookup failed')
    }

    const data = await response.json()

    if (data.Answer && data.Answer.length > 0) {
      // Get the PTR record (hostname)
      const hostname = data.Answer[0].data.replace(/\.$/, '') // Remove trailing dot
      return hostname
    }
  } catch (error) {
    console.log(`Could not resolve ${ipAddress}:`, error.message)
  }

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
      const cacheKey = `dns:${ip}`
      const cached = await cacheGet(cacheKey)

      if (cached !== null) {
        results[ip] = cached
      } else {
        // Resolve and cache
        const hostname = await resolveIP(ip)
        results[ip] = hostname

        // Cache with configured TTL
        await cacheSet(cacheKey, hostname, DNS_CACHE_TTL)
      }
    }

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Error resolving IPs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
