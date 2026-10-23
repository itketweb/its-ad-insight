import React, { useRef, useState } from 'react';
import type { CategoryMap, DashboardData, SyncStatus } from '../types/dashboard';
import {
  buildCategoryBarItems,
  catSum,
  fmt,
  mLabel,
  prevM,
  LEGACY_ONLY_CATS,
  quoteCountFor,
  sumBy,
  THIS_M,
} from '../utils/format';
import { EXTERNAL_LINKS } from '../utils/constants';
import { ViewHeader, SecSrc, type SourceLinkItem } from '../components/common/ViewHeader';
import { KpiCard } from '../components/charts/KpiCard';
import { CategoryBarChart } from '../components/charts/CategoryBarChart';
import {
  CategoryFilter,
  buildCategoryFilter,
  filterByCategory,
  matchesCategory,
  useCategoryFilterState,
} from '../components/common/CategoryFilter';
import { PeriodNavSlot } from '../components/common/PeriodNav';
import { CpaRankList } from '../components/cat-efficiency/CpaRankList';
import { CatEfficiencyTable } from '../components/cat-efficiency/CatEfficiencyTable';
import { LIST_LIMIT, ShowMoreButton } from '../components/common/MoreButton';
import { Card } from '../components/common/Card';
import { EmptyState } from '../components/common/EmptyState';

interface CatEfficiencyViewProps {
  data: DashboardData;
  categoryMap: CategoryMap;
  status: SyncStatus;
  selectedMonth?: string;
}

const CAT_EFF_SOURCES: SourceLinkItem[] = [
  { label: 'Google Ads API', href: EXTERNAL_LINKS.googleAds },
  { label: '네이버 검색광고 API', href: EXTERNAL_LINKS.naverSearchAd },
  { label: '취합 스프레드시트', href: EXTERNAL_LINKS.masterSheet },
  { label: '광고비·클릭·전환 + 고도몰 견적 시트 교차 집계' },
];

export const CatEfficiencyView: React.FC<CatEfficiencyViewProps> = ({
  data,
  categoryMap,
  status,
  selectedMonth,
}) => {
  const catState = useCategoryFilterState();
  const [visibleCount, setVisibleCount] = useState(LIST_LIMIT);
  const prevFilterKey = useRef('');

  if (!data.spend.length) {
    return (
      <div className="view on" data-view="cat-efficiency" data-title="카테고리 효율">
        <ViewHeader
          title="카테고리 효율 분석"
          description="카테고리별 광고비 소진 대비 견적 획득 성과 및 획득단가(CPA) 비교"
          status={status}
        />
        <div className="kpis" id="kpiCatEff">
          <div className="kpi">
            <div className="l">카테고리 데이터</div>
            <div className="v">–</div>
            <div className="d flat">데이터 연결 필요</div>
          </div>
        </div>
        <Card name="empty" id="cat-empty">
          <EmptyState message="취합된 데이터가 없습니다." />
        </Card>
      </div>
    );
  }

  const allMonths = [...new Set(data.spend.map((r) => r.month))].sort();
  const curM =
    (selectedMonth && allMonths.includes(selectedMonth) ? selectedMonth : undefined) ||
    selectedMonth ||
    allMonths.filter((m) => m <= THIS_M).pop() ||
    allMonths[allMonths.length - 1];
  const pv = prevM(curM);

  const rowsCur = data.spend.filter((r) => r.month === curM);
  const rowsPrev = data.spend.filter((r) => r.month === pv);
  const catSpendCur = catSum(categoryMap, rowsCur, (r) => r.cost);
  const catSpendPrev = catSum(categoryMap, rowsPrev, (r) => r.cost);
  const catClk = catSum(categoryMap, rowsCur, (r) => r.clk);
  const catConv = catSum(categoryMap, rowsCur, (r) => r.conv);

  const qOf = (mo: string, c: string) =>
    quoteCountFor(
      data.quotes.filter((r) => r.month === mo),
      c,
      mo === curM ? catSpendCur : catSum(categoryMap, data.spend.filter((r) => r.month === mo), (r) => r.cost)
    );

  const curQuotes = data.quotes.filter((r) => r.month === curM);
  // 견적 시트의 옛 분류(서버·워크스테이션…)는 역매핑(quoteCountFor)으로 처리하므로 allCatKeys에서 제외
  const legacyCatSet = LEGACY_ONLY_CATS;

  const allCatKeys = [
    ...new Set([
      ...Object.keys(catSpendCur),
      ...Object.keys(catSpendPrev),
      ...curQuotes.map((r) => r.category).filter((c): c is string => !!c && !legacyCatSet.has(c)),
    ]),
  ].sort((a, b) => (catSpendCur[b] || 0) - (catSpendCur[a] || 0) || qOf(curM, b) - qOf(curM, a));

  // 1차/2차 카테고리 필터 — 선택하면 표·차트·KPI·합계가 해당 카테고리만으로 다시 계산된다
  const catFilter = buildCategoryFilter(allCatKeys, catState);
  const isFiltered = !!(catFilter.cat1 || catFilter.cat2);
  const catKeys = allCatKeys.filter((k) => matchesCategory(k, catFilter.cat1, catFilter.cat2));

  const totSpend = isFiltered
    ? sumBy(catKeys, (k) => catSpendCur[k] || 0)
    : sumBy(rowsCur, (r) => r.cost);
  const totQuotes = isFiltered
    ? sumBy(catKeys, (k) => qOf(curM, k))
    : sumBy(curQuotes, (r) => r.count);

  const catData = catKeys.map((k) => {
    const cost = catSpendCur[k] || 0;
    const prevCost = catSpendPrev[k] || 0;
    const quotes = qOf(curM, k);
    const clk = catClk[k] || 0;
    const conv = catConv[k] || 0;
    const cpa = quotes > 0 ? cost / quotes : null;
    return {
      k,
      cost,
      prevCost,
      quotes,
      clk,
      conv,
      cpa,
      share: totSpend > 0 ? (cost / totSpend) * 100 : 0,
    };
  });

  const topSpendCat = catData[0];
  const topQuoteCat = [...catData].sort((a, b) => b.quotes - a.quotes)[0];
  const validCpaCats = catData
    .filter((c): c is typeof c & { cpa: number } => c.cpa != null && c.quotes > 0)
    .sort((a, b) => a.cpa - b.cpa);
  const bestCpaCat = validCpaCats[0];
  const avgCpa = totQuotes > 0 ? totSpend / totQuotes : 0;

  const fullList = buildCategoryBarItems(
    filterByCategory(catSpendCur, catFilter.cat1, catFilter.cat2),
    filterByCategory(catSpendPrev, catFilter.cat1, catFilter.cat2),
    (c) => qOf(curM, c),
    true,
    Infinity
  );

  // 필터·월 변경 시 visibleCount 리셋
  const filterKey = `${curM}|${catFilter.cat1}|${catFilter.cat2}`;
  if (prevFilterKey.current !== filterKey) {
    prevFilterKey.current = filterKey;
    setVisibleCount(LIST_LIMIT);
  }
  const list = fullList.slice(0, visibleCount);

  const totClk = isFiltered ? sumBy(catKeys, (k) => catClk[k] || 0) : sumBy(rowsCur, (r) => r.clk);
  const totConv = isFiltered ? sumBy(catKeys, (k) => catConv[k] || 0) : sumBy(rowsCur, (r) => r.conv);

  return (
    <div className="view on" data-view="cat-efficiency" data-title="카테고리 효율">
      <ViewHeader
        title="카테고리 효율 분석"
        description="카테고리별 광고비 소진 대비 견적 획득 성과 및 획득단가(CPA) 비교"
        status={status}
      />

      <PeriodNavSlot>
        <CategoryFilter filter={catFilter} />
      </PeriodNavSlot>

      <div className="kpis" id="kpiCatEff">
        <KpiCard
          label="최다 집행 카테고리"
          value={topSpendCat?.k || '–'}
          sub={`${fmt(topSpendCat?.cost || 0)}원 (${(topSpendCat?.share || 0).toFixed(1)}%)`}
        />
        <KpiCard
          label="최다 견적 카테고리"
          value={topQuoteCat?.k || '–'}
          sub={`${fmt(topQuoteCat?.quotes || 0)}건 접수`}
        />
        <KpiCard
          label="최고 효율 (최저 CPA)"
          value={bestCpaCat?.k || '–'}
          sub={bestCpaCat ? `건당 ${fmt(bestCpaCat.cpa)}원` : '–'}
        />
        <KpiCard
          label={`${mLabel(curM)} 전체 평균 CPA`}
          value={avgCpa ? `${fmt(avgCpa)}원` : '–'}
          sub={`광고비 ${fmt(totSpend)}원 / ${totQuotes}건`}
        />
      </div>

      <div className="grid">
        <Card name="cat-spend" id="cat-spend">
          <h3 id="ttCatEff">
            카테고리별 광고비 소진 비교
            <span className="muted">
              ({mLabel(curM)} vs {mLabel(pv)})
            </span>
          </h3>
          <CategoryBarChart id="chCatEff" list={list} />
          <div className="leg">
            <span>
              <i className="cur" />
              기준월
            </span>
            <span>
              <i className="prev" />
              전월
            </span>
            <span className="leg-note">단위: 만원</span>
          </div>
          <ShowMoreButton
            total={fullList.length}
            expanded={visibleCount >= fullList.length}
            onToggle={() => setVisibleCount((v) => (v >= fullList.length ? LIST_LIMIT : fullList.length))}
          />
        </Card>
        <CpaRankList validCpaCats={validCpaCats} curM={curM} />
      </div>

      <CatEfficiencyTable
        catData={catData}
        curM={curM}
        totSpend={totSpend}
        totClk={totClk}
        totConv={totConv}
        totQuotes={totQuotes}
        avgCpa={avgCpa}
      />
      <SecSrc sources={CAT_EFF_SOURCES} />
    </div>
  );
};
