import React from 'react';
import { prevM, ym } from '../../utils/format';
import { Dropdown } from './Dropdown';

interface MonthPickerProps {
  /** 선택된 달 (YYYY-MM) */
  value: string;
  /** 고를 수 있는 가장 이른 달·늦은 달 (YYYY-MM) */
  min: string;
  max: string;
  onChange: (month: string) => void;
}

const Chevron: React.FC<{ points: string }> = ({ points }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.25"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points={points} />
  </svg>
);

/**
 * [‹] [2026년 ⌄ │ 10월 ⌄] [›]  [당월] — 화살표로 한 달씩 옮기고, 가운데 드롭다운으로 연·월을 바로 고르며, 당월 로 최신월에 돌아간다.
 * 연도를 바꾸면 같은 달을 유지하되 범위를 벗어나면 끝 달로 맞춘다.
 */
export const MonthPicker: React.FC<MonthPickerProps> = ({ value, min, max, onChange }) => {
  const year = value.slice(0, 4);
  const month = Number(value.slice(5, 7));
  const minYear = Number(min.slice(0, 4));
  const maxYear = Number(max.slice(0, 4));
  const clamp = (m: string) => (m < min ? min : m > max ? max : m);
  const prev = prevM(value);
  const next = month === 12 ? ym(Number(year) + 1, 1) : ym(year, month + 1);
  const maxLabel = `${max.slice(0, 4)}년 ${Number(max.slice(5, 7))}월`;

  const yearOptions = Array.from({ length: maxYear - minYear + 1 }, (_, i) => {
    const y = String(maxYear - i);
    return { value: y, label: `${y}년` };
  });

  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const key = ym(year, i + 1);
    const out = key < min || key > max;
    return {
      value: i + 1,
      label: `${i + 1}월`,
      disabled: out,
      title: out ? `${year}년 ${i + 1}월 (데이터 없음)` : undefined,
    };
  });

  return (
    <div className="month-picker" role="group" aria-label="기준월">
      <button
        type="button"
        className="mp-step"
        aria-label="이전 달"
        title={prev < min ? '이전 달 데이터 없음' : '이전 달'}
        disabled={prev < min}
        onClick={() => onChange(prev)}
      >
        <Chevron points="15 18 9 12 15 6" />
      </button>
      <div className="mp-box">
        <Dropdown
          className="mp-year"
          ariaLabel="기준 연도"
          value={year}
          options={yearOptions}
          onChange={(y) => onChange(clamp(ym(y, month)))}
        />
        <Dropdown
          className="mp-month"
          ariaLabel="기준 월"
          value={month}
          options={monthOptions}
          onChange={(m) => onChange(ym(year, m))}
        />
      </div>
      <button
        type="button"
        className="mp-step"
        aria-label="다음 달"
        title={next > max ? '다음 달 데이터 없음' : '다음 달'}
        disabled={next > max}
        onClick={() => onChange(next)}
      >
        <Chevron points="9 18 15 12 9 6" />
      </button>
      {/* 당월(데이터가 있는 최신월)로 바로 가기 — 당월에서도 자리를 지켜 폭이 바뀌지 않게 비활성으로만 표시 */}
      <button
        type="button"
        className="mp-today"
        aria-label={`당월(${maxLabel})로 이동`}
        title={value === max ? `당월(${maxLabel}) 조회 중` : `당월(${maxLabel})로 이동`}
        disabled={value === max}
        onClick={() => onChange(max)}
      >
        당월
      </button>
    </div>
  );
};
