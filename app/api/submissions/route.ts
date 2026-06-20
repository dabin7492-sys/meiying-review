import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// POST: 리뷰 제출 (동시성 안전)
export async function POST(req: NextRequest) {
  try {
    const { application_ids, review_images } = await req.json()
    if (!application_ids || application_ids.length === 0)
      return NextResponse.json({ error: '제출할 신청 건을 선택하세요.' }, { status: 400 })

    const { data: apps, error: fetchError } = await supabaseAdmin
      .from('review_applications')
      .select('*')
      .in('id', application_ids)

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
    if (!apps || apps.length === 0) return NextResponse.json({ error: '신청 내역을 찾을 수 없습니다.' }, { status: 404 })

    const records = apps.map((app) => ({
      application_id: app.id,
      account_holder: app.account_holder,
      store_name: app.store_name,
      order_number: app.order_number,
      recipient: app.recipient,
      phone: app.phone,
      address: app.address,
      bank_name: app.bank_name,
      account_number: app.account_number,
      amount: app.amount,
      review_images: review_images || [],
    }))

    const { data: submissions, error: insertError } = await supabaseAdmin
      .from('review_submissions')
      .insert(records)
      .select()

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

    // 상태 업데이트
    await supabaseAdmin
      .from('review_applications')
      .update({ status: '리뷰제출완료' })
      .in('id', application_ids)

    return NextResponse.json({ success: true, count: submissions.length, data: submissions })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : '오류' }, { status: 500 })
  }
}

// GET: 관리자용 제출 내역 조회
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const store_name = sp.get('store_name')
  const account_holder = sp.get('account_holder')
  const limit = parseInt(sp.get('limit') || '200')
  const page = parseInt(sp.get('page') || '1')
  const offset = (page - 1) * limit

  let query = supabaseAdmin
    .from('review_submissions')
    .select('*', { count: 'exact' })
    .order('submitted_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (store_name) query = query.eq('store_name', store_name)
  if (account_holder) query = query.ilike('account_holder', `%${account_holder}%`)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, total: count, page, limit })
}
