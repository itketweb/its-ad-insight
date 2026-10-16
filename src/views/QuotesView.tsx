import React from 'react';
import type { DashboardData, DonutItem, SyncStatus } from '../types/dashboard';
import {
  fmt,
  mLabel,
  prevM,
  QUOTE_CATS,
  QUOTE_COLORS,
  sumBy,
  ym,
} from '../utils/format';
import { DeltaSpan, KpiCard } from '../components/charts/KpiCard';
import { MultiChart } from '../components/charts/MultiChart';
import { SourceDonut } from '../components/charts/SourceDonut';

interface QuotesViewProps {
  data: DashboardData;
  status: SyncStatus;
}

export const QuotesView: React.FC<QuotesViewProps> = ({ data, status }) => {
  const live = status === 'live';
  const quotes = data.quotes || [];

  if (!quotes.length) {
    return (
      <div className="view on" data-view="quotes" data-title="견적 상세">
        <div className="mod-h">
          <div>
            <h2>ITKET 견적 상세 현황</h2>
            <p>쇼핑몰(고도몰5) 및 직영 채널 접수 견적의 월별·카테고리별 유입 추이</p>
          </div>
          <span className={`ex${live ? ' live' : ''}`} data-src>
            {live ? '실제 취합 데이터' : '데이터 대기 중'}
          </span>
        </div>
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

  const last = quotes.reduce((m, r) => (r.month > m ? r.month : m), '');
  const yr = last.slice(0, 4);
  const mm = +last.slice(5, 7);
  const curM = `${yr}-${String(mm).padStart(2, '0')}`;
  const pv = prevM(curM);
  const labels = Array.from({ length: mm }, (_, i) => `${i + 1}월`);
  const months = Array.from({ length: mm }, (_, i) => ym(yr, i + 1));

  const cnt = (mo: string, k: string) =>
    quotes.filter((r) => r.month === mo && r.category === k).reduce((a, r) => a + r.count, 0);
  const totM = (mo: string) =>
    quotes.filter((r) => r.month === mo).reduce((a, r) => a + r.count, 0);
  const curTot = totM(curM);
  const pvTot = totM(pv);
  const ytdQuotes = sumBy(
    quotes.filter((r) => r.month.startsWith(yr)),
    (r) => r.count
  );

  const bySrcAll: Record<string, number> = {};
  quotes
    .filter((r) => r.month.startsWith(yr) && r.source !== '미수집')
    .forEach((r) => {
      bySrcAll[r.source] = (bySrcAll[r.source] || 0) + r.count;
    });
  const topSrcKey = Object.keys(bySrcAll).sort((a, b) => bySrcAll[b] - bySrcAll[a])[0] || '–';

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

  const totSrc = Object.values(bySrcAll).reduce((a, b) => a + b, 0);
  const sc: Record<string, string> = {
    Naver: '--c-n',
    Google: '--c-g',
    Meta: '--c-m',
    '직접·기타': '--sub',
  };
  const srcItems: DonutItem[] = totSrc
    ? Object.keys(bySrcAll)
        .sort((a, b) => bySrcAll[b] - bySrcAll[a])
        .map((k) => ({
          k,
          c: sc[k] || '--sub',
          v: Math.round((bySrcAll[k] / totSrc) * 100),
        }))
    : [];

  const lastYQuote = (mo: string) => totM(ym(+yr - 1, +mo.slice(5)));

  return (
    <div className="view on" data-view="quotes" data-title="견적 상세">
      <div className="mod-h">
        <div>
          <h2>ITKET 견적 상세 현황</h2>
          <p>쇼핑몰(고도몰5) 및 직영 채널 접수 견적의 월별·카테고리별 유입 추이</p>
        </div>
        <span className={`ex${live ? ' live' : ''}`} data-src>
          {live ? '실제 취합 데이터' : '데이터 대기 중'}
        </span>
      </div>
      <p className="sec-src">
        <a href="https://itket.com/d/dbk_estimate_list.php" target="_blank" rel="noopener">
          아이티켓 고도몰 견적 목록
        </a>
        <a
          href="https://docs.google.com/spreadsheets/d/1mxrTeh7bo50RTz_2_UNyQxtQrljoEK4-xgPy9fr8nIg/edit"
          target="_blank"
          rel="noopener"
        >
          취합 스프레드시트
        </a>
        <span>collectQuotes · 15분 자동 동기화</span>
      </p>

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
          sub="쇼핑몰·전화 직영 유입"
        />
        <KpiCard
          label={`${yr}년 최다 유입 매체`}
          value={topSrcKey}
          smallValue
          sub={bySrcAll[topSrcKey] ? `${fmt(bySrcAll[topSrcKey])}건 접수` : '집계 중'}
        />
        <KpiCard
          label={`${yr}년 최다 견적 카테고리`}
          value={topCat?.k || '–'}
          smallValue
          sub={`${fmt(topCat?.c || 0)}건 (${ytdQuotes > 0 ? ((topCat.c / ytdQuotes) * 100).toFixed(1) : 0}%)`}
        />
      </div>

      <div className="grid">
        <MultiChart
          id="chQuote"
          title={
            <>
              월별 견적 접수 수 <span className="muted">건</span>
            </>
          }
          labels={labels}
          series={series}
          unit="건"
        />
        <div className="card">
          <h3>유입 매체 비중</h3>
          <SourceDonut
            id="chSrc"
            items={srcItems}
            emptyMessage="취합된 실제 유입 매체 데이터가 없습니다."
          />
        </div>
      </div>

      <div className="card tw">
        <h3>월별 카테고리별 견적 접수 내역</h3>
        <div id="tbQuotesSummary">
          <table className="stk">
            <thead>
              <tr>
                <th>월</th>
                {QUOTE_CATS.map((c) => (
                  <th key={c} className="n">
                    {c}
                  </th>
                ))}
                <th className="n">합계</th>
                <th className="n">전년 동월</th>
                <th className="n">전년비</th>
              </tr>
            </thead>
            <tbody>
              {months.map((mo) => {
                const t = totM(mo);
                const l = lastYQuote(mo);
                return (
                  <tr key={mo}>
                    <td>{mLabel(mo)}</td>
                    {QUOTE_CATS.map((c) => (
                      <td key={c} className="n">
                        {fmt(cnt(mo, c))}
                      </td>
                    ))}
                    <td className="n">
                      <b>{fmt(t)}</b>
                    </td>
                    <td className="n">{fmt(l)}</td>
                    <td className="n">
                      <DeltaSpan a={t} b={l} />
                    </td>
                  </tr>
                );
              })}
              <tr className="grp">
                <td>합계</td>
                {QUOTE_CATS.map((c) => (
                  <td key={c} className="n">
                    {fmt(sumBy(months, (mo) => cnt(mo, c)))}
                  </td>
                ))}
                <td className="n">
                  <b>{fmt(sumBy(months, totM))}</b>
                </td>
                <td className="n">{fmt(sumBy(months, lastYQuote))}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
