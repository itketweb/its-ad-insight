import React from 'react';
import type { SpendRow } from '../../types/dashboard';
import { fmt, mLabel, sumBy } from '../../utils/format';
import { EXTERNAL_LINKS } from '../../utils/constants';
import { DeltaSpan } from '../charts/KpiCard';
import { TableFootnote } from '../common/TableFootnote';

export interface SpendSeriesRow {
  k: string;
  f: (r: SpendRow) => boolean;
  raw?: number[];
  v?: number[];
}

interface SpendDetailTableProps {
  series: SpendSeriesRow[];
  allMonths12: string[];
  months: string[];
  isFuture: (mo: string) => boolean;
  at: (mo: string) => SpendRow[];
  tot: (mo: string) => number;
  mdfCost: (mo: string) => number;
  storeCost: (mo: string) => number;
  lastY: (mo: string) => number;
}

export const SpendDetailTable: React.FC<SpendDetailTableProps> = ({
  series,
  allMonths12,
  months,
  isFuture,
  at,
  tot,
  mdfCost,
  storeCost,
  lastY,
}) => {
  return (
    <div className="card tw" id="spend-monthly">
      <h3>월별 집행 상세 내역</h3>
      <div>
        <table className="stk" id="tbSpendDetail">
          <colgroup>
            <col className="col-mo-label" />
            {allMonths12.map((mo) => (
              <col key={mo} className="col-mo-val" />
            ))}
            <col className="col-mo-total" />
          </colgroup>
          <thead>
            <tr>
              <th>구분</th>
              {allMonths12.map((mo) => (
                <th key={mo} className={`n${isFuture(mo) ? ' future' : ''}`}>
                  {mLabel(mo)}
                </th>
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
                <td className="n">
                  <b>{fmt(sumBy(s.raw || [], (v) => v))}</b>
                </td>
              </tr>
            ))}
            <tr className="grp">
              <td>합계</td>
              {allMonths12.map((mo) => (
                <td key={mo} className={`n${isFuture(mo) ? ' future' : ''}`}>
                  {fmt(tot(mo))}
                </td>
              ))}
              <td className="n">
                <b>{fmt(sumBy(months, tot))}</b>
              </td>
            </tr>
            <tr>
              <td className="sub-t">MDF</td>
              {allMonths12.map((mo) => (
                <td key={mo} className={`n sub-t${isFuture(mo) ? ' future' : ''}`}>
                  {fmt(mdfCost(mo))}
                </td>
              ))}
              <td className="n sub-t">{fmt(sumBy(months, mdfCost))}</td>
            </tr>
            <tr>
              <td className="sub-t">스토어</td>
              {allMonths12.map((mo) => (
                <td key={mo} className={`n sub-t${isFuture(mo) ? ' future' : ''}`}>
                  {fmt(storeCost(mo))}
                </td>
              ))}
              <td className="n sub-t">{fmt(sumBy(months, storeCost))}</td>
            </tr>
            <tr>
              <td className="sub-t">전년 동월</td>
              {allMonths12.map((mo) => (
                <td key={mo} className={`n sub-t${isFuture(mo) ? ' future' : ''}`}>
                  {fmt(lastY(mo))}
                </td>
              ))}
              <td className="n sub-t">{fmt(sumBy(months, lastY))}</td>
            </tr>
            <tr>
              <td className="sub-t">전년비</td>
              {allMonths12.map((mo) => (
                <td key={mo} className={`n sub-t${isFuture(mo) ? ' future' : ''}`}>
                  <DeltaSpan a={tot(mo)} b={lastY(mo)} />
                </td>
              ))}
              <td className="n sub-t">
                <DeltaSpan a={sumBy(months, tot)} b={sumBy(months, lastY)} />
              </td>
            </tr>
          </tbody>
        </table>
        <TableFootnote
          unit="원"
          basis="산출 근거: VAT 포함 실소진액 (진행 월은 수집 시점 누적)"
          // 출처는 수집 방식(API 자동 / 시트)별로 묶어 한 줄로 — 세부 설명은 마우스를 올리면 보인다
          sources={[
            <span key="api">
              API:{' '}
              <a href={EXTERNAL_LINKS.googleAds} target="_blank" rel="noopener" title="Google SA·DA 자동 수집">
                Google Ads
              </a>{' '}
              ·{' '}
              <a href={EXTERNAL_LINKS.naverSearchAd} target="_blank" rel="noopener" title="Naver SA 자동 수집">
                네이버 검색광고
              </a>{' '}
              ·{' '}
              <a href={EXTERNAL_LINKS.naverSmartStore} target="_blank" rel="noopener" title="네이버 커머스 API 자동 수집">
                스마트스토어
              </a>
            </span>,
            <span key="sheet">
              시트: <span title="네이버 DA 리포트 시트">네이버 DA</span> ·{' '}
              <a href={EXTERNAL_LINKS.metaAds} target="_blank" rel="noopener" title="Meta Ads 관리자 수치를 시트에 수동 입력">
                Meta
              </a>{' '}
              · <span title="MDF 업로드 시트 + HPE_MDF 캠페인">MDF</span>
            </span>,
          ]}
        />
      </div>
    </div>
  );
};
