import React from 'react';
import type { DashboardData, SyncStatus } from '../types/dashboard';
import {
  buildSourceShareData,
  fmt,
  mLabel,
  prevM,
  QUOTE_CATS,
  QUOTE_COLORS,
  sumBy,
  ym,
} from '../utils/format';
import { EXTERNAL_LINKS } from '../utils/constants';
import { ViewHeader, SecSrc, type SourceLinkItem } from '../components/common/ViewHeader';
import { KpiCard } from '../components/charts/KpiCard';
import { MultiChart } from '../components/charts/MultiChart';
import { SourceBarChart } from '../components/charts/SourceBarChart';
import { MonthlyQuotesTable } from '../components/quotes/MonthlyQuotesTable';

interface QuotesViewProps {
  data: DashboardData;
  status: SyncStatus;
  selectedMonth?: string;
}

const QUOTES_SOURCES: SourceLinkItem[] = [
  { label: '아이티켓 고도몰 견적 목록', href: EXTERNAL_LINKS.itketEstimateList },
  { label: '취합 스프레드시트', href: EXTERNAL_LINKS.masterSheet },
  { label: '견적 접수 원본 시트', href: EXTERNAL_LINKS.quotesRawSheet },
  { label: 'collectQuotes · 15분 자동 동기화' },
];

export const QuotesView: React.FC<QuotesViewProps> = ({ data, status, selectedMonth }) => {
  const quotes = data.quotes || [];
  const quotesRaw = data.quotesRaw || [];

  if (!quotes.length) {
    return (
      <div className="view on" data-view="quotes" data-title="견적 상세">
        <ViewHeader
          title="ITKET 견적 상세 현황"
          description="쇼핑몰(고도몰5) 및 직영 채널 접수 견적의 월별·카테고리별 유입 추이"
          status={status}
        />
        <div className="kpis" id="kpiQuotes">
          <div className="kpi">
            <div className="l">견적 데이터</div>
            <div className="v">–</div>
            <div className="d flat">데이터 연결 필요</div>
          </div>
        </div>
        <div className="card">
          <div className="empty">
            취합된 실제 견적 데이터가 없습니다. 상단 [연결 설정] 버튼에서 데이터 연결을 완료해 주세요.
          </div>
        </div>
      </div>
    );
  }

  const allAvailable = quotes.map((r) => r.month).filter(Boolean).sort();
  const fallbackLast = quotes.reduce((m, r) => (r.month > m ? r.month : m), '');
  const last =
    (selectedMonth && allAvailable.includes(selectedMonth) ? selectedMonth : undefined) ||
    selectedMonth ||
    fallbackLast;
  const yr = last.slice(0, 4);
  const mm = +last.slice(5, 7);
  const curM = `${yr}-${String(mm).padStart(2, '0')}`;
  const pv = prevM(curM);
  const labels = Array.from({ length: mm }, (_, i) => `${i + 1}월`);
  const months = Array.from({ length: mm }, (_, i) => ym(yr, i + 1));
  const allMonths = Array.from({ length: 12 }, (_, i) => ym(yr, i + 1));

  const cnt = (mo: string, k: string) =>
    quotes.filter((r) => r.month === mo && r.category === k).reduce((a, r) => a + r.count, 0);
  const totM = (mo: string) =>
    quotes.filter((r) => r.month === mo).reduce((a, r) => a + r.count, 0);
  const curTot = totM(curM);
  const pvTot = totM(pv);
  const ytdQuotes = sumBy(
    quotes.filter((r) => r.month >= ym(yr, 1) && r.month <= curM),
    (r) => r.count
  );
  const lastYrQuotes = sumBy(
    quotes.filter((r) => r.month >= ym(+yr - 1, 1) && r.month <= ym(+yr - 1, mm)),
    (r) => r.count
  );

  const { bySource: bySrcAll, topSourceKey: topSrcKey, items: srcItems } = buildSourceShareData(
    quotesRaw,
    yr,
    quotes
  );

  const catCounts = QUOTE_CATS.map((k) => ({
    k,
    c: quotes
      .filter((r) => r.month.startsWith(yr) && r.category === k)
      .reduce((a, r) => a + r.count, 0),
  })).sort((a, b) => b.c - a.c);
  const topCat = catCounts[0];

  const series = QUOTE_CATS.map((k, ci) => ({
    k,
    c: QUOTE_COLORS[ci],
    v: labels.map((_, i) => cnt(`${yr}-${String(i + 1).padStart(2, '0')}`, k)),
  })).filter((s) => s.v.some((x) => x));

  return (
    <div className="view on" data-view="quotes" data-title="견적 상세">
      <ViewHeader
        title="ITKET 견적 상세 현황"
        description="쇼핑몰(고도몰5) 및 직영 채널 접수 견적의 월별·카테고리별 유입 추이"
        status={status}
      />

      <div className="kpis" id="kpiQuotes">
        <KpiCard
          label={`${mLabel(curM)} 접수 견적`}
          value={`${fmt(curTot)}건`}
          cur={curTot}
          prev={pvTot}
          cmpLabel="전월"
        />
        <KpiCard
          label={`${yr}년 누적 견적 (1~${mm}월)`}
          value={`${fmt(ytdQuotes)}건`}
          cur={ytdQuotes}
          prev={lastYrQuotes}
          cmpLabel="전년 동기"
        />
        <KpiCard
          label={`${yr}년 최다 유입 매체`}
          value={topSrcKey}
          sub={bySrcAll[topSrcKey] ? `${fmt(bySrcAll[topSrcKey])}건 접수` : '집계 중'}
        />
        <KpiCard
          label={`${yr}년 최다 견적 카테고리`}
          value={topCat?.k || '–'}
          sub={`${fmt(topCat?.c || 0)}건 (${ytdQuotes > 0 ? ((topCat.c / ytdQuotes) * 100).toFixed(1) : 0}%)`}
        />
      </div>

      <div className="grid">
        <MultiChart
          id="chQuote"
          title="월별 견적 접수 수"
          labels={labels}
          series={series}
          unit="건"
        />
        <div className="card" id="quotes-src">
          <h3>유입 매체 비중</h3>
          <SourceBarChart
            id="chSrc"
            items={srcItems}
            emptyMessage="취합된 실제 유입 매체 데이터가 없습니다."
          />
        </div>
      </div>

      <MonthlyQuotesTable
        quotes={quotes}
        quotesRaw={quotesRaw}
        yr={yr}
        curM={curM}
        months={months}
        allMonths={allMonths}
      />
      <SecSrc sources={QUOTES_SOURCES} />
    </div>
  );
};
