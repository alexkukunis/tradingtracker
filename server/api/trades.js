import express from 'express'
import prisma from '../../prisma/client.js'
import { authenticateToken } from '../middleware/auth.js'

const router = express.Router()

// All routes require authentication
router.use(authenticateToken)

// Get all trades for user
router.get('/', async (req, res) => {
  try {
    const trades = await prisma.trade.findMany({
      where: { userId: req.userId },
      orderBy: { date: 'asc' }
    })
    res.json(trades)
  } catch (error) {
    console.error('Get trades error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get single trade
router.get('/:id', async (req, res) => {
  try {
    const trade = await prisma.trade.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId
      }
    })

    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' })
    }

    res.json(trade)
  } catch (error) {
    console.error('Get trade error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Create trade
router.post('/', async (req, res) => {
  try {
    const tradeData = {
      ...req.body,
      userId: req.userId,
      date: new Date(req.body.date)
    }

    const trade = await prisma.trade.create({
      data: tradeData
    })

    res.status(201).json(trade)
  } catch (error) {
    console.error('Create trade error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Update trade
router.put('/:id', async (req, res) => {
  try {
    // Verify trade belongs to user
    const existingTrade = await prisma.trade.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId
      }
    })

    if (!existingTrade) {
      return res.status(404).json({ error: 'Trade not found' })
    }

    // Only allow specific updatable fields
    const allowedFields = ['date', 'day', 'pnl', 'openBalance', 'closeBalance', 'percentGain', 'riskDollar', 'targetDollar', 'rrAchieved', 'targetHit', 'notes', 'result']
    const updateData = {}
    
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'date') {
          updateData[field] = new Date(req.body[field])
        } else {
          updateData[field] = req.body[field]
        }
      }
    }

    const trade = await prisma.trade.update({
      where: { id: req.params.id },
      data: updateData
    })

    res.json(trade)
  } catch (error) {
    console.error('Update trade error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Delete trade
router.delete('/:id', async (req, res) => {
  try {
    // Verify trade belongs to user
    const existingTrade = await prisma.trade.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId
      }
    })

    if (!existingTrade) {
      return res.status(404).json({ error: 'Trade not found' })
    }

    await prisma.trade.delete({
      where: { id: req.params.id }
    })

    res.json({ message: 'Trade deleted successfully' })
  } catch (error) {
    console.error('Delete trade error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
