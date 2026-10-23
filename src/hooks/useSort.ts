import { useCallback, useState } from 'react';

export type SortOrder = 'asc' | 'desc';

/** 표 열 정렬 상태 — 같은 열을 다시 누르면 방향을 뒤집고, 다른 열로 바꾸면 내림차순부터 시작한다 */
export function useSort<K extends string>(initialKey: K, initialOrder: SortOrder = 'desc') {
  const [sortKey, setSortKey] = useState<K>(initialKey);
  const [sortOrder, setSortOrder] = useState<SortOrder>(initialOrder);

  const toggleSort = useCallback(
    (key: K) => {
      if (key === sortKey) {
        setSortOrder((o) => (o === 'desc' ? 'asc' : 'desc'));
      } else {
        setSortKey(key);
        setSortOrder('desc');
      }
    },
    [sortKey]
  );

  return { sortKey, sortOrder, toggleSort };
}
