import React from 'react';
import type { SortOrder } from '../../hooks/useSort';
import { SortIcon } from './SortIcon';

interface SortableThProps<K extends string>
  extends Omit<React.ThHTMLAttributes<HTMLTableCellElement>, 'onClick'> {
  /** 이 열의 정렬 키 */
  sortKey: K;
  /** 현재 정렬 중인 키·방향 (useSort 반환값) */
  activeKey: K;
  order: SortOrder;
  onSort: (key: K) => void;
  children: React.ReactNode;
}

/** 눌러서 정렬하는 표 머리칸. 정렬 중이면 sorted 클래스와 aria-sort 를 붙인다 */
export function SortableTh<K extends string>({
  sortKey,
  activeKey,
  order,
  onSort,
  className,
  title,
  children,
  ...rest
}: SortableThProps<K>): React.ReactElement {
  const active = sortKey === activeKey;
  const autoTitle =
    typeof children === 'string'
      ? `${children} 기준 ${active && order === 'desc' ? '오름차순' : '내림차순'} 정렬`
      : undefined;

  return (
    <th
      {...rest}
      className={`${className ? `${className} ` : ''}sortable${active ? ` sorted ${order}` : ''}`}
      title={title ?? autoTitle}
      aria-sort={active ? (order === 'desc' ? 'descending' : 'ascending') : 'none'}
      onClick={() => onSort(sortKey)}
    >
      <span className="th-sort-inner">
        <span>{children}</span>
        <SortIcon active={active} order={order} />
      </span>
    </th>
  );
}
