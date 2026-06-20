import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// PATCH: 관리자 - 리뷰 확인 / 입금 처리
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { review_checked, review_check_note, payment_done } = body

    const updateData: Record<string, unknown> = {}
    if (review_checked !== undefined) updateData.review_checked = review_checked
    if (review_check_note !== undefined) updateData.review_check_note = review_check_note
    if (payment_done !== undefined) {
      updateData.payment_done = payment_done
      updateData.payment_done_at = payment_done ? new Date().toISOString() : null
    }

    if (Object.keys(updateData).length === 0)
      return NextResponse.json({ error: '업데이트할 항목이 없습니다.' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('review_submissions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : '오류' }, { status: 500 })
  }
}
