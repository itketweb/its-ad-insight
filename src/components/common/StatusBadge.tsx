import React from 'react';
import { badgeSizeClass, type BadgeSize } from './badgeSize';

export type StatusLevel = 'ok' | 'chk' | 'man' | 'warn' | 'error' | 'err' | 'info';

export interface StatusBadgeProps {
  level?: StatusLevel;
  /** 크기 — md(기본) 24px, sm 20px */
  size?: BadgeSize;
  className?: string;
  children: React.ReactNode;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  level = 'ok',
  size,
  className = '',
  children,
}) => {
  const normLevel =
    level === 'error' || level === 'err'
      ? 'chk'
      : level === 'warn' || level === 'info'
        ? 'man'
        : level;

  return (
    <span className={`st ${normLevel} ${badgeSizeClass(size)} ${className}`.replace(/\s+/g, ' ').trim()}>
      {children}
    </span>
  );
};
