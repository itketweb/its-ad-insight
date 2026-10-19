import React from 'react';
import type { CategoryBarItem } from '../../types/dashboard';
import { fmt, measureSvgText, niceMax, rem } from '../../utils/format';
import { useElementWidth } from '../../hooks/useElementWidth';

interface CategoryBarChartProps {
  id: string;
  list: CategoryBarItem[];
  emptyMessage?: string;
}

export const CategoryBarChart: React.FC<CategoryBarChartProps> = ({
  id,
  list,
  emptyMessage = '표시할 데이터가 없습니다',
}) => {
  const { ref: boxRef, width: W } = useElementWidth([list.length]);

  if (!list.length) {
    return (
      <div className="ch" id={id} ref={boxRef}>
        <div className="empty">{emptyMessage}</div>
      </div>
    );
  }

  const r = rem();
  const hasQ = list.some((c) => c.q != null);
  const rowH = 3.75 * r;
  const barH1 = 1.0 * r;
  const barH2 = 0.5 * r;
  const barGap = 0.25 * r;
  const barsH = barH1 + barGap + barH2;
  const barsOff = (rowH - barsH) / 2;
  const maxLabelW = Math.max(...list.map((c) => measureSvgText(c.k, r)));
  const L = maxLabelW + r;
  const R = hasQ ? 4.5 * r : 0;
  const H = list.length * rowH;
  const max = niceMax(Math.max(...list.map((c) => Math.max(c.cur, c.prev))));
  const pw = Math.max(10, W - L - R);

  return (
    <div className="ch" id={id} ref={boxRef}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} overflow="visible" role="img">
        {[0.25, 0.5, 0.75, 1].map((p) => {
          const gx = L + pw * p;
          return <line key={p} x1={gx} y1={0} x2={gx} y2={H} stroke="var(--line)" strokeWidth={1} />;
        })}
        {list.map((c, i) => {
          const y = i * rowH;
          const d = c.prev ? Math.round(((c.cur - c.prev) / c.prev) * 1000) / 10 : null;
          const w1 = (pw * c.cur) / max;
          const w2 = (pw * c.prev) / max;
          const y1 = y + barsOff;
          const y2 = y1 + barH1 + barGap;
          return (
            <React.Fragment key={c.k}>
              {i > 0 && <line x1={L} y1={y} x2={W} y2={y} stroke="var(--line)" strokeWidth={1} />}
              <text
                x={L - 0.5 * r}
                y={y + rowH / 2 + 0.3 * r}
                textAnchor="end"
                style={{ fill: 'var(--ink2)', fontWeight: 500, fontSize: '0.875rem' }}
              >
                <title>{c.k}</title>
                {c.k}
              </text>
              <rect
                className="hit"
                x={L}
                y={y1}
                width={Math.max(0, w1)}
                height={barH1}
                fill="var(--bar)"
                data-tip={`${c.k} · 기준월|${fmt(c.cur)}만원`}
              />
              <text
                x={L + w1 + 0.4 * r}
                y={y1 + barH1 * 0.76}
                style={{ fontSize: '0.75rem', fill: 'var(--ink)', fontWeight: 600 }}
              >
                {fmt(c.cur)}만
                {d != null && (
                  <tspan
                    style={{
                      fill: `var(${d >= 0 ? '--up' : '--down'})`,
                      fontSize: '0.625rem',
                      fontWeight: 700,
                    }}
                  >
                    {' '}
                    {d >= 0 ? '▲' : '▼'}
                    {Math.abs(d)}%
                  </tspan>
                )}
              </text>
              <rect
                className="hit"
                x={L}
                y={y2}
                width={Math.max(0, w2)}
                height={barH2}
                fill="var(--bar2)"
                data-tip={`${c.k} · 전월|${fmt(c.prev)}만원`}
              />
              <text
                x={L + w2 + 0.4 * r}
                y={y2 + barH2 * 0.82}
                style={{ fontSize: '0.625rem', fill: 'var(--sub)' }}
              >
                {fmt(c.prev)}만
              </text>
              {hasQ && (
                <text
                  x={W}
                  y={y + rowH / 2 + 0.3 * r}
                  textAnchor="end"
                  style={{ fontSize: '0.75rem', fill: 'var(--ink2)', fontWeight: 600 }}
                >
                  {c.q != null && c.q > 0 ? `${c.q}건` : '–'}
                </text>
              )}
            </React.Fragment>
          );
        })}
      </svg>
    </div>
  );
};
