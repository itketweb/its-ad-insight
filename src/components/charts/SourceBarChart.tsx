import React from 'react';
import type { SourceShareItem } from '../../types/dashboard';

import { EmptyState } from '../common/EmptyState';

interface SourceBarChartProps {
  id: string;
  items: SourceShareItem[];
  emptyMessage?: string;
}

// 유입 매체 비중: 순위형 가로 막대 (매체가 많아 도넛·누적 막대보다 순위·값이 잘 읽힌다)
export const SourceBarChart: React.FC<SourceBarChartProps> = ({
  id,
  items,
  emptyMessage = '유입경로 수집 데이터가 없습니다.',
}) => {
  if (!items.length) {
    return (
      <div id={id}>
        <EmptyState message={emptyMessage} />
      </div>
    );
  }

  const fmtPct = (v: number) => (Number.isInteger(v) ? `${v}%` : `${v.toFixed(1)}%`);

  return (
    <div id={id} className="src-bars-wrap">
      {items.map((s, idx) => (
        <div
          key={s.k}
          className="src-bar-row"
          data-tip={
            s.count != null
              ? `${s.k}|${s.count.toLocaleString('ko-KR')}건 (${fmtPct(s.v)})`
              : `${s.k}|${fmtPct(s.v)}`
          }
        >
          <span className="src-bar-rank">{idx + 1}</span>
          <span className="pill" style={{ '--pc': `var(${s.c})` } as React.CSSProperties}>
            {s.k}
          </span>
          <div className="src-bar-track">
            <div
              className="src-bar-fill"
              style={{
                width: `${Math.max(s.v > 0 ? 1.5 : 0, s.v)}%`,
                background: `var(${s.c})`,
              }}
            />
          </div>
          <div className="src-bar-val">
            {s.count != null && <span className="count">{s.count.toLocaleString('ko-KR')}건</span>}
            <span className="pct">{fmtPct(s.v)}</span>
          </div>
        </div>
      ))}
    </div>
  );
};
