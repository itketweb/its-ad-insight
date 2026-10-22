import React, { useMemo, useState } from 'react';
import type { QuoteRawRow } from '../../types/dashboard';
import { EXTERNAL_LINKS } from '../../utils/constants';
import { fmt, QUOTE_CATS, sourceColorVar } from '../../utils/format';
import { Dropdown } from '../common/Dropdown';
import { SortIcon } from '../common/SortIcon';
import { Tooltip } from '../common/Tooltip';

interface QuotesRawAdminTableProps {
  quotes: QuoteRawRow[];
  onUpdateQuoteCategory?: (quoteIdOrIndex: string | number, newCategory: string) => void;
  isDirty?: boolean;
  onSave?: () => void;
  onReset?: () => void;
  saving?: boolean;
}

type SortKey = 'idx' | 'sno' | 'date' | 'subject' | 'company' | 'name' | 'email' | 'category' | 'source';
type SortOrder = 'asc' | 'desc';

export const QuotesRawAdminTable: React.FC<QuotesRawAdminTableProps> = ({
  quotes,
  onUpdateQuoteCategory,
  isDirty,
  onSave,
  onReset,
  saving,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('ALL');
  const [selectedSource, setSelectedSource] = useState('ALL');
  const [selectedYear, setSelectedYear] = useState('ALL');
  const thisMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const [scopeMonth, setScopeMonth] = useState<string>('cur');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const categories = useMemo(() => {
    const list = Array.from(new Set([...QUOTE_CATS, ...quotes.map((q) => q.category).filter(Boolean)]));
    return ['ALL', ...list];
  }, [quotes]);

  const sources = useMemo(() => {
    return ['ALL', ...Array.from(new Set(quotes.map((q) => q.source).filter(Boolean)))];
  }, [quotes]);

  const years = useMemo(() => {
    return ['ALL', ...Array.from(new Set(quotes.map((q) => q.date?.slice(0, 4)).filter(Boolean))).sort().reverse()];
  }, [quotes]);

  // 행 식별 키 (id 우선, 없으면 sno, 없으면 index)
  const getRowKey = (q: QuoteRawRow, index: number): string | number => {
    return q.id ?? q.sno ?? index;
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
    setPage(1);
  };

  // 필터링 및 정렬 (원래 인덱스를 유지하여 식별)
  const filteredQuotesWithIndex = useMemo(() => {
    return quotes
      .map((q, originalIndex) => ({ q, originalIndex }))
      .filter(({ q }) => {
        if (selectedCat !== 'ALL' && q.category !== selectedCat) return false;
        if (selectedSource !== 'ALL' && q.source !== selectedSource) return false;
        if (scopeMonth === 'cur' && !q.date?.startsWith(thisMonth)) return false;
        if (selectedYear !== 'ALL' && !q.date?.startsWith(selectedYear)) return false;
        if (search) {
          const s = search.toLowerCase();
          const match =
            String(q.sno || '').toLowerCase().includes(s) ||
            String(q.subject || '').toLowerCase().includes(s) ||
            String(q.company || '').toLowerCase().includes(s) ||
            String(q.name || '').toLowerCase().includes(s) ||
            String(q.email || '').toLowerCase().includes(s) ||
            String(q.date || '').toLowerCase().includes(s) ||
            String(q.category || '').toLowerCase().includes(s) ||
            String(q.source || '').toLowerCase().includes(s);
          if (!match) return false;
        }
        return true;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortKey === 'idx') {
          diff = a.originalIndex - b.originalIndex;
        } else if (sortKey === 'sno') {
          diff = Number(a.q.sno || 0) - Number(b.q.sno || 0);
        } else if (sortKey === 'date') {
          diff = (a.q.date || '').localeCompare(b.q.date || '');
        } else if (sortKey === 'subject') {
          diff = (a.q.subject || '').localeCompare(b.q.subject || '');
        } else if (sortKey === 'company') {
          diff = (a.q.company || '').localeCompare(b.q.company || '');
        } else if (sortKey === 'name') {
          diff = (a.q.name || '').localeCompare(b.q.name || '');
        } else if (sortKey === 'email') {
          diff = (a.q.email || '').localeCompare(b.q.email || '');
        } else if (sortKey === 'category') {
          diff = (a.q.category || '').localeCompare(b.q.category || '');
        } else if (sortKey === 'source') {
          diff = (a.q.source || '').localeCompare(b.q.source || '');
        }
        return sortOrder === 'asc' ? diff : -diff;
      });
  }, [quotes, selectedCat, selectedSource, selectedYear, scopeMonth, thisMonth, search, sortKey, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filteredQuotesWithIndex.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const pageNumbers = useMemo((): (number | 'ellipsis')[] => {
    const delta = 2;
    const result: (number | 'ellipsis')[] = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
        result.push(i);
      } else if (result[result.length - 1] !== 'ellipsis') {
        result.push('ellipsis');
      }
    }
    return result;
  }, [currentPage, totalPages]);

  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredQuotesWithIndex.slice(start, start + pageSize);
  }, [filteredQuotesWithIndex, currentPage, pageSize]);

  // CSV 내보내기 (구글 스프레드시트 전체 원본 열 기준 1:1 출력)
  const handleExportCsv = () => {
    const headers = ['번호', '제목', '작성자', '회사명', '이메일', '접수날짜', '유입경로', '표준카테고리'];
    const rows = filteredQuotesWithIndex.map(({ q, originalIndex }) => [
      `"${q.sno || originalIndex + 1}"`,
      `"${(q.subject || '').replace(/"/g, '""')}"`,
      `"${(q.name || '').replace(/"/g, '""')}"`,
      `"${(q.company || '').replace(/"/g, '""')}"`,
      `"${q.email || ''}"`,
      `"${q.date || ''}"`,
      `"${q.source || ''}"`,
      `"${q.category || ''}"`,
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `quotes_raw_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="card card-admin-quotes" id="card-admin-quotes" data-card="admin-quotes">
      {/* 카드 헤더 및 툴바 */}
      <div className="qr-head">
        <div className="qr-head-meta">
          <h3 className="qr-title">
            견적 접수 원본 리스트 (Google 스프레드시트 연동)
            <span className="qr-count muted">
              총 <b>{fmt(quotes.length)}</b>건 중 <b>{fmt(filteredQuotesWithIndex.length)}</b>건 표시
            </span>
            {isDirty && <span className="qr-unsaved">● 미저장 변경사항 있음</span>}
          </h3>
          <p className="qr-sheet-info">
            시트 ID: <code>18tMYBQLuIhkmX_x_c8MK-aNXlGvOgz1TWauvqo8Dmjg</code> · 카테고리 수동 재분류 가능
          </p>
        </div>

        <div className="qr-head-actions">
          <a
            href={EXTERNAL_LINKS.quotesRawSheet}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-sheet-link"
            id="btn-admin-sheet-link"
            data-btn="sheet-link"
          >
            <span>시트 원본 열기</span>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>

          <button
            type="button"
            className="btn btn-export-csv"
            id="btn-admin-export-csv"
            data-btn="export-csv"
            onClick={handleExportCsv}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>CSV 다운로드</span>
          </button>

          {isDirty && onReset && (
            <button
              type="button"
              className="btn btn-reset-quotes"
              id="btn-admin-reset-quotes"
              data-btn="reset-quotes"
              onClick={onReset}
              disabled={saving}
            >
              수정 취소
            </button>
          )}

          {onSave && (
            <button
              type="button"
              className="btn acc btn-save-supabase"
              id="btn-admin-save-supabase"
              data-btn="save-supabase"
              onClick={onSave}
              disabled={saving}
              style={{
                boxShadow: isDirty ? '0 2px 8px rgba(37, 99, 235, 0.35)' : 'none',
                cursor: saving ? 'wait' : 'pointer',
              }}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              <span>{saving ? '저장 중...' : isDirty ? '변경사항 저장' : '저장'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 필터 바 */}
      <div className="qr-filter">
        <div className="qr-filter-item">
          <Dropdown
            ariaLabel="기간 선택"
            value={scopeMonth}
            options={[
              { value: 'cur', label: `${thisMonth.replace('-', '년 ')}월 (이번 달)` },
              { value: 'ALL', label: '전체 기간' },
            ]}
            onChange={(v) => { setScopeMonth(v); setPage(1); }}
          />
        </div>

        <label className="qr-filter-item">
          <input
            type="text"
            placeholder="제목, 회사명, 성명, 카테고리..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </label>

        <div className="qr-filter-item">
          <Dropdown
            ariaLabel="연도 선택"
            value={selectedYear}
            options={years.map((y) => ({ value: y, label: y === 'ALL' ? '연도 전체' : `${y}년` }))}
            onChange={(v) => { setSelectedYear(v); setPage(1); }}
          />
        </div>

        <div className="qr-filter-item">
          <Dropdown
            ariaLabel="카테고리 선택"
            value={selectedCat}
            options={categories.map((c) => ({ value: c, label: c === 'ALL' ? '카테고리 전체' : c }))}
            onChange={(v) => { setSelectedCat(v); setPage(1); }}
          />
        </div>

        <div className="qr-filter-item">
          <Dropdown
            ariaLabel="유입경로 선택"
            value={selectedSource}
            options={sources.map((s) => ({ value: s, label: s === 'ALL' ? '유입경로 전체' : s }))}
            onChange={(v) => { setSelectedSource(v); setPage(1); }}
          />
        </div>

        <div className="qr-filter-item ml-auto">
          <Dropdown
            ariaLabel="페이지당 표시 개수"
            value={pageSize}
            options={[
              { value: 20, label: '20개씩' },
              { value: 50, label: '50개씩' },
              { value: 100, label: '100개씩' },
              { value: 200, label: '200개씩' },
            ]}
            onChange={(v) => { setPageSize(v); setPage(1); }}
          />
        </div>
      </div>

      <div className="qr-table-wrap">
        <table className="tbl tw stk" style={{ width: '100%', fontSize: '0.8125rem', whiteSpace: 'nowrap', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th
                className={`sortable${sortKey === 'sno' ? ' sorted' : ''}`}
                style={{ width: '4.5rem', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('sno')}
              >
                <span className="th-sort-inner">
                  <span>번호</span>
                  <SortIcon active={sortKey === 'sno'} order={sortOrder} />
                </span>
              </th>
              <th
                className={`sortable${sortKey === 'date' ? ' sorted' : ''}`}
                style={{ width: '7rem', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('date')}
              >
                <span className="th-sort-inner">
                  <span>접수날짜</span>
                  <SortIcon active={sortKey === 'date'} order={sortOrder} />
                </span>
              </th>
              <th
                className={`sortable${sortKey === 'subject' ? ' sorted' : ''}`}
                style={{ width: '16rem', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('subject')}
              >
                <span className="th-sort-inner">
                  <span>제목 (문의 내용)</span>
                  <SortIcon active={sortKey === 'subject'} order={sortOrder} />
                </span>
              </th>
              <th
                className={`sortable${sortKey === 'company' ? ' sorted' : ''}`}
                style={{ width: '10rem', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('company')}
              >
                <span className="th-sort-inner">
                  <span>회사명</span>
                  <SortIcon active={sortKey === 'company'} order={sortOrder} />
                </span>
              </th>
              <th
                className={`sortable${sortKey === 'name' ? ' sorted' : ''}`}
                style={{ width: '6.5rem', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('name')}
              >
                <span className="th-sort-inner">
                  <span>작성자</span>
                  <SortIcon active={sortKey === 'name'} order={sortOrder} />
                </span>
              </th>
              <th
                className={`sortable${sortKey === 'email' ? ' sorted' : ''}`}
                style={{ width: '10.5rem', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('email')}
              >
                <span className="th-sort-inner">
                  <span>이메일</span>
                  <SortIcon active={sortKey === 'email'} order={sortOrder} />
                </span>
              </th>
              <th
                className={`sortable${sortKey === 'category' ? ' sorted' : ''}`}
                style={{ width: '11rem', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('category')}
              >
                <span className="th-sort-inner">
                  <span>표준 카테고리 (수동 지정)</span>
                  <SortIcon active={sortKey === 'category'} order={sortOrder} />
                </span>
              </th>
              <th
                className={`sortable${sortKey === 'source' ? ' sorted' : ''}`}
                style={{ width: '9.5rem', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('source')}
              >
                <span className="th-sort-inner">
                  <span>유입경로</span>
                  <SortIcon active={sortKey === 'source'} order={sortOrder} />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--sub)' }}>
                  조회 조건에 해당하는 견적 접수 내역이 없습니다.
                </td>
              </tr>
            ) : (
              pageItems.map(({ q, originalIndex }) => {
                const rowKey = getRowKey(q, originalIndex);

                return (
                  <tr key={rowKey}>
                    <td style={{ fontFamily: 'monospace', color: 'var(--sub)' }}>
                      {q.sno || '–'}
                    </td>
                    <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>
                      {q.date || '–'}
                    </td>
                    <Tooltip content={q.subject}>
                      <td style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {q.subject || '–'}
                      </td>
                    </Tooltip>
                    <td>
                      <Tooltip content={q.company}>
                        <span className="cell-truncate">{q.company || '–'}</span>
                      </Tooltip>
                    </td>
                    <td>
                      <Tooltip content={q.name}>
                        <span className="cell-wrap">{q.name || '–'}</span>
                      </Tooltip>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{q.email || '–'}</td>
                    <td>
                      <Dropdown
                        className="dd-cat"
                        ariaLabel="카테고리 선택"
                        value={q.category || '기타'}
                        options={[
                          ...QUOTE_CATS.map((cat) => ({ value: cat, label: cat })),
                          ...(!QUOTE_CATS.includes(q.category) && q.category
                            ? [{ value: q.category, label: `${q.category} (기존)` }]
                            : []),
                        ]}
                        onChange={(v) => onUpdateQuoteCategory?.(rowKey, v)}
                      />
                    </td>
                    <td>
                      <span
                        style={{
                          color: `var(${sourceColorVar(q.source)})`,
                          fontWeight: q.source?.includes('광고') ? 600 : 'normal',
                        }}
                      >
                        {q.source || '미수집'}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      <div className="qr-pagination">
        <span className="qr-pagination-info">
          {filteredQuotesWithIndex.length > 0
            ? `${fmt((currentPage - 1) * pageSize + 1)} ~ ${fmt(Math.min(currentPage * pageSize, filteredQuotesWithIndex.length))}건 (전체 ${fmt(filteredQuotesWithIndex.length)}건)`
            : '0건'}
        </span>

        <div className="qr-pagination-btns">
          <button type="button" className="pag-btn pag-arrow" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} title="이전 페이지">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          {pageNumbers.map((p, i) =>
            p === 'ellipsis' ? (
              <span key={`el-${i}`} className="pag-ellipsis">…</span>
            ) : (
              <button
                key={p}
                type="button"
                className={`pag-btn${p === currentPage ? ' active' : ''}`}
                onClick={() => setPage(p)}
                aria-current={p === currentPage ? 'page' : undefined}
              >
                {p}
              </button>
            )
          )}
          <button type="button" className="pag-btn pag-arrow" disabled={currentPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} title="다음 페이지">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
