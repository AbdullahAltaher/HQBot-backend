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

function detectMood(topic) {
  if (topic.includes('بحر') || topic.includes('سفن') || topic.includes('ساحل') || topic.includes('خليج') || topic.includes('معاهدة') || topic.includes('ميناء') || topic.includes('جزيرة')) return 'sea'
  if (topic.includes('نجد') || topic.includes('صحراء') || topic.includes('سعود') || topic.includes('بادية') || topic.includes('قبيلة')) return 'desert'
  if (topic.includes('معركة') || topic.includes('حرب') || topic.includes('قتال') || topic.includes('هجوم') || topic.includes('غزو') || topic.includes('جيش')) return 'battle'
  if (topic.includes('قصر') || topic.includes('شيخ') || topic.includes('حاكم') || topic.includes('سلطان') || topic.includes('دبلوماس') || topic.includes('اجتماع')) return 'palace'
  return 'sea'
}

export async function generateStory(topic) {
  const embedding = await getEmbedding(topic)

  const { data: chunks, error } = await supabase.rpc('match_chunks', {
    query_embedding: embedding,
    match_threshold: 0.05,
    match_count: 15
  })

  if (error) throw new Error(`Retrieval failed: ${error.message}`)

  const context = chunks && chunks.length > 0
    ? chunks.map(c => c.content).join('\n\n')
    : null

  if (!context) throw new Error('لا توجد معلومات كافية عن هذا الموضوع')

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    messages: [{
      role: 'user',
      content: `أنت كاتب روائي متخصص في التاريخ العربي. بناءً على المعلومات التاريخية الحقيقية أدناه، اكتب قصة سردية أدبية رائعة عن: "${topic}"

## قواعد الكتابة:
- ابدأ بجملة افتتاحية تصويرية تضع القارئ في المشهد مباشرة (مثل: "كان الفجر يتسلل ببطء فوق خور رأس الخيمة...")
- اكتب بأسلوب روائي عربي راقٍ، غني بالصور البلاغية والاستعارات
- صف المكان والزمان والأجواء بتفصيل حسي — الأصوات، الروائح، درجة الحرارة، المشاعر
- أدخل أفكار وعواطف الشخصيات التاريخية الحقيقية
- استخدم الحوار الدرامي بين الشخصيات عند الإمكان
- قسّم القصة إلى 3 فصول قصيرة بعناوين شعرية
- اجعل القصة مشوقة مع توتر درامي وذروة وخاتمة
- الطول: 700-1000 كلمة
- لا تذكر أنك تعتمد على مصادر، فقط اسرد القصة كما لو كنت شاهداً عليها

## المعلومات التاريخية:
${context}`
    }]
  })

  return {
    story: message.content[0].text,
    topic,
    mood: detectMood(topic)
  }
}