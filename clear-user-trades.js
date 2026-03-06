/**
 * Script to clear all trades for a specific user
 * Usage: node clear-user-trades.js <email>
 */

import prisma from './prisma/client.js'

const email = process.argv[2] || 'kukunisalex@gmail.com'

async function clearUserTrades() {
  try {
    console.log(`🔍 Finding user: ${email}...`)
    
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        trades: true
      }
    })

    if (!user) {
      console.error(`❌ User with email ${email} not found`)
      process.exit(1)
    }

    console.log(`✅ Found user: ${user.name || user.email}`)
    console.log(`📊 Current trades count: ${user.trades.length}`)

    if (user.trades.length === 0) {
      console.log('ℹ️  No trades to delete')
      process.exit(0)
    }

    // Delete all trades for this user
    console.log(`🗑️  Deleting ${user.trades.length} trades...`)
    
    const result = await prisma.trade.deleteMany({
      where: { userId: user.id }
    })

    console.log(`✅ Successfully deleted ${result.count} trades`)
    console.log(`\n✨ User account is now clean and ready for TradeLocker sync!`)
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error.stack)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

clearUserTrades()
