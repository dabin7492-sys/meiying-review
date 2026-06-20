import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  // review_type 컬럼 추가 (없으면)
  // Supabase에서는 직접 ALTER TABLE을 REST API로 실행할 수 없으므로
  // 테스트 insert/select로 컬럼 존재 여부 확인
  const { data, error } = await supabaseAdmin
    .from('review_applications')
    .select('review_type, review_type_assigned')
    .limit(1)

  if (error && error.message.includes('column')) {
    return NextResponse.json({ 
      error: 'review_type 컬럼이 없습니다. Supabase SQL Editor에서 아래 SQL을 실행해주세요.',
      sql: `ALTER TABLE review_applications ADD COLUMN IF NOT EXISTS review_type TEXT DEFAULT NULL;
ALTER TABLE review_applications ADD COLUMN IF NOT EXISTS review_type_assigned BOOLEAN DEFAULT FALSE;`
    }, { status: 400 })
  }

  return NextResponse.json({ ok: true, message: 'review_type 컬럼이 존재합니다.', sample: data })
}
