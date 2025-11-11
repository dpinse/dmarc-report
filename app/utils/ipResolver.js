// Batch resolve multiple IPs using API route with Redis caching
export async function resolveIPs(ipAddresses) {
  try {
    const response = await fetch('/api/resolve-ips', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ips: ipAddresses }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data.results || {}
  } catch (error) {
    console.error('Failed to resolve IPs:', error)
    // Return empty results on error
    const results = {}
    ipAddresses.forEach(ip => {
      results[ip] = null
    })
    return results
  }
}

// Clear the DNS cache (now handled server-side)
export function clearDNSCache() {
  // No-op for client-side, caching is handled by Redis on server
  console.log('DNS cache is managed server-side')
}
