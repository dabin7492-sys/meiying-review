import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  // review_type, review_type_assigned 업데이트 (applications 테이블)
  if (body.review_type !== undefined || body.review_type_assigned !== undefined) {
    const updateData: Record<string, unknown> = {}
    if (body.review_type !== undefined) updateData.review_type = body.review_type
    if (body.review_type_assigned !== undefined) updateData.review_type_assigned = body.review_type_assigned
    const { data: updated, error } = await supabaseAdmin
      .from('review_applications')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(updated)
  }

  // review_applications에서 확인
  const { data: app, error: appErr } = await supabaseAdmin
    .from('review_applications')
    .select('id')
    .eq('id', id)
    .single()

  if (appErr || !app) return NextResponse.json({ error: '신청 건을 찾을 수 없습니다.' }, { status: 404 })

  // review_submissions에서 해당 application_id 찾기
  const { data: sub, error: subErr } = await supabaseAdmin
    .from('review_submissions')
    .select('id')
    .eq('application_id', id)
    .single()

  if (subErr || !sub) return NextResponse.json({ error: '제출된 리뷰가 없습니다.' }, { status: 404 })

  // 업데이트할 필드 구성
  const updateData: Record<string, unknown> = {}
  if (typeof body.review_checked === 'boolean') updateData.review_checked = body.review_checked
  if (typeof body.review_check_note === 'string') updateData.review_check_note = body.review_check_note
  if (typeof body.payment_done === 'boolean') {
    updateData.payment_done = body.payment_done
    updateData.payment_done_at = body.payment_done ? new Date().toISOString() : null
  }

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('review_submissions')
    .update(updateData)
    .eq('id', sub.id)
    .select()
    .single()

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // 프론트에서 apps 상태 업데이트를 위해 application_id 기준으로 머지된 데이터 반환
  return NextResponse.json({
    id,  // application id
    review_checked: updated.review_checked,
    review_check_note: updated.review_check_note,
    payment_done: updated.payment_done,
    payment_done_at: updated.payment_done_at,
  })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // review_submissions 먼저 삭제
  await supabaseAdmin.from('review_submissions').delete().eq('application_id', id)

  // review_applications 삭제
  const { error } = await supabaseAdmin.from('review_applications').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
