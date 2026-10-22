import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content?: string;
  children: React.ReactElement<React.HTMLAttributes<HTMLElement>>;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children }) => {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const onEnter = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget;
    if (el.scrollWidth <= el.clientWidth) return;
    const r = el.getBoundingClientRect();
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setPos({ x: r.left, y: r.top }), 200);
  }, []);

  const onLeave = useCallback(() => {
    clearTimeout(timer.current);
    setPos(null);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  if (!content) return children;

  return (
    <>
      {React.cloneElement(children, { onMouseEnter: onEnter, onMouseLeave: onLeave })}
      {pos && createPortal(
        <div className="tt" style={{ left: pos.x, top: pos.y }}>
          {content}
        </div>,
        document.body
      )}
    </>
  );
};
