import React, { useState } from 'react';
import type { DashboardData, QuoteRawRow } from '../types/dashboard';
import { ViewHeader } from '../components/common/ViewHeader';
import { QuotesRawAdminTable } from '../components/admin/QuotesRawAdminTable';
import { Notice } from '../components/common/Notice';
import { getCfg } from '../hooks/useDashboardData';
import { useAuth } from '../context/AuthContext';

interface AdminViewProps {
  data: DashboardData;
  /** 실데이터를 받는 중 (화면은 저장해 둔 이전 데이터로 먼저 그린다) */
  isSyncing?: boolean;
  onUpdateQuotesRaw?: (newQuotes: QuoteRawRow[]) => void;
}

export const AdminView: React.FC<AdminViewProps> = ({ data, isSyncing = false, onUpdateQuotesRaw }) => {
  const [localQuotes, setLocalQuotes] = useState<QuoteRawRow[]>(() =>
    (data.quotesRaw || []).filter((r) => r.date >= '2026-10')
  );
  const [isDirty, setIsDirty] = useState<boolean>(false);
  // 수동 변경된 sno → 새 카테고리 추적 (저장 시 Apps Script로 전송)
  const [pendingOverrides, setPendingOverrides] = useState<Map<string, string>>(new Map());
  // 저장 전 변경의 원래 값 (sno → 처음 바꾸기 전 카테고리) — 표에 '이전: ○○' 흔적으로 보여 준다
  const [originals, setOriginals] = useState<Map<string, string>>(new Map());
  const { user } = useAuth();

  // 수정을 시작하기 전 전체 원장 — 되돌리기 때 이 상태로 돌린다
  const baseQuotes = React.useRef<QuoteRawRow[]>(data.quotesRaw || []);

  // 저장해 둔 이전 데이터로 먼저 그린 뒤 실데이터가 오면 바꿔 끼운다 (수정 중이면 그대로 둔다)
  React.useEffect(() => {
    if (!isDirty && data.quotesRaw?.length) {
      baseQuotes.current = data.quotesRaw;
      setLocalQuotes(data.quotesRaw.filter((r) => r.date >= '2026-10'));
    }
  }, [data.quotesRaw, isDirty]);

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // 개별 행 카테고리 수동 지정 변경 — 변경된 sno를 pendingOverrides에 기록
  const handleUpdateQuoteCategory = (idOrIndex: string | number, newCategory: string) => {
    let changedSno: string | undefined;
    let changedId: string | undefined;
    let prevCategory = '';
    const updated = localQuotes.map((q, idx) => {
      const match = typeof idOrIndex === 'string' ? q.id === idOrIndex : idx === idOrIndex;
      if (match) {
        changedSno = String(q.sno ?? '');
        changedId = q.id;
        prevCategory = q.category;
        return { ...q, category: newCategory };
      }
      return q;
    });
    setLocalQuotes(updated);
    setIsDirty(true);
    setSaveMsg(null);
    if (changedSno) {
      const sno = changedSno;
      const original = originals.has(sno) ? originals.get(sno)! : prevCategory;
      // 원래 값으로 되돌리면 저장할 변경에서 뺀다
      if (newCategory === original) {
        setPendingOverrides((prev) => {
          const next = new Map(prev);
          next.delete(sno);
          return next;
        });
        setOriginals((prev) => {
          const next = new Map(prev);
          next.delete(sno);
          return next;
        });
      } else {
        setPendingOverrides((prev) => new Map(prev).set(sno, newCategory));
        setOriginals((prev) => (prev.has(sno) ? prev : new Map(prev).set(sno, original)));
      }
    }
    // 화면에는 10월 이후만 보이지만 앱 전체 원장은 지난달까지 들고 있다 — 바뀐 한 건만 갈아 끼운다
    if (onUpdateQuotesRaw && changedId) {
      onUpdateQuotesRaw(data.quotesRaw.map((q) => (q.id === changedId ? { ...q, category: newCategory } : q)));
    }
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
        body: JSON.stringify({ key, action: 'saveManualCategories', overrides, by: user?.email || user?.name || '' }),
      });
      const json = await res.json();
      if (json.success) {
        setSaveMsg({ text: `${overrides.length}건 저장됨. 다음 동기화(최대 15분) 후 전체 통계에 반영됩니다.`, ok: true });
        // 저장한 행은 '수동 지정' 흔적으로 바로 바꿔 보여 준다 (다음 동기화 전에도)
        const at = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 19);
        const by = user?.email || user?.name || undefined;
        setLocalQuotes((prev) =>
          prev.map((q) => {
            const cat = pendingOverrides.get(String(q.sno ?? ''));
            return cat ? { ...q, manual: { category: cat, at, ...(by ? { by } : {}) } } : q;
          })
        );
        setPendingOverrides(new Map());
        setOriginals(new Map());
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
      const original = baseQuotes.current;
      setLocalQuotes(original.filter((r) => r.date >= '2026-10'));
      setIsDirty(false);
      setPendingOverrides(new Map());
      setSaveMsg(null);
      if (onUpdateQuotesRaw) onUpdateQuotesRaw(original);
    }
  };

  // 로그인한 관리자에게만 그려진다 (App 에서 막는다)
  return (
    <div className="admin-view">
      <ViewHeader
        title="어드민 관리"
        description="견적 접수 원본 리스트(Google 시트) 및 표준 카테고리 수동 지정 · 데이터 저장 관리"
        status="live"
      />

      {saveMsg && <Notice tone={saveMsg.ok ? 'ok' : 'warn'}>{saveMsg.text}</Notice>}

      {/* 견적 원본 스프레드시트 관리 테이블 */}
      <div className="admin-body">
        <QuotesRawAdminTable
          quotes={localQuotes}
          originals={originals}
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
