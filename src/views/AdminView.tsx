import React, { useEffect, useState } from 'react';
import type { DashboardData, QuoteRawRow } from '../types/dashboard';
import { useAuth } from '../context/AuthContext';
import { ViewHeader } from '../components/common/ViewHeader';
import { QuotesRawAdminTable } from '../components/admin/QuotesRawAdminTable';
import { Notice } from '../components/common/Notice';
import { SkelBar } from '../components/common/SkeletonView';
import { TextInput } from '../components/common/TextInput';
import { getCfg } from '../hooks/useDashboardData';
import { Lock, TriangleAlert, Zap } from 'lucide-react';

interface AdminViewProps {
  data: DashboardData;
  /** 실데이터를 받는 중 (화면은 저장해 둔 이전 데이터로 먼저 그린다) */
  isSyncing?: boolean;
  onUpdateQuotesRaw?: (newQuotes: QuoteRawRow[]) => void;
}

export const AdminView: React.FC<AdminViewProps> = ({ data, isSyncing = false, onUpdateQuotesRaw }) => {
  const { isLoggedIn, loading: sessionLoading, loginWithPassword, loginAsDevAdmin } = useAuth();
  const [localQuotes, setLocalQuotes] = useState<QuoteRawRow[]>(() =>
    (data.quotesRaw || []).filter((r) => r.date >= '2026-10')
  );
  const [isDirty, setIsDirty] = useState<boolean>(false);
  // 실데이터가 도착하면 표도 새 값으로 바꾼다 (수정 중인 내용이 있으면 덮지 않는다)
  useEffect(() => {
    if (!isDirty) setLocalQuotes((data.quotesRaw || []).filter((r) => r.date >= '2026-10'));
  }, [data.quotesRaw]);
  // 수동 변경된 sno → 새 카테고리 추적 (저장 시 Apps Script로 전송)
  const [pendingOverrides, setPendingOverrides] = useState<Map<string, string>>(new Map());
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    const res = await loginWithPassword(loginId, password);
    setAuthLoading(false);
    if (res.error) {
      setAuthError(res.error);
    } else {
      setPassword('');
    }
  };

  // 저장해 둔 이전 데이터로 먼저 그린 뒤 실데이터가 오면 바꿔 끼운다 (수정 중이면 그대로 둔다)
  React.useEffect(() => {
    if (!isDirty && data.quotesRaw?.length) {
      setLocalQuotes(data.quotesRaw.filter((r) => r.date >= '2026-10'));
    }
  }, [data.quotesRaw, isDirty]);

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
    <div className="admin-view">
      <ViewHeader
        title="어드민 관리"
        description="견적 접수 원본 리스트(Google 시트) 및 표준 카테고리 수동 지정 · 데이터 저장 관리"
        status="live"
      />

      {saveMsg && <Notice tone={saveMsg.ok ? 'ok' : 'warn'}>{saveMsg.text}</Notice>}

      {/* 미로그인 시 현재 화면 위로 띄워지는 absolute 로그인 게이트 폼 */}
      {/* 저장된 로그인 세션을 확인하는 동안은 로그인 창 대신 같은 크기의 자리표시 */}
      {!isLoggedIn && sessionLoading && (
        <div className="admin-gate-overlay" aria-busy="true">
          <div className="card card-admin-gate skel-card" aria-hidden="true">
            <SkelBar w="2.75rem" h="2.75rem" />
            <SkelBar w="40%" h="1.25rem" />
            <SkelBar w="70%" h="0.75rem" />
            <SkelBar h="2.5rem" />
            <SkelBar h="2.5rem" />
            <SkelBar h="2.5rem" />
          </div>
        </div>
      )}
      {!isLoggedIn && !sessionLoading && (
        <div className="admin-gate-overlay" id="admin-gate-overlay">
          <div className="card card-admin-gate" id="admin-gate" data-card="admin-gate">
            <div className="gate-icon">
              <Lock size={22} />
            </div>

            <h2>관리자 로그인</h2>
            <p>지정된 관리자 계정으로 접속하여 원본 데이터를 편집·저장할 수 있습니다.</p>

            {/* 관리자 아이디·비밀번호 로그인 폼 (Supabase Auth, 회원가입 없음) */}
            <form className="gate-form" onSubmit={handlePasswordSubmit}>
              <TextInput
                className={`gate-input${authError ? ' err' : ''}`}
                name="username"
                autoComplete="username"
                placeholder="아이디"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                autoFocus
              />
              <TextInput
                className={`gate-input${authError ? ' err' : ''}`}
                type="password"
                name="password"
                autoComplete="current-password"
                placeholder="비밀번호"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {authError && (
                <div className="gate-error" role="alert">
                  <TriangleAlert size={12} aria-hidden="true" />
                  <span>{authError}</span>
                </div>
              )}
              <button
                type="submit"
                className="btn acc btn-login"
                id="btn-login-submit"
                data-btn="login-submit"
                disabled={authLoading}
              >
                {authLoading ? '확인 중...' : '로그인'}
              </button>
            </form>

            {/* 개발 환경 전용 즉시 로그인 버튼 */}
            {import.meta.env.DEV && (
              <button
                type="button"
                className="btn btn-dev-login"
                id="gate-dev"
                data-btn="dev"
                onClick={loginAsDevAdmin}
              >
                <Zap size={12} aria-hidden="true" />
                <span>테스트용 관리자로 바로 시작</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 견적 원본 스프레드시트 관리 테이블 (미로그인 시 흐리게 배경 처리 및 읽기 전용) */}
      <div className={`admin-body${isLoggedIn ? '' : ' locked'}`}>
        <QuotesRawAdminTable
          quotes={localQuotes}
          loading={isSyncing}
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
