import { createClient } from 'redis'

let redis = null
let redisConnecting = false
let redisConnectionTested = false

// Initialize and test Redis connection on startup
async function initializeRedis() {
  if (redisConnectionTested) {
    return redis
  }

  redisConnectionTested = true

  // Require REDIS_URL to be set
  if (!process.env.REDIS_URL) {
    throw new Error('REDIS_URL environment variable is required')
  }

  try {
    console.log('Connecting to Redis...')

    redis = createClient({
      url: process.env.REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            return new Error('Max retries reached')
          }
          return Math.min(retries * 100, 3000)
        },
        connectTimeout: 5000, // 5 second timeout
      }
    })

    redis.on('error', (err) => {
      console.error('Redis connection error:', err.message)
    })

    redis.on('ready', () => {
      console.log('✓ Redis connected successfully')
    })

    redis.on('reconnecting', () => {
      console.log('Redis reconnecting...')
    })

    await redis.connect()

    // Test the connection with a ping
    const pong = await redis.ping()
    if (pong !== 'PONG') {
      throw new Error('Redis ping failed')
    }

    console.log('✓ Redis connection tested successfully')
    return redis
  } catch (error) {
    console.error('✗ Failed to connect to Redis:', error.message)
    console.error('Please check your REDIS_URL environment variable')
    throw error
  }
}

// Get Redis client (assumes initialization already happened)
async function getRedisClient() {
  if (redis && redis.isOpen) return redis

  if (redisConnecting) {
    // Wait for connection attempt to complete
    let attempts = 0
    while (redisConnecting && attempts < 100) {
      await new Promise(resolve => setTimeout(resolve, 100))
      attempts++
    }
    if (redis && redis.isOpen) return redis
    throw new Error('Redis connection timeout')
  }

  // Try to initialize if not done yet
  redisConnecting = true
  try {
    await initializeRedis()
    return redis
  } finally {
    redisConnecting = false
  }
}

// Set with TTL
export async function cacheSet(key, value, ttlSeconds = 86400) {
  const client = await getRedisClient()
  await client.setEx(key, ttlSeconds, JSON.stringify(value))
  return true
}

// Get from cache
export async function cacheGet(key) {
  const client = await getRedisClient()
  const value = await client.get(key)
  return value ? JSON.parse(value) : null
}

// Check if key exists
export async function cacheHas(key) {
  const client = await getRedisClient()
  const exists = await client.exists(key)
  return exists === 1
}

// Clear cache (optional - for testing or admin purposes)
export async function cacheClear(pattern = '*') {
  const client = await getRedisClient()
  const keys = await client.keys(pattern)
  if (keys.length > 0) {
    await client.del(keys)
  }
  return true
}

// Export initialize function for manual startup testing
export { initializeRedis }
