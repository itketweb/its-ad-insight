import React, { useMemo, useState } from 'react';
import type { CategoryMap, DashboardData, KeywordRow, QuoteRawRow, QuoteRow, SyncStatus } from '../types/dashboard';
import { cat1Of, fmt, mLabel, quoteSeriesColor, quoteChartCats, SERIES_DEFS, sumBy } from '../utils/format';
import { dotYm, monthsUpTo, periodStartsOf, yearRangeLabel, yearsOf } from '../utils/allPeriod';
import { resultAdGroups, searchDashboard, type SearchTab } from '../utils/search';
import { campaignBuckets } from '../utils/keywordGroups';
import { adStatKey, groupAdsByAdgroup, type AdStat } from '../utils/creativeImage';
import { ViewHeader } from '../components/common/ViewHeader';
import { KpiCard, KpiSection } from '../components/charts/KpiCard';
import { MultiChart } from '../components/charts/MultiChart';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import { TabButton } from '../components/common/TabButton';
import { LIST_LIMIT, ShowMoreButton } from '../components/common/MoreButton';
import { MediaPill } from '../components/common/MediaPill';
import { useSort } from '../hooks/useSort';
import { ChevronRight } from 'lucide-react';
import { KeywordAccordionTable } from '../components/keywords/KeywordAccordionTable';
import { AdCreativesList } from '../components/keywords/AdCreativesList';
import { TableFootnote } from '../components/common/TableFootnote';
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

type KeywordSort = 'bid' | 'quality' | 'imp' | 'clk' | 'ctr' | 'conv' | 'cost';
const KEYWORD_COLS: { key: KeywordSort; label: string }[] = [
  { key: 'bid', label: '입찰가' },
  { key: 'quality', label: '품질지수' },
  { key: 'imp', label: '노출' },
  { key: 'clk', label: '클릭' },
  { key: 'ctr', label: 'CTR' },
  { key: 'conv', label: '전환' },
  { key: 'cost', label: '광고비' },
];
const keywordMetric = (k: KeywordRow, key: KeywordSort): number =>
  key === 'ctr' ? (k.imp > 0 ? k.clk / k.imp : 0) : k[key];

/** 견적 상세 펼침의 항목 — 값이 있는 것만 */
const quoteDetails = (r: QuoteRawRow): [string, string][] =>
  (
    [
      ['번호', String(r.sno ?? '')],
      ['사이트', !r.site ? '아이티켓' : r.site === 'phone' ? '전화문의' : r.site],
      ['유입 경로', [r.source, r.sourceDetail].filter(Boolean).join(' - ')],
      ['문의 유형', r.inquiryType || INQUIRY_WEB],
      ['이메일', r.email || ''],
      ['전화번호', r.phone || ''],
      ['접수자', r.receiver || ''],
    ] as [string, string][]
  ).filter(([, v]) => v);

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

  const { sortKey: kKey, sortOrder: kOrd, toggleSort: kSort } = useSort<KeywordSort>('cost');
  const { sortKey: qKey, sortOrder: qOrd, toggleSort: qSort } = useSort<'date'>('date');
  const [campTab, setCampTab] = useState(0);
  const [openQuotes, setOpenQuotes] = useState<Set<string>>(new Set());
  const toggleQuote = (key: string) =>
    setOpenQuotes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const adGroups = useMemo(() => (result ? resultAdGroups(result) : []), [result]);
  const campaigns = useMemo(() => campaignBuckets(adGroups), [adGroups]);
  const adCreatives = useMemo(() => groupAdsByAdgroup((result?.ads || []).map((a) => a.ad)), [result]);
  const adStats = useMemo(() => {
    const out: Record<string, AdStat> = {};
    (result?.ads || []).forEach(({ ad, stat }) => {
      if (stat) out[adStatKey(ad.media, ad.adId)] = stat;
    });
    return out;
  }, [result]);

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
    groups: adGroups.length,
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
    setCampTab(0);
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
      c: quoteSeriesColor(k, i),
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

      <KpiSection id="kpiSearch">
        <KpiCard
          label="광고비"
          value={`${fmt(result.cost)}원`}
          sub={`광고그룹 ${fmt(result.groups.length)}개${result.keywordOnlyGroups ? ` · 키워드만 일치 ${fmt(result.keywordOnlyGroups)}개 그룹` : ''}`}
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
      </KpiSection>

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

        {activeTab === 'groups' && (
          <KeywordAccordionTable
            title="캠페인·광고그룹"
            detailed
            topGroups={adGroups}
            campaigns={campaigns}
            month={selectedMonth}
            periodLabel={periodLabel}
            media="all"
            type="SA"
            kwTabIdx={campTab}
            onChangeTab={setCampTab}
          />
        )}

        {activeTab === 'ads' && (
          <AdCreativesList groups={adCreatives} stats={adStats} loading={false} periodLabel={periodLabel} media="all" type="SA" />
        )}

        {activeTab === 'keywords' && (
          <>
            <div className="tw">
              <table className="stk" id="tbSearchKeywords">
                <colgroup>
                  <col className="col-skw-name" />
                  {KEYWORD_COLS.map((c) => (
                    <col key={c.key} className={c.key === 'cost' ? 'col-skw-cost' : 'col-skw-val'} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    <th>키워드</th>
                    {KEYWORD_COLS.map((c) => (
                      <SortableTh key={c.key} className="n" sortKey={c.key} activeKey={kKey} order={kOrd} onSort={kSort}>
                        {c.label}
                      </SortableTh>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...result.keywords]
                    .sort((a, b) => (kOrd === 'asc' ? 1 : -1) * (keywordMetric(a, kKey) - keywordMetric(b, kKey)))
                    .slice(0, limit)
                    .map((k) => (
                      <tr key={`${k.media}|${k.campaign}|${k.adgroup}|${k.keyword}|${k.match || ''}`}>
                        <td>
                          <span className="s-media-row">
                            <MediaPill media={k.media} iconOnly size="0.875rem" />
                            <b>{k.keyword}</b>
                          </span>
                          <small className="search-sub search-sub-line" title={`${k.campaign} › ${k.adgroup}`}>
                            {k.campaign} › {k.adgroup}
                          </small>
                        </td>
                        <td className="n">{k.bid ? `${fmt(k.bid)}원` : '–'}</td>
                        <td className="n">{k.quality || '–'}</td>
                        <td className="n">{fmt(k.imp)}</td>
                        <td className="n">{fmt(k.clk)}</td>
                        <td className="n">{ctr(k.clk, k.imp)}</td>
                        <td className="n">{fmt(k.conv)}</td>
                        <td className="n">{fmt(k.cost)}원</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <ShowMoreButton noun="키워드" total={counts.keywords} expanded={showAll} onToggle={() => setShowAll((v) => !v)} />
            <TableFootnote
              unit="원·회"
              basis={`산출 근거: ${periodLabel} 실적 합계 · 입찰가·품질지수는 가장 최근 달 값 · CTR = 클릭 ÷ 노출`}
              sources={['Google Ads · 네이버 검색광고 API 자동 수집']}
            />
          </>
        )}

        {activeTab === 'quotes' && (
          <>
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

            {isLoggedIn ? (
              <>
                <div className="tw">
                  <table className="stk" id="tbSearchQuotes">
                    <colgroup>
                      <col className="col-sq-date" />
                      <col className="col-sq-subject" />
                      <col className="col-sq-customer" />
                      <col className="col-sq-text" />
                      <col className="col-sq-text" />
                      <col className="col-sq-text" />
                    </colgroup>
                    <thead>
                      <tr>
                        <SortableTh sortKey="date" activeKey={qKey} order={qOrd} onSort={qSort}>
                          접수일
                        </SortableTh>
                        <th>제목</th>
                        <th>고객</th>
                        <th>카테고리</th>
                        <th>유입</th>
                        <th>담당자</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(qOrd === 'asc' ? [...result.quotes].reverse() : result.quotes).slice(0, limit).map((r, i) => {
                        const key = String(r.id || i);
                        const isOpen = openQuotes.has(key);
                        const details = quoteDetails(r);
                        return (
                          <React.Fragment key={key}>
                            <tr
                              className="search-q-row"
                              aria-expanded={isOpen}
                              title={isOpen ? '클릭하여 상세 접기' : '클릭하여 상세 펼치기'}
                              onClick={() => toggleQuote(key)}
                            >
                              <td className="search-nowrap">
                                <ChevronRight className={`grp-acc-chev${isOpen ? ' open' : ''}`} strokeWidth={2.25} aria-hidden="true" />
                                {r.date.slice(0, 10)}
                              </td>
                              <td className="search-ellipsis" title={r.subject}>{r.subject || CUSTOMER_FALLBACK}</td>
                              <td className="search-ellipsis">{[r.company, r.name].filter(Boolean).join(' · ') || CUSTOMER_FALLBACK}</td>
                              <td className="search-ellipsis">{r.category || CUSTOMER_FALLBACK}</td>
                              <td className="search-ellipsis">{r.inquiryType || r.source || CUSTOMER_FALLBACK}</td>
                              <td className="search-ellipsis">{r.salesRep || CUSTOMER_FALLBACK}</td>
                            </tr>
                            {isOpen && (
                              <tr className="search-q-detail">
                                <td colSpan={6}>
                                  {r.subject && <p className="search-q-subject">{r.subject}</p>}
                                  <dl>
                                    {details.map(([label, value]) => (
                                      <div key={label}>
                                        <dt>{label}</dt>
                                        <dd>{value}</dd>
                                      </div>
                                    ))}
                                  </dl>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <ShowMoreButton noun="견적" total={counts.quotes} expanded={showAll} onToggle={() => setShowAll((v) => !v)} />
              </>
            ) : (
              <p className="leg-note search-login-note">
                견적 제목과 고객 정보는 로그인 후 볼 수 있습니다.{' '}
                <Button variant="link" className="btn-search-login" id="btn-search-login" data-btn="search-login" onClick={onLogin}>
                  로그인
                </Button>
              </p>
            )}
            <TableFootnote
              unit="건"
              basis="산출 근거: 제목·카테고리·유입 매체·담당자 일치 건 · 유입 매체는 2026년 10월부터 추적"
              sources={['견적 접수 원본 시트 · collectQuotes 자동 동기화']}
            />
          </>
        )}
      </Card>
    </div>
  );
};
