// Test Redis connection on startup
// Run with: node scripts/test-redis.js

import { initializeRedis } from '../lib/redis.js'

async function testRedis() {
  console.log('Testing Redis connection...\n')

  try {
    await initializeRedis()
    console.log('\n✓ Redis is configured correctly!')
    console.log('The application will use Redis for caching.')
    process.exit(0)
  } catch (error) {
    console.error('\n✗ Redis connection failed!')
    console.error('Error:', error.message)
    console.error('\nPlease ensure:')
    console.error('1. REDIS_URL is set in your .env file')
    console.error('2. Redis/Valkey server is running and accessible')
    console.error('3. Connection credentials are correct')
    process.exit(1)
  }
}

testRedis()
