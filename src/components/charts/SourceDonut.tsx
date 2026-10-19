import React from 'react';
import type { DonutItem } from '../../types/dashboard';

export type SourceChartType = 'donut' | 'bar' | 'stacked';

export const SOURCE_CHART_OPTIONS: { value: SourceChartType; label: string; title: string }[] = [
  { value: 'donut', label: '도넛', title: '도넛형 점유율' },
  { value: 'bar', label: '막대', title: '순위형 가로 막대' },
  { value: 'stacked', label: '누적', title: '100% 누적 비중' },
];

interface SourceDonutProps {
  id: string;
  items: DonutItem[];
  emptyMessage?: string;
  chartType?: SourceChartType;
}

export const SourceDonut: React.FC<SourceDonutProps> = ({
  id,
  items,
  emptyMessage = '유입경로 수집 데이터가 없습니다.',
  chartType = 'donut',
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

  const renderDonut = () => (
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
                : `${s.k}|${fmtPct(s.v)}`
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
  );

  const renderBar = () => (
    <div className="src-bars-wrap">
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

  const renderStacked = () => (
    <div className="src-stacked-wrap">
      <div className="src-stacked-bar" role="img" aria-label="100% 매체별 누적 점유율">
        {items.map((s) => (
          <div
            key={s.k}
            className="src-stacked-seg"
            style={{
              width: `${s.v}%`,
              background: `var(${s.c})`,
            }}
            data-tip={
              s.count != null
                ? `${s.k}|${s.count.toLocaleString('ko-KR')}건 (${fmtPct(s.v)})`
                : `${s.k}|${fmtPct(s.v)}`
            }
          >
            {s.v >= 10 && (
              <span className="seg-label">
                {s.k} {fmtPct(s.v)}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="src-stacked-legend">
        {items.map((s) => (
          <div
            key={s.k}
            className="src-stacked-item"
            data-tip={
              s.count != null
                ? `${s.k}|${s.count.toLocaleString('ko-KR')}건 (${fmtPct(s.v)})`
                : undefined
            }
          >
            <i style={{ background: `var(${s.c})` }} />
            <span className="name">{s.k}</span>
            <span className="val">
              {s.count != null && <small>{s.count.toLocaleString('ko-KR')}건</small>}
              <b>{fmtPct(s.v)}</b>
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div id={id}>
      {chartType === 'bar'
        ? renderBar()
        : chartType === 'stacked'
        ? renderStacked()
        : renderDonut()}
    </div>
  );
};
