import React, { useState } from 'react';
import type { QuoteRawRow, QuoteRow } from '../../types/dashboard';
import { fmt, mLabel, QUOTE_CATS, sumBy, ym } from '../../utils/format';
import { EXTERNAL_LINKS } from '../../utils/constants';
import { DeltaSpan } from '../charts/KpiCard';
import { SegmentedControl } from '../common/SegmentedControl';

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
  '기타·직접': ['Meta', '카카오', '유튜브', '블로그·커뮤니티', '직접', '직접·기타', '미수집'],
};

export const MonthlyQuotesTable: React.FC<MonthlyQuotesTableProps> = ({
  quotes,
  quotesRaw,
  yr,
  curM,
  months,
  allMonths,
}) => {
  const [summaryTab, setSummaryTab] = useState<SummaryTab>('src');
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

  return (
    <div className="card tw" id="quotes-table">
      <h3>
        월별 견적 접수 현황
        <SegmentedControl<SummaryTab>
          mini
          value={summaryTab}
          onChange={setSummaryTab}
          options={[
            { value: 'src', label: '유입 매체별' },
            { value: 'cat', label: '카테고리별' },
          ]}
        />
      </h3>

      {summaryTab === 'cat' ? (
        <div id="tbQuotesSummary">
          <table className="stk" id="tbQuotesCat">
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
                  className={srcPlatform === p ? 'on' : ''}
                  onClick={() => setSrcPlatform(p)}
                >
                  {p}
                  {tot > 0 && <span className="tab-cnt">{fmt(tot)}</span>}
                </button>
              );
            })}
          </div>
          <table className="stk" id="tbQuotesSrcMonth">
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

      <p className="tbl-src">
        단위: 건&nbsp;
        <span>견적 접수 원본 시트 · collectQuotes 1시간 자동 동기화</span>
        <a href={EXTERNAL_LINKS.quotesRawSheet} target="_blank" rel="noopener">
          원본 시트 열기
        </a>
      </p>
    </div>
  );
};
