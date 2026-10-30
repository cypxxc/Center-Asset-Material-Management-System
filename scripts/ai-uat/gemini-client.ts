import type { UserRole } from './scenarios/types'
import { getUATConfig, type UATConfig } from './config'

export { getUATConfig, type UATConfig }

export const UAT_TOOL_DECLARATIONS = [
  {
    name: 'click_element',
    description: 'คลิก Element บนหน้าจอโดยอ้างอิงจาก ID ของ Element [#id]',
    parameters: {
      type: 'OBJECT',
      properties: {
        id: {
          type: 'INTEGER',
          description: 'หมายเลข ID ของ Element ที่ระบุในเครื่องหมาย [#id] จากรายการ',
        },
        reason: {
          type: 'STRING',
          description: 'เหตุผลภาษาไทยในการตัดสินใจคลิก Element นี้',
        },
      },
      required: ['id', 'reason'],
    },
  },
  {
    name: 'fill_input',
    description: 'กรอกข้อความลงในช่อง Input หรือ Textarea ตาม ID [#id]',
    parameters: {
      type: 'OBJECT',
      properties: {
        id: {
          type: 'INTEGER',
          description: 'หมายเลข ID ของ Input/Textarea ใน [#id]',
        },
        value: {
          type: 'STRING',
          description: 'ข้อความหรือตัวเลขที่ต้องการพิมพ์ (รองรับภาษาไทย)',
        },
        reason: {
          type: 'STRING',
          description: 'เหตุผลภาษาไทยในการกรอกข้อความนี้',
        },
      },
      required: ['id', 'value', 'reason'],
    },
  },
  {
    name: 'select_option',
    description: 'เลือกตัวเลือกจาก Dropdown หรือ Select element [#id]',
    parameters: {
      type: 'OBJECT',
      properties: {
        id: {
          type: 'INTEGER',
          description: 'หมายเลข ID ของ Select ใน [#id]',
        },
        value: {
          type: 'STRING',
          description: 'ค่า value หรือข้อความ label ของตัวเลือกที่ต้องการเลือก',
        },
        reason: {
          type: 'STRING',
          description: 'เหตุผลภาษาไทยในการเลือกค่านี้',
        },
      },
      required: ['id', 'value', 'reason'],
    },
  },
  {
    name: 'navigate_to',
    description: 'เดินทางไปยัง URL path ภายในระบบ เช่น /items, /dashboard, /admin',
    parameters: {
      type: 'OBJECT',
      properties: {
        path: {
          type: 'STRING',
          description: 'Path ปลายทางที่ต้องการเดินทางไป (เช่น /items, /dashboard)',
        },
        reason: {
          type: 'STRING',
          description: 'เหตุผลในการเปลี่ยนหน้า',
        },
      },
      required: ['path', 'reason'],
    },
  },
  {
    name: 'assert_condition',
    description: 'ทำการตรวจสอบ Assertion หรือยืนยันความถูกต้องของหน้าจอ',
    parameters: {
      type: 'OBJECT',
      properties: {
        assertion: {
          type: 'STRING',
          description: 'เงื่อนไขที่ตรวจสอบ เช่น "พบตารางพัสดุ", "แสดงข้อความแจ้งเตือนสีแดง"',
        },
        passed: {
          type: 'BOOLEAN',
          description: 'ผลการตรวจสอบว่าผ่านตามคาดหวังหรือไม่',
        },
        observation: {
          type: 'STRING',
          description: 'สิ่งที่สังเกตเห็นจริงบนหน้าจอ',
        },
      },
      required: ['assertion', 'passed', 'observation'],
    },
  },
  {
    name: 'complete_goal',
    description: 'บันทึกการสิ้นสุดการทดสอบ Scenario พร้อมสรุปผล Pass/Fail และประเด็นข้อบกพร่อง',
    parameters: {
      type: 'OBJECT',
      properties: {
        status: {
          type: 'STRING',
          enum: ['PASS', 'FAIL'],
          description: 'ผลสรุปสุดท้ายของ Scenario',
        },
        summary: {
          type: 'STRING',
          description: 'สรุปผลการทดสอบโดยละเอียดเป็นภาษาไทย',
        },
        defects: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              severity: {
                type: 'STRING',
                enum: ['Critical', 'Major', 'Minor'],
              },
              title: { type: 'STRING' },
              description: { type: 'STRING' },
            },
            required: ['severity', 'title', 'description'],
          },
          description: 'รายการข้อบกพร่อง บั๊ก หรือปัญหา UX/ภาษาไทยที่พบ',
        },
      },
      required: ['status', 'summary'],
    },
  },
]

export function formatSystemPrompt(role: UserRole, goal: string): string {
  return `คุณคือ AI Autonomous QA Tester มืออาชีพ ทำหน้าที่ทดสอบระบบ CAMMS (Center Asset & Material Management System)
คุณกำลังสวมบทบาท (Role): "${role.toUpperCase()}"
เป้าหมายของ Scenario นี้: "${goal}"

คำแนะนำในการตัดสินใจ:
1. วิเคราะห์ URL ปัจจุบันและรายการ Interactive Elements [#id] ที่ได้รับ
2. เลือก Tool ที่เหมาะสมที่สุดเพียง 1 คำสั่งต่อรอบ เพื่อพาไปยังเป้าหมาย (เช่น click_element, fill_input, select_option, navigate_to)
3. หากบรรลุเป้าหมายครบถ้วนแล้ว ให้เรียกคำสั่ง complete_goal(status="PASS", summary="...") ทันที
4. หากพบว่าระบบไม่ยอมให้ทำตามสิทธิ์ หรือเกิดข้อผิดพลาด ให้เรียก complete_goal(status="FAIL", summary="...") พร้อมระบุ defects
5. ทุกครั้งที่ตัดสินใจ ให้ระบุเหตุผล (reason) เป็นภาษาไทยที่ชัดเจน เป็นทางการ และมีหลักการทดสอบที่ดี`
}

export interface AgentPromptContext {
  role: UserRole
  goal: string
  url: string
  stepNumber: number
  maxSteps: number
  compactDOM: string
  previousSteps: Array<{ step: number; tool: string; result: string }>
}

export interface AgentDecision {
  thought: string
  tool: string
  args: Record<string, unknown>
}

export class GeminiUATClient {
  private apiKey: string
  private model: string
  private timeoutMs: number

  constructor(config: UATConfig) {
    if (!config.apiKey || !config.apiKey.trim()) {
      throw new Error('GEMINI_API_KEY ไม่ถูกต้องหรือยังไม่ได้ตั้งค่า กรุณาระบุใน .env.local หรือ environment variable')
    }
    this.apiKey = config.apiKey.trim()
    this.model = config.model || 'gemini-2.5-flash'
    this.timeoutMs = config.timeoutMs || 45000
  }

  async decideNextAction(context: AgentPromptContext): Promise<AgentDecision> {
    const systemPrompt = formatSystemPrompt(context.role, context.goal)

    const userMessage = `[ขั้นตอนที่ ${context.stepNumber} จาก ${context.maxSteps}]
URL ปัจจุบัน: ${context.url}

สถานะหน้าจอ (Interactive Elements):
${context.compactDOM}

ประวัติการกระทำก่อนหน้านี้:
${context.previousSteps.length === 0 ? '(เพิ่งเริ่มต้น ยังไม่มีประวัติ)' : context.previousSteps.map(p => `สเต็ป ${p.step}: ${p.tool} -> ${p.result}`).join('\n')}

กรุณาเลือก Action ถัดไปผ่าน Function Calling Tool เพื่อบรรลุเป้าหมาย:`

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`

    const requestBody = {
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userMessage }],
        },
      ],
      tools: [
        {
          functionDeclarations: UAT_TOOL_DECLARATIONS,
        },
      ],
      toolConfig: {
        functionCallingConfig: {
          mode: 'ANY',
        },
      },
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Gemini API Error HTTP ${response.status}: ${errorText}`)
      }

      const data = await response.json()
      const candidate = data.candidates?.[0]
      const call = candidate?.content?.parts?.find((p: { functionCall?: unknown }) => Boolean(p.functionCall))?.functionCall

      if (!call) {
        throw new Error('Gemini ไม่ได้ตอบกลับมาเป็น Function Call ที่ถูกต้อง')
      }

      const thought = candidate?.content?.parts?.find((p: { text?: string }) => Boolean(p.text))?.text || call.args?.reason || `Action: ${call.name}`

      return {
        thought: String(thought),
        tool: call.name,
        args: call.args || {},
      }
    } finally {
      clearTimeout(timeout)
    }
  }
}
