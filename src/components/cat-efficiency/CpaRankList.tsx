import React from 'react';
import { fmt, mLabel } from '../../utils/format';
import { EmptyState } from '../common/EmptyState';

interface CpaItem {
  k: string;
  cpa: number;
  quotes: number;
}

interface CpaRankListProps {
  validCpaCats: CpaItem[];
  curM: string;
}

export const CpaRankList: React.FC<CpaRankListProps> = ({ validCpaCats, curM }) => {
  // 단가 낮은 순(고효율 먼저) 고정
  const sortedCats = [...validCpaCats].sort((a, b) => a.cpa - b.cpa || b.quotes - a.quotes);

  const maxCpa = Math.max(...validCpaCats.map((c) => c.cpa), 1);

  return (
    <div className="card" id="cat-cpa">
      <h3 id="ttCatCpa">
        카테고리별 견적 획득 단가 (CPA)
        <span className="muted">({mLabel(curM)} 실적 기준)</span>
      </h3>
      <div id="chCatCpa">
        {sortedCats.length ? (
          <div className="cpa-list">
            {sortedCats.map((c) => {
              const widthPct = Math.max(5, Math.round((c.cpa / maxCpa) * 100));

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
          <EmptyState message="기준월의 견적 접수 데이터가 없어 CPA를 산출할 수 없습니다." />
        )}
      </div>
    </div>
  );
};
