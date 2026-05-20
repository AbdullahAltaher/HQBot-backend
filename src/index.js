import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import { query } from './retrieval.js'
import { generateQuiz } from './quiz.js'
import { generateStory } from './story.js'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)

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

app.post('/api/quiz', async (req, res) => {
  const { book, difficulty } = req.body
  if (!book) return res.status(400).json({ error: 'Book is required' })
  try {
    const result = await generateQuiz(book, difficulty || 'medium')
    res.json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/story', async (req, res) => {
  const { topic } = req.body
  if (!topic) return res.status(400).json({ error: 'Topic is required' })
  try {
    const result = await generateStory(topic)
    res.json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/tts', async (req, res) => {
  const { text } = req.body
  if (!text) return res.status(400).json({ error: 'Text is required' })
  try {
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1-hd',
      voice: 'fable',
      input: text.slice(0, 4096),
    })
    const buffer = Buffer.from(await mp3.arrayBuffer())
    res.set('Content-Type', 'audio/mpeg')
    res.send(buffer)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/entities', async (req, res) => {
  try {
    const { data, error } = await supabase.from('entities').select('*')
    if (error) throw error
    res.json(data)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/debug-prompt', (_, res) => {
  res.json({ model: 'claude-sonnet-4-6' })
})

app.get('/api/health', (_, res) => res.json({ status: 'ok' }))

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`))