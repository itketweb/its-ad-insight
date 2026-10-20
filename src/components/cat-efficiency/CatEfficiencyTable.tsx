import React from 'react';
import type { CatEfficiencyItem } from './types';
import { fmt, mLabel } from '../../utils/format';
import { EXTERNAL_LINKS } from '../../utils/constants';
import { TableFootnote } from '../common/TableFootnote';

interface CatEfficiencyTableProps {
  catData: CatEfficiencyItem[];
  curM: string;
  totSpend: number;
  totClk: number;
  totConv: number;
  totQuotes: number;
  avgCpa: number;
}

export const CatEfficiencyTable: React.FC<CatEfficiencyTableProps> = ({
  catData,
  curM,
  totSpend,
  totClk,
  totConv,
  totQuotes,
  avgCpa,
}) => {
  return (
    <div className="card tw" id="cat-table">
      <h3 id="ttCatTable">
        카테고리별 집행 성과 및 전환 효율 상세
        <span className="muted">({mLabel(curM)} 기준)</span>
      </h3>
      <table className="stk" id="tbCatEfficiency">
        <colgroup>
          <col className="col-eff-name" />
          <col className="col-eff-cost" />
          <col className="col-eff-share" />
          <col className="col-eff-clk" />
          <col className="col-eff-conv" />
          <col className="col-eff-quotes" />
          <col className="col-eff-rate" />
          <col className="col-eff-cpa" />
        </colgroup>
        <thead>
          <tr>
            <th>카테고리</th>
            <th className="n">광고비</th>
            <th className="n">비중</th>
            <th className="n">클릭수</th>
            <th className="n">광고전환</th>
            <th className="n">접수견적</th>
            <th className="n">견적전환율</th>
            <th className="n">건당 광고비 (CPA)</th>
          </tr>
        </thead>
        <tbody>
          {catData.map((c) => {
            const convRate = c.clk > 0 ? `${((c.quotes / c.clk) * 100).toFixed(2)}%` : '–';
            return (
              <tr key={c.k}>
                <td>
                  <b>{c.k}</b>
                </td>
                <td className="n">{fmt(c.cost)}원</td>
                <td className="n">{c.share.toFixed(1)}%</td>
                <td className="n">{fmt(c.clk)}</td>
                <td className="n">{fmt(c.conv)}</td>
                <td className="n">
                  <b>{c.quotes ? `${fmt(c.quotes)}건` : '–'}</b>
                </td>
                <td className="n">{convRate}</td>
                <td className="n">
                  <b>{c.cpa != null ? `${fmt(c.cpa)}원` : '–'}</b>
                </td>
              </tr>
            );
          })}
          <tr className="grp">
            <td>합계</td>
            <td className="n">{fmt(totSpend)}원</td>
            <td className="n">100.0%</td>
            <td className="n">{fmt(totClk)}</td>
            <td className="n">{fmt(totConv)}</td>
            <td className="n">
              <b>{fmt(totQuotes)}건</b>
            </td>
            <td className="n">
              {totClk > 0 ? `${((totQuotes / totClk) * 100).toFixed(2)}%` : '–'}
            </td>
            <td className="n">
              <b>{avgCpa ? `${fmt(avgCpa)}원` : '–'}</b>
            </td>
          </tr>
        </tbody>
      </table>
      <TableFootnote
        id="srcCatEfficiency"
        unit="원·건"
        basis="산출 근거: 견적전환율 = (접수견적 ÷ 클릭수) × 100 · CPA = 광고비 ÷ 접수견적"
        sources={[
          <span key="ads">
            광고비·클릭·전환 —{' '}
            <a href={EXTERNAL_LINKS.googleAds} target="_blank" rel="noopener">
              Google Ads
            </a>{' '}
            /{' '}
            <a href={EXTERNAL_LINKS.naverSearchAd} target="_blank" rel="noopener">
              네이버 검색광고
            </a>{' '}
            API 자동 수집
          </span>,
          '접수 견적 — 아이티켓 고도몰 견적 시트 (collectQuotes)',
        ]}
      />
    </div>
  );
};
