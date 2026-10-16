import React from 'react';
import type { CategoryBarItem, CategoryMap, DashboardData, DonutItem, SyncStatus } from '../types/dashboard';
import {
  catSum,
  fmt,
  mLabel,
  prevM,
  QUOTE_CATS,
  QUOTE_COLORS,
  SERIES_DEFS,
  sumBy,
  THIS_M,
  ym,
} from '../utils/format';
import { KpiCard } from '../components/charts/KpiCard';
import { MultiChart } from '../components/charts/MultiChart';
import { CategoryBarChart } from '../components/charts/CategoryBarChart';
import { SourceDonut } from '../components/charts/SourceDonut';

interface OverviewViewProps {
  data: DashboardData;
  categoryMap: CategoryMap;
  status: SyncStatus;
}

export const OverviewView: React.FC<OverviewViewProps> = ({ data, categoryMap, status }) => {
  const live = status === 'live';
  const hasSpend = data.spend.length > 0;
  const hasQuotes = data.quotes.length > 0;

  if (!hasSpend && !hasQuotes) {
    return (
      <div className="view on" data-view="overview" data-title="종합 요약">
        <div className="mod-h">
          <div>
            <h2>종합 요약</h2>
            <p>광고비 집행 현황과 견적 유입 성과를 한눈에 파악하는 통합 대시보드</p>
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
          <a
            href="https://docs.google.com/spreadsheets/d/1mxrTeh7bo50RTz_2_UNyQxtQrljoEK4-xgPy9fr8nIg/edit"
            target="_blank"
            rel="noopener"
          >
            취합 스프레드시트
          </a>
          <span>15분 자동 동기화</span>
        </p>
        <div className="kpis" id="kpiOverview">
          <div className="kpi">
            <div className="l">데이터 상태</div>
            <div className="v">연결 대기</div>
            <div className="d flat">상단 [연결 설정]을 완료해 주세요</div>
          </div>
        </div>
      </div>
    );
  }

  const allMonths = [
    ...new Set([...data.spend.map((r) => r.month), ...data.quotes.map((r) => r.month)]),
  ]
    .filter(Boolean)
    .sort();
  const curM =
    allMonths.filter((m) => m <= THIS_M).pop() || allMonths[allMonths.length - 1] || THIS_M;
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
  const quoteSeries = QUOTE_CATS.map((k, ci) => ({
    k,
    c: QUOTE_COLORS[ci],
    v: months.map((mo) => cnt(mo, k)),
  })).filter((s) => s.v.some((x) => x));

  // 카테고리별 소진 vs 견적
  const catsMap = (mo: string) => catSum(categoryMap, atSpend(mo), (r) => r.cost);
  const ca = catsMap(curM);
  const cb = catsMap(pv);
  const catKeys = Object.keys(ca)
    .concat(Object.keys(cb).filter((k) => !(k in ca)))
    .sort((x, y) => (ca[y] || 0) - (ca[x] || 0));
  const topCats = catKeys.slice(0, 7);
  const restCats = catKeys.slice(7);
  const qOf = (mo: string, c: string) =>
    data.quotes
      .filter((r) => r.month === mo && r.category === c)
      .reduce((a, r) => a + r.count, 0);

  const list: CategoryBarItem[] = topCats.map((k) => ({
    k,
    cur: (ca[k] || 0) / 1e4,
    prev: (cb[k] || 0) / 1e4,
    q: qOf(curM, k),
  }));
  if (restCats.length) {
    list.push({
      k: `기타 ${restCats.length}개`,
      cur: sumBy(restCats, (k) => ca[k] || 0) / 1e4,
      prev: sumBy(restCats, (k) => cb[k] || 0) / 1e4,
      q: sumBy(restCats, (k) => qOf(curM, k)),
    });
  }

  // 유입 매체 비중 — quotesRaw 기반으로 세분화된 매체 전체 집계
  const quotesRaw = data.quotesRaw || [];
  const bySrc: Record<string, number> = {};
  quotesRaw
    .filter((r) => r.date?.startsWith(yr) && r.source && r.source !== '미수집')
    .forEach((r) => {
      bySrc[r.source] = (bySrc[r.source] || 0) + 1;
    });
  const totSrc = Object.values(bySrc).reduce((a, b) => a + b, 0);
  const srcColor = (s: string) => {
    if (s.startsWith('네이버') || s.startsWith('Naver')) return '--c-n';
    if (s.startsWith('구글') || s.startsWith('Google')) return '--c-g';
    if (s.startsWith('Meta')) return '--c-m';
    if (s.startsWith('카카오')) return '--c-ka';
    return '--sub';
  };
  const srcItems: DonutItem[] = totSrc
    ? Object.keys(bySrc)
        .sort((a, b) => bySrc[b] - bySrc[a])
        .map((k) => ({
          k,
          c: srcColor(k),
          v: Math.round((bySrc[k] / totSrc) * 100),
        }))
    : [];

  return (
    <div className="view on" data-view="overview" data-title="종합 요약">
      <div className="mod-h">
        <div>
          <h2>종합 요약</h2>
          <p>광고비 집행 현황과 견적 유입 성과를 한눈에 파악하는 통합 대시보드</p>
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
        <a
          href="https://docs.google.com/spreadsheets/d/1mxrTeh7bo50RTz_2_UNyQxtQrljoEK4-xgPy9fr8nIg/edit"
          target="_blank"
          rel="noopener"
        >
          취합 스프레드시트
        </a>
        <span>15분 자동 동기화</span>
      </p>

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
          title={
            <>
              월별 광고비 추이 <span className="muted">만원</span>
            </>
          }
          labels={months.map(mLabel)}
          series={spendSeries}
          unit="만원"
          emptyMessage="취합된 광고비 데이터가 없습니다."
        />
        <MultiChart
          id="chOverviewQuotes"
          title={
            <>
              월별 견적 접수 추이 <span className="muted">건</span>
            </>
          }
          labels={months.map(mLabel)}
          series={quoteSeries}
          unit="건"
          emptyMessage="취합된 견적 데이터가 없습니다."
        />
      </div>

      <div className="grid">
        <div className="card" id="overview-cat">
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
            <span className="leg-note">우측: 견적 건수</span>
          </div>
        </div>
        <div className="card" id="overview-src">
          <h3>유입 매체 비중</h3>
          <SourceDonut
            id="chOverviewSrc"
            items={srcItems}
            emptyMessage="취합된 유입 매체 데이터가 없습니다."
          />
        </div>
      </div>
    </div>
  );
};
