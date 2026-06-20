import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const store_name = sp.get('store_name')
  const account_holder = sp.get('account_holder')
  const status = sp.get('status')
  const limit = parseInt(sp.get('limit') || '500')
  const page = parseInt(sp.get('page') || '1')
  const offset = (page - 1) * limit

  // review_applications 조회
  let query = supabaseAdmin
    .from('review_applications')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (store_name) query = query.eq('store_name', store_name)
  if (account_holder) query = query.ilike('account_holder', `%${account_holder}%`)
  if (status) query = query.eq('status', status)

  const { data: apps, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // review_submissions 조회 (application_id 기준으로 JOIN)
  const appIds = (apps || []).map((a: { id: string }) => a.id)
  let submissions: Record<string, {
    id: string; review_images: string[]; review_checked: boolean;
    review_check_note: string; payment_done: boolean; payment_done_at: string | null; submitted_at: string
  }> = {}

  if (appIds.length > 0) {
    const { data: subs } = await supabaseAdmin
      .from('review_submissions')
      .select('id, application_id, review_images, review_checked, review_check_note, payment_done, payment_done_at, submitted_at')
      .in('application_id', appIds)

    if (subs) {
      subs.forEach((s: { application_id: string; id: string; review_images: string[]; review_checked: boolean; review_check_note: string; payment_done: boolean; payment_done_at: string | null; submitted_at: string }) => {
        submissions[s.application_id] = s
      })
    }
  }

  // 합치기
  const merged = (apps || []).map((app: Record<string, unknown>) => {
    const sub = submissions[app.id as string]
    return {
      ...app,
      submission_id: sub?.id || null,
      review_images: sub?.review_images || [],
      review_checked: sub?.review_checked || false,
      review_check_note: sub?.review_check_note || '',
      payment_done: sub?.payment_done || false,
      payment_done_at: sub?.payment_done_at || null,
      submitted_at: sub?.submitted_at || null,
    }
  })

  return NextResponse.json({ data: merged, total: count, page, limit })
}
