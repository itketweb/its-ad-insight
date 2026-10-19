import React from 'react';

export type StatusLevel = 'ok' | 'chk' | 'man' | 'warn' | 'error' | 'err' | 'info';

export interface StatusBadgeProps {
  level?: StatusLevel;
  className?: string;
  children: React.ReactNode;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  level = 'ok',
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
    <span className={`st ${normLevel} ${className}`.trim()}>
      {children}
    </span>
  );
};
