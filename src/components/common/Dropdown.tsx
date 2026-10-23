import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface DropdownOption<T extends string | number> {
  value: T;
  label: React.ReactNode;
  /** 목록에서만 라벨 뒤에 흐리게 붙는 보조 표시 (예: 하위 항목 개수) — 선택된 값 표시에는 나오지 않는다 */
  hint?: React.ReactNode;
  title?: string;
  disabled?: boolean;
}

interface DropdownProps<T extends string | number> {
  options: DropdownOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
  id?: string;
  disabled?: boolean;
}

/** 대시보드 톤에 맞춘 드롭다운 (기본 select 의 OS 목록 대신). 바깥 클릭·Esc 로 닫고 ↑↓·Home·End·Enter 로 고른다 */
export function Dropdown<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
  id,
  disabled,
}: DropdownProps<T>): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selectedIdx = options.findIndex((o) => o.value === value);
  const selected = options[selectedIdx];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    listRef.current?.focus({ preventScroll: true });
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // 키보드로 옮긴 항목이 목록 밖이면 보이게 스크롤
  useEffect(() => {
    if (!open || active < 0) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-idx="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const openList = () => {
    setActive(selectedIdx);
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  };

  const pick = (idx: number) => {
    const opt = options[idx];
    if (!opt || opt.disabled) return;
    close();
    if (opt.value !== value) onChange(opt.value);
  };

  const step = (from: number, dir: 1 | -1) => {
    for (let i = from + dir; i >= 0 && i < options.length; i += dir) {
      if (!options[i].disabled) return i;
    }
    return from;
  };

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') setActive((a) => step(a, 1));
    else if (e.key === 'ArrowUp') setActive((a) => step(a, -1));
    else if (e.key === 'Home') setActive(step(-1, 1));
    else if (e.key === 'End') setActive(step(options.length, -1));
    else if (e.key === 'Enter' || e.key === ' ') pick(active);
    else if (e.key === 'Escape' || e.key === 'Tab') close();
    else return;
    e.preventDefault();
  };

  return (
    <div className={`dd${open ? ' open' : ''}${disabled ? ' disabled' : ''}${className ? ` ${className}` : ''}`} ref={rootRef} id={id}>
      <button
        type="button"
        className="dd-trigger btn-dd-trigger"
        data-btn="dd-trigger"
        ref={triggerRef}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? close() : openList())}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            openList();
          }
        }}
      >
        <span className="dd-value">{selected?.label}</span>
        <ChevronDown className="dd-chev" strokeWidth={2.25} aria-hidden="true" />
      </button>

      {open && (
        <div
          className="dd-menu"
          role="listbox"
          id={listId}
          ref={listRef}
          tabIndex={-1}
          aria-label={ariaLabel}
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          onKeyDown={onListKey}
        >
          {options.map((o, i) => (
            <div
              key={String(o.value)}
              id={`${listId}-${i}`}
              data-idx={i}
              role="option"
              aria-selected={o.value === value}
              aria-disabled={o.disabled || undefined}
              title={o.title}
              className={`dd-opt${o.value === value ? ' on' : ''}${i === active ? ' active' : ''}${o.disabled ? ' disabled' : ''}`}
              onMouseEnter={() => !o.disabled && setActive(i)}
              onClick={() => pick(i)}
            >
              <span>
                {o.label}
                {o.hint != null && <span className="dd-opt-hint">{o.hint}</span>}
              </span>
              {o.value === value && (
                <Check className="dd-check" strokeWidth={2.5} aria-hidden="true" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
