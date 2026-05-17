import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { query } from './retrieval.js'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

app.post('/api/chat', async (req, res) => {
  const { question, history } = req.body
  if (!question) return res.status(400).json({ error: 'Question is required' })

  try {
    const result = await query(question, history || [])
    res.json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/debug-prompt', (_, res) => {
  res.json({
    model: 'claude-sonnet-4-6',
    note: 'System prompt is built dynamically in retrieval.js based on retrieved chunks'
  })
})

app.get('/api/health', (_, res) => res.json({ status: 'ok' }))

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`))