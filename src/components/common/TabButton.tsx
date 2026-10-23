import React from 'react';
import { fmt } from '../../utils/format';

export interface TabButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active: boolean;
  label: React.ReactNode;
  /** 0 보다 크면 오른쪽에 건수 배지(tab-cnt)를 붙인다 */
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
    {count != null && count > 0 && <span className="tab-cnt">{fmt(count)}</span>}
    {children}
  </button>
);
