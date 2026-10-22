import React, { useState, useMemo } from 'react';
import type { QuoteRawRow, QuoteRow } from '../../types/dashboard';
import {
  fmt,
  mLabel,
  QUOTE_CATS,
  QUOTE_COLORS,
  sourceColorVar,
  sumBy,
  ym,
} from '../../utils/format';
import { EXTERNAL_LINKS } from '../../utils/constants';
import { DeltaSpan } from '../charts/KpiCard';
import { SegmentedControl } from '../common/SegmentedControl';
import { TableFootnote } from '../common/TableFootnote';

interface MonthlyQuotesTableProps {
  quotes: QuoteRow[];
  quotesRaw: QuoteRawRow[];
  yr: string;
  curM: string;
  months: string[];
  allMonths: string[];
}

type SummaryTab = 'src' | 'cat';
type SourcePlatform = '네이버' | '구글' | '기타·직접';

const BASE_SRC_GROUPS: Record<SourcePlatform, string[]> = {
  네이버: ['네이버(광고)', '네이버(검색)', '네이버(블로그)', '네이버(카페)', '네이버(쇼핑)'],
  구글: ['구글(광고)', '구글(검색)', '구글(유튜브)', '구글(디스플레이)'],
  '기타·직접': ['Meta', '카카오', '유튜브', '블로그·커뮤니티', '직접', '기타', '미수집'],
};

export const MonthlyQuotesTable: React.FC<MonthlyQuotesTableProps> = ({
  quotes,
  quotesRaw,
  yr,
  curM,
  months,
  allMonths,
}) => {
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  const [timeScope, setTimeScope] = useState<'cur' | 'ytd'>('cur');
  const [summaryTab, setSummaryTab] = useState<SummaryTab>('cat');
  const [srcPlatform, setSrcPlatform] = useState<SourcePlatform>('네이버');

  const isFuture = (mo: string) => mo > curM;

  const cntCat = (mo: string, category: string) =>
    quotes.filter((r) => r.month === mo && r.category === category).reduce((a, r) => a + r.count, 0);

  const totMonth = (mo: string) =>
    quotes.filter((r) => r.month === mo).reduce((a, r) => a + r.count, 0);

  const lastYearQuote = (mo: string) => totMonth(ym(+yr - 1, +mo.slice(5)));

  // 유입 매체 그룹 구성 (정의되지 않은 동적 매체는 '기타·직접'에 병합)
  const knownSet = new Set(Object.values(BASE_SRC_GROUPS).flat());
  const dynamicExtra = [
    ...new Set(
      quotesRaw.filter((r) => r.date?.startsWith(yr) && r.source).map((r) => r.source!)
    ),
  ].filter((s) => !knownSet.has(s));

  const srcGroups: Record<SourcePlatform, string[]> = {
    네이버: BASE_SRC_GROUPS['네이버'],
    구글: BASE_SRC_GROUPS['구글'],
    '기타·직접': dynamicExtra.length
      ? [...BASE_SRC_GROUPS['기타·직접'], ...dynamicExtra]
      : BASE_SRC_GROUPS['기타·직접'],
  };

  const srcCols = srcGroups[srcPlatform] || [];
  const cntSource = (mo: string, source: string) =>
    quotesRaw.filter((r) => r.date?.startsWith(mo) && r.source === source).length;
  const totPlatformMonth = (mo: string) =>
    srcCols.reduce((a, s) => a + cntSource(mo, s), 0);
  const totRawMonth = (mo: string) =>
    quotesRaw.filter((r) => r.date?.startsWith(mo)).length;

  // 차트 모드 데이터 산출
  const chartData = useMemo(() => {
    if (summaryTab === 'cat') {
      const items = QUOTE_CATS.map((c, ci) => {
        const count =
          timeScope === 'cur'
            ? cntCat(curM, c)
            : sumBy(months, (mo) => cntCat(mo, c));
        return {
          k: c,
          count,
          color: QUOTE_COLORS[ci],
        };
      });
      const total = items.reduce((a, b) => a + b.count, 0);
      const sorted = items
        .filter((it) => it.count > 0)
        .sort((a, b) => b.count - a.count)
        .map((it) => ({
          ...it,
          pct: total > 0 ? (it.count / total) * 100 : 0,
        }));
      return { items: sorted, total, max: Math.max(...sorted.map((s) => s.count), 1) };
    } else {
      // 유입 매체별
      const bySrc: Record<string, number> = {};
      const targetRows =
        timeScope === 'cur'
          ? quotesRaw.filter((r) => r.date?.startsWith(curM) && r.source && r.source !== '미수집')
          : quotesRaw.filter((r) => r.date?.startsWith(yr) && r.source && r.source !== '미수집');

      targetRows.forEach((r) => {
        bySrc[r.source] = (bySrc[r.source] || 0) + 1;
      });

      const total = Object.values(bySrc).reduce((a, b) => a + b, 0);
      const sorted = Object.keys(bySrc)
        .sort((a, b) => bySrc[b] - bySrc[a])
        .map((k) => ({
          k,
          count: bySrc[k],
          color: sourceColorVar(k),
          pct: total > 0 ? (bySrc[k] / total) * 100 : 0,
        }));
      return { items: sorted, total, max: Math.max(...sorted.map((s) => s.count), 1) };
    }
  }, [summaryTab, timeScope, curM, yr, months, quotes, quotesRaw]);

  const curCount =
    summaryTab === 'cat'
      ? totMonth(curM)
      : quotesRaw.filter((r) => r.date?.startsWith(curM) && r.source && r.source !== '미수집').length;

  const ytdCount =
    summaryTab === 'cat'
      ? sumBy(months, totMonth)
      : quotesRaw.filter((r) => r.date?.startsWith(yr) && r.source && r.source !== '미수집').length;

  return (
    <div className="card card-quotes-monthly tw" id="quotes-table" data-card="quotes-monthly">
      <h3>
        <span>월별 견적 접수 현황</span>
        <div className="h3-tools">
          <SegmentedControl<'chart' | 'table'>
            mini
            value={viewMode}
            onChange={setViewMode}
            options={[
              { value: 'chart', label: '그래프' },
              { value: 'table', label: '표' },
            ]}
          />
          <span className="h3-tool-sep" />
          <SegmentedControl<SummaryTab>
            mini
            value={summaryTab}
            onChange={setSummaryTab}
            options={[
              { value: 'cat', label: '카테고리별' },
              { value: 'src', label: '유입 매체별' },
            ]}
          />
        </div>
      </h3>

      {viewMode === 'chart' ? (
        <div className="quote-chart-view">
          <div className="kw-tabs seg-src-platform">
            <button
              type="button"
              className={`btn-scope${timeScope === 'cur' ? ' on' : ''}`}
              id="scope-cur"
              data-btn="cur"
              onClick={() => setTimeScope('cur')}
            >
              <span>당월 실적</span>
              {curCount > 0 && <span className="tab-cnt">{fmt(curCount)}</span>}
            </button>
            <button
              type="button"
              className={`btn-scope${timeScope === 'ytd' ? ' on' : ''}`}
              id="scope-ytd"
              data-btn="ytd"
              onClick={() => setTimeScope('ytd')}
            >
              <span>{yr}년 누적</span>
              {ytdCount > 0 && <span className="tab-cnt">{fmt(ytdCount)}</span>}
            </button>
          </div>

          {summaryTab === 'src' && (
            <p className="leg-note quote-src-note">
              ※ 유입 매체 추적은 2026년 10월 12일부터 시작되어 10월 이전 데이터는 '미수집' 상태입니다.
            </p>
          )}

          {chartData.items.length ? (
            <div className="cpa-list quote-rank-list">
              {chartData.items.map((it, idx) => {
                const widthPct = Math.max(5, Math.round((it.count / chartData.max) * 100));
                return (
                  <div key={it.k} className="cpa-row">
                    <div className="cpa-name has-rank" title={it.k}>
                      <span className="src-bar-rank">{idx + 1}</span>
                      <span>{it.k}</span>
                    </div>
                    <div className="cpa-track">
                      <div
                        className="cpa-bar"
                        style={{
                          width: `${widthPct}%`,
                          background: it.color ? `var(${it.color})` : 'var(--acc)',
                        }}
                      />
                    </div>
                    <div className="cpa-info">
                      <span className="cpa-badge">{fmt(it.count)}건 견적</span>
                      <span className="cpa-val">{it.pct.toFixed(1)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty" style={{ margin: '1.5rem 0' }}>
              선택한 조건의 견적 접수 데이터가 없습니다.
            </div>
          )}
        </div>
      ) : summaryTab === 'cat' ? (
        <div id="tbQuotesSummary">
          <table className="stk" id="tbQuotesCat">
            <colgroup>
              <col className="col-mo-label" />
              {allMonths.map((mo) => (
                <col key={mo} className="col-mo-val" />
              ))}
              <col className="col-mo-total" />
            </colgroup>
            <thead>
              <tr>
                <th>카테고리</th>
                {allMonths.map((mo) => (
                  <th key={mo} className={`n${isFuture(mo) ? ' future' : ''}`}>
                    {mLabel(mo)}
                  </th>
                ))}
                <th className="n">합계</th>
              </tr>
            </thead>
            <tbody>
              {QUOTE_CATS.map((c) => (
                <tr key={c}>
                  <td>{c}</td>
                  {allMonths.map((mo) => (
                    <td key={mo} className={`n${isFuture(mo) ? ' future' : ''}`}>
                      {fmt(cntCat(mo, c))}
                    </td>
                  ))}
                  <td className="n">
                    <b>{fmt(sumBy(months, (mo) => cntCat(mo, c)))}</b>
                  </td>
                </tr>
              ))}
              <tr className="grp">
                <td>합계</td>
                {allMonths.map((mo) => (
                  <td key={mo} className={`n${isFuture(mo) ? ' future' : ''}`}>
                    {fmt(totMonth(mo))}
                  </td>
                ))}
                <td className="n">
                  <b>{fmt(sumBy(months, totMonth))}</b>
                </td>
              </tr>
              <tr>
                <td className="sub-t">전년 동월</td>
                {allMonths.map((mo) => (
                  <td key={mo} className={`n sub-t${isFuture(mo) ? ' future' : ''}`}>
                    {fmt(lastYearQuote(mo))}
                  </td>
                ))}
                <td className="n sub-t">{fmt(sumBy(months, lastYearQuote))}</td>
              </tr>
              <tr>
                <td className="sub-t">전년비</td>
                {allMonths.map((mo) => (
                  <td key={mo} className={`n sub-t${isFuture(mo) ? ' future' : ''}`}>
                    <DeltaSpan a={totMonth(mo)} b={lastYearQuote(mo)} />
                  </td>
                ))}
                <td className="n sub-t">
                  <DeltaSpan a={sumBy(months, totMonth)} b={sumBy(months, lastYearQuote)} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div id="tbQuotesSrc">
          <div className="kw-tabs seg-src-platform">
            {(Object.keys(srcGroups) as SourcePlatform[]).map((p) => {
              const tot = sumBy(months, (mo) =>
                srcGroups[p].reduce((a, s) => a + cntSource(mo, s), 0)
              );
              return (
                <button
                  key={p}
                  type="button"
                  className={`btn-src${srcPlatform === p ? ' on' : ''}`}
                  data-btn={p}
                  onClick={() => setSrcPlatform(p)}
                >
                  <span>{p}</span>
                  {tot > 0 && <span className="tab-cnt">{fmt(tot)}</span>}
                </button>
              );
            })}
          </div>
          <p
            className="leg-note"
            style={{
              margin: '-0.375rem 0 0.75rem',
              fontSize: '0.6875rem',
              color: 'var(--sub)',
            }}
          >
            ※ 유입 매체 추적은 2026년 10월 12일부터 시작되어 10월 이전 데이터는 '미수집' 상태입니다.
          </p>
          <table className="stk" id="tbQuotesSrcMonth">
            <colgroup>
              <col className="col-mo-label" />
              {allMonths.map((mo) => (
                <col key={mo} className="col-mo-val" />
              ))}
              <col className="col-mo-total" />
            </colgroup>
            <thead>
              <tr>
                <th>매체</th>
                {allMonths.map((mo) => (
                  <th key={mo} className={`n${isFuture(mo) ? ' future' : ''}`}>
                    {mLabel(mo)}
                  </th>
                ))}
                <th className="n">합계</th>
              </tr>
            </thead>
            <tbody>
              {srcCols.map((s) => (
                <tr key={s}>
                  <td>{s}</td>
                  {allMonths.map((mo) => (
                    <td key={mo} className={`n${isFuture(mo) ? ' future' : ''}`}>
                      {fmt(cntSource(mo, s))}
                    </td>
                  ))}
                  <td className="n">
                    <b>{fmt(sumBy(months, (mo) => cntSource(mo, s)))}</b>
                  </td>
                </tr>
              ))}
              <tr className="grp">
                <td>{srcPlatform} 소계</td>
                {allMonths.map((mo) => (
                  <td key={mo} className={`n${isFuture(mo) ? ' future' : ''}`}>
                    {fmt(totPlatformMonth(mo))}
                  </td>
                ))}
                <td className="n">
                  <b>{fmt(sumBy(months, totPlatformMonth))}</b>
                </td>
              </tr>
              <tr>
                <td className="sub-t">전체 유입 합계</td>
                {allMonths.map((mo) => (
                  <td key={mo} className={`n sub-t${isFuture(mo) ? ' future' : ''}`}>
                    {fmt(totRawMonth(mo))}
                  </td>
                ))}
                <td className="n sub-t">{fmt(sumBy(months, totRawMonth))}</td>
              </tr>
              <tr>
                <td className="sub-t">전년 동월</td>
                {allMonths.map((mo) => (
                  <td key={mo} className={`n sub-t${isFuture(mo) ? ' future' : ''}`}>
                    {fmt(lastYearQuote(mo))}
                  </td>
                ))}
                <td className="n sub-t">{fmt(sumBy(months, lastYearQuote))}</td>
              </tr>
              <tr>
                <td className="sub-t">전년비</td>
                {allMonths.map((mo) => (
                  <td key={mo} className={`n sub-t${isFuture(mo) ? ' future' : ''}`}>
                    <DeltaSpan a={totRawMonth(mo)} b={lastYearQuote(mo)} />
                  </td>
                ))}
                <td className="n sub-t">
                  <DeltaSpan a={sumBy(months, totRawMonth)} b={sumBy(months, lastYearQuote)} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <TableFootnote
        unit="건"
        basis="산출 근거: 접수 시점 UTM/Referrer 경로 기반 매체 자동 판별 · 5대 표준 카테고리 매핑 기준"
        sources={[
          '견적 접수 원본 시트 · collectQuotes 자동 동기화',
        ]}
        action={{
          text: '원본 시트 열기',
          href: EXTERNAL_LINKS.quotesRawSheet,
        }}
      />
    </div>
  );
};
