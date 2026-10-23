import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MonthPicker } from './MonthPicker';

const SLOT_ID = 'periodNavSlot';

/**
 * 화면별 조회 조건(카테고리 필터 등)을 기준월 바(#periodNav) 안에 그린다.
 * 선택 상태는 각 화면이 그대로 들고, 그리는 자리만 바로 옮긴다 (바가 먼저 그려진 뒤 자리를 찾는다).
 */
export const PeriodNavSlot: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => setEl(document.getElementById(SLOT_ID)), []);
  return el ? createPortal(children, el) : null;
};

interface PeriodNavProps {
  years: string[];
  selectedYear: string;
  selectedMonth: string;
  /** 데이터가 있는 가장 이른 달 (없으면 가장 이른 연도의 1월) */
  minAvailableMonth?: string;
  maxAvailableMonth: string;
  onSelectYear: (year: string) => void;
  onSelectMonth: (month: string) => void;
}

export const PeriodNav: React.FC<PeriodNavProps> = ({
  years,
  selectedYear,
  selectedMonth,
  minAvailableMonth,
  maxAvailableMonth,
  onSelectYear,
  onSelectMonth,
}) => {
  const minYear = [...years].sort()[0] || maxAvailableMonth.slice(0, 4);

  const selectMonth = (m: string) => {
    const y = m.slice(0, 4);
    if (y !== selectedYear) onSelectYear(y);
    onSelectMonth(m);
  };

  return (
    <div className="period-nav-bar" id="periodNav">
      <div className="period-nav-left">
        {/* [‹] [2026년 ⌄] [10월 ⌄] [›] [›|] — 연·월 글자가 기준월임을 드러내므로 따로 아이콘을 두지 않는다 */}
        <MonthPicker
          value={selectedMonth}
          min={minAvailableMonth || `${minYear}-01`}
          max={maxAvailableMonth}
          onChange={selectMonth}
        />
        <div className="period-nav-filters" id={SLOT_ID} />
      </div>
    </div>
  );
};
