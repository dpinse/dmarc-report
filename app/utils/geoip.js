// GeoIP lookup using API route with Redis/Valkey caching
export async function getCountriesForIPs(ips) {
  try {
    const response = await fetch('/api/geoip', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ips }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data.results || {}
  } catch (error) {
    console.error('Failed to lookup GeoIP:', error)
    // Return empty results on error
    const results = {}
    ips.forEach(ip => {
      results[ip] = null
    })
    return results
  }
}
