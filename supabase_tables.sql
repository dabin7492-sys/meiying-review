-- =============================================
-- Suzzzy-review 테이블 생성 SQL
-- Supabase 대시보드 → SQL Editor에서 실행
-- =============================================

-- 1. 스토어 테이블
CREATE TABLE IF NOT EXISTS review_stores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 신청 테이블
CREATE TABLE IF NOT EXISTS review_applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_name TEXT NOT NULL,
  order_info TEXT NOT NULL,
  order_number TEXT,
  recipient TEXT,
  phone TEXT,
  address TEXT,
  bank_name TEXT,
  account_number TEXT,
  account_holder TEXT NOT NULL,
  amount TEXT,
  purchase_images TEXT[],
  status TEXT DEFAULT '대기중',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 리뷰 제출 테이블
CREATE TABLE IF NOT EXISTS review_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID REFERENCES review_applications(id) ON DELETE CASCADE,
  account_holder TEXT NOT NULL,
  store_name TEXT NOT NULL,
  order_number TEXT,
  recipient TEXT,
  phone TEXT,
  address TEXT,
  bank_name TEXT,
  account_number TEXT,
  amount TEXT,
  review_images TEXT[],
  review_checked BOOLEAN DEFAULT FALSE,
  review_check_note TEXT DEFAULT '',
  payment_done BOOLEAN DEFAULT FALSE,
  payment_done_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_apps_holder ON review_applications(account_holder);
CREATE INDEX IF NOT EXISTS idx_apps_store ON review_applications(store_name);
CREATE INDEX IF NOT EXISTS idx_apps_status ON review_applications(status);
CREATE INDEX IF NOT EXISTS idx_subs_holder ON review_submissions(account_holder);
CREATE INDEX IF NOT EXISTS idx_subs_app_id ON review_submissions(application_id);
CREATE INDEX IF NOT EXISTS idx_subs_store ON review_submissions(store_name);
CREATE INDEX IF NOT EXISTS idx_subs_payment ON review_submissions(payment_done);
CREATE INDEX IF NOT EXISTS idx_subs_review ON review_submissions(review_checked);

-- RLS 비활성화 (서비스 키 사용)
ALTER TABLE review_stores DISABLE ROW LEVEL SECURITY;
ALTER TABLE review_applications DISABLE ROW LEVEL SECURITY;
ALTER TABLE review_submissions DISABLE ROW LEVEL SECURITY;
