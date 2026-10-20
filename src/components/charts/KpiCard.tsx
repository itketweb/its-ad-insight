import React from 'react';
import { pct } from '../../utils/format';

interface KpiCardProps {
  label: React.ReactNode;
  value: string;
  cur?: number | null;
  prev?: number | null;
  cmpLabel?: string;
  sub?: React.ReactNode;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  cur,
  prev,
  cmpLabel,
  sub,
}) => {
  const p = cur != null && prev != null ? pct(cur, prev) : null;
  const cls = p && p.cls !== 'flat' ? ` ${p.cls}` : '';

  return (
    <div className={`kpi${cls}`}>
      <div className="l">{label}</div>
      <div className="v">{value}</div>
      {cmpLabel ? (
        p ? (
          <div className={`d ${p.cls}`}>
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
    </div>
  );
};

export const DeltaSpan: React.FC<{ a?: number | null; b?: number | null }> = ({ a, b }) => {
  const p = pct(a, b);
  if (!p) return <>–</>;
  return <span className={`d ${p.cls}`}>{p.txt}</span>;
};
