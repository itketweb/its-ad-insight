import React from 'react';
import type { SyncStatus, ViewId } from '../../types/dashboard';
import { HeaderProfileMenu } from './HeaderProfileMenu';
import { Menu, Moon, Sun } from 'lucide-react';
import { Button } from '../common/Button';

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
      <Button
        iconOnly
        icon={Menu}
        className="burger"
        id="burger"
        data-btn="burger"
        aria-label="메뉴 열기"
        aria-expanded={drawerOpen}
        aria-controls="side"
        onClick={onOpenDrawer}
      />
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
            <Button variant="link" className="btn-reload" id="btn-reload" data-btn="reload" onClick={onReload}>
              지금 새로고침
            </Button>
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
            <Sun />
          </span>
          <span className="k moon" aria-hidden="true">
            <Moon />
          </span>
          <i />
        </button>
      </div>
    </header>
  );
};
