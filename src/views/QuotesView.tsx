import React, { useState } from 'react';
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
  const quotesRaw = data.quotesRaw || [];
  const [summaryTab, setSummaryTab] = useState<'cat' | 'src'>('src');
  const [srcPlatform, setSrcPlatform] = useState<'네이버' | '구글' | '기타·직접'>('네이버');

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
  const allMonths = Array.from({ length: 12 }, (_, i) => ym(yr, i + 1));
  const isFuture = (mo: string) => mo > curM;

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
  quotesRaw
    .filter((r) => r.date?.startsWith(yr) && r.source && r.source !== '미수집')
    .forEach((r) => {
      bySrcAll[r.source] = (bySrcAll[r.source] || 0) + 1;
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
  const srcColor = (s: string) => {
    if (s.startsWith('네이버') || s.startsWith('Naver')) return '--c-n';
    if (s.startsWith('구글') || s.startsWith('Google')) return '--c-g';
    if (s.startsWith('Meta')) return '--c-m';
    if (s.startsWith('카카오')) return '--c-ka';
    return '--sub';
  };
  const srcItems: DonutItem[] = totSrc
    ? Object.keys(bySrcAll)
        .sort((a, b) => bySrcAll[b] - bySrcAll[a])
        .map((k) => ({
          k,
          c: srcColor(k),
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
        <a
          href="https://docs.google.com/spreadsheets/d/18tMYBQLuIhkmX_x_c8MK-aNXlGvOgz1TWauvqo8Dmjg/edit?gid=0#gid=0"
          target="_blank"
          rel="noopener"
        >
          견적 접수 원본 시트
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
        <div className="card" id="quotes-src">
          <h3>유입 매체 비중</h3>
          <SourceDonut
            id="chSrc"
            items={srcItems}
            emptyMessage="취합된 실제 유입 매체 데이터가 없습니다."
          />
        </div>
      </div>

      <div className="card tw" id="quotes-table">
        <h3>
          월별 견적 접수 현황
          <span className="seg seg-mini">
            <button className={summaryTab === 'src' ? 'on' : ''} onClick={() => setSummaryTab('src')}>
              유입 매체별
            </button>
            <button className={summaryTab === 'cat' ? 'on' : ''} onClick={() => setSummaryTab('cat')}>
              카테고리별
            </button>
          </span>
        </h3>

        {summaryTab === 'cat' && (
          <div id="tbQuotesSummary">
            <table className="stk" id="tbQuotesCat">
              <thead>
                <tr>
                  <th>카테고리</th>
                  {allMonths.map((mo) => <th key={mo} className={`n${isFuture(mo) ? ' future' : ''}`}>{mLabel(mo)}</th>)}
                  <th className="n">합계</th>
                </tr>
              </thead>
              <tbody>
                {QUOTE_CATS.map((c) => (
                  <tr key={c}>
                    <td>{c}</td>
                    {allMonths.map((mo) => (
                      <td key={mo} className={`n${isFuture(mo) ? ' future' : ''}`}>{fmt(cnt(mo, c))}</td>
                    ))}
                    <td className="n"><b>{fmt(sumBy(months, (mo) => cnt(mo, c)))}</b></td>
                  </tr>
                ))}
                <tr className="grp">
                  <td>합계</td>
                  {allMonths.map((mo) => (
                    <td key={mo} className={`n${isFuture(mo) ? ' future' : ''}`}>{fmt(totM(mo))}</td>
                  ))}
                  <td className="n"><b>{fmt(sumBy(months, totM))}</b></td>
                </tr>
                <tr>
                  <td className="sub-t">전년 동월</td>
                  {allMonths.map((mo) => (
                    <td key={mo} className={`n sub-t${isFuture(mo) ? ' future' : ''}`}>{fmt(lastYQuote(mo))}</td>
                  ))}
                  <td className="n sub-t">{fmt(sumBy(months, lastYQuote))}</td>
                </tr>
                <tr>
                  <td className="sub-t">전년비</td>
                  {allMonths.map((mo) => (
                    <td key={mo} className={`n${isFuture(mo) ? ' future' : ''}`}><DeltaSpan a={totM(mo)} b={lastYQuote(mo)} /></td>
                  ))}
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {summaryTab === 'src' && (() => {
          const SRC_GROUPS: Record<string, string[]> = {
            '네이버': ['네이버(광고)', '네이버(검색)', '네이버(블로그)', '네이버(카페)', '네이버(쇼핑)'],
            '구글': ['구글(광고)', '구글(검색)', '구글(유튜브)', '구글(디스플레이)'],
            '기타·직접': ['Meta', '카카오', '유튜브', '블로그·커뮤니티', '직접', '직접·기타', '미수집'],
          };
          // 데이터에서 실제 등장한 타입 중 미리 정의되지 않은 것도 포함
          const knownSet = new Set(Object.values(SRC_GROUPS).flat());
          const dynamicExtra = [...new Set(
            quotesRaw.filter((r) => r.date?.startsWith(yr) && r.source).map((r) => r.source!)
          )].filter((s) => !knownSet.has(s));
          if (dynamicExtra.length) SRC_GROUPS['기타·직접'].push(...dynamicExtra);

          const srcCols = SRC_GROUPS[srcPlatform] || [];
          const cntS = (mo: string, s: string) =>
            quotesRaw.filter((r) => r.date?.startsWith(mo) && r.source === s).length;
          const totRaw = (mo: string) =>
            quotesRaw.filter((r) => r.date?.startsWith(mo)).length;
          return (
            <div id="tbQuotesSrc">
              <div className="seg seg-mini seg-src-platform">
                {(Object.keys(SRC_GROUPS) as Array<keyof typeof SRC_GROUPS>).map((p) => (
                  <button
                    key={p}
                    className={srcPlatform === p ? 'on' : ''}
                    onClick={() => setSrcPlatform(p as typeof srcPlatform)}
                  >
                    {p}
                    {(() => {
                      const tot = sumBy(months, (mo) =>
                        SRC_GROUPS[p].reduce((a, s) => a + cntS(mo, s), 0)
                      );
                      return tot > 0 ? <span className="tab-cnt">{fmt(tot)}</span> : null;
                    })()}
                  </button>
                ))}
              </div>
              <table className="stk" id="tbQuotesSrcMonth">
                <thead>
                  <tr>
                    <th>매체</th>
                    {allMonths.map((mo) => <th key={mo} className={`n${isFuture(mo) ? ' future' : ''}`}>{mLabel(mo)}</th>)}
                    <th className="n">합계</th>
                  </tr>
                </thead>
                <tbody>
                  {srcCols.map((s) => (
                    <tr key={s}>
                      <td>{s}</td>
                      {allMonths.map((mo) => (
                        <td key={mo} className={`n${isFuture(mo) ? ' future' : ''}`}>{fmt(cntS(mo, s))}</td>
                      ))}
                      <td className="n"><b>{fmt(sumBy(months, (mo) => cntS(mo, s)))}</b></td>
                    </tr>
                  ))}
                  <tr className="grp">
                    <td>합계</td>
                    {allMonths.map((mo) => (
                      <td key={mo} className={`n${isFuture(mo) ? ' future' : ''}`}>{fmt(totRaw(mo))}</td>
                    ))}
                    <td className="n"><b>{fmt(sumBy(months, totRaw))}</b></td>
                  </tr>
                  <tr>
                    <td className="sub-t">전년 동월</td>
                    {allMonths.map((mo) => (
                      <td key={mo} className={`n sub-t${isFuture(mo) ? ' future' : ''}`}>{fmt(lastYQuote(mo))}</td>
                    ))}
                    <td className="n sub-t">{fmt(sumBy(months, lastYQuote))}</td>
                  </tr>
                  <tr>
                    <td className="sub-t">전년비</td>
                    {allMonths.map((mo) => (
                      <td key={mo} className={`n${isFuture(mo) ? ' future' : ''}`}><DeltaSpan a={totRaw(mo)} b={lastYQuote(mo)} /></td>
                    ))}
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })()}
        <p className="tbl-src">
          단위: 건&nbsp;
          <span>견적 접수 원본 시트 · collectQuotes 1시간 자동 동기화</span>
          <a
            href="https://docs.google.com/spreadsheets/d/18tMYBQLuIhkmX_x_c8MK-aNXlGvOgz1TWauvqo8Dmjg/edit?gid=0#gid=0"
            target="_blank"
            rel="noopener"
          >
            원본 시트 열기
          </a>
        </p>
      </div>
    </div>
  );
};
