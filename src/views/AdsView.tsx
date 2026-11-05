import React, { useState } from 'react';
import type { DashboardData, SyncStatus } from '../types/dashboard';
import {
  fmt,
  mLabel,
  NOW_MONTH,
  prevM,
  SERIES_DEFS,
  sumBy,
  THIS_M,
  THIS_Y,
  ym,
} from '../utils/format';
import { EXTERNAL_LINKS } from '../utils/constants';
import { ViewHeader, SecSrc, type SourceLinkItem } from '../components/common/ViewHeader';
import { SegmentedControl } from '../components/common/SegmentedControl';
import { KpiCard } from '../components/charts/KpiCard';
import { MultiChart } from '../components/charts/MultiChart';
import { SpendDetailTable } from '../components/ads/SpendDetailTable';
import { Card } from '../components/common/Card';
import { EmptyState } from '../components/common/EmptyState';
import { dotYm, monthsUpTo, periodStartsOf, sameMonthsLastYear, yearRangeLabel } from '../utils/allPeriod';

interface AdsViewProps {
  data: DashboardData;
  status: SyncStatus;
  selectedMonth?: string;
  /** 기간 선택이 '전체' — 표·그래프의 열이 달 대신 연도(YYYY)가 된다 */
  allPeriod?: boolean;
  /** 월 선택이 '전체' — selectedMonth 는 그 연도의 마지막 달이다 */
  yearTotal?: boolean;
}

const ADS_SOURCES: SourceLinkItem[] = [
  { label: 'Google Ads API', href: EXTERNAL_LINKS.googleAds },
  { label: '네이버 검색광고 API', href: EXTERNAL_LINKS.naverSearchAd },
  { label: 'Meta Ads 시트 (수동 입력)' },
  { label: '네이버 커머스 API', href: EXTERNAL_LINKS.naverSmartStore },
  { label: 'MDF 업로드 시트' },
  { label: '취합 스프레드시트', href: EXTERNAL_LINKS.masterSheet },
];

export const AdsView: React.FC<AdsViewProps> = ({ data, status, selectedMonth, allPeriod = false, yearTotal = false }) => {
  const years = [...new Set(data.spend.map((r) => Number(r.month.slice(0, 4))))].sort(
    (a, b) => b - a
  );
  const availableYears = years.length ? years : [THIS_Y];
  const [mode, setMode] = useState<'chart' | 'table'>('chart');

  const targetYear = selectedMonth ? Number(selectedMonth.slice(0, 4)) : availableYears[0];
  const Y = availableYears.includes(targetYear) ? targetYear : availableYears[0];

  if (!data.spend.length) {
    return (
      <div className="view on" data-view="ads" data-title="월별 광고비">
        <ViewHeader
          title="월별 광고비"
          description="매체별·구분별 월간 광고비 집행 추이 및 소진 내역"
          status={status}
        />
        <div className="kpis" id="kpiAds">
          <div className="kpi">
            <div className="l">실제 광고비 데이터</div>
            <div className="v">–</div>
            <div className="d flat">데이터 연결 필요</div>
          </div>
        </div>
        <Card name="empty" id="ads-empty">
          <EmptyState message="취합된 실제 광고비 데이터가 없습니다. 상단 [연결 설정] 버튼에서 데이터 연결을 완료해 주세요." />
        </Card>
      </div>
    );
  }

  const yearKeys = availableYears.map(String).sort();
  const yearMonths12 = Array.from({ length: 12 }, (_, i) => ym(Y, i + 1));
  const monthsOfY = Array.from({ length: Y === THIS_Y ? NOW_MONTH : 12 }, (_, i) => ym(Y, i + 1));
  const months = allPeriod ? yearKeys : monthsOfY;
  const allMonths12 = allPeriod ? yearKeys : yearMonths12;
  const isFuture = (mo: string) => !allPeriod && Y === THIS_Y && mo > months[months.length - 1];
  // 키는 달(YYYY-MM) 또는 전체 기간의 연도(YYYY)
  const at = (key: string) => data.spend.filter((r) => r.month.startsWith(key));
  const colLabel = (key: string) => (allPeriod ? `${key}년` : mLabel(key));
  const tot = (mo: string) => sumBy(at(mo), (r) => r.cost);
  const man = (mo: string, item: string) =>
    sumBy(
      data.manual.filter((r) => r.month === mo && r.item === item),
      (r) => r.amount
    );

  // MDF·스토어는 달마다 API 값과 시트 값 중 하나를 고르므로, 연도는 달별 값을 더한다
  const byMonthOrYear = (f: (mo: string) => number) => (key: string) =>
    key.length === 4 ? sumBy(Array.from({ length: 12 }, (_, i) => ym(key, i + 1)), f) : f(key);

  const storeCost = byMonthOrYear((mo: string) => {
    const apiStore = sumBy(
      data.spend.filter(
        (r) => r.month === mo && (r.campaign.includes('스마트스토어') || r.campaign.includes('스토어'))
      ),
      (r) => r.cost
    );
    return apiStore || man(mo, 'STORE');
  });

  const mdfCost = byMonthOrYear((mo: string) => {
    const manMdf = man(mo, 'MDF');
    const apiMdf = sumBy(
      data.spend.filter((r) => r.month === mo && r.campaign.includes('MDF')),
      (r) => r.cost
    );
    return manMdf || apiMdf;
  });

  const curM =
    selectedMonth && selectedMonth.startsWith(String(Y))
      ? selectedMonth
      : monthsOfY[monthsOfY.length - 1];
  const pv = prevM(curM);
  const upTo = +curM.slice(5);
  const ytd = (y: number) =>
    sumBy(
      data.spend.filter((r) => r.month >= ym(y, 1) && r.month <= ym(y, upTo)),
      (r) => r.cost
    );
  const cpa = (mo: string) => {
    const c = sumBy(at(mo), (r) => r.conv);
    return c ? tot(mo) / c : 0;
  };

  const series = SERIES_DEFS.map((s) => ({
    ...s,
    raw: months.map((mo) => sumBy(at(mo).filter(s.f), (r) => r.cost)),
  }))
    .filter((s) => s.raw.some((v) => v))
    .map((s) => ({ ...s, v: s.raw.map((v) => v / 1e4) }));

  const lastY = (mo: string) => tot(ym(Y - 1, +mo.slice(5)));

  // 연도 합계: 1월~마지막 달을 전년 같은 달들과 비교한다
  const yearMonths = monthsUpTo(curM);
  const starts = periodStartsOf(data);
  const allSpendMonths = new Set(data.spend.filter((r) => r.cost > 0).map((r) => r.month)).size;
  const lastYrMonths = sameMonthsLastYear(yearMonths);
  const yearLabel = yearRangeLabel(curM);
  const costIn = (list: string[]) => sumBy(list, tot);
  const mdfIn = (list: string[]) => sumBy(list, mdfCost);
  const cpaIn = (list: string[]) => {
    const c = sumBy(list, (mo) => sumBy(at(mo), (r) => r.conv));
    return c ? costIn(list) / c : 0;
  };
  const spendMonths = yearMonths.filter((mo) => tot(mo) > 0).length;

  return (
    <div className="view on" data-view="ads" data-title="월별 광고비">
      <ViewHeader
        title="월별 광고비"
        description="매체별·구분별 월간 광고비 집행 추이 및 소진 내역"
        status={status}
      />

      <div className="mock-bar">
        <SegmentedControl<'chart' | 'table'>
          dataKey="mode"
          options={[
            { value: 'chart', label: '그래프' },
            { value: 'table', label: '표' },
          ]}
          value={mode}
          onChange={setMode}
        />
        <span className="sp" />
      </div>

      {allPeriod && (
        <p className="leg-note quote-src-note">
          ※ 전체 기간 합산입니다. 데이터 시작 시기가 달라 구글 광고비는 {dotYm(starts.google)}, 네이버 광고비는 {dotYm(starts.naver)}
          {starts.meta && `, 메타 광고비는 ${dotYm(starts.meta)}`}부터입니다.
        </p>
      )}

      <div className="kpis" id="kpiAds">
        {allPeriod ? (
          <>
            <KpiCard
              label="전체 누적 광고비"
              value={`${fmt(costIn(yearKeys))}원`}
              sub={`구글 ${dotYm(starts.google)}~ · 네이버 ${dotYm(starts.naver)}~${starts.meta ? ` · 메타 ${dotYm(starts.meta)}~` : ''}`}
            />
            <KpiCard
              label="월평균 광고비"
              value={`${fmt(allSpendMonths ? Math.round(costIn(yearKeys) / allSpendMonths) : 0)}원`}
              sub={`${fmt(allSpendMonths)}개월 기준`}
            />
            <KpiCard label="전체 MDF 소진" value={`${fmt(mdfIn(yearKeys))}원`} sub="전체 기간 합계" />
            <KpiCard label="전체 전환 1건당 광고비" value={`${fmt(cpaIn(yearKeys))}원`} sub="전체 기간 기준" />
          </>
        ) : yearTotal ? (
          <>
            <KpiCard
              label={
                <>
                  {yearLabel} 광고비
                  {curM === THIS_M && (
                    <>
                      {' '}
                      <small className="muted">(진행 중)</small>
                    </>
                  )}
                </>
              }
              value={`${fmt(costIn(yearMonths))}원`}
              cur={costIn(yearMonths)}
              prev={costIn(lastYrMonths)}
              cmpLabel="전년 동기"
            />
            <KpiCard
              label="월평균 광고비"
              value={`${fmt(spendMonths ? Math.round(costIn(yearMonths) / spendMonths) : 0)}원`}
              sub={`${fmt(spendMonths)}개월 기준`}
            />
            <KpiCard
              label={`${yearLabel} MDF 소진`}
              value={`${fmt(mdfIn(yearMonths))}원`}
              cur={mdfIn(yearMonths)}
              prev={mdfIn(lastYrMonths)}
              cmpLabel="전년 동기"
            />
            <KpiCard
              label={`${yearLabel} 전환 1건당 광고비`}
              value={`${fmt(cpaIn(yearMonths))}원`}
              cur={cpaIn(yearMonths)}
              prev={cpaIn(lastYrMonths)}
              cmpLabel="전년 동기"
            />
          </>
        ) : (
          <>
        <KpiCard
          label={
            <>
              {mLabel(curM)} 광고비
              {curM === THIS_M && (
                <>
                  {' '}
                  <small className="muted">(진행 중)</small>
                </>
              )}
            </>
          }
          value={`${fmt(tot(curM))}원`}
          cur={tot(curM)}
          prev={tot(pv)}
          cmpLabel="전월"
        />
        <KpiCard
          label={`${Y}년 누적 (1~${upTo}월)`}
          value={`${fmt(ytd(Y))}원`}
          cur={ytd(Y)}
          prev={ytd(Y - 1)}
          cmpLabel="전년 동기"
        />
        <KpiCard
          label={`${mLabel(curM)} MDF 소진`}
          value={`${fmt(mdfCost(curM))}원`}
          cur={mdfCost(curM)}
          prev={mdfCost(pv)}
          cmpLabel="전월"
        />
        <KpiCard
          label={`${mLabel(curM)} 전환 1건당 광고비`}
          value={`${fmt(cpa(curM))}원`}
          cur={cpa(curM)}
          prev={cpa(pv)}
          cmpLabel="전월"
        />
          </>
        )}
      </div>

      {mode === 'chart' && (
        <MultiChart
          id="chSpend"
          title={allPeriod ? '연도별 매체·구분별 광고비' : '월별 매체·구분별 광고비'}
          labels={months.map(colLabel)}
          series={series}
          unit="만원"
        />
      )}

      <SpendDetailTable
        series={series}
        allMonths12={allMonths12}
        months={months}
        isFuture={isFuture}
        at={at}
        tot={tot}
        mdfCost={mdfCost}
        storeCost={storeCost}
        lastY={lastY}
        allPeriod={allPeriod}
        colLabel={colLabel}
      />
      <SecSrc sources={ADS_SOURCES} />
    </div>
  );
};
