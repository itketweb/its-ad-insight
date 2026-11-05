import React, { useMemo, useState } from 'react';
import type { CategoryMap, DashboardData, QuoteRawRow, QuoteRow, SyncStatus } from '../types/dashboard';
import { cat1Of, fmt, mLabel, QUOTE_COLORS, quoteChartCats, SERIES_DEFS, sumBy } from '../utils/format';
import { dotYm, monthsUpTo, periodStartsOf, yearRangeLabel, yearsOf } from '../utils/allPeriod';
import { searchDashboard, type SearchTab } from '../utils/search';
import { adDisplayTitle } from '../utils/creativeImage';
import { ViewHeader } from '../components/common/ViewHeader';
import { KpiCard } from '../components/charts/KpiCard';
import { MultiChart } from '../components/charts/MultiChart';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import { TabButton } from '../components/common/TabButton';
import { LIST_LIMIT, ShowMoreButton } from '../components/common/MoreButton';
import { MediaPill } from '../components/common/MediaPill';
import { useSort } from '../hooks/useSort';
import { SortableTh } from '../components/common/SortableTh';

interface SearchViewProps {
  data: DashboardData;
  categoryMap: CategoryMap;
  status: SyncStatus;
  query: string;
  initialTab?: SearchTab;
  selectedMonth: string;
  allPeriod?: boolean;
  yearTotal?: boolean;
  isLoggedIn: boolean;
  onLogin: () => void;
  onSelectAllPeriod: () => void;
}

const TITLE = '검색 결과';
const DESCRIPTION = '검색어와 관련된 광고와 견적을 한 화면에 요약합니다';
const CUSTOMER_FALLBACK = '–';
const SEARCH_HINT = '화면 위쪽 돋보기 버튼이나 Ctrl+K로 검색할 수 있습니다.';

const BREAKDOWN_LIMIT = 5;
const INQUIRY_WEB = '견적문의';

/** 견적을 키별로 세어 많은 순으로 — 비어 있는 값은 emptyLabel 로 모아 맨 뒤에 둔다 */
function breakdownOf(rows: QuoteRawRow[], keyOf: (r: QuoteRawRow) => string, emptyLabel: string) {
  const counts = new Map<string, number>();
  rows.forEach((r) => {
    const k = keyOf(r) || emptyLabel;
    counts.set(k, (counts.get(k) || 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => (a[0] === emptyLabel ? 1 : b[0] === emptyLabel ? -1 : b[1] - a[1]));
}

const ctr = (clk: number, imp: number) => (imp > 0 ? `${((clk / imp) * 100).toFixed(2)}%` : '–');

export const SearchView: React.FC<SearchViewProps> = ({
  data,
  categoryMap,
  status,
  query,
  initialTab,
  selectedMonth,
  allPeriod = false,
  yearTotal = false,
  isLoggedIn,
  onLogin,
  onSelectAllPeriod,
}) => {
  const months = useMemo(
    () => (allPeriod ? null : yearTotal ? monthsUpTo(selectedMonth) : [selectedMonth]),
    [allPeriod, yearTotal, selectedMonth]
  );
  const result = useMemo(
    () => (query ? searchDashboard(data, categoryMap, query, months) : null),
    [data, categoryMap, query, months]
  );
  // 추이 차트는 한 달을 골라도 그 해 1월~기준월 흐름을 보여 준다
  const chartMonths = useMemo(() => (allPeriod ? null : monthsUpTo(selectedMonth)), [allPeriod, selectedMonth]);
  const chartResult = useMemo(
    () => (query && !allPeriod && !yearTotal ? searchDashboard(data, categoryMap, query, chartMonths) : result),
    [data, categoryMap, query, allPeriod, yearTotal, chartMonths, result]
  );
  const [tab, setTab] = useState<SearchTab | null>(initialTab || null);
  const [showAll, setShowAll] = useState(false);

  const { sortKey: gKey, sortOrder: gOrd, toggleSort: gSort } = useSort<'imp' | 'clk' | 'conv' | 'cost'>('cost');
  const { sortKey: kKey, sortOrder: kOrd, toggleSort: kSort } = useSort<'bid' | 'quality' | 'imp' | 'clk' | 'conv' | 'cost'>('cost');
  const { sortKey: aKey, sortOrder: aOrd, toggleSort: aSort } = useSort<'imp' | 'clk' | 'cost'>('cost');

  const periodLabel = allPeriod
    ? '전체 기간'
    : yearTotal
      ? yearRangeLabel(selectedMonth)
      : `${selectedMonth.slice(0, 4)}년 ${mLabel(selectedMonth)}`;

  if (!query || !result) {
    return (
      <div className="view on" data-view="search" data-title={TITLE}>
        <ViewHeader title={TITLE} description={DESCRIPTION} status={status} />
        <Card name="empty" id="search-empty">
          <EmptyState message="검색어를 입력해 주세요." subMessage={SEARCH_HINT} />
        </Card>
      </div>
    );
  }

  const counts: Record<SearchTab, number> = {
    groups: result.groups.length,
    keywords: result.keywords.length,
    ads: result.ads.length,
    quotes: result.quotes.length,
  };
  const total = counts.groups + counts.keywords + counts.ads + counts.quotes;

  if (!total) {
    return (
      <div className="view on" data-view="search" data-title={TITLE}>
        <ViewHeader title={`"${query}" ${TITLE}`} description={DESCRIPTION} status={status} />
        <Card name="empty" id="search-empty">
          <EmptyState message={`${periodLabel}에 "${query}"와 일치하는 결과가 없습니다.`} subMessage={SEARCH_HINT} />
          {!allPeriod && (
            <div className="search-actions">
              <Button size="sm" className="btn-search-all" id="btn-search-all" data-btn="search-all" onClick={onSelectAllPeriod}>
                전체 기간에서 찾기
              </Button>
            </div>
          )}
        </Card>
      </div>
    );
  }

  const TABS: { id: SearchTab; label: string }[] = [
    { id: 'groups', label: '캠페인·광고그룹' },
    { id: 'keywords', label: '키워드' },
    { id: 'ads', label: '소재' },
    { id: 'quotes', label: '견적' },
  ];
  const activeTab = tab && counts[tab] ? tab : TABS.find((t) => counts[t.id])!.id;
  const changeTab = (t: SearchTab) => {
    setTab(t);
    setShowAll(false);
  };
  const limit = showAll ? undefined : LIST_LIMIT;

  // 추이 차트의 가로축 — 전체 기간은 연도, 그 밖에는 그 해 1월~기준월
  const chartSpend = chartResult?.spendRows || [];
  const rawQuotes = chartResult?.quotes || [];
  const queryTokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  // 카테고리명에 검색어가 포함된 경우만 직접 매칭으로 본다
  const isCatMatch = (r: QuoteRawRow) => queryTokens.some((t) => (r.category || '').toLowerCase().includes(t));
  const catMatchCount = rawQuotes.filter(isCatMatch).length;
  // 직접 매칭이 20% 미만이면 브랜드·고객 검색으로 보고 모든 카테고리를 그대로 표시
  const useCatFilter = catMatchCount >= rawQuotes.length * 0.2;
  const CAT_OTHER = '기타 카테고리';
  const chartQuotes: QuoteRow[] = rawQuotes.map((r) => ({
    month: r.date.slice(0, 7),
    category: useCatFilter && !isCatMatch(r) ? CAT_OTHER : r.category,
    source: r.source,
    count: 1,
  }));
  // breakdown 카테고리도 차트와 동일한 필터 적용
  const listCatFilter = result.quotes.filter(isCatMatch).length >= result.quotes.length * 0.2;
  const axis = allPeriod
    ? yearsOf([...chartSpend.map((r) => r.month), ...chartQuotes.map((r) => r.month)])
    : monthsUpTo(selectedMonth);
  const axisLabels = axis.map((key) => (allPeriod ? `${key}년` : mLabel(key)));
  const spendSeries = SERIES_DEFS.map((s) => ({
    k: s.k,
    c: s.c,
    raw: axis.map((key) => sumBy(chartSpend.filter((r) => r.month.startsWith(key)).filter(s.f), (r) => r.cost)),
  }))
    .filter((s) => s.raw.some((v) => v))
    .map((s) => ({ ...s, v: s.raw.map((v) => v / 1e4) }));
  const quoteCats = quoteChartCats(chartQuotes);
  const quoteSeries = quoteCats.keys
    .map((k, i) => ({
      k,
      c: QUOTE_COLORS[i % QUOTE_COLORS.length],
      v: axis.map((key) =>
        sumBy(chartQuotes.filter((r) => r.month.startsWith(key) && quoteCats.keyOf(r.category) === k), (r) => r.count)
      ),
    }))
    .filter((s) => s.v.some((x) => x));

  const cpaFrom = periodStartsOf(data).cpaFrom;
  const otherQuotes = result.quotes.length - result.itketQuotes;

  // 견적 구성 — 제목·고객 정보 없이 건수만이라 로그아웃 상태에서도 보여 준다
  const breakdowns = [
    { title: '카테고리', rows: breakdownOf(result.quotes, (r) => listCatFilter && !isCatMatch(r) ? CAT_OTHER : cat1Of(r.category || '기타'), '기타') },
    { title: '유입 매체', rows: breakdownOf(result.quotes.filter((r) => !r.inquiryType), (r) => (r.source === '미수집' ? '' : r.source), '미수집') },
    { title: '문의 유형', rows: breakdownOf(result.quotes, (r) => r.inquiryType || INQUIRY_WEB, '기타') },
    { title: '담당자', rows: breakdownOf(result.quotes, (r) => r.salesRep || '', '미지정') },
  ];

  return (
    <div className="view on" data-view="search" data-title={TITLE}>
      <ViewHeader title={`"${query}" ${TITLE}`} description={DESCRIPTION} status={status} />

      <p className="leg-note quote-src-note">
          ※ {periodLabel} 기준입니다. 광고비는 이름·카테고리·매체가 일치한 광고그룹과 일치한 키워드의 합계이고, 견적은 제목·카테고리·유입 매체 일치 건입니다(유입 매체는 2026년 10월부터 추적). 서로 직접 연결된 값이 아니어서 CPA는 추정치입니다.
      </p>

      <div className="kpis" id="kpiSearch">
        <KpiCard
          label="광고비"
          value={`${fmt(result.cost)}원`}
          sub={`광고그룹 ${fmt(counts.groups)}개${result.keywordOnlyGroups ? ` · 키워드만 일치 ${fmt(result.keywordOnlyGroups)}개 그룹` : ''}`}
        />
        <KpiCard label="클릭" value={fmt(result.clk)} sub={`노출 ${fmt(result.imp)} · CTR ${ctr(result.clk, result.imp)} · 전환 ${fmt(result.conv)}`} />
        <KpiCard
          label="접수 견적"
          value={`${fmt(result.quotes.length)}건`}
          sub={`아이티켓 ${fmt(result.itketQuotes)}건${otherQuotes ? ` · 그 외 ${fmt(otherQuotes)}건` : ''}`}
        />
        <KpiCard
          label={
            <>
              추정 CPA <small className="muted">(아이티켓 기준)</small>
            </>
          }
          value={result.cpa ? `${fmt(result.cpa)}원` : '–'}
          sub={result.cpaHidden ? '매체·유입 경로 검색은 추적 기간이 달라 계산하지 않습니다' : `${dotYm(cpaFrom)} 이후 기준`}
        />
      </div>

      <div className="grid">
        <MultiChart
          id="chSearchSpend"
          title={allPeriod ? '연도별 광고비' : '월별 광고비'}
          labels={axisLabels}
          series={spendSeries}
          unit="만원"
          emptyMessage="일치하는 광고비가 없습니다."
        />
        <MultiChart
          id="chSearchQuotes"
          title={allPeriod ? '연도별 견적 접수' : '월별 견적 접수'}
          labels={axisLabels}
          series={quoteSeries}
          unit="건"
          emptyMessage="일치하는 견적이 없습니다."
        />
      </div>

      <Card name="search-list" id="search-list">
        <h3>일치 항목</h3>
        <div className="kw-tabs">
          {TABS.map((t) => (
            <TabButton
              key={t.id}
              className="btn-search-tab"
              data-btn={`search-tab-${t.id}`}
              active={activeTab === t.id}
              label={t.label}
              count={counts[t.id]}
              disabled={!counts[t.id]}
              onClick={() => changeTab(t.id)}
            />
          ))}
        </div>

        <div className="tw">
          {activeTab === 'groups' && (
            <table className="stk" id="tbSearchGroups">
              <thead>
                <tr>
                  <th>캠페인 › 광고그룹</th>
                  <SortableTh className="n" sortKey="imp" activeKey={gKey} order={gOrd} onSort={gSort}>노출</SortableTh>
                  <SortableTh className="n" sortKey="clk" activeKey={gKey} order={gOrd} onSort={gSort}>클릭</SortableTh>
                  <SortableTh className="n" sortKey="conv" activeKey={gKey} order={gOrd} onSort={gSort}>전환</SortableTh>
                  <SortableTh className="n" sortKey="cost" activeKey={gKey} order={gOrd} onSort={gSort}>광고비</SortableTh>
                </tr>
              </thead>
              <tbody>
                {[...result.groups].sort((a, b) => (gOrd === 'asc' ? 1 : -1) * (a[gKey] - b[gKey])).slice(0, limit).map((g) => (
                  <tr key={`${g.media}|${g.type}|${g.campaign}|${g.adgroup}`}>
                    <td>
                      <span className="s-media-row"><MediaPill media={g.media} iconOnly size={14} />{g.campaign} › {g.adgroup} <small className="muted">{g.type}</small></span>
                    </td>
                    <td className="n">{fmt(g.imp)}</td>
                    <td className="n">{fmt(g.clk)}</td>
                    <td className="n">{fmt(g.conv)}</td>
                    <td className="n">{fmt(g.cost)}원</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'keywords' && (
            <table className="stk" id="tbSearchKeywords">
              <thead>
                <tr>
                  <th>키워드</th>
                  <th>캠페인 › 광고그룹</th>
                  <SortableTh className="n" sortKey="bid" activeKey={kKey} order={kOrd} onSort={kSort}>입찰가</SortableTh>
                  <SortableTh className="n" sortKey="quality" activeKey={kKey} order={kOrd} onSort={kSort}>품질지수</SortableTh>
                  <SortableTh className="n" sortKey="imp" activeKey={kKey} order={kOrd} onSort={kSort}>노출</SortableTh>
                  <SortableTh className="n" sortKey="clk" activeKey={kKey} order={kOrd} onSort={kSort}>클릭</SortableTh>
                  <SortableTh className="n" sortKey="conv" activeKey={kKey} order={kOrd} onSort={kSort}>전환</SortableTh>
                  <SortableTh className="n" sortKey="cost" activeKey={kKey} order={kOrd} onSort={kSort}>광고비</SortableTh>
                </tr>
              </thead>
              <tbody>
                {[...result.keywords].sort((a, b) => (kOrd === 'asc' ? 1 : -1) * (a[kKey] - b[kKey])).slice(0, limit).map((k) => (
                  <tr key={`${k.media}|${k.campaign}|${k.adgroup}|${k.keyword}|${k.match || ''}`}>
                    <td>
                      <span className="s-media-row"><MediaPill media={k.media} iconOnly size={14} /><b>{k.keyword}</b></span>
                    </td>
                    <td className="search-sub">
                      {k.campaign} › {k.adgroup}
                    </td>
                    <td className="n">{k.bid ? `${fmt(k.bid)}원` : '–'}</td>
                    <td className="n">{k.quality || '–'}</td>
                    <td className="n">{fmt(k.imp)}</td>
                    <td className="n">{fmt(k.clk)}</td>
                    <td className="n">{fmt(k.conv)}</td>
                    <td className="n">{fmt(k.cost)}원</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'ads' && (
            <table className="stk" id="tbSearchAds">
              <thead>
                <tr>
                  <th>소재</th>
                  <th>캠페인 › 광고그룹</th>
                  <SortableTh className="n" sortKey="imp" activeKey={aKey} order={aOrd} onSort={aSort}>노출</SortableTh>
                  <SortableTh className="n" sortKey="clk" activeKey={aKey} order={aOrd} onSort={aSort}>클릭</SortableTh>
                  <SortableTh className="n" sortKey="cost" activeKey={aKey} order={aOrd} onSort={aSort}>광고비</SortableTh>
                </tr>
              </thead>
              <tbody>
                {[...result.ads].sort((a, b) => (aOrd === 'asc' ? 1 : -1) * ((a.stat?.[aKey] ?? 0) - (b.stat?.[aKey] ?? 0))).slice(0, limit).map(({ ad, stat }) => (
                  <tr key={`${ad.media}|${ad.adId}`}>
                    <td>
                      <span className="s-media-row"><MediaPill media={ad.media} iconOnly size={14} />{adDisplayTitle(ad)}</span>
                    </td>
                    <td className="search-sub">
                      {ad.campaign} › {ad.adgroup}
                    </td>
                    <td className="n">{stat ? fmt(stat.imp) : '–'}</td>
                    <td className="n">{stat ? fmt(stat.clk) : '–'}</td>
                    <td className="n">{stat ? `${fmt(stat.cost)}원` : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'quotes' && (
            <div className="search-breakdown" id="searchBreakdown">
              {breakdowns.map((b) => (
                <div key={b.title} className="search-breakdown-col">
                  <h4>{b.title}</h4>
                  {b.rows.slice(0, showAll ? undefined : BREAKDOWN_LIMIT).map(([k, n]) => (
                    <p key={k}>
                      <span title={k}>{k}</span>
                      <b>{fmt(n)}건</b>
                    </p>
                  ))}
                  {!showAll && b.rows.length > BREAKDOWN_LIMIT && <small className="muted">외 {fmt(b.rows.length - BREAKDOWN_LIMIT)}개</small>}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'quotes' &&
            (isLoggedIn ? (
              <table className="stk" id="tbSearchQuotes">
                <thead>
                  <tr>
                    <th>접수일</th>
                    <th>제목</th>
                    <th>고객</th>
                    <th>카테고리</th>
                    <th>유입</th>
                    <th>담당자</th>
                  </tr>
                </thead>
                <tbody>
                  {result.quotes.slice(0, limit).map((r, i) => (
                    <tr key={r.id || i}>
                      <td className="search-nowrap">{r.date.slice(0, 10)}</td>
                      <td>{r.subject || CUSTOMER_FALLBACK}</td>
                      <td>{[r.company, r.name].filter(Boolean).join(' · ') || CUSTOMER_FALLBACK}</td>
                      <td>{r.category || CUSTOMER_FALLBACK}</td>
                      <td>{r.inquiryType || r.source || CUSTOMER_FALLBACK}</td>
                      <td>{r.salesRep || CUSTOMER_FALLBACK}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="leg-note search-login-note">
                견적 제목과 고객 정보는 로그인 후 볼 수 있습니다.{' '}
                <Button variant="link" className="btn-search-login" id="btn-search-login" data-btn="search-login" onClick={onLogin}>
                  로그인
                </Button>
              </p>
            ))}
        </div>

        <ShowMoreButton
          noun={TABS.find((t) => t.id === activeTab)?.label}
          total={counts[activeTab]}
          expanded={showAll}
          onToggle={() => setShowAll((v) => !v)}
        />
      </Card>
    </div>
  );
};
