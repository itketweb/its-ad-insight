import React, { useState, useMemo } from 'react';
import type { QuoteRawRow, QuoteRow } from '../../types/dashboard';
import {
  fmt,
  mLabel,
  cat1Of,
  QUOTE_COLORS,
  quoteCat1Order,
  sourceColorVar,
  sumBy,
  ym,
} from '../../utils/format';
import { EXTERNAL_LINKS } from '../../utils/constants';
import { DeltaSpan } from '../charts/KpiCard';
import { SegmentedControl } from '../common/SegmentedControl';
import { TableFootnote } from '../common/TableFootnote';
import { TabButton } from '../common/TabButton';
import { LIST_LIMIT, ShowMoreButton } from '../common/MoreButton';
import { Card } from '../common/Card';

interface MonthlyQuotesTableProps {
  quotes: QuoteRow[];
  quotesRaw: QuoteRawRow[];
  yr: string;
  curM: string;
  months: string[];
  allMonths: string[];
  /** 기간 선택이 '전체' — months·allMonths 에 연도(YYYY)가 들어오고 yr 은 빈 값이다 */
  allPeriod?: boolean;
  /** 월 선택이 '전체' — 한 달 범위가 없으므로 연도 누적부터 보여 준다 */
  yearTotal?: boolean;
}

type SummaryTab = 'src' | 'cat' | 'rep' | 'type';
type SourcePlatform = '네이버' | '구글' | '기타·직접';

const BASE_SRC_GROUPS: Record<SourcePlatform, string[]> = {
  네이버: ['네이버(광고)', '네이버(검색)', '네이버(블로그)', '네이버(카페)', '네이버(쇼핑)'],
  구글: ['구글(광고)', '구글(검색)', '구글(유튜브)', '구글(디스플레이)'],
  '기타·직접': ['Meta', '카카오', '유튜브', '블로그·커뮤니티', '직접', '기타', '미수집'],
};

const REP_UNASSIGNED = '미지정';
const INQUIRY_WEB = '견적문의';
const INQUIRY_COLORS: Record<string, string> = {
  [INQUIRY_WEB]: '--c-it',
  전화: '--c-g',
  톡플러스: '--c-ka',
  메일: '--c-m',
};
const INQUIRY_NOTE = '※ 전화·톡플러스·메일은 전화문의 시트에 직원이 기록한 건만 집계됩니다. (2024년 7월부터)';
/** 비중 표기 — 건이 있는데 0.0% 로 보이지 않게 0.1% 미만은 소수 둘째 자리까지, 최소 0.01% */
const sharePct = (pct: number): string =>
  pct > 0 && pct < 0.1 ? Math.max(0.01, pct).toFixed(2) : pct.toFixed(1);
const REP_EMPTY_TEXT ='담당자 데이터가 아직 수집되지 않았습니다. 견적 데이터 수집이 다시 실행되면 표시됩니다.';
const SRC_NOTE = "※ 유입 매체 추적은 2026년 10월 12일부터 시작되어 10월 이전 데이터는 '미수집' 상태입니다.";
const CAT_OTHER = '기타';
/** 순위 막대에서 색을 칠하는 상위 카테고리 수 (지금 보는 범위의 순위 기준) — 나머지는 회색 */
const CAT_COLOR_LIMIT = 5;

const monthOf = (r: QuoteRawRow): string => r.date?.slice(0, 7) ?? '';
const repOf = (r: QuoteRawRow): string => r.salesRep || REP_UNASSIGNED;
/** 사이트 접수는 견적문의, 전화문의 시트 건은 시트의 경로 */
const inquiryOf = (r: QuoteRawRow): string => r.inquiryType || INQUIRY_WEB;
const isTrackedSource = (r: QuoteRawRow): boolean => !!r.source && r.source !== '미수집';

/** 행을 키별로 한 번에 센다 (weightOf 를 주면 그 값을 더한다) */
function tally<T>(rows: T[], keyOf: (row: T) => string, weightOf: (row: T) => number = () => 1): Map<string, number> {
  const counts = new Map<string, number>();
  rows.forEach((r) => counts.set(keyOf(r), (counts.get(keyOf(r)) || 0) + weightOf(r)));
  return counts;
}

/** 건수 큰 순 키 목록. lastKey('미지정'·'기타')는 맨 뒤로 보낸다 */
const orderKeys = (counts: Map<string, number>, lastKey?: string): string[] =>
  [...counts.keys()].sort((a, b) => (a === lastKey ? 1 : b === lastKey ? -1 : counts.get(b)! - counts.get(a)!));

/** 막대 목록 데이터 — 건수 순 정렬과 비중·최댓값 계산 */
function rankGroups(counts: Map<string, number>, colorOf: (key: string) => string | undefined, lastKey?: string) {
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const items = orderKeys(counts, lastKey)
    .filter((k) => counts.get(k)! > 0)
    .map((k) => {
      const count = counts.get(k)!;
      return { k, count, color: colorOf(k), pct: total > 0 ? (count / total) * 100 : 0 };
    });
  return { items, total, max: Math.max(...items.map((s) => s.count), 1) };
}

export const MonthlyQuotesTable: React.FC<MonthlyQuotesTableProps> = ({
  quotes,
  quotesRaw,
  yr,
  curM,
  months: monthsProp,
  allMonths,
  allPeriod = false,
  yearTotal = false,
}) => {
  // 부모가 렌더마다 새 배열을 넘기므로 값이 같으면 같은 배열을 쓴다 (아래 집계 메모가 매번 다시 돌지 않게)
  const months = useMemo(() => monthsProp, [monthsProp.join()]);
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  const [timeScope, setTimeScope] = useState<'cur' | 'ytd' | 'all'>('cur');
  const scope = allPeriod ? 'all' : yearTotal && timeScope === 'cur' ? 'ytd' : timeScope;
  const [summaryTab, setSummaryTab] = useState<SummaryTab>('cat');
  const [srcPlatform, setSrcPlatform] = useState<SourcePlatform>('네이버');
  // 카테고리·담당자는 10개까지만 보이고 나머지는 '더보기'로 (막대 목록·표 함께). 탭을 바꾸면 접는다
  const [showAllRows, setShowAllRows] = useState(false);
  const rowLimit = showAllRows ? undefined : LIST_LIMIT;
  const changeSummaryTab = (tab: SummaryTab) => {
    setSummaryTab(tab);
    setShowAllRows(false);
  };

  const isFuture = (mo: string) => mo > curM;
  const colLabel = (mo: string) => (allPeriod ? `${mo}년` : mLabel(mo));

  // 카테고리는 분류표 1차 기준 — "SAN 스토리지 > 화웨이" 같은 2차 견적은 1차 행에 합산한다
  const cntCat = (mo: string, cat1: string) =>
    quotes.filter((r) => r.month.startsWith(mo) && cat1Of(r.category || CAT_OTHER) === cat1).reduce((a, r) => a + r.count, 0);
  // 올해 견적이 있는 1차 카테고리 전부, 건수 큰 순 ('기타'는 맨 뒤)
  const yearCats = useMemo(() => quoteCat1Order(quotes.filter((r) => months.includes(r.month))), [quotes, months]);

  const totMonth = (mo: string) =>
    quotes.filter((r) => r.month.startsWith(mo)).reduce((a, r) => a + r.count, 0);

  const lastYearQuote = (mo: string) => totMonth(ym(+yr - 1, +mo.slice(5)));

  // 담당자별: 원장(quotes_raw)의 영업담당 기준. 값이 없는 건은 '미지정'으로 모은다
  const hasRepData = useMemo(() => quotesRaw.some((r) => r.salesRep), [quotesRaw]);
  const cntRep = (mo: string, rep: string) =>
    quotesRaw.filter((r) => r.date?.startsWith(mo) && repOf(r) === rep).length;
  const cntInquiry = (mo: string, type: string) =>
    quotesRaw.filter((r) => r.date?.startsWith(mo) && inquiryOf(r) === type).length;

  // 표의 행 목록: 올해 견적이 있는 담당자·문의 유형, 건수 큰 순
  const yearRaw = useMemo(() => {
    const set = new Set(months);
    return quotesRaw.filter((r) => set.has(monthOf(r)));
  }, [quotesRaw, months]);
  const yearReps = useMemo(
    () => (hasRepData ? orderKeys(tally(yearRaw, repOf), REP_UNASSIGNED) : []),
    [yearRaw, hasRepData]
  );
  const yearInquiries = useMemo(() => orderKeys(tally(yearRaw, inquiryOf), CAT_OTHER), [yearRaw]);

  // 전체 누적: 데이터가 있는 모든 달과, 올해 없는 항목까지 포함한 목록
  const dataMonths = useMemo(
    () => [...new Set([...quotes.map((r) => r.month), ...quotesRaw.map(monthOf)])].filter(Boolean).sort(),
    [quotes, quotesRaw]
  );
  const allCats = useMemo(() => quoteCat1Order(quotes), [quotes]);
  const allReps = useMemo(
    () => (hasRepData ? orderKeys(tally(quotesRaw, repOf), REP_UNASSIGNED) : []),
    [quotesRaw, hasRepData]
  );
  const allInquiries = useMemo(() => orderKeys(tally(quotesRaw, inquiryOf), CAT_OTHER), [quotesRaw]);

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

  // 차트 모드 데이터 산출: 선택 범위의 행을 한 번만 훑어 항목별로 센다
  const chartData = useMemo(() => {
    const scopeMonths = new Set(scope === 'cur' ? [curM] : scope === 'ytd' ? months : dataMonths);
    const scopeRaw = quotesRaw.filter((r) => scopeMonths.has(monthOf(r)));
    if (summaryTab === 'rep') {
      return rankGroups(
        tally(hasRepData ? scopeRaw : [], repOf),
        (k) => (k === REP_UNASSIGNED ? '--c-etc' : undefined),
        REP_UNASSIGNED
      );
    }
    if (summaryTab === 'type') {
      return rankGroups(tally(scopeRaw, inquiryOf), (k) => INQUIRY_COLORS[k] || '--c-etc', CAT_OTHER);
    }
    if (summaryTab === 'cat') {
      const counts = tally(quotes.filter((r) => scopeMonths.has(r.month)), (r) => cat1Of(r.category || CAT_OTHER), (r) => r.count);
      const colored = orderKeys(counts, CAT_OTHER)
        .filter((c) => c !== CAT_OTHER && counts.get(c)! > 0)
        .slice(0, CAT_COLOR_LIMIT);
      return rankGroups(counts, (c) => QUOTE_COLORS[colored.indexOf(c)] || '--c-rest', CAT_OTHER);
    }
    return rankGroups(tally(scopeRaw.filter(isTrackedSource), (r) => r.source), sourceColorVar);
  }, [summaryTab, scope, curM, months, dataMonths, quotes, quotesRaw, hasRepData]);

  const isRep = summaryTab === 'rep';
  const isInquiry = summaryTab === 'type';
  // 표: 카테고리·담당자·문의 유형은 행 기준만 다르고 구성이 같다
  const groupRows = isRep
    ? allPeriod ? allReps : yearReps
    : isInquiry
      ? allPeriod ? allInquiries : yearInquiries
      : allPeriod ? allCats : yearCats;
  const cntGroup = isRep ? cntRep : isInquiry ? cntInquiry : cntCat;
  const totGroupMonth = isRep || isInquiry ? totRawMonth : totMonth;

  // 범위 탭의 건수: 지금 탭의 달별 합계를 더한다
  const monthTotals = useMemo(
    () => ({
      raw: tally(quotesRaw, monthOf),
      quote: tally(quotes, (r) => r.month, (r) => r.count),
      tracked: tally(quotesRaw.filter(isTrackedSource), monthOf),
    }),
    [quotes, quotesRaw]
  );
  const countIn = (list: string[]): number => {
    if (isRep && !hasRepData) return 0;
    const totals = isRep || isInquiry ? monthTotals.raw : summaryTab === 'cat' ? monthTotals.quote : monthTotals.tracked;
    return sumBy(list, (mo) => totals.get(mo) || 0);
  };
  const groupNoun = isRep ? '담당자' : isInquiry ? '문의 유형' : '카테고리';

  return (
    <Card name="quotes-monthly" tableWrap id="quotes-table">
      <h3>
        <span>{allPeriod ? '연도별' : '월별'} 견적 접수 현황</span>
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
            onChange={changeSummaryTab}
            options={[
              { value: 'cat', label: '카테고리별' },
              { value: 'src', label: '유입 매체별' },
              { value: 'type', label: '문의 유형별' },
              { value: 'rep', label: '담당자별' },
            ]}
          />
        </div>
      </h3>

      {viewMode === 'chart' ? (
        <div className="quote-chart-view">
          <div className="kw-tabs seg-src-platform">
            {!allPeriod && (
              <>
                {!yearTotal && (
                  <TabButton
                    className="btn-scope"
                    id="scope-cur"
                    data-btn="cur"
                    active={scope === 'cur'}
                    label="당월 실적"
                    count={countIn([curM])}
                    onClick={() => setTimeScope('cur')}
                  />
                )}
                <TabButton
                  className="btn-scope"
                  id="scope-ytd"
                  data-btn="ytd"
                  active={scope === 'ytd'}
                  label={`${yr}년 누적`}
                  count={countIn(months)}
                  onClick={() => setTimeScope('ytd')}
                />
              </>
            )}
            <TabButton
              className="btn-scope"
              id="scope-all"
              data-btn="all"
              active={scope === 'all'}
              label="전체 누적"
              count={countIn(dataMonths)}
              title={dataMonths.length ? `${dataMonths[0]} ~ ${dataMonths[dataMonths.length - 1]}` : undefined}
              onClick={() => {
                // 전체 기간 선택 중에는 이 탭만 보인다. 월로 돌아갔을 때 보던 범위를 유지한다
                if (!allPeriod) setTimeScope('all');
              }}
            />
          </div>

          {summaryTab === 'src' && (
            <p className="leg-note quote-src-note">
              {SRC_NOTE}
            </p>
          )}

          {isInquiry && <p className="leg-note quote-src-note">{INQUIRY_NOTE}</p>}

          {chartData.items.length ? (
            <div className="cpa-list quote-rank-list">
              {chartData.items.slice(0, summaryTab === 'src' ? undefined : rowLimit).map((it, idx) => {
                // 건수에 비례. 적은 건수끼리도 길이가 달라 보이도록 최소 길이는 눈에 보일 정도로만 둔다
                const widthPct = it.count > 0 ? Math.max(0.5, (it.count / chartData.max) * 100) : 0;
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
                      <span className="cpa-val">{sharePct(it.pct)}%</span>
                    </div>
                  </div>
                );
              })}
              {summaryTab !== 'src' && (
                <ShowMoreButton noun={groupNoun} total={chartData.items.length} expanded={showAllRows} onToggle={() => setShowAllRows((v) => !v)} />
              )}
            </div>
          ) : (
            <div className="empty" style={{ margin: '1.5rem 0' }}>
              {isRep && !hasRepData ? REP_EMPTY_TEXT : '선택한 조건의 견적 접수 데이터가 없습니다.'}
            </div>
          )}
        </div>
      ) : isRep && !hasRepData ? (
        <div className="empty" style={{ margin: '1.5rem 0' }}>
          {REP_EMPTY_TEXT}
        </div>
      ) : summaryTab !== 'src' ? (
        <div id="tbQuotesSummary">
          {isInquiry && <p className="leg-note quote-src-note">{INQUIRY_NOTE}</p>}
          {/* 연도 열만 있을 때는 월별 표의 min-width(72rem)가 불필요한 가로 스크롤을 만든다 */}
          <table className="stk" id="tbQuotesCat" style={allPeriod ? { minWidth: 'auto' } : undefined}>
            <colgroup>
              <col className="col-mo-label" />
              {allMonths.map((mo) => (
                <col key={mo} className="col-mo-val" />
              ))}
              <col className="col-mo-total" />
            </colgroup>
            <thead>
              <tr>
                <th>{groupNoun}</th>
                {allMonths.map((mo) => (
                  <th key={mo} className={`n${isFuture(mo) ? ' future' : ''}`}>
                    {colLabel(mo)}
                  </th>
                ))}
                <th className="n">합계</th>
              </tr>
            </thead>
            <tbody>
              {groupRows.slice(0, rowLimit).map((c) => (
                <tr key={c}>
                  <td>{c}</td>
                  {allMonths.map((mo) => (
                    <td key={mo} className={`n${isFuture(mo) ? ' future' : ''}`}>
                      {fmt(cntGroup(mo, c))}
                    </td>
                  ))}
                  <td className="n">
                    <b>{fmt(sumBy(allMonths, (mo) => cntGroup(mo, c)))}</b>
                  </td>
                </tr>
              ))}
              <tr className="grp">
                <td>합계</td>
                {allMonths.map((mo) => (
                  <td key={mo} className={`n${isFuture(mo) ? ' future' : ''}`}>
                    {fmt(totGroupMonth(mo))}
                  </td>
                ))}
                <td className="n">
                  <b>{fmt(sumBy(allMonths, totGroupMonth))}</b>
                </td>
              </tr>
              {!allPeriod && (
                <>
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
                        <DeltaSpan a={totGroupMonth(mo)} b={lastYearQuote(mo)} />
                      </td>
                    ))}
                    <td className="n sub-t">
                      <DeltaSpan a={sumBy(months, totGroupMonth)} b={sumBy(months, lastYearQuote)} />
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
          <ShowMoreButton noun={groupNoun} total={groupRows.length} expanded={showAllRows} onToggle={() => setShowAllRows((v) => !v)} />
        </div>
      ) : (
        <div id="tbQuotesSrc">
          <div className="kw-tabs seg-src-platform">
            {(Object.keys(srcGroups) as SourcePlatform[]).map((p) => {
              const tot = sumBy(months, (mo) =>
                srcGroups[p].reduce((a, s) => a + cntSource(mo, s), 0)
              );
              return (
                <TabButton
                  key={p}
                  className="btn-src"
                  data-btn={p}
                  active={srcPlatform === p}
                  label={p}
                  count={tot}
                  onClick={() => setSrcPlatform(p)}
                />
              );
            })}
          </div>
          <p
            className="leg-note"
            style={{
              margin: '-0.5rem 0 0.75rem',
              fontSize: '0.75rem',
              color: 'var(--sub)',
            }}
          >
            {SRC_NOTE}
          </p>
          <table className="stk" id="tbQuotesSrcMonth" style={allPeriod ? { minWidth: 'auto' } : undefined}>
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
                    {colLabel(mo)}
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
              {!allPeriod && (
                <>
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
                </>
              )}
            </tbody>
          </table>
        </div>
      )}

      <TableFootnote
        unit="건"
        basis="산출 근거: 매체 = 접수 시점 UTM/Referrer 자동 판별 · 카테고리 = 분류표 1차 (2차 합산) · 담당자 = 영업담당 (동일인 합산, 최근 직급 표기) · 문의 유형 = 사이트 견적문의 / 전화문의 시트 경로"
        sources={[
          '견적 접수 원본 시트 · collectQuotes 자동 동기화',
        ]}
        action={{
          text: '원본 시트 열기',
          href: EXTERNAL_LINKS.quotesRawSheet,
        }}
      />
    </Card>
  );
};
