import React, { useEffect, useRef } from 'react';

export const Tooltip: React.FC = () => {
  const tipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const tip = tipRef.current;
      if (!tip) return;
      const target = e.target as HTMLElement | null;
      const t = target?.closest?.('[data-tip]') as HTMLElement | null;
      if (!t || !t.dataset.tip) {
        // 차트가 같은 #tip 을 직접 쓰므로, 머리글 설명 모양이 남아 있지 않게 지운다
        tip.classList.remove('desc');
        // Only hide if not hovering inside a chart slice that manages #tip
        if (!target?.closest?.('.chart-slice')) {
          tip.style.opacity = '0';
        }
        return;
      }
      const [h, v] = t.dataset.tip.split('|');
      tip.innerHTML = `<span>${h ?? ''}</span><b>${v ?? ''}</b>`;
      // 표 머리글 설명처럼 문장인 툴팁은 줄바꿈되는 설명 모양으로 보여 준다 (값 툴팁은 큰 숫자 한 줄)
      tip.classList.toggle('desc', t.dataset.tipDesc !== undefined);
      const w = tip.offsetWidth;
      const x = e.clientX + 12 + w > window.innerWidth ? e.clientX - 12 - w : e.clientX + 12;
      tip.style.left = `${x}px`;
      tip.style.top = `${e.clientY + 12}px`;
      tip.style.opacity = '1';
    };

    document.addEventListener('pointermove', handlePointerMove);
    return () => document.removeEventListener('pointermove', handlePointerMove);
  }, []);

  return <div className="tip" id="tip" ref={tipRef} />;
};
