'use client'

import { useState, useEffect, useCallback } from 'react'

interface Store { id: string; name: string }
interface AppRow {
  id: string; store_name: string; order_number: string; recipient: string
  phone: string; address: string; bank_name: string; account_number: string
  account_holder: string; amount: string; purchase_images: string[]
  review_images: string[]; review_checked: boolean; review_check_note: string
  payment_done: boolean; payment_done_at: string | null
  status: string; created_at: string; submitted_at: string | null
  review_type: string | null; review_type_assigned: boolean
  purchase_type: string | null
}
type Tab = 'applications' | 'stores'

const REVIEW_TYPES = [
  { key: 'text', label: '텍스트', icon: '📝', amount: 1000, color: '#3498db' },
  { key: 'photo', label: '포토', icon: '📸', amount: 1000, color: '#9b59b6' },
  { key: 'star', label: '별점', icon: '⭐', amount: 500, color: '#f39c12' },
]

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('applications')
  const [stores, setStores] = useState<Store[]>([])
  const [newStore, setNewStore] = useState('')
  const [storeLoading, setStoreLoading] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)

  // 신청 내역
  const [apps, setApps] = useState<AppRow[]>([])
  const [appLoading, setAppLoading] = useState(false)
  const [afStore, setAfStore] = useState('')
  const [afHolder, setAfHolder] = useState('')
  const [afStatus, setAfStatus] = useState('')
  const [afDate, setAfDate] = useState('')  // 날짜 필터
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [noteEdit, setNoteEdit] = useState<{ id: string; val: string } | null>(null)

  // 삭제 모드
  const [deleteMode, setDeleteMode] = useState(false)
  const [deleteSelectedIds, setDeleteSelectedIds] = useState<string[]>([])

  const toggleDeleteSelect = (id: string) => {
    setDeleteSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const deleteSelected = async () => {
    if (deleteSelectedIds.length === 0) { alert('삭제할 항목을 선택하세요.'); return }
    if (!confirm(`선택한 ${deleteSelectedIds.length}건을 삭제하시겠습니까? 복구할 수 없습니다.`)) return
    await Promise.all(deleteSelectedIds.map(id =>
      fetch(`/api/applications/admin/${id}`, { method: 'DELETE' })
    ))
    setApps(prev => prev.filter(a => !deleteSelectedIds.includes(a.id)))
    setDeleteSelectedIds([])
    setDeleteMode(false)
  }

  // 리뷰 유형 배치 모드
  const [assignMode, setAssignMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])  // 순서 있는 배열
  const [typeConfig, setTypeConfig] = useState<{ key: string; count: number }[]>([
    { key: 'text', count: 0 },
    { key: 'photo', count: 0 },
    { key: 'star', count: 0 },
  ])

  const loadStores = useCallback(async () => {
    const r = await fetch('/api/stores'); const d = await r.json()
    setStores(Array.isArray(d) ? d : [])
  }, [])

  const loadApps = useCallback(async () => {
    setAppLoading(true)
    try {
      const p = new URLSearchParams({ limit: '500' })
      if (afHolder) p.set('account_holder', afHolder)
      const r = await fetch(`/api/applications/admin?${p}`); const d = await r.json()
      setApps(Array.isArray(d.data) ? d.data : [])
    } finally { setAppLoading(false) }
  }, [afHolder])

  useEffect(() => { loadStores() }, [loadStores])
  useEffect(() => { if (tab === 'applications') loadApps() }, [tab, loadApps])

  const addStore = async () => {
    if (!newStore.trim()) return
    setStoreLoading(true)
    try {
      const r = await fetch('/api/stores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newStore.trim() }) })
      const d = await r.json()
      if (!r.ok) { alert(d.error); return }
      setNewStore(''); await loadStores()
    } finally { setStoreLoading(false) }
  }

  const deleteStore = async (id: string, name: string) => {
    if (!confirm(`"${name}" 스토어를 삭제하시겠습니까?`)) return
    await fetch('/api/stores', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    await loadStores()
  }

  const deleteApp = async (id: string) => {
    if (!confirm('이 신청 건을 삭제하시겠습니까? 복구할 수 없습니다.')) return
    const r = await fetch(`/api/applications/admin/${id}`, { method: 'DELETE' })
    if (r.ok) {
      setApps(prev => prev.filter(a => a.id !== id))
      setExpandedId(null)
    } else {
      alert('삭제 중 오류가 발생했습니다.')
    }
  }

  const patchApp = async (id: string, data: Partial<{ review_checked: boolean; review_check_note: string; payment_done: boolean; review_type: string | null; review_type_assigned: boolean }>) => {
    const r = await fetch(`/api/applications/admin/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    const d = await r.json()
    if (!r.ok) { alert(d.error || '오류가 발생했습니다'); return }
    // API가 반환하는 id는 항상 application id
    const appId = d.id || id
    setApps(prev => prev.map(a => a.id === appId ? { ...a, ...d, id: appId } : a))
  }

  const saveNote = async (id: string) => {
    if (!noteEdit || noteEdit.id !== id) return
    await patchApp(id, { review_check_note: noteEdit.val })
    setNoteEdit(null)
  }

  // 리뷰 유형 배치 실행 (랜덤 배정)
  const applyReviewTypes = async () => {
    const total = typeConfig.reduce((s, c) => s + c.count, 0)
    if (total === 0) { alert('리뷰 유형 인원을 설정하세요.'); return }
    if (selectedIds.length === 0) { alert('배치할 신청 건을 선택하세요.'); return }
    if (total < selectedIds.length) {
      if (!confirm(`설정 인원(${total}명)이 선택 인원(${selectedIds.length}명)보다 적습니다. 나머지는 미배정됩니다. 계속하시겠습니까?`)) return
    }

    // 타입 배열 생성 (텍스트 → 포토 → 별점 순서대로)
    const typePool: string[] = []
    typeConfig.forEach(tc => {
      for (let i = 0; i < tc.count; i++) typePool.push(tc.key)
    })

    const promises = selectedIds.map((id, idx) => {
      const reviewType = typePool[idx] || null
      return patchApp(id, { review_type: reviewType, review_type_assigned: !!typePool[idx] })
    })
    await Promise.all(promises)
    setAssignMode(false)
    setSelectedIds([])

    // 결과 요약
    const summary = typeConfig.filter(c => c.count > 0).map(c => {
      const rt = REVIEW_TYPES.find(t => t.key === c.key)
      return `${rt?.icon} ${rt?.label} ${c.count}명`
    }).join(', ')
    alert(`랜덤 배정 완료!\n${summary}\n총 ${Math.min(selectedIds.length, total)}건 배정`)
  }

  // 날짜 목록 (신청 내역에서 unique 날짜)
  const availableDates = Array.from(new Set(
    apps.map(a => a.created_at.slice(0, 10))
  )).sort((a, b) => b.localeCompare(a))

  const appFiltered = apps.filter(a => {
    if (afStore && a.store_name !== afStore) return false
    if (afDate && a.created_at.slice(0, 10) !== afDate) return false
    if (afStatus === 'pending' && a.status === '리뷰제출완료') return false
    // 리뷰 제출됨 = 리뷰제출완료 + 미확인(review_checked=false)
    if (afStatus === 'submitted' && !(a.status === '리뷰제출완료' && !a.review_checked)) return false
    if (afStatus === 'unchecked' && (a.review_checked || a.status !== '리뷰제출완료')) return false
    // 입금 대기 = 리뷰제출완료 + 확인됨(review_checked=true) + 미입금
    if (afStatus === 'unpaid' && !(a.status === '리뷰제출완료' && a.review_checked && !a.payment_done)) return false
    if (afStatus === 'paid' && !a.payment_done) return false
    return true
  })

  const stats = {
    total: apps.length,
    pending: apps.filter(a => a.status !== '리뷰제출완료').length,
    // 리뷰 제출됨 = 리뷰제출완료 + 미확인
    submitted: apps.filter(a => a.status === '리뷰제출완료' && !a.review_checked).length,
    unchecked: apps.filter(a => a.status === '리뷰제출완료' && !a.review_checked).length,
    // 입금 대기 = 리뷰제출완료 + 확인됨 + 미입금
    unpaid: apps.filter(a => a.status === '리뷰제출완료' && a.review_checked && !a.payment_done).length,
    paid: apps.filter(a => a.payment_done).length,
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const getReviewTypeInfo = (key: string | null) => {
    if (!key) return null
    return REVIEW_TYPES.find(t => t.key === key) || null
  }

  // CSV 다운로드
  const downloadCSV = () => {
    const data = appFiltered
    if (data.length === 0) { alert('다운로드할 데이터가 없습니다.'); return }

    const headers = ['번호', '신청일', '스토어명', '구매유형', '상태', '주문번호', '수취인', '연락처', '주소', '은행명', '계좌번호', '예금주', '금액', '리뷰유형', '리뷰확인', '입금완료', '입금처리일', '메모']
    const rows = data.map((a, i) => {
      const rtInfo = getReviewTypeInfo(a.review_type)
      return [
        i + 1,
        new Date(a.created_at).toLocaleString('ko-KR'),
        a.store_name,
        a.purchase_type || '',
        a.status,
        a.order_number,
        a.recipient,
        a.phone,
        a.address,
        a.bank_name,
        a.account_number,
        a.account_holder,
        a.amount,
        rtInfo ? `${rtInfo.label}(${rtInfo.amount}원)` : '',
        a.review_checked ? 'O' : '',
        a.payment_done ? 'O' : '',
        a.payment_done_at ? new Date(a.payment_done_at).toLocaleString('ko-KR') : '',
        a.review_check_note || '',
      ]
    })

    const csvContent = '\uFEFF' + [headers, ...rows]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `suzzzy-review_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ fontFamily: "'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif", background: '#f0f2f5', minHeight: '100vh' }}>

      {/* 라이트박스 */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
          <img src={lightbox} alt="" style={{ maxWidth: '92vw', maxHeight: '92vh', borderRadius: 10, boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }} />
          <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 18, right: 22, background: 'none', border: 'none', color: 'white', fontSize: 34, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>
      )}

      {/* 헤더 */}
      <div style={{ background: 'linear-gradient(135deg, #1a252f, #2c3e50)', color: 'white', padding: '16px 24px' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 'bold' }}>🛠 MeiYing-review 관리자</div>
            <div style={{ fontSize: 12, color: '#95a5a6', marginTop: 2 }}>Review Management Dashboard</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['applications', 'stores'] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: '8px 16px', border: 'none', borderRadius: 8, cursor: 'pointer',
                fontWeight: 'bold', fontSize: 13,
                background: tab === t ? '#3498db' : 'rgba(255,255,255,0.12)',
                color: 'white',
              }}>
                {t === 'applications' ? '📝 신청 내역' : '🏪 제품 관리'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: '20px 24px', maxWidth: 1400, margin: '0 auto' }}>

        {/* ══ 신청 내역 ══ */}
        {tab === 'applications' && (
          <div>
            {/* 통계 카드 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
              {[
                { label: '전체 (全部)', val: stats.total, color: '#3498db', icon: '📋', key: 'all' },
                { label: '구매완료 (购买完成)', val: stats.pending, color: '#e67e22', icon: '🛒', key: 'pending' },
                { label: '리뷰완료 (评价完成)', val: stats.submitted, color: '#9b59b6', icon: '📸', key: 'submitted' },
                { label: '입금 대기 (待汇款)', val: stats.unpaid, color: '#f39c12', icon: '💰', key: 'unpaid' },
                { label: '입금 완료 (汇款完成)', val: stats.paid, color: '#27ae60', icon: '💸', key: 'paid' },
              ].map(c => (
                <div key={c.label} onClick={() => setAfStatus(afStatus === c.key ? '' : (c.key === 'all' ? '' : c.key))}
                  style={{ background: 'white', borderRadius: 10, padding: '12px 14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderLeft: `4px solid ${c.color}`, cursor: 'pointer', outline: (afStatus === c.key || (c.key === 'all' && afStatus === '')) ? `2px solid ${c.color}` : 'none' }}>
                  <div style={{ fontSize: 16, marginBottom: 2 }}>{c.icon}</div>
                  <div style={{ fontSize: 22, fontWeight: 'bold', color: c.color }}>{c.val}</div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{c.label}</div>
                </div>
              ))}
            </div>

            {/* 필터 */}
            <div style={{ background: 'white', borderRadius: 10, padding: '14px 18px', marginBottom: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
              <div><div style={flStyle}>스토어 (店铺)</div>
                <select value={afStore} onChange={e => setAfStore(e.target.value)} style={fis}>
                  <option value="">전체 (全部)</option>{stores.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <div><div style={flStyle}>날짜 (日期)</div>
                <select value={afDate} onChange={e => setAfDate(e.target.value)} style={fis}>
                  <option value="">전체 날짜 (全部日期)</option>
                  {availableDates.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div><div style={flStyle}>예금주 (存款人)</div>
                <input type="text" value={afHolder} onChange={e => setAfHolder(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadApps()} placeholder="예금주명 (输入存款人)" style={fis} />
              </div>
              <button onClick={loadApps} style={{ padding: '8px 18px', background: '#3498db', color: 'white', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', height: 36 }}>🔄 새로고침</button>
              {afStatus === 'pending' && (
                <button onClick={() => { setAssignMode(!assignMode); setSelectedIds([]) }}
                  style={{ padding: '8px 18px', background: assignMode ? '#e74c3c' : '#8e44ad', color: 'white', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', height: 36 }}>
                  {assignMode ? '✕ 배치 취소' : '🎯 리뷰 배치'}
                </button>
              )}
              <button onClick={downloadCSV}
                style={{ padding: '8px 18px', background: '#27ae60', color: 'white', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', height: 36 }}>
                📥 엑셀 다운로드
              </button>
              <button onClick={() => { setDeleteMode(!deleteMode); setDeleteSelectedIds([]) }}
                style={{ padding: '8px 18px', background: deleteMode ? '#c0392b' : '#e74c3c', color: 'white', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', height: 36 }}>
                {deleteMode ? '✕ 취소' : '🗑 삭제하기'}
              </button>
            </div>

            {/* 삭제 모드 패널 */}
            {deleteMode && (
              <div style={{ background: 'white', borderRadius: 10, padding: '14px 18px', marginBottom: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '2px solid #e74c3c', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14, fontWeight: 'bold', color: '#e74c3c' }}>🗑 삭제 모드</span>
                <span style={{ fontSize: 13, color: '#555' }}>삭제할 항목을 선택하세요</span>
                <button onClick={() => {
                  if (deleteSelectedIds.length === appFiltered.length) setDeleteSelectedIds([])
                  else setDeleteSelectedIds(appFiltered.map(a => a.id))
                }} style={{ padding: '6px 14px', background: '#fde8e8', color: '#c0392b', border: '1px solid #e74c3c', borderRadius: 6, fontWeight: 'bold', fontSize: 12, cursor: 'pointer' }}>
                  {deleteSelectedIds.length === appFiltered.length ? '전체 해제' : '전체 선택'}
                </button>
                <span style={{ fontSize: 13, color: '#e74c3c', fontWeight: 'bold' }}>{deleteSelectedIds.length}건 선택됨</span>
                <button onClick={deleteSelected} disabled={deleteSelectedIds.length === 0}
                  style={{ padding: '8px 20px', background: deleteSelectedIds.length === 0 ? '#ccc' : '#e74c3c', color: 'white', border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: deleteSelectedIds.length === 0 ? 'not-allowed' : 'pointer' }}>
                  🗑 선택 삭제 ({deleteSelectedIds.length}건)
                </button>
              </div>
            )}

            {/* 리뷰 유형 배치 패널 */}
            {assignMode && (
              <div style={{ background: 'white', borderRadius: 10, padding: '18px 20px', marginBottom: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '2px solid #8e44ad' }}>
                <div style={{ fontWeight: 'bold', fontSize: 15, color: '#8e44ad', marginBottom: 14 }}>🎯 리뷰 유형 배치 설정</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 14 }}>
                  {REVIEW_TYPES.map(rt => {
                    const cfg = typeConfig.find(c => c.key === rt.key)!
                    return (
                      <div key={rt.key} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8f4fc', borderRadius: 8, padding: '10px 14px', border: `1px solid ${rt.color}30` }}>
                        <span style={{ fontSize: 18 }}>{rt.icon}</span>
                        <div>
                          <div style={{ fontWeight: 'bold', fontSize: 13, color: rt.color }}>{rt.label}</div>
                          <div style={{ fontSize: 11, color: '#888' }}>{rt.amount.toLocaleString()}원</div>
                        </div>
                        <input type="number" min={0} value={cfg.count}
                          onChange={e => setTypeConfig(prev => prev.map(c => c.key === rt.key ? { ...c, count: Math.max(0, parseInt(e.target.value) || 0) } : c))}
                          style={{ width: 60, padding: '6px 8px', border: `1px solid ${rt.color}`, borderRadius: 6, fontSize: 14, fontWeight: 'bold', textAlign: 'center' }} />
                        <span style={{ fontSize: 12, color: '#888' }}>명</span>
                      </div>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 13, color: '#555' }}>
                    총 설정: <strong>{typeConfig.reduce((s, c) => s + c.count, 0)}명</strong>
                    {' / '}선택됨: <strong style={{ color: '#8e44ad' }}>{selectedIds.length}명</strong>
                  </div>
                  <button onClick={() => {
                    const purchaseOnly = appFiltered.filter(a => a.status !== '리뷰제출완료')
                    if (selectedIds.length === purchaseOnly.length) {
                      setSelectedIds([])
                    } else {
                      setSelectedIds(purchaseOnly.map(a => a.id))
                    }
                  }} style={{ padding: '7px 16px', background: '#f0e8fc', color: '#8e44ad', border: '1px solid #8e44ad', borderRadius: 6, fontWeight: 'bold', fontSize: 12, cursor: 'pointer' }}>
                    {selectedIds.length === appFiltered.filter(a => a.status !== '리뷰제출완료').length ? '전체 해제' : '전체 선택'}
                  </button>
                  <button onClick={applyReviewTypes}
                    disabled={selectedIds.length === 0 || typeConfig.reduce((s, c) => s + c.count, 0) === 0}
                    style={{ padding: '10px 24px', background: selectedIds.length === 0 ? '#ccc' : '#8e44ad', color: 'white', border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: selectedIds.length === 0 ? 'not-allowed' : 'pointer' }}>
                    ✅ 배치 적용 ({selectedIds.length}건)
                  </button>
                </div>
              </div>
            )}

            {/* 목록 */}
            {appLoading ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>불러오는 중...</div>
            ) : appFiltered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#bbb', background: 'white', borderRadius: 10 }}>데이터가 없습니다.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {appFiltered.map((app, idx) => {
                  const isExp = expandedId === app.id
                  const isSubmitted = app.status === '리뷰제출완료'
                  const isSelected = selectedIds.includes(app.id)
                  const selIdx = selectedIds.indexOf(app.id)
                  const borderColor = app.payment_done ? '#d5f5e3' : isSubmitted && app.review_checked ? '#fef9e7' : isSubmitted ? '#fde8e8' : '#e8ecf0'
                  const rtInfo = getReviewTypeInfo(app.review_type)
                  const isDeleteSelected = deleteSelectedIds.includes(app.id)

                  return (
                    <div key={app.id} style={{ background: 'white', borderRadius: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.05)', border: `2px solid ${deleteMode && isDeleteSelected ? '#e74c3c' : assignMode && isSelected ? '#8e44ad' : borderColor}`, overflow: 'hidden' }}>
                      {/* 헤더 행 */}
                      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>

                        {/* 삭제 모드 체크박스 */}
                        {deleteMode && (
                          <div onClick={() => toggleDeleteSelect(app.id)}
                            style={{ width: 24, height: 24, borderRadius: 6, border: `2px solid ${isDeleteSelected ? '#e74c3c' : '#ddd'}`, background: isDeleteSelected ? '#e74c3c' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                            {isDeleteSelected && <span style={{ color: 'white', fontSize: 14, fontWeight: 'bold' }}>✓</span>}
                          </div>
                        )}

                        {/* 번호 */}
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#f0f2f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 'bold', color: '#666', flexShrink: 0 }}>
                          {idx + 1}
                        </div>

                        {/* 배치 모드 체크박스 - 구매완료 건만 활성화 */}
                        {assignMode && (
                          <div onClick={() => !isSubmitted && toggleSelect(app.id)}
                            style={{ width: 24, height: 24, borderRadius: 6, border: `2px solid ${isSubmitted ? '#eee' : isSelected ? '#8e44ad' : '#ddd'}`, background: isSubmitted ? '#f5f5f5' : isSelected ? '#8e44ad' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isSubmitted ? 'not-allowed' : 'pointer', flexShrink: 0, opacity: isSubmitted ? 0.4 : 1 }}>
                            {isSelected && <span style={{ color: 'white', fontSize: 14, fontWeight: 'bold' }}>✓</span>}
                          </div>
                        )}
                        {assignMode && isSelected && (
                          <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#8e44ad', color: 'white', fontSize: 11, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {selIdx + 1}
                          </div>
                        )}

                        {/* 상태 뱃지 */}
                        <div style={{ display: 'flex', gap: 5, flexShrink: 0, flexWrap: 'wrap' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 'bold', background: isSubmitted ? '#e8d5f5' : '#fef9e7', color: isSubmitted ? '#6c3483' : '#d68910' }}>
                            {isSubmitted ? '📸 리뷰제출' : '🛒 구매완료'}
                          </span>
                          {app.purchase_type && afStatus === '' && (
                            <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 'bold', background: app.purchase_type === '빈박' ? '#e8f4fd' : app.purchase_type === '실배' ? '#e8f8f5' : '#fef9e7', color: app.purchase_type === '빈박' ? '#1a5276' : app.purchase_type === '실배' ? '#1e8449' : '#7d6608' }}>
                              {app.purchase_type === '빈박' ? '📦' : app.purchase_type === '실배' ? '🚚' : '📋'} {app.purchase_type}
                            </span>
                          )}
                          {isSubmitted && (
                            <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 'bold', background: app.review_checked ? '#d5f5e3' : '#fde8e8', color: app.review_checked ? '#1e8449' : '#c0392b' }}>
                              {app.review_checked ? '✅ 확인' : '🔍 미확인'}
                            </span>
                          )}
                          {isSubmitted && (
                            <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 'bold', background: app.payment_done ? '#d5f5e3' : '#fef3cd', color: app.payment_done ? '#1e8449' : '#856404' }}>
                              {app.payment_done ? '💸 입금완료' : '⏳ 입금대기'}
                            </span>
                          )}
                          {/* 구매완료 건에 배정된 리뷰 유형 뱃지 */}
                          {!isSubmitted && rtInfo && (
                            <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 'bold', background: `${rtInfo.color}20`, color: rtInfo.color, border: `1px solid ${rtInfo.color}50` }}>
                              {rtInfo.icon} {rtInfo.label}
                            </span>
                          )}
                        </div>

                        <div style={{ flex: 1, minWidth: 150 }}>
                          <span style={{ fontWeight: 'bold', fontSize: 14, color: '#2c3e50' }}>{app.recipient || app.account_holder}</span>
                          <span style={{ color: '#888', fontSize: 12, marginLeft: 6 }}>{app.store_name}</span>
                        </div>
                        <div style={{ fontSize: 12, color: '#555', flexShrink: 0 }}>
                          {app.order_number && <span style={{ marginRight: 8 }}>주문번호: {app.order_number}</span>}
                          {(() => {
                            const base = Number(String(app.amount || '').replace(/[^0-9]/g, '')) || 0
                            const rtInfo = getReviewTypeInfo(app.review_type)
                            const fee = isSubmitted && rtInfo ? rtInfo.amount : 0
                            const total = base + fee
                            if (base > 0) return (
                              <span style={{ marginLeft: 6, fontWeight: 'bold', color: fee > 0 ? '#27ae60' : '#e67e22' }}>
                                {total.toLocaleString()}원
                                {fee > 0 && <span style={{ fontSize: 10, color: '#888', marginLeft: 3 }}>({base.toLocaleString()}+{fee.toLocaleString()})</span>}
                              </span>
                            )
                            return null
                          })()}
                        </div>
                        <div style={{ fontSize: 11, color: '#aaa', flexShrink: 0 }}>{new Date(app.created_at).toLocaleString('ko-KR')}</div>
                        <span onClick={() => setExpandedId(isExp ? null : app.id)} style={{ color: '#bbb', fontSize: 14, cursor: 'pointer', padding: '4px 8px' }}>{isExp ? '▲' : '▼'}</span>
                      </div>

                      {/* 상세 */}
                      {isExp && (
                        <div style={{ borderTop: '1px solid #f0f0f0', padding: '14px 16px', background: '#fafafa' }}>
                          {/* 정보 그리드 */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginBottom: 14 }}>
                            {[
                              ['주문번호', app.order_number], ['수취인', app.recipient], ['연락처', app.phone],
                              ['주소', app.address], ['은행', app.bank_name], ['계좌번호', app.account_number],
                              ['예금주', app.account_holder], ['상품금액', app.amount ? (Number(String(app.amount).replace(/[^0-9]/g, '')) || 0).toLocaleString() + '원' : '-'],
                            ].map(([label, val]) => (
                              <div key={label} style={{ background: 'white', borderRadius: 6, padding: '7px 10px', border: '1px solid #eee' }}>
                                <div style={{ fontSize: 10, color: '#999', marginBottom: 2 }}>{label}</div>
                                <div style={{ fontSize: 13, fontWeight: 'bold', color: '#333', wordBreak: 'break-all' }}>{val || '-'}</div>
                              </div>
                            ))}
                          </div>

                          {/* 리뷰 유형 직접 변경 */}
                          <div style={{ marginBottom: 14 }}>
                            <div style={{ fontSize: 12, fontWeight: 'bold', color: '#555', marginBottom: 8 }}>🎯 리뷰 유형</div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              {[...REVIEW_TYPES, { key: '', label: '미배정', icon: '—', amount: 0, color: '#999' }].map(rt => (
                                <button key={rt.key} onClick={() => patchApp(app.id, { review_type: rt.key || null, review_type_assigned: !!rt.key })}
                                  style={{ padding: '6px 14px', border: `2px solid ${app.review_type === rt.key || (!app.review_type && !rt.key) ? rt.color : '#eee'}`, borderRadius: 20, background: app.review_type === rt.key || (!app.review_type && !rt.key) ? `${rt.color}20` : 'white', color: rt.color, fontWeight: 'bold', fontSize: 12, cursor: 'pointer' }}>
                                  {rt.icon} {rt.label}{rt.amount ? ` (${rt.amount.toLocaleString()}원)` : ''}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* 구매 이미지 */}
                          {app.purchase_images?.length > 0 && (
                            <div style={{ marginBottom: 14 }}>
                              <div style={{ fontSize: 12, fontWeight: 'bold', color: '#555', marginBottom: 6 }}>🛒 구매 이미지 ({app.purchase_images.length}장)</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {app.purchase_images.map((url, i) => (
                                  <img key={i} src={url} alt={`구매${i + 1}`} onClick={() => setLightbox(url)}
                                    style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 8, border: '2px solid #ffd700', cursor: 'zoom-in' }} />
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 리뷰 이미지 */}
                          {app.review_images?.length > 0 && (
                            <div style={{ marginBottom: 14 }}>
                              <div style={{ fontSize: 12, fontWeight: 'bold', color: '#555', marginBottom: 6 }}>📸 리뷰 이미지 ({app.review_images.length}장)</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {app.review_images.map((url, i) => (
                                  <img key={i} src={url} alt={`리뷰${i + 1}`} onClick={() => setLightbox(url)}
                                    style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 8, border: '2px solid #bee3f8', cursor: 'zoom-in' }} />
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 메모 */}
                          {isSubmitted && (
                            <div style={{ marginBottom: 14 }}>
                              <div style={{ fontSize: 12, fontWeight: 'bold', color: '#555', marginBottom: 6 }}>📝 메모</div>
                              {noteEdit?.id === app.id ? (
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <input type="text" value={noteEdit.val} onChange={e => setNoteEdit({ id: app.id, val: e.target.value })}
                                    onKeyDown={e => e.key === 'Enter' && saveNote(app.id)}
                                    style={{ flex: 1, padding: '8px 10px', border: '1px solid #3498db', borderRadius: 6, fontSize: 13 }} autoFocus />
                                  <button onClick={() => saveNote(app.id)} style={{ padding: '8px 14px', background: '#3498db', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}>저장</button>
                                  <button onClick={() => setNoteEdit(null)} style={{ padding: '8px 14px', background: '#ecf0f1', border: 'none', borderRadius: 6, cursor: 'pointer' }}>취소</button>
                                </div>
                              ) : (
                                <div onClick={() => setNoteEdit({ id: app.id, val: app.review_check_note || '' })}
                                  style={{ padding: '8px 12px', background: 'white', border: '1px dashed #ddd', borderRadius: 6, fontSize: 13, color: app.review_check_note ? '#333' : '#bbb', cursor: 'text', minHeight: 34 }}>
                                  {app.review_check_note || '클릭하여 메모 입력...'}
                                </div>
                              )}
                            </div>
                          )}

                          {/* 액션 버튼 */}
                          {isSubmitted && (
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                              {/* 합산 금액 표시 */}
                              {(() => {
                                const base = Number(String(app.amount || '').replace(/[^0-9]/g, '')) || 0
                                const fee = rtInfo ? rtInfo.amount : 0
                                const total = base + fee
                                return base > 0 ? (
                                  <div style={{ padding: '9px 14px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, fontSize: 13 }}>
                                    💰 입금 금액: <strong style={{ color: '#15803d', fontSize: 15 }}>{total.toLocaleString()}원</strong>
                                    {fee > 0 && <span style={{ fontSize: 11, color: '#888', marginLeft: 4 }}>(상품 {base.toLocaleString()}원 + {rtInfo?.label} {fee.toLocaleString()}원)</span>}
                                  </div>
                                ) : null
                              })()}

                              {/* 리뷰 제출됨 탭: 리뷰 확인 버튼 (미확인 건만) */}
                              {afStatus === 'submitted' && !app.review_checked && (
                                <button onClick={() => patchApp(app.id, { review_checked: true })}
                                  style={{ padding: '9px 18px', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', fontSize: 13, background: '#e8d5f5', color: '#6c3483' }}>
                                  ✅ 리뷰 확인 (确认评价)
                                </button>
                              )}

                              {/* 입금 대기 탭: 입금 완료 처리 버튼 */}
                              {afStatus === 'unpaid' && app.review_checked && !app.payment_done && (
                                <button onClick={() => patchApp(app.id, { payment_done: true })}
                                  style={{ padding: '9px 18px', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', fontSize: 13, background: '#d5f5e3', color: '#1e8449' }}>
                                  💸 입금 완료 (汇款完成)
                                </button>
                              )}

                              {/* 입금 완료 탭: 입금 취소 버튼 */}
                              {afStatus === 'paid' && app.payment_done && (
                                <button onClick={() => patchApp(app.id, { payment_done: false })}
                                  style={{ padding: '9px 18px', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', fontSize: 13, background: '#fef3cd', color: '#856404' }}>
                                  🔄 입금 취소 (取消汇款)
                                </button>
                              )}

                              {/* 전체 탭: 기존 버튼 유지 */}
                              {afStatus !== 'submitted' && afStatus !== 'unpaid' && afStatus !== 'paid' && (
                                <>
                                  {!app.review_checked && (
                                    <button onClick={() => patchApp(app.id, { review_checked: true })}
                                      style={{ padding: '9px 18px', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', fontSize: 13, background: '#e8d5f5', color: '#6c3483' }}>
                                      ✅ 리뷰 확인 (确认评价)
                                    </button>
                                  )}
                                  <button onClick={() => patchApp(app.id, { payment_done: !app.payment_done })}
                                    style={{ padding: '9px 18px', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', fontSize: 13, background: app.payment_done ? '#fef3cd' : '#d5f5e3', color: app.payment_done ? '#856404' : '#1e8449' }}>
                                    {app.payment_done ? '🔄 입금 취소 (取消汇款)' : '💸 입금 완료 (汇款完成)'}
                                  </button>
                                </>
                              )}

                              {app.payment_done_at && (
                                <span style={{ fontSize: 12, color: '#888', alignSelf: 'center' }}>
                                  입금처리: {new Date(app.payment_done_at).toLocaleString('ko-KR')}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ══ 스토어 관리 ══ */}
        {tab === 'stores' && (
          <div style={{ maxWidth: 480 }}>
            <div style={{ background: 'white', borderRadius: 10, padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 16 }}>
              <h3 style={{ margin: '0 0 16px', color: '#2c3e50', fontSize: 16 }}>🏪 스토어 추가</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="text" value={newStore} onChange={e => setNewStore(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addStore()}
                  placeholder="스토어명 입력"
                  style={{ flex: 1, padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14 }} />
                <button onClick={addStore} disabled={storeLoading || !newStore.trim()}
                  style={{ padding: '10px 20px', background: '#2c3e50', color: 'white', border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer' }}>
                  추가
                </button>
              </div>
            </div>
            <div style={{ background: 'white', borderRadius: 10, padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h3 style={{ margin: '0 0 16px', color: '#2c3e50', fontSize: 16 }}>등록된 스토어 ({stores.length}개)</h3>
              {stores.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#bbb', padding: '20px 0' }}>등록된 스토어가 없습니다.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {stores.map(s => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#f8f9fa', borderRadius: 8, border: '1px solid #eee' }}>
                      <span style={{ fontWeight: 'bold', color: '#2c3e50' }}>🏪 {s.name}</span>
                      <button onClick={() => deleteStore(s.id, s.name)}
                        style={{ padding: '4px 12px', background: '#fde8e8', color: '#c0392b', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}>
                        삭제
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const flStyle: React.CSSProperties = { fontSize: 11, color: '#888', marginBottom: 4, fontWeight: 'bold' }
const fis: React.CSSProperties = { padding: '7px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13, height: 36 }
