import React, { useMemo, useState } from 'react';
import type { QuoteRawRow } from '../../types/dashboard';
import { EXTERNAL_LINKS } from '../../utils/constants';
import { fmt, sourceColorVar } from '../../utils/format';
import { ALL_CATEGORIES } from '../../utils/constants';
import { SkelRows } from '../common/SkeletonView';
import { Dropdown } from '../common/Dropdown';
import { Tooltip } from '../common/Tooltip';
import { Download, ExternalLink, Save } from 'lucide-react';
import { useSort } from '../../hooks/useSort';
import { SortableTh } from '../common/SortableTh';
import { Button, ButtonLink } from '../common/Button';
import { TextInput } from '../common/TextInput';
import { Pagination } from '../common/Pagination';
import { Card } from '../common/Card';

interface QuotesRawAdminTableProps {
  quotes: QuoteRawRow[];
  /** 실데이터를 받는 중 — 아직 없는 광고 꼬리표는 스켈레톤으로 보여 준다 */
  loading?: boolean;
  /** 저장 전 변경의 원래 값 (sno → 바꾸기 전 카테고리) */
  originals?: Map<string, string>;
  onUpdateQuoteCategory?: (quoteIdOrIndex: string | number, newCategory: string) => void;
  isDirty?: boolean;
  onSave?: () => void;
  onReset?: () => void;
  saving?: boolean;
}

type SortKey = 'idx' | 'sno' | 'date' | 'subject' | 'company' | 'name' | 'email' | 'category' | 'source';

/** '2026-10-23 14:51:00' → '10.23 14:51' */
const shortAt = (at: string) => {
  const m = at.match(/^\d{4}-(\d{2})-(\d{2})[ T](\d{2}:\d{2})/);
  return m ? `${m[1]}.${m[2]} ${m[3]}` : at;
};

/**
 * 카테고리 칸 아래 흔적 한 줄 — 저장 전 변경이면 원래 값, 저장된 수동 지정이면 저장 시각.
 * 마우스를 올리면 자동 분류 결과와 저장한 관리자를 보여 준다.
 */
const CategoryTrace: React.FC<{ quote: QuoteRawRow; original?: string }> = ({ quote, original }) => {
  if (original !== undefined) {
    return <span className="qr-cat-trace pending">저장 전 · 이전: {original || '없음'}</span>;
  }
  const m = quote.manual;
  if (!m) return null;
  const tip = [`자동 분류: ${quote.autoCategory || '–'}`, `수동 지정: ${m.category}`, m.by && `저장: ${m.by}`, m.at && `시각: ${m.at}`]
    .filter(Boolean)
    .join('\n');
  return (
    <span className="qr-cat-trace" title={tip}>
      수동 지정{m.at ? ` · ${shortAt(m.at)}` : ''}
    </span>
  );
};

export const QuotesRawAdminTable: React.FC<QuotesRawAdminTableProps> = ({
  quotes,
  loading = false,
  originals,
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
  const { sortKey, sortOrder, toggleSort } = useSort<SortKey>('date', 'asc');

  const categories = useMemo(() => {
    // 필터 목록: 실제 견적에 붙은 카테고리만 (분류표 순서, 분류표 밖 값은 뒤에)
    const used = new Set(quotes.map((q) => q.category).filter(Boolean));
    const list = [...ALL_CATEGORIES.filter((c) => used.has(c)), ...[...used].filter((c) => !ALL_CATEGORIES.includes(c))];
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
    toggleSort(key);
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
            String(q.source || '').toLowerCase().includes(s) ||
            q.sourceDetail.toLowerCase().includes(s);
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

  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredQuotesWithIndex.slice(start, start + pageSize);
  }, [filteredQuotesWithIndex, currentPage, pageSize]);

  // CSV 내보내기 (구글 스프레드시트 전체 원본 열 기준 1:1 출력)
  const handleExportCsv = () => {
    const headers = ['번호', '제목', '작성자', '회사명', '이메일', '접수날짜', '유입경로', '유입 광고', '표준카테고리'];
    const rows = filteredQuotesWithIndex.map(({ q, originalIndex }) => [
      `"${q.sno || originalIndex + 1}"`,
      `"${(q.subject || '').replace(/"/g, '""')}"`,
      `"${(q.name || '').replace(/"/g, '""')}"`,
      `"${(q.company || '').replace(/"/g, '""')}"`,
      `"${q.email || ''}"`,
      `"${q.date || ''}"`,
      `"${q.source || ''}"`,
      `"${q.sourceDetail.replace(/"/g, '""')}"`,
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
    <Card name="admin-quotes" id="card-admin-quotes">
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
          <ButtonLink
            href={EXTERNAL_LINKS.quotesRawSheet}
            size="sm"
            icon={ExternalLink}
            iconPosition="end"
            className="btn-sheet-link"
            id="btn-admin-sheet-link"
            data-btn="sheet-link"
          >
            시트 원본 열기
          </ButtonLink>

          <Button
            size="sm"
            icon={Download}
            className="btn-export-csv"
            id="btn-admin-export-csv"
            data-btn="export-csv"
            onClick={handleExportCsv}
          >
            CSV 다운로드
          </Button>

          {isDirty && onReset && (
            <Button
              size="sm"
              className="btn-reset-quotes"
              id="btn-admin-reset-quotes"
              data-btn="reset-quotes"
              onClick={onReset}
              disabled={saving}
            >
              수정 취소
            </Button>
          )}

          {onSave && (
            <Button
              variant="primary"
              size="sm"
              icon={Save}
              className={`btn-save-supabase${isDirty ? ' dirty' : ''}${saving ? ' saving' : ''}`}
              id="btn-admin-save-supabase"
              data-btn="save-supabase"
              onClick={onSave}
              disabled={saving}
            >
              {saving ? '저장 중...' : isDirty ? '변경사항 저장' : '저장'}
            </Button>
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
          <TextInput
            aria-label="검색"
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
        <table className="tbl tw stk qr-table">
          <thead>
            <tr>
              <SortableTh sortKey="sno" activeKey={sortKey} order={sortOrder} onSort={handleSort} className="col-sno">번호</SortableTh>
              <SortableTh sortKey="date" activeKey={sortKey} order={sortOrder} onSort={handleSort} className="col-date">접수날짜</SortableTh>
              <SortableTh sortKey="subject" activeKey={sortKey} order={sortOrder} onSort={handleSort} className="col-subject">제목 (문의 내용)</SortableTh>
              <SortableTh sortKey="company" activeKey={sortKey} order={sortOrder} onSort={handleSort} className="col-company">회사명</SortableTh>
              <SortableTh sortKey="name" activeKey={sortKey} order={sortOrder} onSort={handleSort} className="col-name">작성자</SortableTh>
              <SortableTh sortKey="email" activeKey={sortKey} order={sortOrder} onSort={handleSort} className="col-email">이메일</SortableTh>
              <SortableTh sortKey="category" activeKey={sortKey} order={sortOrder} onSort={handleSort} className="col-category">표준 카테고리 (수동 지정)</SortableTh>
              <SortableTh sortKey="source" activeKey={sortKey} order={sortOrder} onSort={handleSort} className="col-source">유입경로</SortableTh>
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 && loading ? (
              <SkelRows rows={8} widths={['3rem', '5rem', '60%', '50%', '4rem', '70%', '5rem', '5rem']} />
            ) : pageItems.length === 0 ? (
              <tr>
                <td colSpan={8} className="qr-empty">
                  조회 조건에 해당하는 견적 접수 내역이 없습니다.
                </td>
              </tr>
            ) : (
              pageItems.map(({ q, originalIndex }) => {
                const rowKey = getRowKey(q, originalIndex);

                return (
                  <tr key={rowKey}>
                    <td className="qr-sno">
                      {q.sno || '–'}
                    </td>
                    <td className="qr-date">
                      {q.date || '–'}
                    </td>
                    <Tooltip content={q.subject}>
                      <td className="qr-subject">
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
                    <td className="qr-email">{q.email || '–'}</td>
                    <td className="qr-cat">
                      <Dropdown
                        className={`dd-cat${originals?.has(String(q.sno ?? '')) ? ' is-changed' : ''}`}
                        ariaLabel="카테고리 선택"
                        value={q.category || '기타'}
                        options={[
                          ...ALL_CATEGORIES.map((cat) => ({ value: cat, label: cat })),
                          ...(!ALL_CATEGORIES.includes(q.category) && q.category
                            ? [{ value: q.category, label: `${q.category} (기존)` }]
                            : []),
                        ]}
                        onChange={(v) => onUpdateQuoteCategory?.(rowKey, v)}
                      />
                      <CategoryTrace quote={q} original={originals?.get(String(q.sno ?? ''))} />
                    </td>
                    <td className="qr-source" title={q.sourceDetail ? `${q.source} - ${q.sourceDetail}` : undefined}>
                      {/* 색은 유입경로마다 달라 인라인으로 둔다 */}
                      <span
                        className={`qr-src${q.source?.includes('광고') ? ' ad' : ''}`}
                        style={{ color: `var(${sourceColorVar(q.source)})` }}
                      >
                        {q.source || '미수집'}
                      </span>
                      {q.sourceDetail ? (
                        <span className="qr-src-detail">{q.sourceDetail}</span>
                      ) : (
                        // 광고 유입은 꼬리표(광고 이름)가 실데이터로 와서, 받는 동안 자리만 잡아 둔다
                        loading &&
                        q.source?.includes('광고') && <span className="qr-src-detail skel" aria-hidden="true" />
                      )}
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

        <Pagination page={currentPage} totalPages={totalPages} onChange={setPage} />
      </div>
    </Card>
  );
};
