import React, { useMemo, useState } from 'react';
import { fmt, mLabel } from '../../utils/format';
import { EmptyState } from '../common/EmptyState';
import { Card } from '../common/Card';
import { LIST_LIMIT, ShowMoreButton } from '../common/MoreButton';

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
  // "1차 > 2차" 키를 1차 단위로 합산 후 CPA 재산출
  const [showAll, setShowAll] = useState(false);
  const sortedCats = useMemo(() => {
    const map: Record<string, { totalCost: number; totalQuotes: number }> = {};
    const order: string[] = [];

    validCpaCats.forEach((item) => {
      const sep = item.k.indexOf(' > ');
      const pk = sep >= 0 ? item.k.slice(0, sep) : item.k;
      if (!map[pk]) { map[pk] = { totalCost: 0, totalQuotes: 0 }; order.push(pk); }
      map[pk].totalCost   += item.cpa * item.quotes;
      map[pk].totalQuotes += item.quotes;
    });

    return order
      .map((k) => ({
        k,
        cpa:    map[k].totalQuotes > 0 ? map[k].totalCost / map[k].totalQuotes : 0,
        quotes: map[k].totalQuotes,
      }))
      .filter((c) => c.cpa > 0 && c.quotes > 0)
      .sort((a, b) => a.cpa - b.cpa || b.quotes - a.quotes);
  }, [validCpaCats]);

  const maxCpa = Math.max(...sortedCats.map((c) => c.cpa), 1);

  return (
    <Card name="cat-cpa" id="cat-cpa">
      <h3 id="ttCatCpa">
        카테고리별 견적 획득 단가 (CPA)
        <span className="muted">({mLabel(curM)} 실적 기준)</span>
      </h3>
      <div id="chCatCpa">
        {sortedCats.length ? (
          <div className="cpa-list">
            {sortedCats.slice(0, showAll ? undefined : LIST_LIMIT).map((c) => {
              const widthPct = Math.max(5, Math.round((c.cpa / maxCpa) * 100));
              return (
                <div key={c.k} className="cpa-row">
                  <div className="cpa-name" title={c.k}>
                    {c.k}
                  </div>
                  <div className="cpa-track">
                    <div className="cpa-bar" style={{ width: `${widthPct}%` }} />
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
        <ShowMoreButton total={sortedCats.length} expanded={showAll} onToggle={() => setShowAll((v) => !v)} />
      </div>
    </Card>
  );
};
