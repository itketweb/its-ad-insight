import { useEffect, useRef, useState } from 'react';

export function useElementWidth<T extends HTMLElement = HTMLDivElement>(
  deps: readonly unknown[] = [],
  fallbackWidth = 520
): { ref: React.RefObject<T | null>; width: number } {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState<number>(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const updateWidth = () => {
      if (el.clientWidth > 0) setWidth(el.clientWidth);
    };
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ref, width: width || fallbackWidth };
}
