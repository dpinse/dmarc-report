// Cache for DNS lookups to avoid redundant requests
const dnsCache = new Map()

// Resolve IP address to hostname using DNS-over-HTTPS
export async function resolveIP(ipAddress) {
  // Check cache first
  if (dnsCache.has(ipAddress)) {
    return dnsCache.get(ipAddress)
  }

  try {
    // Use Google's DNS-over-HTTPS service for reverse DNS lookup
    const response = await fetch(
      `https://dns.google/resolve?name=${reverseIP(ipAddress)}.in-addr.arpa&type=PTR`,
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
      dnsCache.set(ipAddress, hostname)
      return hostname
    }
  } catch (error) {
    console.log(`Could not resolve ${ipAddress}:`, error.message)
  }

  // If resolution fails, cache and return null
  dnsCache.set(ipAddress, null)
  return null
}

// Reverse IP address for PTR lookup (e.g., 1.2.3.4 -> 4.3.2.1)
function reverseIP(ip) {
  return ip.split('.').reverse().join('.')
}

// Batch resolve multiple IPs
export async function resolveIPs(ipAddresses) {
  const results = {}
  const promises = ipAddresses.map(async (ip) => {
    const hostname = await resolveIP(ip)
    results[ip] = hostname
  })

  await Promise.all(promises)
  return results
}

// Clear the DNS cache
export function clearDNSCache() {
  dnsCache.clear()
}
