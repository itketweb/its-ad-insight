import React from 'react';
import { fmt } from '../../utils/format';

export interface TabButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active: boolean;
  label: React.ReactNode;
  /** 주면 오른쪽에 건수 배지(tab-cnt)를 붙인다 — 0 건도 0 으로 보여 준다. 건수가 없는 탭은 넘기지 않는다 */
  count?: number;
}

/** 밑줄 탭 바(.kw-tabs) 안의 탭 하나. 아이콘 등 덧붙일 내용은 children 으로 */
export const TabButton: React.FC<TabButtonProps> = ({ active, label, count, className, children, ...rest }) => (
  <button
    type="button"
    {...rest}
    className={`${className ?? ''}${active ? ' on' : ''}`.trim() || undefined}
    aria-pressed={active}
  >
    <span>{label}</span>
    {count != null && <span className="tab-cnt">{fmt(count)}</span>}
    {children}
  </button>
);
