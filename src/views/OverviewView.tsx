import React, { useRef, useState } from 'react';
import type { CategoryMap, DashboardData, SyncStatus } from '../types/dashboard';
import {
  buildCategoryBarItems,
  buildSourceShareData,
  catSum,
  fmt,
  mLabel,
  prevM,
  QUOTE_COLORS,
  quoteCountFor,
  SERIES_DEFS,
  sumBy,
  THIS_M,
  ym,
} from '../utils/format';
import { EXTERNAL_LINKS } from '../utils/constants';
import { ViewHeader, SecSrc, type SourceLinkItem } from '../components/common/ViewHeader';
import { KpiCard } from '../components/charts/KpiCard';
import { MultiChart } from '../components/charts/MultiChart';
import { CategoryBarChart } from '../components/charts/CategoryBarChart';
import { SourceBarChart } from '../components/charts/SourceBarChart';
import { MoreButton } from '../components/common/MoreButton';

interface OverviewViewProps {
  data: DashboardData;
  categoryMap: CategoryMap;
  status: SyncStatus;
  selectedMonth?: string;
}

const OVERVIEW_SOURCES: SourceLinkItem[] = [
  { label: 'Google Ads API', href: EXTERNAL_LINKS.googleAds },
  { label: '네이버 검색광고 API', href: EXTERNAL_LINKS.naverSearchAd },
  { label: '취합 스프레드시트', href: EXTERNAL_LINKS.masterSheet },
  { label: '15분 자동 동기화' },
];

export const OverviewView: React.FC<OverviewViewProps> = ({
  data,
  categoryMap,
  status,
  selectedMonth,
}) => {
  const hasSpend = data.spend.length > 0;
  const hasQuotes = data.quotes.length > 0;
  const [visibleCount, setVisibleCount] = useState(10);
  const prevMonthRef = useRef('');

  if (!hasSpend && !hasQuotes) {
    return (
      <div className="view on" data-view="overview" data-title="종합 요약">
        <ViewHeader
          title="종합 요약"
          description="광고비 집행 현황과 견적 유입 성과를 한눈에 파악하는 통합 대시보드"
          status={status}
        />
        <div className="kpis" id="kpiOverview">
          <div className="kpi">
            <div className="l">데이터 상태</div>
            <div className="v">연결 대기</div>
            <div className="d flat">상단 [연결 설정]을 완료해 주세요</div>
          </div>
        </div>
        <SecSrc sources={OVERVIEW_SOURCES} />
      </div>
    );
  }

  const allMonths = [
    ...new Set([...data.spend.map((r) => r.month), ...data.quotes.map((r) => r.month)]),
  ]
    .filter(Boolean)
    .sort();
  const curM =
    (selectedMonth && allMonths.includes(selectedMonth) ? selectedMonth : undefined) ||
    selectedMonth ||
    allMonths.filter((m) => m <= THIS_M).pop() ||
    allMonths[allMonths.length - 1] ||
    THIS_M;
  const pv = prevM(curM);
  const yr = curM.slice(0, 4);
  const mm = +curM.slice(5, 7);
  const months = Array.from({ length: mm }, (_, i) => ym(yr, i + 1));

  const atSpend = (mo: string) => data.spend.filter((r) => r.month === mo);
  const totSpend = (mo: string) => sumBy(atSpend(mo), (r) => r.cost);
  const curSpendTot = totSpend(curM);
  const pvSpendTot = totSpend(pv);

  const atQuotes = (mo: string) => data.quotes.filter((r) => r.month === mo);
  const totQuotes = (mo: string) => sumBy(atQuotes(mo), (r) => r.count);
  const curQuotesTot = totQuotes(curM);
  const pvQuotesTot = totQuotes(pv);

  const curCpa = curQuotesTot > 0 ? curSpendTot / curQuotesTot : 0;
  const pvCpa = pvQuotesTot > 0 ? pvSpendTot / pvQuotesTot : 0;

  const ytdSpend = sumBy(
    data.spend.filter((r) => r.month >= ym(yr, 1) && r.month <= curM),
    (r) => r.cost
  );
  const lastYrSpend = sumBy(
    data.spend.filter((r) => r.month >= ym(+yr - 1, 1) && r.month <= ym(+yr - 1, mm)),
    (r) => r.cost
  );

  const spendSeries = SERIES_DEFS.map((s) => ({
    ...s,
    raw: months.map((mo) => sumBy(atSpend(mo).filter(s.f), (r) => r.cost)),
  }))
    .filter((s) => s.raw.some((v) => v))
    .map((s) => ({ ...s, v: s.raw.map((v) => v / 1e4) }));

  const cnt = (mo: string, k: string) =>
    data.quotes
      .filter((r) => r.month === mo && r.category === k)
      .reduce((a, r) => a + r.count, 0);

  // 견적 추이: 실제 데이터 카테고리 동적 추출 (견적 시트 분류 변경 시 자동 반영)
  const allQuoteCats = [
    ...new Set(
      data.quotes
        .filter((r) => r.month >= ym(+yr, 1) && r.month <= curM)
        .map((r) => r.category)
        .filter(Boolean)
    ),
  ].sort((a, b) => {
    const va = data.quotes.filter((r) => r.category === a).reduce((s, r) => s + r.count, 0);
    const vb = data.quotes.filter((r) => r.category === b).reduce((s, r) => s + r.count, 0);
    return vb - va;
  });
  const quoteSeries = allQuoteCats.map((k, ci) => ({
    k,
    c: QUOTE_COLORS[ci % QUOTE_COLORS.length],
    v: months.map((mo) => cnt(mo, k)),
  })).filter((s) => s.v.some((x) => x));

  // 카테고리별 소진 vs 견적 (새 카테고리 기준, 견적 비례 배분 적용)
  const catsMap = (mo: string) => catSum(categoryMap, atSpend(mo), (r) => r.cost);
  const catSpendCur = catsMap(curM);
  const curQuotesRows = data.quotes.filter((r) => r.month === curM);
  const fullList = buildCategoryBarItems(
    catSpendCur,
    catsMap(pv),
    (c) => quoteCountFor(curQuotesRows, c, catSpendCur),
    true,
    Infinity
  );

  // 월 변경 시 visibleCount 리셋
  if (prevMonthRef.current !== curM) {
    prevMonthRef.current = curM;
    setVisibleCount(10);
  }
  const list = fullList.slice(0, visibleCount);

  // 유입 매체 비중
  const { items: srcItems } = buildSourceShareData(data.quotesRaw || [], yr, data.quotes);

  return (
    <div className="view on" data-view="overview" data-title="종합 요약">
      <ViewHeader
        title="종합 요약"
        description="광고비 집행 현황과 견적 유입 성과를 한눈에 파악하는 통합 대시보드"
        status={status}
      />

      <div className="kpis" id="kpiOverview">
        <KpiCard
          label={
            <>
              {mLabel(curM)} 총 광고비
              {curM === THIS_M && (
                <>
                  {' '}
                  <small className="muted">(진행 중)</small>
                </>
              )}
            </>
          }
          value={`${fmt(curSpendTot)}원`}
          cur={curSpendTot}
          prev={pvSpendTot}
          cmpLabel="전월"
        />
        <KpiCard
          label={`${mLabel(curM)} 접수 견적`}
          value={`${fmt(curQuotesTot)}건`}
          cur={curQuotesTot}
          prev={pvQuotesTot}
          cmpLabel="전월"
        />
        <KpiCard
          label={`${mLabel(curM)} 견적당 광고비 (CPA)`}
          value={`${fmt(curCpa)}원`}
          cur={curCpa}
          prev={pvCpa}
          cmpLabel="전월"
        />
        <KpiCard
          label={`${yr}년 누적 광고비 (1~${mm}월)`}
          value={`${fmt(ytdSpend)}원`}
          cur={ytdSpend}
          prev={lastYrSpend}
          cmpLabel="전년 동기"
        />
      </div>

      <div className="grid">
        <MultiChart
          id="chOverviewSpend"
          title="월별 광고비 추이"
          labels={months.map(mLabel)}
          series={spendSeries}
          unit="만원"
          emptyMessage="취합된 광고비 데이터가 없습니다."
        />
        <MultiChart
          id="chOverviewQuotes"
          title="월별 견적 접수 추이"
          labels={months.map(mLabel)}
          series={quoteSeries}
          unit="건"
          emptyMessage="취합된 견적 데이터가 없습니다."
        />
      </div>

      <div className="grid">
        <div className="card card-overview-cat" id="overview-cat" data-card="overview-cat">
          <h3 id="ttOverviewCat">
            카테고리별 소진 ({mLabel(curM)} vs {mLabel(pv)}){hasQuotes ? ' · 견적 수' : ''}
          </h3>
          <CategoryBarChart
            id="chOverviewCat"
            list={list}
            emptyMessage="취합된 카테고리 데이터가 없습니다."
          />
          <div className="leg" id="lgOverviewCat">
            <span>
              <i className="cur" />
              기준월 (값 · 증감%)
            </span>
            <span>
              <i className="prev" />
              전월
            </span>
            <span className="leg-note">단위: 만원{hasQuotes ? ' · 우측: 견적 건수' : ''}</span>
          </div>
          {visibleCount < fullList.length && (
            <div className="kw-more-wrap">
              <MoreButton
                label={`카테고리 더보기 (+${Math.min(fullList.length - visibleCount, 10)}개 · 전체 ${fullList.length}개)`}
                onClick={() => setVisibleCount((v) => Math.min(v + 10, fullList.length))}
              />
            </div>
          )}
        </div>
        <div className="card card-overview-src" id="overview-src" data-card="overview-src">
          <h3>유입 매체 비중</h3>
          <SourceBarChart
            id="chOverviewSrc"
            items={srcItems}
            emptyMessage="취합된 유입 매체 데이터가 없습니다."
          />
        </div>
      </div>
      <SecSrc sources={OVERVIEW_SOURCES} />
    </div>
  );
};
