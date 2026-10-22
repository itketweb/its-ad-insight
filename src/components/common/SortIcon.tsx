import React from 'react';

export interface SortIconProps {
  active: boolean;
  order: 'asc' | 'desc';
}

export const SortIcon: React.FC<SortIconProps> = ({ active, order }) => {
  const upActive = active && order === 'asc';
  const downActive = active && order === 'desc';

  return (
    <svg
      className={`th-sort-icon ${active ? 'active' : 'inactive'}`}
      viewBox="0 0 10 12"
      width="10"
      height="10"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path
        d="M2.5 4L5 1.5L7.5 4"
        className={`sort-arrow-up ${upActive ? 'on' : 'off'}`}
      />
      <path
        d="M2.5 8L5 10.5L7.5 8"
        className={`sort-arrow-down ${downActive ? 'on' : 'off'}`}
      />
    </svg>
  );
};
