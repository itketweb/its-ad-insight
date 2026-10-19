import React from 'react';
import type { DonutItem } from '../../types/dashboard';

interface SourceDonutProps {
  id: string;
  items: DonutItem[];
  emptyMessage?: string;
}

export const SourceDonut: React.FC<SourceDonutProps> = ({
  id,
  items,
  emptyMessage = '유입경로 수집 데이터가 없습니다.',
}) => {
  if (!items.length) {
    return (
      <div id={id}>
        <div className="empty">{emptyMessage}</div>
      </div>
    );
  }

  const r = 44;
  const C = 2 * Math.PI * r;
  let offset = 0;

  const circles = items.map((s) => {
    const dash = (s.v / 100) * C;
    const curOffset = offset;
    offset += dash;
    return (
      <circle
        key={s.k}
        cx={60}
        cy={60}
        r={r}
        fill="none"
        stroke={`var(${s.c})`}
        strokeWidth={14}
        strokeDasharray={`${dash.toFixed(2)} ${(C - dash).toFixed(2)}`}
        strokeDashoffset={(-curOffset).toFixed(2)}
        transform="rotate(-90 60 60)"
      />
    );
  });

  const top = items[0] || { k: '-', v: 0 };
  const fmtPct = (v: number) => (Number.isInteger(v) ? `${v}%` : `${v.toFixed(1)}%`);

  return (
    <div id={id}>
      <div className="donut-wrap">
        <div className="donut-chart">
          <svg viewBox="0 0 120 120" role="img" aria-label="유입 매체 점유율">
            {circles}
            <text x={60} y={55} textAnchor="middle" fontSize="0.6875rem" fill="var(--sub)">
              1위 {top.k}
            </text>
            <text x={60} y={73} textAnchor="middle" fontSize="1.125rem" fontWeight={700} fill="var(--ink)">
              {fmtPct(top.v)}
            </text>
          </svg>
        </div>
        <div className="donut-bars">
          {items.map((s) => (
            <div
              key={s.k}
              className="donut-row"
              data-tip={
                s.count != null
                  ? `${s.k}|${s.count.toLocaleString('ko-KR')}건 (${fmtPct(s.v)})`
                  : undefined
              }
            >
              <span className="pill" style={{ '--pc': `var(${s.c})` } as React.CSSProperties}>
                {s.k}
              </span>
              <div className="donut-track">
                <div
                  className="donut-fill"
                  style={{ width: `${Math.max(s.v > 0 ? 1.5 : 0, s.v)}%`, background: `var(${s.c})` }}
                />
              </div>
              <span className="pct">{fmtPct(s.v)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
