import React from 'react';
import type { SyncStatus, ViewId } from '../../types/dashboard';
import { HeaderProfileMenu } from './HeaderProfileMenu';

interface HeaderProps {
  title: string;
  status: SyncStatus;
  updated: string;
  isSyncing: boolean;
  drawerOpen: boolean;
  isDark: boolean;
  onOpenDrawer: () => void;
  onToggleTheme: () => void;
  onReload: () => void;
  onNavigate?: (view: ViewId) => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  status,
  updated,
  isSyncing,
  drawerOpen,
  isDark,
  onOpenDrawer,
  onToggleTheme,
  onReload,
  onNavigate,
}) => {
  const live = status === 'live';

  return (
    <header className="top">
      <button
        className="btn ic burger"
        id="burger"
        data-btn="burger"
        aria-label="메뉴 열기"
        aria-expanded={drawerOpen}
        aria-controls="side"
        onClick={onOpenDrawer}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <h1>
        <span className="ttx">광고 &amp; 견적 대시보드 </span>
        <span className="crumb" id="crumb">
          {title}
        </span>
      </h1>
      <span className="sp" />
      <span className={`upd${live ? ' live' : ''}`}>
        {live ? (
          <>
            실제 데이터 · {updated || '취합본'} 수집
            {isSyncing && (
              <>
                {' · '}
                <span className="sync-pulse">동기화 중...</span>
              </>
            )}
          </>
        ) : (
          <>
            {status === 'error' ? '연동 지연 (자동 재시도 중)' : '실데이터 자동 연결 중...'}{' '}
            <button className="link-btn btn-reload" id="btn-reload" data-btn="reload" onClick={onReload}>
              지금 새로고침
            </button>
          </>
        )}
      </span>
      <div className="acts">
        {/* 헤더 프로필 & 로그인 유도 버튼 */}
        <HeaderProfileMenu onNavigate={onNavigate} />

        {/* 테마 전환 버튼 */}
        <button
          className="tgl btn-theme"
          id="theme"
          data-btn="theme"
          role="switch"
          aria-checked={isDark}
          aria-label="다크 모드"
          title="테마 전환"
          onClick={onToggleTheme}
        >
          <span className="k sun" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </svg>
          </span>
          <span className="k moon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
            </svg>
          </span>
          <i />
        </button>
      </div>
    </header>
  );
};
