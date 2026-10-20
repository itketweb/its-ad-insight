import React from 'react';
import type { SyncStatus } from '../../types/dashboard';

export interface SourceLinkItem {
  label: string;
  href?: string;
}

interface ViewHeaderProps {
  title: string;
  description: string;
  status: SyncStatus;
}

export const ViewHeader: React.FC<ViewHeaderProps> = ({ title, description, status }) => {
  const live = status === 'live';

  return (
    <div className="mod-h">
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {!live && (
        <span className="ex" data-src>데이터 대기 중</span>
      )}
    </div>
  );
};

export const SecSrc: React.FC<{ sources: SourceLinkItem[] }> = ({ sources }) => (
  <p className="sec-src">
    {sources.map((src, idx) =>
      src.href ? (
        <a key={`${src.label}-${idx}`} href={src.href} target="_blank" rel="noopener">
          {src.label}
        </a>
      ) : (
        <span key={`${src.label}-${idx}`}>{src.label}</span>
      )
    )}
  </p>
);
