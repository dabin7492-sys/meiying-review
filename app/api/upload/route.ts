import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Vercel 요청 크기 제한 해제 (기본 4.5MB → 무제한)
export const config = {
  api: {
    bodyParser: false,
  },
}

// POST: 이미지 업로드 (순차 처리로 안정성 향상)
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const files = formData.getAll('files') as File[]
    const folder = (formData.get('folder') as string) || 'misc'

    if (!files || files.length === 0)
      return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })

    const urls: string[] = []
    const errors: string[] = []

    // 순차 업로드 (병렬 시 메모리/타임아웃 문제 방지)
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      try {
        const timestamp = Date.now()
        const random = Math.random().toString(36).substring(2, 8)
        const ext = file.name.split('.').pop() || 'jpg'
        const path = `${folder}/${timestamp}_${random}.${ext}`

        const buffer = new Uint8Array(await file.arrayBuffer())

        const { error } = await supabaseAdmin.storage
          .from('suzzzy-review-images')
          .upload(path, buffer, { contentType: file.type, upsert: false })

        if (error) throw new Error(error.message)

        const { data: urlData } = supabaseAdmin.storage
          .from('suzzzy-review-images')
          .getPublicUrl(path)

        urls.push(urlData.publicUrl)
      } catch (e: unknown) {
        errors.push(`파일 ${i + 1}: ${e instanceof Error ? e.message : '업로드 실패'}`)
      }
    }

    if (urls.length === 0)
      return NextResponse.json({ error: '모든 파일 업로드 실패: ' + errors.join(', ') }, { status: 500 })

    return NextResponse.json({ urls, errors: errors.length > 0 ? errors : undefined })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : '오류' }, { status: 500 })
  }
}
