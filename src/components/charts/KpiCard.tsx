import React from 'react';
import { fmt, pct } from '../../utils/format';

interface KpiCardProps {
  label: React.ReactNode;
  value: string;
  cur?: number | null;
  prev?: number | null;
  cmpLabel?: string;
  sub?: React.ReactNode;
  /** 카드 하단 보조 줄 (cmpLabel·sub와 별개로 항상 표시) */
  detail?: React.ReactNode;
  /** CPA 등 낮을수록 좋은 지표 — ▼는 초록(up), ▲는 빨강(down)으로 반전 */
  invertDelta?: boolean;
}

/** 카드 하단 보조 줄의 항목 목록 — "이름 값 | 이름 값" */
export const KpiDetailItems: React.FC<{ items: [string, number | string][] }> = ({ items }) => (
  <>
    {items.map(([label, value], i) => (
      <React.Fragment key={label}>
        {i > 0 && <i>|</i>}
        <p>
          {label} <b>{typeof value === 'number' ? fmt(value) : value}</b>
        </p>
      </React.Fragment>
    ))}
  </>
);

export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  cur,
  prev,
  cmpLabel,
  sub,
  detail,
  invertDelta,
}) => {
  const p = cur != null && prev != null ? pct(cur, prev) : null;
  const displayCls = p
    ? invertDelta
      ? (p.cls === 'down' ? 'up' : p.cls === 'up' ? 'down' : 'flat')
      : p.cls
    : null;
  const cls = displayCls && displayCls !== 'flat' ? ` ${displayCls}` : '';

  return (
    <div className={`kpi${cls}`}>
      <div className="l">{label}</div>
      <div className="v">{value}</div>
      {cmpLabel ? (
        p && displayCls ? (
          <div className={`d ${displayCls}`}>
            {p.txt} <small>{cmpLabel}</small>
          </div>
        ) : (
          <div className="d flat">
            – <small>{cmpLabel} 값 없음</small>
          </div>
        )
      ) : sub ? (
        <div className="s">{sub}</div>
      ) : null}
      {detail && <div className="kpi-detail">{detail}</div>}
    </div>
  );
};

/** KPI 카드 묶음 컨테이너 — className="kpis" 를 단일 출처로 관리 */
export const KpiSection: React.FC<{ id?: string; children: React.ReactNode }> = ({ id, children }) => (
  <div className="kpis" id={id}>
    {children}
  </div>
);

export const DeltaSpan: React.FC<{ a?: number | null; b?: number | null }> = ({ a, b }) => {
  const p = pct(a, b);
  if (!p) return <>–</>;
  return <span className={`d ${p.cls}`}>{p.txt}</span>;
};
