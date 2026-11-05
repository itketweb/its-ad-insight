import React, { useMemo, useRef, useState } from 'react';
import type { CategoryMap, DashboardData, QuoteRawRow, QuoteRow, SyncStatus } from '../types/dashboard';
import {
  buildCategoryBarItems,
  buildSourceShareData,
  catSum,
  fmt,
  mLabel,
  prevM,
  QUOTE_COLORS,
  quoteChartCats,
  quoteCountFor,
  SERIES_DEFS,
  sumBy,
  THIS_M,
  ym,
} from '../utils/format';
import { EXTERNAL_LINKS } from '../utils/constants';
import { quoteStatsOf } from '../hooks/useDashboardData';
import { ViewHeader, SecSrc, type SourceLinkItem } from '../components/common/ViewHeader';
import { KpiCard } from '../components/charts/KpiCard';
import { MultiChart } from '../components/charts/MultiChart';
import { CategoryBarChart } from '../components/charts/CategoryBarChart';
import { SourceBarChart } from '../components/charts/SourceBarChart';
import { LIST_LIMIT, ShowMoreButton } from '../components/common/MoreButton';
import { Card } from '../components/common/Card';
import { dotYm, firstMonth, inMonths, periodStartsOf, sameMonthsLastYear, yearRangeLabel, yearsOf } from '../utils/allPeriod';

interface OverviewViewProps {
  data: DashboardData;
  categoryMap: CategoryMap;
  status: SyncStatus;
  selectedMonth?: string;
  /** 기간 선택이 '전체' */
  allPeriod?: boolean;
  /** 월 선택이 '전체' — selectedMonth 는 그 연도의 마지막 달이다 */
  yearTotal?: boolean;
}

const OVERVIEW_SOURCES: SourceLinkItem[] = [
  { label: 'Google Ads API', href: EXTERNAL_LINKS.googleAds },
  { label: '네이버 검색광고 API', href: EXTERNAL_LINKS.naverSearchAd },
  { label: '취합 스프레드시트', href: EXTERNAL_LINKS.masterSheet },
  { label: '1시간 자동 동기화' },
];

export const OverviewView: React.FC<OverviewViewProps> = ({
  data,
  categoryMap,
  status,
  selectedMonth,
  allPeriod = false,
  yearTotal = false,
}) => {
  // 건수 통계는 다른 사이트·전화문의까지 더하고, CPA·카테고리별 소진은 data.quotes(아이티켓) 기준을 유지한다
  const stats = useMemo(() => quoteStatsOf(data), [data.quotes, data.quotesRaw, data.quotesExtra]);
  const hasSpend = data.spend.length > 0;
  const hasQuotes = data.quotes.length > 0;
  const [visibleCount, setVisibleCount] = useState(LIST_LIMIT);
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

  const totQuotes = (rows: QuoteRow[], mo: string) => sumBy(rows.filter((r) => r.month === mo), (r) => r.count);
  const curQuotesTot = totQuotes(stats.quotes, curM);
  const pvQuotesTot = totQuotes(stats.quotes, pv);

  const curAdQuotes = totQuotes(data.quotes, curM);
  const pvAdQuotes = totQuotes(data.quotes, pv);
  const curCpa = curAdQuotes > 0 ? curSpendTot / curAdQuotes : 0;
  const pvCpa = pvAdQuotes > 0 ? pvSpendTot / pvAdQuotes : 0;

  const ytdSpend = sumBy(
    data.spend.filter((r) => r.month >= ym(yr, 1) && r.month <= curM),
    (r) => r.cost
  );
  const lastYrSpend = sumBy(
    data.spend.filter((r) => r.month >= ym(+yr - 1, 1) && r.month <= ym(+yr - 1, mm)),
    (r) => r.cost
  );

  // 전체 기간: 데이터가 있는 연도별로 합산한다. CPA 는 광고비와 견적이 모두 있는 달부터만 계산한다
  const starts = periodStartsOf(data);
  // 합계가 다른 사이트·전화문의까지 포함하므로 시작 달도 같은 데이터에서 구한다 (starts.quotes 는 아이티켓만)
  const quotesFrom = firstMonth(stats.quotes.map((r) => r.month));
  const spendYears = yearsOf(data.spend.map((r) => r.month));
  const quoteYears = yearsOf(stats.quotes.map((r) => r.month));
  const allSpend = sumBy(data.spend, (r) => r.cost);
  const allQuotes = sumBy(stats.quotes, (r) => r.count);
  const cpaSpend = sumBy(data.spend.filter((r) => r.month >= starts.cpaFrom), (r) => r.cost);
  const cpaQuotes = sumBy(data.quotes.filter((r) => r.month >= starts.cpaFrom), (r) => r.count);
  const allCpa = cpaQuotes > 0 ? cpaSpend / cpaQuotes : 0;

  // 연도 합계: 1월~선택 연도 최신 달을 전년 같은 달들과 비교한다. CPA 는 전체 기간과 같은 기준으로 계산한다
  const lastYrMonths = sameMonthsLastYear(months);
  const yearLabel = yearRangeLabel(curM);
  const quotesIn = (list: string[]) => sumBy(stats.quotes.filter(inMonths(list)), (r) => r.count);
  const cpaIn = (list: string[]) => {
    const valid = list.filter((mo) => mo >= starts.cpaFrom);
    const q = sumBy(data.quotes.filter(inMonths(valid)), (r) => r.count);
    return q > 0 ? sumBy(data.spend.filter(inMonths(valid)), (r) => r.cost) / q : 0;
  };
  const ytdQuotes = quotesIn(months);
  const ytdCpa = cpaIn(months);
  const yearQuoteMonths = new Set(stats.quotes.filter(inMonths(months)).map((r) => r.month)).size;
  const quoteMonthCount = new Set(stats.quotes.map((r) => r.month)).size;

  // 사이트별 견적 건수 breakdown — quotesExtra(어드민)가 있을 때만 의미 있다
  const hasMultiSite = stats.quotesRaw.some((r) => r.site);
  const siteBreak = (rows: QuoteRawRow[]): string | null => {
    if (!hasMultiSite || !rows.length) return null;
    const counts: Record<string, number> = {};
    rows.forEach((r) => {
      const k = r.inquiryType ? '전화' : !r.site ? 'itket' : r.site === 'zbyhp' ? 'zbyhp' : r.site === 'cadkorea' ? 'cadkorea' : 'itket';
      counts[k] = (counts[k] || 0) + 1;
    });
    const parts = ['itket', 'zbyhp', 'cadkorea', '전화'].filter((k) => counts[k]).map((k) => `${k} ${counts[k]}`);
    return parts.length > 1 ? parts.join(' · ') : null;
  };
  const curSiteDetail = siteBreak(stats.quotesRaw.filter((r) => r.date?.slice(0, 7) === curM));
  const ytdSiteDetail = siteBreak(stats.quotesRaw.filter((r) => r.date?.slice(0, 4) === yr));
  const allSiteDetail = siteBreak(stats.quotesRaw);

  const spendAxis = allPeriod ? spendYears : months;
  const spendSeries = SERIES_DEFS.map((s) => ({
    ...s,
    raw: spendAxis.map((key) => sumBy(data.spend.filter((r) => r.month.startsWith(key)).filter(s.f), (r) => r.cost)),
  }))
    .filter((s) => s.raw.some((v) => v))
    .map((s) => ({ ...s, v: s.raw.map((v) => v / 1e4) }));

  // 견적 추이: 올해 건수 상위 6개 1차 카테고리 + 그 외 (2차는 1차에 합산)
  const yrQuoteRows = allPeriod ? stats.quotes : stats.quotes.filter((r) => r.month >= ym(+yr, 1) && r.month <= curM);
  const quoteAxis = allPeriod ? quoteYears : months;
  const quoteCats = quoteChartCats(yrQuoteRows);
  const quoteSeries = quoteCats.keys
    .map((k, ci) => ({
      k,
      c: QUOTE_COLORS[ci % QUOTE_COLORS.length],
      v: quoteAxis.map((key) =>
        yrQuoteRows.filter((r) => r.month.startsWith(key) && quoteCats.keyOf(r.category) === k).reduce((a, r) => a + r.count, 0)
      ),
    }))
    .filter((s) => s.v.some((x) => x));

  // 카테고리별 소진 vs 견적 (새 카테고리 기준, 견적 비례 배분 적용)
  const catsMap = (mo: string) => catSum(categoryMap, atSpend(mo), (r) => r.cost);
  const spendIn = (list: string[]) => catSum(categoryMap, data.spend.filter(inMonths(list)), (r) => r.cost);
  const catSpendCur = allPeriod ? catSum(categoryMap, data.spend, (r) => r.cost) : yearTotal ? spendIn(months) : catsMap(curM);
  // quoteCountFor 는 한 달 치 기준이라, 전체 기간은 달별로 계산해 더한다 (월별 화면의 합과 맞도록)
  const quoteMonths = allPeriod
    ? [...new Set(data.quotes.map((r) => r.month))].filter((mo) => mo >= starts.cpaFrom)
    : yearTotal
      ? months
      : [curM];
  const monthlyQuoteInputs = quoteMonths.map((mo) => ({
    rows: data.quotes.filter((r) => r.month === mo),
    spend: catsMap(mo),
  }));
  const fullList = buildCategoryBarItems(
    catSpendCur,
    allPeriod ? {} : yearTotal ? spendIn(lastYrMonths) : catsMap(pv),
    (c) => sumBy(monthlyQuoteInputs, (m) => quoteCountFor(m.rows, c, m.spend)),
    true,
    Infinity
  );

  // 월 변경 시 visibleCount 리셋
  const listKey = allPeriod ? 'ALL' : yearTotal ? `Y${curM}` : curM;
  if (prevMonthRef.current !== listKey) {
    prevMonthRef.current = listKey;
    setVisibleCount(LIST_LIMIT);
  }
  const list = fullList.slice(0, visibleCount);

  // 유입 매체 비중
  const { items: srcItems } = buildSourceShareData(stats.quotesRaw || [], allPeriod ? '' : yr, stats.quotes, allPeriod ? undefined : curM);

  return (
    <div className="view on" data-view="overview" data-title="종합 요약">
      <ViewHeader
        title="종합 요약"
        description="광고비 집행 현황과 견적 유입 성과를 한눈에 파악하는 통합 대시보드"
        status={status}
      />

      {allPeriod && (
        <p className="leg-note quote-src-note">
          ※ 전체 기간 합산입니다. 데이터 시작 시기가 달라 견적은 {dotYm(quotesFrom)}, 구글 광고비는 {dotYm(starts.google)}, 네이버 광고비는 {dotYm(starts.naver)}
          {starts.meta && `, 메타 광고비는 ${dotYm(starts.meta)}`}부터이고,
          CPA는 모두 있는 {dotYm(starts.cpaFrom)} 이후만 계산합니다.
        </p>
      )}

      <div className="kpis" id="kpiOverview">
        {allPeriod ? (
          <>
            <KpiCard
              label="전체 누적 광고비"
              value={`${fmt(allSpend)}원`}
              sub={`구글 ${dotYm(starts.google)}~ · 네이버 ${dotYm(starts.naver)}~${starts.meta ? ` · 메타 ${dotYm(starts.meta)}~` : ''}`}
            />
            <KpiCard label="전체 누적 견적" value={`${fmt(allQuotes)}건`} sub={`${dotYm(quotesFrom)}~`} detail={allSiteDetail} />
            <KpiCard
              label={
                <>
                  견적당 광고비 (CPA) <small className="muted">(아이티켓 기준)</small>
                </>
              }
              value={`${fmt(allCpa)}원`}
              sub={`${dotYm(starts.cpaFrom)} 이후 기준`}
            />
            <KpiCard
              label="월평균 견적"
              value={`${fmt(quoteMonthCount ? Math.round(allQuotes / quoteMonthCount) : 0)}건`}
              sub={`${fmt(quoteMonthCount)}개월 기준`}
            />
          </>
        ) : yearTotal ? (
          <>
            <KpiCard
              label={
                <>
                  {yearLabel} 총 광고비
                  {curM === THIS_M && (
                    <>
                      {' '}
                      <small className="muted">(진행 중)</small>
                    </>
                  )}
                </>
              }
              value={`${fmt(ytdSpend)}원`}
              cur={ytdSpend}
              prev={lastYrSpend}
              cmpLabel="전년 동기"
            />
            <KpiCard
              label={`${yearLabel} 접수 견적`}
              value={`${fmt(ytdQuotes)}건`}
              cur={ytdQuotes}
              prev={quotesIn(lastYrMonths)}
              cmpLabel="전년 동기"
              detail={ytdSiteDetail}
            />
            <KpiCard
              label={
                <>
                  {yearLabel} 견적당 광고비 (CPA) <small className="muted">(아이티켓 기준)</small>
                </>
              }
              value={ytdCpa ? `${fmt(ytdCpa)}원` : '–'}
              cur={ytdCpa || null}
              prev={lastYrMonths[0] >= starts.cpaFrom ? cpaIn(lastYrMonths) : null}
              cmpLabel="전년 동기"
            />
            <KpiCard
              label="월평균 견적"
              value={`${fmt(yearQuoteMonths ? Math.round(ytdQuotes / yearQuoteMonths) : 0)}건`}
              sub={`${fmt(yearQuoteMonths)}개월 기준`}
            />
          </>
        ) : (
          <>
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
          detail={curSiteDetail}
        />
        <KpiCard
          label={
            <>
              {mLabel(curM)} 견적당 광고비 (CPA) <small className="muted">(아이티켓 기준)</small>
            </>
          }
          value={curCpa > 0 ? `${fmt(curCpa)}원` : '–'}
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
          </>
        )}
      </div>

      <div className="grid">
        <MultiChart
          id="chOverviewSpend"
          title={allPeriod ? '연도별 광고비 추이' : '월별 광고비 추이'}
          labels={allPeriod ? spendYears.map((y) => `${y}년`) : months.map(mLabel)}
          series={spendSeries}
          unit="만원"
          emptyMessage="취합된 광고비 데이터가 없습니다."
        />
        <MultiChart
          id="chOverviewQuotes"
          title={allPeriod ? '연도별 견적 접수 추이' : '월별 견적 접수 추이'}
          labels={allPeriod ? quoteYears.map((y) => `${y}년`) : months.map(mLabel)}
          series={quoteSeries}
          unit="건"
          emptyMessage="취합된 견적 데이터가 없습니다."
        />
      </div>

      <div className="grid">
        <Card name="overview-cat" id="overview-cat">
          <h3 id="ttOverviewCat">
            카테고리별 소진 ({allPeriod ? '전체 기간' : yearTotal ? `${yearLabel} vs 전년 동기` : `${mLabel(curM)} vs ${mLabel(pv)}`}){hasQuotes ? ' · 견적 수' : ''}
          </h3>
          <CategoryBarChart
            id="chOverviewCat"
            list={list}
            hidePrev={allPeriod}
            curLabel={yearTotal ? yearLabel : undefined}
            prevLabel={yearTotal ? '전년 동기' : undefined}
            emptyMessage="취합된 카테고리 데이터가 없습니다."
          />
          <div className="leg" id="lgOverviewCat">
            <span>
              <i className="cur" />
              {allPeriod ? '전체 기간' : `${yearTotal ? yearLabel : '기준월'} (값 · 증감%)`}
            </span>
            {!allPeriod && (
              <span>
                <i className="prev" />
                {yearTotal ? '전년 동기' : '전월'}
              </span>
            )}
            <span className="leg-note">
              단위: 만원
              {hasQuotes ? ` · 우측: 견적 건수(아이티켓${allPeriod ? `, ${dotYm(starts.cpaFrom)} 이후` : ''})` : ''}
            </span>
          </div>
          <ShowMoreButton
            total={fullList.length}
            expanded={visibleCount >= fullList.length}
            onToggle={() => setVisibleCount((v) => (v >= fullList.length ? LIST_LIMIT : fullList.length))}
          />
        </Card>
        <Card name="overview-src" id="overview-src" title="유입 매체 비중">
          <SourceBarChart
            id="chOverviewSrc"
            items={srcItems}
            emptyMessage="취합된 유입 매체 데이터가 없습니다."
          />
        </Card>
      </div>
      <SecSrc sources={OVERVIEW_SOURCES} />
    </div>
  );
};
