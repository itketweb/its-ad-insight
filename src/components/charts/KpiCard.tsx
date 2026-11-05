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
      {detail && <div className="kpi-detail">{detail}</div>}
    </div>
  );
};

export const DeltaSpan: React.FC<{ a?: number | null; b?: number | null }> = ({ a, b }) => {
  const p = pct(a, b);
  if (!p) return <>–</>;
  return <span className={`d ${p.cls}`}>{p.txt}</span>;
};
