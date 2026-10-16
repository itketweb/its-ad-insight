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
import { DeltaSpan, KpiCard } from '../components/charts/KpiCard';
import { MultiChart } from '../components/charts/MultiChart';

interface AdsViewProps {
  data: DashboardData;
  status: SyncStatus;
}

export const AdsView: React.FC<AdsViewProps> = ({ data, status }) => {
  const live = status === 'live';
  const years = [...new Set(data.spend.map((r) => Number(r.month.slice(0, 4))))].sort(
    (a, b) => b - a
  );
  const availableYears = years.length ? years : [THIS_Y];
  const [selectedYear, setSelectedYear] = useState<number>(availableYears[0]);
  const [mode, setMode] = useState<'chart' | 'table'>('chart');

  const Y = availableYears.includes(selectedYear) ? selectedYear : availableYears[0];

  if (!data.spend.length) {
    return (
      <div className="view on" data-view="ads" data-title="월별 광고비">
        <div className="mod-h">
          <div>
            <h2>월별 광고비</h2>
            <p>매체별·구분별 월간 광고비 집행 추이 및 소진 내역</p>
          </div>
          <span className={`ex${live ? ' live' : ''}`} data-src>
            {live ? '실제 취합 데이터' : '데이터 대기 중'}
          </span>
        </div>
        <div className="kpis" id="kpiAds">
          <div className="kpi">
            <div className="l">실제 광고비 데이터</div>
            <div className="v">–</div>
            <div className="d flat">데이터 연결 필요</div>
          </div>
        </div>
        <div className="card">
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
    const manStore = man(mo, 'STORE');
    return apiStore || manStore;
  };

  const mdfCost = (mo: string) => {
    const manMdf = man(mo, 'MDF');
    const apiMdf = sumBy(
      data.spend.filter((r) => r.month === mo && r.campaign.includes('MDF')),
      (r) => r.cost
    );
    return manMdf || apiMdf;
  };

  const curM = months[months.length - 1];
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
      <div className="mod-h">
        <div>
          <h2>월별 광고비</h2>
          <p>매체별·구분별 월간 광고비 집행 추이 및 소진 내역</p>
        </div>
        <span className={`ex${live ? ' live' : ''}`} data-src>
          {live ? '실제 취합 데이터' : '데이터 대기 중'}
        </span>
      </div>
      <p className="sec-src">
        <a href="https://ads.google.com" target="_blank" rel="noopener">
          Google Ads API
        </a>
        <a href="https://searchad.naver.com" target="_blank" rel="noopener">
          네이버 검색광고 API
        </a>
        <span>Meta Ads 수동 입력</span>
        <a href="https://sell.smartstore.naver.com" target="_blank" rel="noopener">
          네이버 커머스 API
        </a>
        <span>MDF 업로드 시트</span>
        <a
          href="https://docs.google.com/spreadsheets/d/1mxrTeh7bo50RTz_2_UNyQxtQrljoEK4-xgPy9fr8nIg/edit"
          target="_blank"
          rel="noopener"
        >
          취합 스프레드시트
        </a>
      </p>

      <div className="mock-bar">
        <span className="seg" data-k="year" id="segYear">
          {availableYears.map((y) => (
            <button
              key={y}
              data-v={y}
              className={Y === y ? 'on' : ''}
              onClick={() => setSelectedYear(y)}
            >
              {y}
            </button>
          ))}
        </span>
        <span className="seg" data-k="mode">
          <button
            data-v="chart"
            className={mode === 'chart' ? 'on' : ''}
            onClick={() => setMode('chart')}
          >
            그래프
          </button>
          <button
            data-v="table"
            className={mode === 'table' ? 'on' : ''}
            onClick={() => setMode('table')}
          >
            표
          </button>
        </span>
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
          title={
            <>
              월별 매체·구분별 광고비 <span className="muted">만원</span>
            </>
          }
          labels={months.map(mLabel)}
          series={series}
          unit="만원"
        />
      )}

      <div className="card tw" id="spend-monthly">
        <h3>월별 집행 상세 내역</h3>
        <div>
          <table className="stk" id="tbSpendDetail">
            <thead>
              <tr>
                <th>구분</th>
                {allMonths12.map((mo) => (
                  <th key={mo} className={`n${isFuture(mo) ? ' future' : ''}`}>{mLabel(mo)}</th>
                ))}
                <th className="n">합계</th>
              </tr>
            </thead>
            <tbody>
              {series.map((s) => (
                <tr key={s.k}>
                  <td>{s.k}</td>
                  {allMonths12.map((mo) => (
                    <td key={mo} className={`n${isFuture(mo) ? ' future' : ''}`}>
                      {fmt(sumBy(at(mo).filter(s.f), (r) => r.cost))}
                    </td>
                  ))}
                  <td className="n"><b>{fmt(sumBy(s.raw || [], (v) => v))}</b></td>
                </tr>
              ))}
              <tr className="grp">
                <td>합계</td>
                {allMonths12.map((mo) => (
                  <td key={mo} className={`n${isFuture(mo) ? ' future' : ''}`}>{fmt(tot(mo))}</td>
                ))}
                <td className="n"><b>{fmt(sumBy(months, tot))}</b></td>
              </tr>
              <tr>
                <td className="sub-t">MDF</td>
                {allMonths12.map((mo) => (
                  <td key={mo} className={`n sub-t${isFuture(mo) ? ' future' : ''}`}>{fmt(mdfCost(mo))}</td>
                ))}
                <td className="n sub-t">{fmt(sumBy(months, mdfCost))}</td>
              </tr>
              <tr>
                <td className="sub-t">스토어</td>
                {allMonths12.map((mo) => (
                  <td key={mo} className={`n sub-t${isFuture(mo) ? ' future' : ''}`}>{fmt(storeCost(mo))}</td>
                ))}
                <td className="n sub-t">{fmt(sumBy(months, storeCost))}</td>
              </tr>
              <tr>
                <td className="sub-t">전년 동월</td>
                {allMonths12.map((mo) => (
                  <td key={mo} className={`n sub-t${isFuture(mo) ? ' future' : ''}`}>{fmt(lastY(mo))}</td>
                ))}
                <td className="n sub-t">{fmt(sumBy(months, lastY))}</td>
              </tr>
              <tr>
                <td className="sub-t">전년비</td>
                {allMonths12.map((mo) => (
                  <td key={mo} className={`n${isFuture(mo) ? ' future' : ''}`}>
                    <DeltaSpan a={tot(mo)} b={lastY(mo)} />
                  </td>
                ))}
                <td />
              </tr>
            </tbody>
          </table>
          <p className="tbl-src">
            단위: 원&nbsp;
            <span>
              Google SA·DA —{' '}
              <a href="https://ads.google.com" target="_blank" rel="noopener">
                Google Ads
              </a>{' '}
              API 자동 수집
            </span>
            <span>
              Naver SA —{' '}
              <a href="https://searchad.naver.com" target="_blank" rel="noopener">
                네이버 검색광고
              </a>{' '}
              API 자동 수집
            </span>
            <span>Naver DA — 네이버 DA 리포트 시트</span>
            <span>
              Meta —{' '}
              <a href="https://adsmanager.facebook.com" target="_blank" rel="noopener">
                Meta Ads 관리자
              </a>{' '}
              시트
            </span>
            <span>
              스토어 —{' '}
              <a href="https://sell.smartstore.naver.com" target="_blank" rel="noopener">
                네이버 스마트스토어
              </a>{' '}
              커머스 API 자동 수집
            </span>
            <span>MDF — MDF 업로드 시트 + HPE_MDF 캠페인</span>
          </p>
        </div>
      </div>
    </div>
  );
};
