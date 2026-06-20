import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function parseOrderLine(line: string) {
  const parts = line.split('/')
  // 금액: 숫자/쉼표/원 이외 문자 제거 → 순수 숫자만 추출
  const rawAmount = parts[7]?.trim() || ''
  const amount = rawAmount.replace(/[^0-9]/g, '') || rawAmount
  return {
    order_number: parts[0]?.trim() || '',
    recipient: parts[1]?.trim() || '',
    phone: parts[2]?.trim() || '',
    address: parts[3]?.trim() || '',
    bank_name: parts[4]?.trim() || '',
    account_number: parts[5]?.trim() || '',
    account_holder: parts[6]?.trim() || '',
    amount,
  }
}

// POST: 신청 제출 (여러 줄, 동시성 안전)
export async function POST(req: NextRequest) {
  try {
    const { store_name, purchase_type, order_info, purchase_images } = await req.json()
    if (!store_name?.trim()) return NextResponse.json({ error: '스토어명을 선택하세요.' }, { status: 400 })
    if (!order_info?.trim()) return NextResponse.json({ error: '주문 정보를 입력하세요.' }, { status: 400 })

    const lines = order_info.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0)
    if (lines.length === 0) return NextResponse.json({ error: '유효한 주문 정보가 없습니다.' }, { status: 400 })

    const records = lines.map((line: string) => {
      const p = parseOrderLine(line)
      if (!p.account_holder) throw new Error(`예금주가 없는 줄: "${line}"`)
      return {
        store_name: store_name.trim(),
        order_info: line,
        order_number: p.order_number,
        recipient: p.recipient,
        phone: p.phone,
        address: p.address,
        bank_name: p.bank_name,
        account_number: p.account_number,
        account_holder: p.account_holder,
        amount: p.amount,
        purchase_type: purchase_type || null,
        purchase_images: purchase_images || [],
        status: '대기중',
      }
    })

    const { data, error } = await supabaseAdmin.from('review_applications').insert(records).select()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, count: data.length, data })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : '오류' }, { status: 500 })
  }
}

// GET: 예금주명으로 조회
export async function GET(req: NextRequest) {
  const holder = new URL(req.url).searchParams.get('account_holder')?.trim()
  if (!holder) return NextResponse.json({ error: '예금주명을 입력하세요.' }, { status: 400 })
  const { data, error } = await supabaseAdmin
    .from('review_applications')
    .select('*')
    .eq('account_holder', holder)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
