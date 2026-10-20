import React from 'react';
import { MonthPicker } from './MonthPicker';

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
  const isCurrentMonth = selectedMonth === maxAvailableMonth;
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
      </div>

      {/* 연·월은 선택칸에 이미 보이므로 배지는 상태만 짧게 */}
      <div className="period-nav-right">
        {isCurrentMonth ? (
          <span className="period-status-badge current">
            <span className="status-dot live" />
            실시간
          </span>
        ) : (
          <span className="period-status-badge past">과거 실적</span>
        )}
      </div>
    </div>
  );
};
