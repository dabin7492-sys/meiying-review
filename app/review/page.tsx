'use client'

import { useState, useEffect, useRef } from 'react'

interface Store { id: string; name: string }
interface Application {
  id: string; store_name: string; order_number: string; recipient: string
  amount: string; purchase_images: string[]
  status: string; created_at: string
  review_type: string | null
}

const REVIEW_FEE: Record<string, number> = { text: 1000, photo: 1000, star: 500 }
const REVIEW_LABEL: Record<string, string> = { text: '텍스트', photo: '포토', star: '별점' }

const FORMAT = '이름/주문번호/금액'

function validateLine(line: string): { ok: boolean; errors: string[] } {
  const parts = line.split('/')
  const errors: string[] = []
  if (parts.length !== 3) {
    errors.push(`항목이 ${parts.length}개입니다 (/ 가 ${parts.length - 1}개, 2개여야 함)`)
    return { ok: false, errors }
  }
  const [name, orderNum, amount] = parts
  if (!name?.trim()) errors.push('이름이 비어있습니다')
  if (!orderNum?.trim()) errors.push('주문번호가 비어있습니다')
  if (!amount?.trim()) errors.push('금액이 비어있습니다')
  return { ok: errors.length === 0, errors }
}

function Toast({ msg, type, onClose }: { msg: string; type: 'success' | 'error' | 'info'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t) }, [onClose])
  const colors = { success: '#27ae60', error: '#e74c3c', info: '#e67e22' }
  const icons = { success: '✅', error: '❌', info: 'ℹ️' }
  return (
    <div style={{
      position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
      background: 'white', borderLeft: `4px solid ${colors[type]}`,
      borderRadius: 10, padding: '14px 20px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      zIndex: 9999, minWidth: 280, maxWidth: 360, display: 'flex', alignItems: 'center', gap: 10,
      animation: 'slideDown 0.3s ease',
    }}>
      <span style={{ fontSize: 18 }}>{icons[type]}</span>
      <span style={{ fontSize: 14, color: '#333', flex: 1 }}>{msg}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: 18, padding: 0, lineHeight: 1 }}>×</button>
    </div>
  )
}

export default function ReviewPage() {
  const [activeTab, setActiveTab] = useState<1 | 2>(1)
  const [copied, setCopied] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null)

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => setToast({ msg, type })

  const [stores, setStores] = useState<Store[]>([])
  const [selectedStore, setSelectedStore] = useState('')
  const [purchaseType, setPurchaseType] = useState('')
  const [orderInfo, setOrderInfo] = useState('')
  const [purchaseFiles, setPurchaseFiles] = useState<File[]>([])
  const [purchasePreviews, setPurchasePreviews] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitLog, setSubmitLog] = useState<string[]>([])
  const purchaseRef = useRef<HTMLInputElement>(null)

  const [searchName, setSearchName] = useState('')
  const [applications, setApplications] = useState<Application[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [reviewFiles, setReviewFiles] = useState<File[]>([])
  const [reviewPreviews, setReviewPreviews] = useState<string[]>([])
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const reviewRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/stores').then(r => r.json()).then(d => setStores(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  const copyFormat = () => {
    navigator.clipboard.writeText(FORMAT).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const addFiles = (files: File[], setF: React.Dispatch<React.SetStateAction<File[]>>, setP: React.Dispatch<React.SetStateAction<string[]>>) => {
    setF(prev => [...prev, ...files])
    files.forEach(f => {
      const r = new FileReader()
      r.onloadend = () => setP(prev => [...prev, r.result as string])
      r.readAsDataURL(f)
    })
  }

  const removeFile = (i: number, setF: React.Dispatch<React.SetStateAction<File[]>>, setP: React.Dispatch<React.SetStateAction<string[]>>) => {
    setF(prev => prev.filter((_, j) => j !== i))
    setP(prev => prev.filter((_, j) => j !== i))
  }

  const compressImage = (file: File): Promise<File> => {
    return new Promise(resolve => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        const MAX = 1200
        let { width, height } = img
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX }
          else { width = Math.round(width * MAX / height); height = MAX }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width; canvas.height = height
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
        canvas.toBlob(blob => {
          URL.revokeObjectURL(url)
          if (blob) resolve(new File([blob], file.name, { type: 'image/jpeg' }))
          else resolve(file)
        }, 'image/jpeg', 0.75)
      }
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
      img.src = url
    })
  }

  const uploadImages = async (files: File[], folder: string): Promise<string[]> => {
    if (!files.length) return []
    const compressed = await Promise.all(files.map(f => compressImage(f)))
    const results = await Promise.allSettled(
      compressed.map(async file => {
        const fd = new FormData()
        fd.append('files', file)
        fd.append('folder', folder)
        const res = await fetch('/api/upload', { method: 'POST', body: fd })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || '이미지 업로드 실패')
        return data.urls?.[0] as string
      })
    )
    return results.filter(r => r.status === 'fulfilled').map(r => (r as PromiseFulfilledResult<string>).value).filter(Boolean)
  }

  const validationResults = orderInfo.trim()
    ? orderInfo.trim().split('\n').filter(l => l.trim()).map((line, i) => ({
        line: i + 1, text: line, ...validateLine(line),
      }))
    : []
  const hasErrors = validationResults.some(r => !r.ok)

  // 양식에서 이름/주문번호/금액 파싱
  const parseOrderLine = (line: string) => {
    const parts = line.split('/')
    return {
      recipient: parts[0]?.trim() || '',
      order_number: parts[1]?.trim() || '',
      amount: parts[2]?.trim().replace(/[^0-9]/g, '') || '',
    }
  }

  const handleApply = async () => {
    if (!selectedStore) { showToast('제품을 선택하세요.', 'info'); return }
    if (!orderInfo.trim()) { showToast('주문 정보를 입력하세요.', 'info'); return }
    if (hasErrors) { showToast('입력 형식 오류가 있습니다. 빨간 줄을 확인해주세요.', 'error'); return }
    if (purchaseFiles.length === 0) { showToast('구매 캡쳐를 1장 이상 첨부해주세요. (필수)', 'error'); return }
    setSubmitting(true)
    setSubmitLog(['데이터 분석 중...'])
    try {
      setSubmitLog(p => [...p, `구매 캡쳐 ${purchaseFiles.length}장 업로드 중...`])
      const imageUrls = await uploadImages(purchaseFiles, 'purchase')
      setSubmitLog(p => [...p, `업로드 완료 (${imageUrls.length}장)`])

      // 각 줄을 개별 신청으로 처리
      const lines = orderInfo.trim().split('\n').filter(l => l.trim())
      const records = lines.map(line => {
        const p = parseOrderLine(line)
        return {
          store_name: selectedStore,
          purchase_type: purchaseType || null,
          order_info: line,
          order_number: p.order_number,
          recipient: p.recipient,
          phone: '',
          address: '',
          bank_name: '',
          account_number: '',
          account_holder: p.recipient,
          amount: p.amount,
          purchase_images: imageUrls,
        }
      })

      setSubmitLog(p => [...p, '서버에 신청 정보 전송 중...'])
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_name: selectedStore,
          purchase_type: purchaseType || null,
          order_info: orderInfo,
          purchase_images: imageUrls,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSubmitLog(p => [...p, `✅ ${data.count}건 신청 완료!`])
      showToast(`${data.count}건 신청이 완료되었습니다!`, 'success')
      setSelectedStore(''); setPurchaseType(''); setOrderInfo('')
      setPurchaseFiles([]); setPurchasePreviews([])
      setTimeout(() => setSubmitLog([]), 3000)
    } catch {
      setSubmitLog(p => [...p, '❌ 오류가 발생했습니다.'])
      showToast('오류가 발생했습니다. 다시 시도해주세요.', 'error')
    } finally { setSubmitting(false) }
  }

  const handleSearch = async () => {
    if (!searchName.trim()) { showToast('이름을 입력하세요.', 'info'); return }
    setSearching(true); setApplications([]); setSelectedIds(new Set())
    try {
      const res = await fetch(`/api/applications?account_holder=${encodeURIComponent(searchName.trim())}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const list = Array.isArray(data) ? data : []
      setApplications(list)
      if (list.length === 0) showToast('조회되는 이름이 없습니다. 다시 확인해주세요.', 'info')
    } catch {
      showToast('조회 중 오류가 발생했습니다. 다시 시도해주세요.', 'error')
    }
    finally { setSearching(false) }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  const toggleAll = () => {
    const pending = applications.filter(a => a.status !== '리뷰제출완료')
    setSelectedIds(selectedIds.size === pending.length ? new Set() : new Set(pending.map(a => a.id)))
  }

  const handleReviewSubmit = async () => {
    if (!selectedIds.size) { showToast('제출할 신청 건을 선택하세요.', 'info'); return }
    if (!reviewFiles.length) { showToast('리뷰 이미지를 첨부하세요.', 'info'); return }
    setReviewSubmitting(true)
    try {
      const imageUrls = await uploadImages(reviewFiles, 'review')
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ application_ids: Array.from(selectedIds), review_images: imageUrls }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      showToast(`${data.count}건 리뷰 제출 완료!`, 'success')
      setReviewFiles([]); setReviewPreviews([])
      if (reviewRef.current) reviewRef.current.value = ''
      await handleSearch()
    } catch {
      showToast('제출 중 오류가 발생했습니다. 다시 시도해주세요.', 'error')
    }
    finally { setReviewSubmitting(false) }
  }

  const pendingCount = applications.filter(a => a.status !== '리뷰제출완료').length

  const PRIMARY = '#e67e22'
  const PRIMARY_DARK = '#d35400'
  const PRIMARY_LIGHT = '#f39c12'
  const BG = '#fff8f0'
  const BORDER = '#f0c080'
  const HEADER_GRAD = 'linear-gradient(135deg, #e67e22, #f39c12, #f5c842)'

  return (
    <div style={{ fontFamily: "'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif", background: BG, minHeight: '100vh', padding: '20px 15px' }}>
      <style>{`@keyframes slideDown { from { opacity:0; transform:translateX(-50%) translateY(-10px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }`}</style>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div style={{ background: 'white', borderRadius: 14, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', maxWidth: 640, margin: '0 auto', overflow: 'hidden' }}>

        {/* 헤더 */}
        <div style={{ background: HEADER_GRAD, padding: '22px 24px', textAlign: 'center' }}>
          <div style={{ color: 'white', fontSize: 22, fontWeight: 'bold', letterSpacing: 1, textShadow: '0 1px 3px rgba(0,0,0,0.15)' }}>🌟 MEIYING-review</div>
          <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12, marginTop: 4 }}>리뷰 모집 플랫폼</div>
        </div>

        {/* 탭 */}
        <div style={{ display: 'flex', borderBottom: `2px solid #fde8c8` }}>
          {([1, 2] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              flex: 1, padding: '14px', border: 'none', cursor: 'pointer',
              fontWeight: 'bold', fontSize: 14, transition: '0.2s',
              background: activeTab === tab ? PRIMARY : BG,
              color: activeTab === tab ? 'white' : PRIMARY_DARK,
            }}>
              {tab === 1 ? '📝 구매 제출' : '🔍 리뷰 제출 및 조회'}
            </button>
          ))}
        </div>

        <div style={{ padding: '24px' }}>

          {/* ── 탭1 ── */}
          {activeTab === 1 && (
            <div>
              <div style={fgStyle}>
                <label style={labelStyle}>1. 제품 선택</label>
                <select value={selectedStore} onChange={e => setSelectedStore(e.target.value)} style={{ ...inputStyle, borderColor: BORDER }}>
                  <option value="">제품을 선택하세요</option>
                  {stores.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>

              <div style={fgStyle}>
                <label style={labelStyle}>2. 주문 정보 입력</label>
                <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '14px 16px', marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>아래 양식에 맞게 입력해주세요 (여러 건은 줄바꿈)</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#333', background: 'white', border: `1px solid #fde8c8`, borderRadius: 6, padding: '10px 12px', marginBottom: 10, wordBreak: 'break-all', letterSpacing: 0.2 }}>
                    {FORMAT}
                  </div>
                  <button onClick={copyFormat}
                    style={{ width: '100%', padding: '11px', background: copied ? '#27ae60' : 'white', color: copied ? 'white' : PRIMARY_DARK, border: `2px solid ${copied ? '#27ae60' : PRIMARY}`, borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 'bold', transition: '0.2s', letterSpacing: 0.3 }}>
                    {copied ? '✅ 양식이 복사됩니다!' : '📋 양식 복사하기'}
                  </button>
                </div>

                <textarea value={orderInfo} onChange={e => setOrderInfo(e.target.value)} rows={6}
                  placeholder={`예시:\n홍길동/20240001/15000\n김철수/20240002/9900`}
                  style={{ ...inputStyle, resize: 'none', lineHeight: 1.6, fontFamily: 'inherit', borderColor: hasErrors ? '#e74c3c' : BORDER }} />

                {validationResults.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {validationResults.map((r, i) => (
                      <div key={i} style={{
                        padding: '6px 10px', borderRadius: 6, fontSize: 11, lineHeight: 1.6,
                        background: r.ok ? '#f0fdf4' : '#fff5f5',
                        border: `1px solid ${r.ok ? '#bbf7d0' : '#fecaca'}`,
                        color: r.ok ? '#166534' : '#991b1b',
                      }}>
                        {r.ok ? `✅ ${r.line}번째 줄 정상` : <>❌ <strong>{r.line}번째 줄</strong>: {r.errors.join(' / ')}</>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={fgStyle}>
                <label style={labelStyle}>3. 구매 캡쳐 첨부</label>
                <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontWeight: 'bold', fontSize: 13, color: PRIMARY_DARK }}>🛒 구매 캡쳐</span>
                    <span style={{ fontSize: 11, color: '#e74c3c', fontWeight: 'bold', background: '#fde8e8', padding: '2px 8px', borderRadius: 10 }}>1장 이상 필수</span>
                  </div>
                  <input ref={purchaseRef} type="file" accept="image/*" multiple id="purchase-file-input"
                    onChange={e => { addFiles(Array.from(e.target.files || []), setPurchaseFiles, setPurchasePreviews); e.target.value = '' }}
                    style={{ display: 'none' }} />
                  <label htmlFor="purchase-file-input" style={{ display: 'block', width: '100%', padding: '14px', background: `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_LIGHT})`, color: 'white', borderRadius: 8, textAlign: 'center', fontWeight: 'bold', fontSize: 15, cursor: 'pointer', boxSizing: 'border-box', letterSpacing: 0.5, boxShadow: `0 3px 10px rgba(230,126,34,0.35)` }}>
                    🛒 구매 캡쳐 사진 선택
                  </label>
                  {purchasePreviews.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                      {purchasePreviews.map((src, i) => (
                        <div key={i} style={{ position: 'relative' }}>
                          <img src={src} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: `1px solid ${BORDER}` }} />
                          <button onClick={() => removeFile(i, setPurchaseFiles, setPurchasePreviews)}
                            style={{ position: 'absolute', top: -6, right: -6, background: '#e74c3c', color: 'white', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: '20px' }}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {purchaseFiles.length > 0 && <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>{purchaseFiles.length}장 선택됨</div>}
                </div>
              </div>

              {submitLog.length > 0 && (
                <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 12, lineHeight: 1.8, color: '#666' }}>
                  {submitLog.map((log, i) => <div key={i}>· {log}</div>)}
                </div>
              )}

              <button onClick={handleApply} disabled={submitting}
                style={{ width: '100%', padding: '14px', color: 'white', border: 'none', fontWeight: 'bold', fontSize: 16, borderRadius: 8, marginTop: 4, background: submitting ? '#ccc' : `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_LIGHT})`, cursor: submitting ? 'not-allowed' : 'pointer' }}>
                {submitting ? '제출 중...' : '제출하기'}
              </button>
            </div>
          )}

          {/* ── 탭2 ── */}
          {activeTab === 2 && (
            <div>
              <h3 style={{ textAlign: 'center', color: PRIMARY_DARK, marginTop: 0, marginBottom: 24, fontSize: 17 }}>리뷰 제출 및 조회</h3>

              <div style={fgStyle}>
                <label style={labelStyle}>이름 입력</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="text" value={searchName} onChange={e => setSearchName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    placeholder="신청하신 이름을 입력하세요"
                    style={{ ...inputStyle, flex: 1, borderColor: BORDER }} />
                  <button onClick={handleSearch} disabled={searching}
                    style={{ padding: '10px 18px', background: PRIMARY, color: 'white', border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {searching ? '조회중' : '조회'}
                  </button>
                </div>
              </div>

              {applications.length > 0 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 13, color: '#555' }}>
                      총 <strong>{applications.length}</strong>건
                      {pendingCount > 0 && <span style={{ color: PRIMARY, marginLeft: 6 }}>(미제출 {pendingCount}건)</span>}
                    </span>
                    {pendingCount > 0 && (
                      <button onClick={toggleAll}
                        style={{ fontSize: 12, padding: '4px 12px', background: BG, border: `1px solid ${BORDER}`, borderRadius: 6, cursor: 'pointer', color: PRIMARY_DARK }}>
                        {selectedIds.size === pendingCount ? '전체 해제' : '전체 선택'}
                      </button>
                    )}
                  </div>

                  <div style={{ border: `1px solid #fde8c8`, borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
                    {applications.map((app, idx) => {
                      const isDone = app.status === '리뷰제출완료'
                      const isSel = selectedIds.has(app.id)
                      return (
                        <div key={app.id} onClick={() => !isDone && toggleSelect(app.id)}
                          style={{
                            padding: '14px 16px', borderBottom: idx < applications.length - 1 ? `1px solid #fde8c8` : 'none',
                            background: isDone ? '#fffaf5' : isSel ? '#fde8c8' : 'white',
                            cursor: isDone ? 'default' : 'pointer', display: 'flex', alignItems: 'flex-start', gap: 12, transition: 'background 0.15s',
                          }}>
                          <div style={{ paddingTop: 2, flexShrink: 0 }}>
                            {isDone ? <span style={{ fontSize: 20 }}>✅</span> : (
                              <div style={{ width: 20, height: 20, borderRadius: 4, border: `2px solid ${isSel ? PRIMARY : '#ddd'}`, background: isSel ? PRIMARY : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {isSel && <span style={{ color: 'white', fontSize: 13 }}>✓</span>}
                              </div>
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                              <span style={{ fontWeight: 'bold', fontSize: 14, color: '#333' }}>{app.store_name}</span>
                              <span style={{ padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 'bold', background: isDone ? '#d5f5e3' : '#fef9e7', color: isDone ? '#1e8449' : '#d68910' }}>
                                {app.status}
                              </span>
                            </div>
                            <div style={{ fontSize: 12, color: '#555', lineHeight: 1.8 }}>
                              이름: <strong>{app.recipient || '-'}</strong>
                              <span style={{ margin: '0 6px', color: '#ddd' }}>|</span>
                              주문번호: <strong>{app.order_number || '-'}</strong>
                            </div>
                            <div style={{ fontSize: 12, color: '#555', lineHeight: 1.8 }}>
                              {(() => {
                                const base = Number(String(app.amount || '').replace(/[^0-9]/g, '')) || 0
                                const fee = app.review_type ? (REVIEW_FEE[app.review_type] || 0) : 0
                                const total = base + fee
                                if (fee > 0) {
                                  return (
                                    <span>
                                      💰 입금 금액: <strong style={{ color: isDone ? '#27ae60' : PRIMARY, fontSize: 14 }}>{total.toLocaleString()}원</strong>
                                      <span style={{ fontSize: 11, color: '#999', marginLeft: 4 }}>
                                        (상품 {base.toLocaleString()}원 + {REVIEW_LABEL[app.review_type!]} {fee.toLocaleString()}원)
                                      </span>
                                    </span>
                                  )
                                }
                                return <span>상품 금액: <strong>{base > 0 ? base.toLocaleString() + '원' : '-'}</strong></span>
                              })()}
                            </div>
                            <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>
                              신청일: {new Date(app.created_at).toLocaleString('ko-KR')}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {selectedIds.size > 0 && (
                    <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 18, marginBottom: 16 }}>
                      <div style={{ fontWeight: 'bold', fontSize: 14, color: PRIMARY_DARK, marginBottom: 12 }}>
                        📎 리뷰 이미지 첨부 ({selectedIds.size}건 선택됨)
                      </div>
                      <input ref={reviewRef} type="file" accept="image/*" multiple id="review-file-input"
                        onChange={e => { addFiles(Array.from(e.target.files || []), setReviewFiles, setReviewPreviews); e.target.value = '' }}
                        style={{ display: 'none' }} />
                      <label htmlFor="review-file-input" style={{ display: 'block', width: '100%', padding: '14px', background: 'linear-gradient(135deg, #8e44ad, #6c3483)', color: 'white', borderRadius: 8, textAlign: 'center', fontWeight: 'bold', fontSize: 15, cursor: 'pointer', boxSizing: 'border-box', letterSpacing: 0.5, marginBottom: 8, boxShadow: '0 3px 10px rgba(142,68,173,0.35)' }}>
                        📸 리뷰 사진 선택
                      </label>
                      {reviewPreviews.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 12 }}>
                          {reviewPreviews.map((src, i) => (
                            <div key={i} style={{ position: 'relative' }}>
                              <img src={src} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: `1px solid ${BORDER}` }} />
                              <button onClick={() => removeFile(i, setReviewFiles, setReviewPreviews)}
                                style={{ position: 'absolute', top: -6, right: -6, background: '#e74c3c', color: 'white', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: '20px' }}>×</button>
                            </div>
                          ))}
                        </div>
                      )}
                      {reviewFiles.length > 0 && <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>{reviewFiles.length}장 선택됨</div>}
                      <button onClick={handleReviewSubmit} disabled={reviewSubmitting || !reviewFiles.length}
                        style={{ width: '100%', padding: '14px', color: 'white', border: 'none', fontWeight: 'bold', fontSize: 16, borderRadius: 8, background: reviewSubmitting || !reviewFiles.length ? '#ccc' : `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_LIGHT})`, cursor: reviewSubmitting || !reviewFiles.length ? 'not-allowed' : 'pointer' }}>
                        {reviewSubmitting ? '제출 중...' : `리뷰 제출하기 (${selectedIds.size}건)`}
                      </button>
                    </div>
                  )}
                </>
              )}

              {!searching && applications.length === 0 && searchName && (
                <div style={{ textAlign: 'center', color: '#999', padding: '40px 0', fontSize: 14 }}>신청된 내역이 없습니다.</div>
              )}
              {!searchName && (
                <div style={{ textAlign: 'center', color: '#ccc', padding: '40px 0', fontSize: 14 }}>이름을 입력하고 조회해 주세요.</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 하단 배너 */}
      <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', justifyContent: 'center', padding: '12px 0 20px' }}>
        <img src="/contact-banner.png" alt="모집 사이트 제작 문의" style={{ width: '280px', height: 'auto', display: 'block' }} />
      </div>
    </div>
  )
}

const fgStyle: React.CSSProperties = { marginBottom: 20 }
const labelStyle: React.CSSProperties = { display: 'block', fontWeight: 'bold', marginBottom: 6, fontSize: 14, color: '#555' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #f0c080', borderRadius: 8, boxSizing: 'border-box', fontSize: 14, outline: 'none' }
