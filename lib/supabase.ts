import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// 클라이언트용 (브라우저)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 서버용 (관리자 권한)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
