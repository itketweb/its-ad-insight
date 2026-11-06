import React from 'react';
import type { SortOrder } from '../../hooks/useSort';
import { SortIcon } from './SortIcon';
import { ThLabel, thTipProps } from './Th';

interface SortableThProps<K extends string>
  extends Omit<React.ThHTMLAttributes<HTMLTableCellElement>, 'onClick'> {
  /** 이 열의 정렬 키 */
  sortKey: K;
  /** 현재 정렬 중인 키·방향 (useSort 반환값) */
  activeKey: K;
  order: SortOrder;
  onSort: (key: K) => void;
  /** 머리글 설명("제목|설명"). 없으면 머리글 글자로 columnTips 에서 찾는다 */
  tip?: string;
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
  tip,
  children,
  ...rest
}: SortableThProps<K>): React.ReactElement {
  const active = sortKey === activeKey;
  const autoTitle =
    typeof children === 'string'
      ? `${children} 기준 ${active && order === 'desc' ? '오름차순' : '내림차순'} 정렬`
      : undefined;
  const tipProps = thTipProps(children, tip);

  return (
    <th
      {...rest}
      className={`${className ? `${className} ` : ''}sortable${active ? ` sorted ${order}` : ''}`}
      // 설명 툴팁이 있으면 브라우저 기본 툴팁(정렬 안내)은 겹치지 않게 뺀다
      title={tipProps['data-tip'] ? undefined : title ?? autoTitle}
      {...tipProps}
      aria-sort={active ? (order === 'desc' ? 'descending' : 'ascending') : 'none'}
      onClick={() => onSort(sortKey)}
    >
      <span className="th-sort-inner">
        <ThLabel tip={tipProps['data-tip']}>{children}</ThLabel>
        <SortIcon active={active} order={order} />
      </span>
    </th>
  );
}
