import React, { useState } from 'react';
import { fmt, mLabel } from '../../utils/format';
import { SegmentedControl } from '../common/SegmentedControl';

interface CpaItem {
  k: string;
  cpa: number;
  quotes: number;
}

interface CpaRankListProps {
  validCpaCats: CpaItem[];
  curM: string;
}

type CpaSort = 'cpa' | 'quotes';

export const CpaRankList: React.FC<CpaRankListProps> = ({ validCpaCats, curM }) => {
  const [cpaSort, setCpaSort] = useState<CpaSort>('cpa');

  const sortedCats = [...validCpaCats].sort((a, b) => {
    if (cpaSort === 'quotes') {
      return b.quotes - a.quotes || a.cpa - b.cpa;
    }
    return a.cpa - b.cpa || b.quotes - a.quotes;
  });

  const maxCpa = Math.max(...validCpaCats.map((c) => c.cpa), 1);
  const maxQuotes = Math.max(...validCpaCats.map((c) => c.quotes), 1);

  return (
    <div className="card" id="cat-cpa">
      <h3 id="ttCatCpa">
        <span>
          카테고리별 견적 획득 단가 (CPA){' '}
          <span className="muted">({mLabel(curM)} 실적 기준)</span>
        </span>
        <SegmentedControl<CpaSort>
          mini
          dataChart="cat-cpa"
          options={[
            { value: 'cpa', label: '단가순', title: 'CPA 낮은 순 (고효율)' },
            { value: 'quotes', label: '견적순', title: '견적 건수 많은 순' },
          ]}
          value={cpaSort}
          onChange={setCpaSort}
        />
      </h3>
      <div id="chCatCpa">
        {sortedCats.length ? (
          <div className="cpa-list">
            {sortedCats.map((c) => {
              const widthPct =
                cpaSort === 'quotes'
                  ? Math.max(5, Math.round((c.quotes / maxQuotes) * 100))
                  : Math.max(5, Math.round((c.cpa / maxCpa) * 100));

              return (
                <div key={c.k} className="cpa-row">
                  <div className="cpa-name" title={c.k}>
                    {c.k}
                  </div>
                  <div className="cpa-track">
                    <div
                      className="cpa-bar"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                  <div className="cpa-info">
                    <span className="cpa-val">{fmt(c.cpa)}원</span>
                    <span className="cpa-badge">{c.quotes}건 견적</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty">
            기준월의 견적 접수 데이터가 없어 CPA를 산출할 수 없습니다.
          </div>
        )}
      </div>
    </div>
  );
};
