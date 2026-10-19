import React from 'react';
import { fmt, mLabel } from '../../utils/format';

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
  const maxCpa = Math.max(...validCpaCats.map((c) => c.cpa), 1);

  return (
    <div className="card" id="cat-cpa">
      <h3 id="ttCatCpa">
        <span>
          카테고리별 견적 획득 단가 (CPA){' '}
          <span className="muted">({mLabel(curM)} 실적 기준)</span>
        </span>
      </h3>
      <div id="chCatCpa">
        {validCpaCats.length ? (
          <div className="cpa-list">
            {validCpaCats.map((c) => (
              <div key={c.k} className="cpa-row">
                <div className="cpa-name" title={c.k}>
                  {c.k}
                </div>
                <div className="cpa-track">
                  <div
                    className="cpa-bar"
                    style={{ width: `${Math.max(5, Math.round((c.cpa / maxCpa) * 100))}%` }}
                  />
                </div>
                <div className="cpa-info">
                  <span className="cpa-val">{fmt(c.cpa)}원</span>
                  <span className="cpa-badge">{c.quotes}건 견적</span>
                </div>
              </div>
            ))}
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
