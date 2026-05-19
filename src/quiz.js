import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function generateQuiz(book, difficulty) {
  const { data: chunks, error } = await supabase
    .from('chunks')
    .select('content, metadata')
    .contains('metadata', { title: book })
    .limit(30)

  if (error) throw new Error(`Failed to fetch chunks: ${error.message}`)
  if (!chunks || chunks.length === 0) throw new Error('No content found for this book')

  const randomChunks = chunks
    .sort(() => Math.random() - 0.5)
    .slice(0, 10)
    .map(c => c.content)
    .join('\n\n---\n\n')

  const difficultyMap = {
    easy: 'سهلة ومباشرة تعتمد على معلومات واضحة في النص',
    medium: 'متوسطة الصعوبة تتطلب فهم النص جيداً',
    hard: 'صعبة تتطلب تحليل النص واستنتاج المعلومات'
  }

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `بناءً على النصوص التالية من الكتاب، أنشئ 5 أسئلة اختيار من متعدد ${difficultyMap[difficulty]}.

النصوص:
${randomChunks}

أرجع الإجابة بصيغة JSON فقط بدون أي نص إضافي، بهذا الشكل بالضبط:
{
  "questions": [
    {
      "question": "نص السؤال",
      "options": ["الخيار أ", "الخيار ب", "الخيار ج", "الخيار د"],
      "correct": 0,
      "explanation": "شرح الإجابة الصحيحة"
    }
  ]
}`
    }]
  })

  const text = message.content[0].text
  const clean = text.replace(/```json|```/g, '').trim()
  const parsed = JSON.parse(clean)
  return parsed
}