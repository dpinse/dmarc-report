/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
  webpack: (config, { isServer }) => {
    // Redis package requires Node.js built-ins that aren't available in the browser
    // Only allow Redis to be used on the server side
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        stream: false,
        net: false,
        tls: false,
        dns: false,
      }
    }
    return config
  },
}

module.exports = nextConfig
