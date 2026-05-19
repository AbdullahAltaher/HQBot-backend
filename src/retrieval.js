import dotenv from 'dotenv'
dotenv.config()

import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function getEmbedding(text) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  })
  return response.data[0].embedding
}

async function getSuggestedQuestions(question, answer) {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: `بناءً على هذا السؤال: "${question}"
وهذه الإجابة: "${answer.slice(0, 500)}"

اكتب 3 أسئلة متابعة باللغة العربية مرتبطة بالموضوع.
أرجع فقط الأسئلة الثلاثة، كل سؤال في سطر منفصل، بدون ترقيم أو رموز.`
    }]
  })
  const text = message.content[0].text
  return text.split('\n').map(q => q.trim()).filter(q => q.length > 5).slice(0, 3)
}

export async function query(userQuestion, history = []) {
  const queryEmbedding = await getEmbedding(userQuestion)

  const { data: chunks, error } = await supabase.rpc('match_chunks', {
    query_embedding: queryEmbedding,
    match_threshold: 0.1,
    match_count: 12
  })

  if (error) throw new Error(`Retrieval failed: ${error.message}`)

  const context = chunks && chunks.length > 0
    ? chunks.map((c, i) => `[${i + 1}] ${c.content}`).join('\n\n')
    : null

  const systemPrompt = context
    ? `أنت مساعد متخصص في تاريخ القواسم والخليج العربي، مبني على كتب صاحب السمو الشيخ الدكتور سلطان بن محمد القاسمي.

## قواعد الإجابة:
- أجب **فقط** بناءً على النصوص الموجودة في السياق أدناه
- استخرج المعلومات بشكل ذكي حتى لو كانت مذكورة بشكل غير مباشر
- رتّب الإجابة بشكل منطقي ومترابط
- استخدم العناوين والنقاط عند الحاجة لتنظيم المعلومات
- اذكر التواريخ والأسماء بدقة كما وردت في النص
- تذكر سياق المحادثة السابقة وأجب بشكل متسلسل
- إذا لم يكن هناك أي معلومة ذات صلة، قل: "لا تتوفر معلومات حول هذا الموضوع في قاعدة البيانات"
- لا تنهِ إجابتك بسؤال للمستخدم

## السياق من الكتاب:
${context}`
    : `أنت مساعد متخصص في تاريخ القواسم والخليج العربي.
لا تتوفر معلومات حول هذا الموضوع في قاعدة البيانات حالياً.`

  const conversationMessages = [
    ...history.slice(-6).map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.text
    })),
    { role: 'user', content: userQuestion }
  ]

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: systemPrompt,
    messages: conversationMessages
  })

  const answer = message.content[0].text
    .replace(/\n*هل تو[دّ].*?؟\s*$/g, '').trim()

  const suggestedQuestions = context
    ? await getSuggestedQuestions(userQuestion, answer)
    : []

  return {
    answer,
    sources: chunks || [],
    hasContext: !!context,
    suggestedQuestions
  }
}