import { createClient } from '@supabase/supabase-js'
import { CohereClient } from 'cohere-ai'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

const cohere = new CohereClient({ token: process.env.COHERE_API_KEY })

function chunkText(text, chunkSize = 500) {
  const sentences = text.split(/(?<=[.!?؟،\n])\s+/)
  const chunks = []
  let current = ''

  for (const sentence of sentences) {
    if ((current + sentence).length > chunkSize) {
      if (current.trim()) chunks.push(current.trim())
      current = sentence
    } else {
      current += ' ' + sentence
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks
}

async function embedBatch(texts) {
  const response = await cohere.embed({
    texts,
    model: 'embed-multilingual-v3.0',
    inputType: 'search_document'
  })
  return response.embeddings
}

async function ingestFile(filePath, sourceType, author = null) {
  const text = fs.readFileSync(filePath, 'utf-8')
  const title = path.basename(filePath, path.extname(filePath))
  const chunks = chunkText(text)

  console.log(`📄 Processing: ${title} — ${chunks.length} chunks`)

  const { data: doc, error: docError } = await supabase
    .from('documents')
    .insert({ title, source_type: sourceType, author, language: 'ar' })
    .select()
    .single()

  if (docError) throw new Error(`Document insert failed: ${docError.message}`)

  // process in batches of 90 chunks at a time
  const BATCH_SIZE = 90
  let done = 0

  for (let b = 0; b < chunks.length; b += BATCH_SIZE) {
    const batch = chunks.slice(b, b + BATCH_SIZE)

    // embed entire batch in one API call
    const embeddings = await embedBatch(batch)

    // insert all chunks in batch
    const rows = batch.map((content, i) => ({
      document_id: doc.id,
      content,
      chunk_index: b + i,
      embedding: embeddings[i],
      metadata: { source_type: sourceType, author, title }
    }))

    const { error } = await supabase.from('chunks').insert(rows)
    if (error) throw new Error(`Chunk insert failed: ${error.message}`)

    done += batch.length
    console.log(`  ✅ ${done}/${chunks.length} chunks embedded`)
  }

  console.log(`✅ Done: ${title}`)
}

async function main() {
  const files = [
  { path: 'data/taht-rayat-alihtelal-full.txt', type: 'history', author: 'سلطان القاسمي' },
]

  for (const file of files) {
    if (fs.existsSync(file.path)) {
      await ingestFile(file.path, file.type, file.author)
    } else {
      console.log(`⚠️  File not found, skipping: ${file.path}`)
    }
  }
}

main().catch(console.error)