import React from 'react';
import { fmt, mLabel, sumBy, THIS_M } from '../../utils/format';
import { EXTERNAL_LINKS } from '../../utils/constants';
import { TableFootnote } from '../common/TableFootnote';

interface KeywordCategoryTableProps {
  month?: string;
  categoryKeys: string[];
  costByCat: Record<string, number>;
  clkByCat: Record<string, number>;
  convByCat: Record<string, number>;
  media: 'all' | 'Google' | 'Naver';
  type: 'SA' | 'DA';
}

export const KeywordCategoryTable: React.FC<KeywordCategoryTableProps> = ({
  month = THIS_M,
  categoryKeys,
  costByCat,
  clkByCat,
  convByCat,
  media,
  type,
}) => {
  const curMonth = month || THIS_M;
  const totCost = sumBy(categoryKeys, (k) => costByCat[k] || 0);
  const totClk = sumBy(categoryKeys, (k) => clkByCat[k] || 0);
  const totConv = sumBy(categoryKeys, (k) => convByCat[k] || 0);

  return (
    <div className="card" id="kw-cat">
      <h3 id="ttCatConv">
        카테고리별 전환 · 소진
        <span className="muted">({mLabel(curMonth)} 기준)</span>
      </h3>
      <div className="tw">
        <table className="stk" id="tbCatConv">
          <colgroup>
            <col className="col-cat-name" />
            <col className="col-cat-cost" />
            <col className="col-cat-clk" />
            <col className="col-cat-conv" />
            <col className="col-cat-cpa" />
          </colgroup>
          {categoryKeys.length ? (
            <>
              <thead>
                <tr>
                  <th>카테고리</th>
                  <th className="n">광고비</th>
                  <th className="n">클릭</th>
                  <th className="n">전환</th>
                  <th className="n">전환당 비용</th>
                </tr>
              </thead>
              <tbody>
                {categoryKeys.map((k) => (
                  <tr key={k}>
                    <td>{k}</td>
                    <td className="n">{fmt(costByCat[k])}원</td>
                    <td className="n">{fmt(clkByCat[k])}</td>
                    <td className="n">{fmt(convByCat[k])}</td>
                    <td className="n">
                      {convByCat[k] ? `${fmt(costByCat[k] / convByCat[k])}원` : '–'}
                    </td>
                  </tr>
                ))}
                <tr className="grp">
                  <td>합계</td>
                  <td className="n">
                    <b>{fmt(totCost)}원</b>
                  </td>
                  <td className="n">{fmt(totClk)}</td>
                  <td className="n">{fmt(totConv)}</td>
                  <td className="n">
                    <b>{totConv ? `${fmt(totCost / totConv)}원` : '–'}</b>
                  </td>
                </tr>
              </tbody>
            </>
          ) : (
            <tbody>
              <tr>
                <td colSpan={5}>
                  <div className="empty">
                    {type === 'DA' ? (
                      <>
                        수집된 디스플레이 광고(DA) 데이터가 없습니다.
                        <br />
                        <small className="muted">GFA 무인 스케줄러 동기화 후 자동 집계됩니다.</small>
                      </>
                    ) : media === 'Google' ? (
                      <>
                        수집된 Google 검색광고 데이터가 없습니다.
                        <br />
                        <small className="muted">스크립트 실행 후 데이터가 집계됩니다.</small>
                      </>
                    ) : (
                      '조회 조건에 해당하는 광고 데이터가 없습니다.'
                    )}
                  </div>
                </td>
              </tr>
            </tbody>
          )}
        </table>
        <TableFootnote
          unit="원"
          basis="산출 근거: 전환당 비용 = 광고비 ÷ 광고전환수 · 검색광고(SA) 전환 추적 태그 기준"
          sources={[
            <span key="g">
              Google SA —{' '}
              <a href={EXTERNAL_LINKS.googleAds} target="_blank" rel="noopener">
                Google Ads
              </a>{' '}
              API 자동 수집
            </span>,
            <span key="n">
              Naver SA —{' '}
              <a href={EXTERNAL_LINKS.naverSearchAd} target="_blank" rel="noopener">
                네이버 검색광고
              </a>{' '}
              API 자동 수집
            </span>,
          ]}
        />
      </div>
    </div>
  );
};
