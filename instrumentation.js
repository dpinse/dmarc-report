// This file runs once when the Next.js server starts
// Use it to initialize services and test connections

export async function register() {
  // Only run on server-side
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      console.log('Initializing application...')

      // Dynamic import to avoid bundling Redis in client-side code
      const { initializeRedis } = await import('./lib/redis.js')
      await initializeRedis()

      console.log('Application ready!')
    } catch (error) {
      console.error('\n❌ STARTUP FAILED: Redis connection could not be established')
      console.error('Error:', error.message)
      console.error('\nThe application requires Redis/Valkey to function.')
      console.error('Please ensure:')
      console.error('1. REDIS_URL is set in your .env.local file')
      console.error('2. Redis/Valkey server is running and accessible')
      console.error('3. Connection credentials are correct')
      console.error('\nYou can test your Redis connection with: node scripts/test-redis.js\n')

      // Exit the process - don't allow the app to start without Redis
      process.exit(1)
    }
  }
}
