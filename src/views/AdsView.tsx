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

interface AdsViewProps {
  data: DashboardData;
  status: SyncStatus;
  selectedMonth?: string;
}

const ADS_SOURCES: SourceLinkItem[] = [
  { label: 'Google Ads API', href: EXTERNAL_LINKS.googleAds },
  { label: '네이버 검색광고 API', href: EXTERNAL_LINKS.naverSearchAd },
  { label: 'Meta Ads 시트 (수동 입력)' },
  { label: '네이버 커머스 API', href: EXTERNAL_LINKS.naverSmartStore },
  { label: 'MDF 업로드 시트' },
  { label: '취합 스프레드시트', href: EXTERNAL_LINKS.masterSheet },
];

export const AdsView: React.FC<AdsViewProps> = ({ data, status, selectedMonth }) => {
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
        <div className="card card-empty" id="ads-empty" data-card="empty">
          <div className="empty">
            취합된 실제 광고비 데이터가 없습니다. 상단 [연결 설정] 버튼에서 데이터 연결을 완료해 주세요.
          </div>
        </div>
      </div>
    );
  }

  const months = Array.from({ length: Y === THIS_Y ? NOW_MONTH : 12 }, (_, i) => ym(Y, i + 1));
  const allMonths12 = Array.from({ length: 12 }, (_, i) => ym(Y, i + 1));
  const isFuture = (mo: string) => Y === THIS_Y && mo > months[months.length - 1];
  const at = (mo: string) => data.spend.filter((r) => r.month === mo);
  const tot = (mo: string) => sumBy(at(mo), (r) => r.cost);
  const man = (mo: string, item: string) =>
    sumBy(
      data.manual.filter((r) => r.month === mo && r.item === item),
      (r) => r.amount
    );

  const storeCost = (mo: string) => {
    const apiStore = sumBy(
      data.spend.filter(
        (r) => r.month === mo && (r.campaign.includes('스마트스토어') || r.campaign.includes('스토어'))
      ),
      (r) => r.cost
    );
    return apiStore || man(mo, 'STORE');
  };

  const mdfCost = (mo: string) => {
    const manMdf = man(mo, 'MDF');
    const apiMdf = sumBy(
      data.spend.filter((r) => r.month === mo && r.campaign.includes('MDF')),
      (r) => r.cost
    );
    return manMdf || apiMdf;
  };

  const curM =
    selectedMonth && selectedMonth.startsWith(String(Y))
      ? selectedMonth
      : months[months.length - 1];
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

      <div className="kpis" id="kpiAds">
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
      </div>

      {mode === 'chart' && (
        <MultiChart
          id="chSpend"
          title="월별 매체·구분별 광고비"
          labels={months.map(mLabel)}
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
      />
      <SecSrc sources={ADS_SOURCES} />
    </div>
  );
};
