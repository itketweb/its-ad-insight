import React, { useMemo } from 'react';
import type { DashboardData, QuoteRawRow, SyncStatus } from '../types/dashboard';
import {
  buildSourceShareData,
  fmt,
  mLabel,
  prevM,
  cat1Of,
  quoteSeriesColor,
  quoteCat1Order,
  quoteChartCats,
  sumBy,
  ym,
} from '../utils/format';
import { EXTERNAL_LINKS } from '../utils/constants';
import { quoteStatsOf } from '../hooks/useDashboardData';
import { ViewHeader, SecSrc, type SourceLinkItem } from '../components/common/ViewHeader';
import { KpiCard } from '../components/charts/KpiCard';
import { MultiChart } from '../components/charts/MultiChart';
import { SourceBarChart } from '../components/charts/SourceBarChart';
import { MonthlyQuotesTable } from '../components/quotes/MonthlyQuotesTable';
import { Card } from '../components/common/Card';
import { SkelBar } from '../components/common/SkeletonView';
import { EmptyState } from '../components/common/EmptyState';
import { dotYm, inMonths, periodStartsOf, sameMonthsLastYear, yearsOf } from '../utils/allPeriod';

interface QuotesViewProps {
  data: DashboardData;
  status: SyncStatus;
  /** 실데이터를 받는 중 */
  isSyncing?: boolean;
  selectedMonth?: string;
  /** 기간 선택이 '전체' */
  allPeriod?: boolean;
  /** 월 선택이 '전체' — selectedMonth 는 그 연도의 마지막 달이다 */
  yearTotal?: boolean;
}

const QUOTES_SOURCES: SourceLinkItem[] = [
  { label: '아이티켓 고도몰 견적 목록', href: EXTERNAL_LINKS.itketEstimateList },
  { label: '취합 스프레드시트', href: EXTERNAL_LINKS.masterSheet },
  { label: '견적 접수 원본 시트', href: EXTERNAL_LINKS.quotesRawSheet },
  { label: 'collectQuotes · collectQuoteStatsExtra · 1시간 자동 동기화' },
];

export const QuotesView: React.FC<QuotesViewProps> = ({ data, status, isSyncing = false, selectedMonth, allPeriod = false, yearTotal = false }) => {
  // 건수 통계는 아이티켓에 다른 사이트·전화문의를 더해 센다
  const { quotes, quotesRaw } = useMemo(() => quoteStatsOf(data), [data.quotes, data.quotesRaw, data.quotesExtra]);

  if (!quotes.length) {
    return (
      <div className="view on" data-view="quotes" data-title="견적 상세">
        <ViewHeader
          title="ITKET 견적 상세 현황"
          description="아이티켓·zbyhp·cadkorea 견적과 전화문의의 월별·카테고리별 유입 추이"
          status={status}
        />
        <div className="kpis" id="kpiQuotes">
          <div className="kpi">
            <div className="l">견적 데이터</div>
            <div className="v">–</div>
            <div className="d flat">데이터 연결 필요</div>
          </div>
        </div>
        <Card name="empty" id="quotes-empty">
          <EmptyState message="취합된 실제 견적 데이터가 없습니다. 상단 [연결 설정] 버튼에서 데이터 연결을 완료해 주세요." />
        </Card>
      </div>
    );
  }

  const allAvailable = quotes.map((r) => r.month).filter(Boolean).sort();
  const fallbackLast = quotes.reduce((m, r) => (r.month > m ? r.month : m), '');
  const last = allPeriod ? fallbackLast :
    (selectedMonth && allAvailable.includes(selectedMonth) ? selectedMonth : undefined) ||
    selectedMonth ||
    fallbackLast;
  const years = yearsOf(allAvailable);
  const yr = allPeriod ? '' : last.slice(0, 4);
  const mm = +last.slice(5, 7);
  const curM = last.slice(0, 7);
  const pv = prevM(curM);
  // 전체 기간이면 달 대신 연도 단위로 본다
  const labels = allPeriod ? years.map((y) => `${y}년`) : Array.from({ length: mm }, (_, i) => `${i + 1}월`);
  const axisKeys = allPeriod ? years : Array.from({ length: mm }, (_, i) => ym(yr, i + 1));
  const months = axisKeys;
  const allMonths = allPeriod ? years : Array.from({ length: 12 }, (_, i) => ym(yr, i + 1));
  const firstM = allAvailable[0] || '';

  const allTotal = sumBy(quotes, (r) => r.count);

  const totM = (mo: string) =>
    quotes.filter((r) => r.month === mo).reduce((a, r) => a + r.count, 0);
  const curTot = totM(curM);
  const pvTot = totM(pv);
  const ytdQuotes = sumBy(
    quotes.filter((r) => r.month >= ym(yr, 1) && r.month <= curM),
    (r) => r.count
  );



  const starts = periodStartsOf(data);
  const cpaMonths = yr ? Array.from({ length: mm }, (_, i) => ym(yr, i + 1)) : [];
  const lastYrMonths = sameMonthsLastYear(cpaMonths);
  const cpaIn = (list: string[]) => {
    const valid = list.filter((mo) => mo >= starts.cpaFrom);
    const q = sumBy(data.quotes.filter(inMonths(valid)), (r) => r.count);
    return q > 0 ? sumBy(data.spend.filter(inMonths(valid)), (r) => r.cost) / q : 0;
  };
  const ytdCpa = cpaIn(cpaMonths);
  const lastYrCpa = cpaIn(lastYrMonths);
  const cpaSpend = sumBy(data.spend.filter((r) => r.month >= starts.cpaFrom), (r) => r.cost);
  const cpaQuotesCount = sumBy(data.quotes.filter((r) => r.month >= starts.cpaFrom), (r) => r.count);
  const allCpa = cpaQuotesCount > 0 ? cpaSpend / cpaQuotesCount : 0;

  const hasMultiSite = quotesRaw.some((r) => r.site);
  const siteBreak = (rows: QuoteRawRow[]): React.ReactNode => {
    if (!hasMultiSite || !rows.length) return null;
    const counts: Record<string, number> = {};
    rows.forEach((r) => {
      const k = r.inquiryType ? '전화/톡플러스' : !r.site ? 'itket' : r.site === 'zbyhp' ? 'zbyhp' : r.site === 'cadkorea' ? 'cadkorea' : 'itket';
      counts[k] = (counts[k] || 0) + 1;
    });
    const parts = ['itket', 'zbyhp', 'cadkorea', '전화/톡플러스'].filter((k) => k === 'cadkorea' || k === 'zbyhp' || counts[k]);
    if (parts.length <= 1) return null;
    return parts.map((k, i) => (
      <React.Fragment key={k}>{i > 0 && <i>|</i>}<p>{k} <b>{counts[k] ?? 0}</b></p></React.Fragment>
    ));
  };
  const curSiteDetail = siteBreak(quotesRaw.filter((r) => r.date?.slice(0, 7) === curM));
  const allSiteDetail = siteBreak(quotesRaw);

  const { bySource: bySrcAll, topSourceKey: topSrcKey, items: srcItems } = buildSourceShareData(
    quotesRaw,
    yr,
    quotes,
    allPeriod ? undefined : curM
  );

  // 카테고리는 분류표 1차 기준 (2차는 1차에 합산). 최다 카테고리는 '기타'를 빼고 고른다
  // 선택한 달까지만 본다 — 비중의 분모인 누적 견적(1~선택 월)과 기간을 맞춘다
  const yrQuotes = quotes.filter((r) => r.month.startsWith(yr) && r.month <= curM);
  const topCatKey = quoteCat1Order(yrQuotes).find((c) => c !== '기타');
  const topCat = topCatKey
    ? { k: topCatKey, c: sumBy(yrQuotes.filter((r) => cat1Of(r.category) === topCatKey), (r) => r.count) }
    : undefined;

  // 2~3위 유입 매체
  const srcRunnerUps =
    Object.entries(bySrcAll)
      .filter(([k]) => k !== topSrcKey)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2)
      .map(([k, n]) => `${k} ${fmt(n)}`)
      .join(' · ') || null;

  // 2~3위 견적 카테고리 (기타 제외)
  const catRunnerUps =
    quoteCat1Order(yrQuotes)
      .filter((c) => c !== '기타' && c !== topCatKey)
      .slice(0, 2)
      .map((k) => `${k} ${fmt(sumBy(yrQuotes.filter((r) => cat1Of(r.category) === k), (r) => r.count))}`)
      .join(' · ') || null;

  // 추이 차트: 건수 상위 6개 1차 카테고리 + 그 외
  const chartCats = quoteChartCats(yrQuotes);
  const series = chartCats.keys
    .map((k, ci) => ({
      k,
      c: quoteSeriesColor(k, ci),
      v: axisKeys.map((key) =>
        sumBy(
          yrQuotes.filter((r) => r.month.startsWith(key) && chartCats.keyOf(r.category) === k),
          (r) => r.count
        )
      ),
    }))
    .filter((s) => s.v.some((x) => x));

  return (
    <div className="view on" data-view="quotes" data-title="견적 상세">
      <ViewHeader
        title="ITKET 견적 상세 현황"
        description="아이티켓·zbyhp·cadkorea 견적과 전화문의의 월별·카테고리별 유입 추이"
        status={status}
      />

      {allPeriod && (
        <p className="leg-note quote-src-note">
          ※ 전체 기간 합산입니다. 견적 데이터는 {dotYm(firstM)}부터 있고, 유입 매체는 2026년 10월부터 추적합니다.
        </p>
      )}

      <div className="kpis" id="kpiQuotes">
        {allPeriod ? (
          <>
            <KpiCard label="전체 누적 견적" value={`${fmt(allTotal)}건`} sub={`${dotYm(firstM)} ~ ${dotYm(curM)}`} detail={allSiteDetail} />
            <KpiCard
              label={<>견적당 광고비 (CPA) <small className="muted">(아이티켓 기준)</small></>}
              value={allCpa ? `${fmt(allCpa)}원` : '–'}
              sub={`${dotYm(starts.cpaFrom)} 이후 기준`}
            />
            <KpiCard
              label="전체 최다 유입 매체"
              value={topSrcKey}
              sub={bySrcAll[topSrcKey] ? `${fmt(bySrcAll[topSrcKey])}건 접수` : isSyncing ? <SkelBar w="5rem" h="0.75rem" /> : '–'}
              detail={srcRunnerUps}
            />
            <KpiCard
              label="전체 최다 견적 카테고리"
              value={topCat?.k || '–'}
              sub={`${fmt(topCat?.c || 0)}건 (${allTotal > 0 ? (((topCat?.c || 0) / allTotal) * 100).toFixed(1) : 0}%)`}
              detail={catRunnerUps}
            />
          </>
        ) : (
          <>
        {!yearTotal && (
          <KpiCard
            label={`${mLabel(curM)} 접수 견적`}
            value={`${fmt(curTot)}건`}
            cur={curTot}
            prev={pvTot}
            cmpLabel="전월"
            detail={curSiteDetail}
          />
        )}
        {yearTotal && (
          <KpiCard
            label={<>{yr}년 누적 견적 (1~{mm}월)</>}
            value={`${fmt(ytdQuotes)}건`}
            cur={ytdQuotes}
            prev={sumBy(quotes.filter((r) => r.month >= ym(+yr - 1, 1) && r.month <= ym(+yr - 1, mm)), (r) => r.count)}
            cmpLabel="전년 동기"
            detail={siteBreak(quotesRaw.filter((r) => r.date?.slice(0, 4) === yr))}
          />
        )}
        <KpiCard
          label={<>{yr}년 견적당 광고비 (CPA) <small className="muted">(아이티켓 기준)</small></>}
          value={ytdCpa ? `${fmt(ytdCpa)}원` : '–'}
          cur={ytdCpa || null}
          prev={lastYrMonths[0] >= starts.cpaFrom ? lastYrCpa : null}
          cmpLabel="전년 동기"
        />
        <KpiCard
          label={`${yr}년 최다 유입 매체`}
          value={topSrcKey}
          sub={bySrcAll[topSrcKey] ? `${fmt(bySrcAll[topSrcKey])}건 접수` : isSyncing ? <SkelBar w="5rem" h="0.75rem" /> : '–'}
          detail={srcRunnerUps}
        />
        <KpiCard
          label={`${yr}년 최다 견적 카테고리`}
          value={topCat?.k || '–'}
          sub={`${fmt(topCat?.c || 0)}건 (${ytdQuotes > 0 ? (((topCat?.c || 0) / ytdQuotes) * 100).toFixed(1) : 0}%)`}
          detail={catRunnerUps}
        />
          </>
        )}
      </div>

      <div className="grid grid-2-1">
        <MultiChart
          id="chQuote"
          title={allPeriod ? '연도별 견적 접수 수' : '월별 견적 접수 수'}
          labels={labels}
          series={series}
          unit="건"
        />
        <Card name="quotes-src" id="quotes-src" title="유입 매체 비중">
          <SourceBarChart
            id="chSrc"
            items={srcItems}
            emptyMessage="취합된 실제 유입 매체 데이터가 없습니다."
          />
        </Card>
      </div>

      <MonthlyQuotesTable
        quotes={quotes}
        quotesRaw={quotesRaw}
        yr={yr}
        curM={curM}
        months={months}
        allMonths={allMonths}
        allPeriod={allPeriod}
        yearTotal={yearTotal}
      />
      <SecSrc sources={QUOTES_SOURCES} />
    </div>
  );
};
