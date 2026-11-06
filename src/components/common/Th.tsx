import React from 'react';
import { Info } from 'lucide-react';
import { colTip } from '../../utils/columnTips';

/** 머리글 설명 속성 — 직접 준 tip, 없으면 머리글 글자로 columnTips 에서 찾은 설명 */
export function thTipProps(children: React.ReactNode, tip?: string): { 'data-tip'?: string; 'data-tip-desc'?: string } {
  const resolved = tip ?? (typeof children === 'string' ? colTip(children) : undefined);
  return resolved ? { 'data-tip': resolved, 'data-tip-desc': '' } : {};
}

/** 머리글 글자 — 설명이 있으면 옆에 ⓘ 를 붙여 툴팁이 있음을 알린다 */
export const ThLabel: React.FC<{ tip?: string; children: React.ReactNode }> = ({ tip, children }) =>
  tip ? (
    <span className="th-tip">
      {children}
      <Info className="th-tip-ico" aria-hidden="true" />
    </span>
  ) : (
    <span>{children}</span>
  );

interface ThProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  /** 머리글 설명("제목|설명"). 없으면 머리글 글자로 columnTips 에서 찾는다 */
  tip?: string;
  children: React.ReactNode;
}

/** 정렬 없는 표 머리칸 — 설명이 있으면 마우스를 올릴 때 공용 툴팁을 보여 준다 */
export const Th: React.FC<ThProps> = ({ tip, children, ...rest }) => {
  const tipProps = thTipProps(children, tip);
  return (
    <th {...rest} {...tipProps}>
      {tipProps['data-tip'] ? <ThLabel tip={tipProps['data-tip']}>{children}</ThLabel> : children}
    </th>
  );
};
