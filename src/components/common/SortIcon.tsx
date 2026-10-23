import React from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';

export interface SortIconProps {
  active: boolean;
  order: 'asc' | 'desc';
}

export const SortIcon: React.FC<SortIconProps> = ({ active, order }) => {
  const Icon = !active ? ChevronsUpDown : order === 'asc' ? ChevronUp : ChevronDown;

  return <Icon className={`th-sort-icon ${active ? 'active' : 'inactive'}`} aria-hidden="true" />;
};
