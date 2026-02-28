import express from 'express'
import prisma from '../../prisma/client.js'
import { authenticateToken } from '../middleware/auth.js'

const router = express.Router()

// All routes require authentication
router.use(authenticateToken)

// Get user settings
router.get('/', async (req, res) => {
  try {
    let settings = await prisma.settings.findUnique({
      where: { userId: req.userId }
    })

    // Create default settings if they don't exist
    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          userId: req.userId,
          startingBalance: 1000,
          riskPercent: 2,
          riskReward: 3
        }
      })
    }

    res.json(settings)
  } catch (error) {
    console.error('Get settings error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Update user settings
router.put('/', async (req, res) => {
  try {
    const { startingBalance, riskPercent, riskReward } = req.body

    // Ensure values are numbers (handle string inputs from form)
    const parsedStartingBalance = parseFloat(startingBalance) || 0
    const parsedRiskPercent = parseFloat(riskPercent) || 0
    const parsedRiskReward = parseFloat(riskReward) || 0

    let settings = await prisma.settings.findUnique({
      where: { userId: req.userId }
    })

    if (settings) {
      // Update existing settings
      settings = await prisma.settings.update({
        where: { userId: req.userId },
        data: {
          startingBalance: parsedStartingBalance,
          riskPercent: parsedRiskPercent,
          riskReward: parsedRiskReward
        }
      })
    } else {
      // Create new settings
      settings = await prisma.settings.create({
        data: {
          userId: req.userId,
          startingBalance: parsedStartingBalance || 1000,
          riskPercent: parsedRiskPercent || 2,
          riskReward: parsedRiskReward || 3
        }
      })
    }

    res.json(settings)
  } catch (error) {
    console.error('Update settings error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
