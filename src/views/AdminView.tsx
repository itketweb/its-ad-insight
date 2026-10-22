import React, { useState } from 'react';
import type { DashboardData, QuoteRawRow } from '../types/dashboard';
import { useAuth } from '../context/AuthContext';
import { ViewHeader } from '../components/common/ViewHeader';
import { QuotesRawAdminTable } from '../components/admin/QuotesRawAdminTable';
import { getCfg } from '../hooks/useDashboardData';

interface AdminViewProps {
  data: DashboardData;
  onUpdateQuotesRaw?: (newQuotes: QuoteRawRow[]) => void;
}

export const AdminView: React.FC<AdminViewProps> = ({ data, onUpdateQuotesRaw }) => {
  const { isLoggedIn, loginWithPassword, loginWithGoogle, loginAsDevAdmin } = useAuth();
  const [localQuotes, setLocalQuotes] = useState<QuoteRawRow[]>(() =>
    (data.quotesRaw || []).filter((r) => r.date >= '2026-10')
  );
  const [isDirty, setIsDirty] = useState<boolean>(false);
  // 수동 변경된 sno → 새 카테고리 추적 (저장 시 Apps Script로 전송)
  const [pendingOverrides, setPendingOverrides] = useState<Map<string, string>>(new Map());
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    const res = await loginWithPassword(password);
    setAuthLoading(false);
    if (res.error) {
      setAuthError(res.error);
    } else {
      setPassword('');
    }
  };

  React.useEffect(() => {
    if (!isDirty && data.quotesRaw?.length && localQuotes.length === 0) {
      setLocalQuotes(data.quotesRaw.filter((r) => r.date >= '2026-10'));
    }
  }, [data.quotesRaw, isDirty, localQuotes.length]);

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // 개별 행 카테고리 수동 지정 변경 — 변경된 sno를 pendingOverrides에 기록
  const handleUpdateQuoteCategory = (idOrIndex: string | number, newCategory: string) => {
    let changedSno: string | undefined;
    const updated = localQuotes.map((q, idx) => {
      const match = typeof idOrIndex === 'string' ? q.id === idOrIndex : idx === idOrIndex;
      if (match) {
        changedSno = String(q.sno ?? '');
        return { ...q, category: newCategory };
      }
      return q;
    });
    setLocalQuotes(updated);
    setIsDirty(true);
    setSaveMsg(null);
    if (changedSno) {
      setPendingOverrides((prev) => new Map(prev).set(changedSno!, newCategory));
    }
    if (onUpdateQuotesRaw) onUpdateQuotesRaw(updated);
  };

  // Apps Script manual_categories 시트에 오버라이드 저장 → 다음 동기화 때 quotes_monthly 재산출
  const handleSaveOverrides = async () => {
    if (pendingOverrides.size === 0) {
      setSaveMsg({ text: '저장할 변경사항이 없습니다.', ok: false });
      return;
    }
    setSaving(true);
    setSaveMsg(null);

    const { url, key } = getCfg();
    const overrides = Array.from(pendingOverrides.entries()).map(([sno, category]) => ({ sno, category }));
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ key, action: 'saveManualCategories', overrides }),
      });
      const json = await res.json();
      if (json.success) {
        setSaveMsg({ text: `${overrides.length}건 저장됨. 다음 동기화(최대 15분) 후 전체 통계에 반영됩니다.`, ok: true });
        setPendingOverrides(new Map());
        setIsDirty(false);
      } else {
        setSaveMsg({ text: json.error || '저장 실패', ok: false });
      }
    } catch (err: any) {
      setSaveMsg({ text: err.message || '네트워크 오류', ok: false });
    }
    setSaving(false);
  };

  // 변경사항 되돌리기 (최초 로드 상태로 리셋)
  const handleResetChanges = () => {
    if (confirm('저장하지 않은 모든 카테고리 수동 변경사항을 되돌리시겠습니까?')) {
      const original = (data.quotesRaw || []).filter((r) => r.date >= '2026-10');
      setLocalQuotes(original);
      setIsDirty(false);
      setPendingOverrides(new Map());
      setSaveMsg(null);
      if (onUpdateQuotesRaw) onUpdateQuotesRaw(original);
    }
  };

  // 로그인된 경우: 어드민 대시보드 화면
  return (
    <div style={{ position: 'relative' }}>
      <ViewHeader
        title="어드민 관리"
        description="견적 접수 원본 리스트(Google 시트) 및 표준 카테고리 수동 지정 · 데이터 저장 관리"
        status="live"
      />

      {saveMsg && (
        <div
          style={{
            padding: '0.75rem 1.25rem',
            marginBottom: '1rem',
            fontSize: '0.8125rem',
            fontWeight: 600,
            borderRadius: '0',
            background: saveMsg.ok ? 'var(--grp-naver-bg, #f2faf5)' : 'var(--warnbg, #fbeccb)',
            color: saveMsg.ok ? 'var(--grp-naver-ink, #166534)' : 'var(--warn, #7a4a00)',
            border: `1px solid ${saveMsg.ok ? 'color-mix(in srgb, var(--ok) 40%, transparent)' : 'color-mix(in srgb, var(--warn) 40%, transparent)'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span>{saveMsg.ok ? '✅' : '⚠️'}</span>
          <span>{saveMsg.text}</span>
        </div>
      )}

      {/* 미로그인 시 현재 화면 위로 띄워지는 absolute 로그인 게이트 폼 */}
      {!isLoggedIn && (
        <div
          id="admin-gate-overlay"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 50,
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            background: 'color-mix(in srgb, var(--bg) 65%, transparent)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '3.5rem',
          }}
        >
          <div
            className="card card-admin-gate"
            id="admin-gate"
            data-card="admin-gate"
            style={{
              width: '100%',
              maxWidth: '26rem',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2), 0 1px 3px rgba(0, 0, 0, 0.1)',
              border: '1px solid var(--line2)',
              padding: '2rem 1.75rem',
              textAlign: 'center',
              background: 'var(--card)',
            }}
          >
            <div
              style={{
                width: '3.25rem',
                height: '3.25rem',
                borderRadius: '50%',
                background: 'var(--accbg)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
                border: '1px solid var(--acc)',
              }}
            >
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="var(--acc)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>

            <h2 style={{ fontSize: '1.1875rem', fontWeight: 700, margin: '0 0 0.375rem', color: 'var(--ink)' }}>
              관리자 로그인
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--sub)', margin: '0 0 1.25rem', lineHeight: 1.5 }}>
              지정된 관리자 계정으로 접속하여 원본 데이터를 편집·저장할 수 있습니다.
            </p>

            {/* 관리자 비밀번호 직접 로그인 폼 */}
            <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <input
                type="password"
                placeholder="관리자 비밀번호를 입력하세요"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                style={{
                  width: '100%',
                  padding: '0.625rem 0.875rem',
                  fontSize: '0.875rem',
                  border: authError ? '1px solid var(--warn)' : '1px solid var(--line2)',
                  borderRadius: '0',
                  background: 'var(--bg)',
                  color: 'var(--ink)',
                }}
              />
              {authError && (
                <div style={{ fontSize: '0.75rem', color: 'var(--warn, #dc2626)', textAlign: 'left', fontWeight: 600 }}>
                  ⚠️ {authError}
                </div>
              )}
              <button
                type="submit"
                className="btn acc btn-login"
                id="btn-login-submit"
                data-btn="login-submit"
                disabled={authLoading}
                style={{
                  width: '100%',
                  padding: '0.625rem 1rem',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  color: '#fff',
                  border: 'none',
                }}
              >
                {authLoading ? '확인 중...' : '로그인'}
              </button>
            </form>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0 0 1rem' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--line)' }} />
              <span style={{ fontSize: '0.6875rem', color: 'var(--sub)' }}>또는</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--line)' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {/* Google OAuth 로그인 버튼 (지정 계정) */}
              <button
                type="button"
                className="btn btn-google"
                id="gate-google"
                data-btn="google"
                onClick={loginWithGoogle}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.625rem',
                  padding: '0.5625rem 0.875rem',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  background: '#fff',
                  color: '#3c4043',
                  border: '1px solid #dadce0',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                }}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" style={{ width: 16, height: 16, minWidth: 16, flexShrink: 0, display: 'inline-block' }} aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.27v3.15C3.25 21.37 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.27C.46 8.2 0 10.04 0 12s.46 3.8 1.27 5.42l4.01-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.25 2.63 1.27 6.58l4.01 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>Google 관리자 계정으로 로그인</span>
              </button>

              {/* 개발/테스트용 즉시 로그인 버튼 */}
              <button
                type="button"
                className="btn btn-dev"
                id="gate-dev"
                data-btn="dev"
                onClick={loginAsDevAdmin}
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--sub)',
                  background: 'transparent',
                  border: '1px dashed var(--line2)',
                  padding: '0.4375rem',
                }}
              >
                ⚡ 테스트용 관리자로 바로 시작
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 견적 원본 스프레드시트 관리 테이블 (미로그인 시 흐리게 배경 처리 및 읽기 전용) */}
      <div style={{ filter: !isLoggedIn ? 'blur(1px)' : 'none', pointerEvents: !isLoggedIn ? 'none' : 'auto', userSelect: !isLoggedIn ? 'none' : 'auto' }}>
        <QuotesRawAdminTable
          quotes={localQuotes}
          onUpdateQuoteCategory={handleUpdateQuoteCategory}
                    isDirty={isDirty}
          onSave={handleSaveOverrides}
          onReset={handleResetChanges}
          saving={saving}
        />
      </div>
    </div>
  );
};
