import React from 'react';

export interface EmptyStateProps {
  message?: React.ReactNode;
  subMessage?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  message = '취합된 데이터가 없습니다.',
  subMessage,
  className = '',
  style,
}) => {
  return (
    <div className={`empty ${className}`.trim()} style={style}>
      {message}
      {subMessage && (
        <>
          <br />
          <small className="muted">{subMessage}</small>
        </>
      )}
    </div>
  );
};
