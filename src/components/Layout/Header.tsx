import React from 'react';
import { HeaderProfileMenu } from './HeaderProfileMenu';
import { Menu, Moon, Search, Sun } from 'lucide-react';
import { Button } from '../common/Button';

interface HeaderProps {
  title: string;
  /** 제목 오른쪽에 함께 보여 줄 값 (예: 검색어) */
  titleDetail?: string;
  /** 제목 오른쪽 값 옆에 둘 버튼 (예: 검색어 즐겨찾기) */
  titleAction?: React.ReactNode;
  drawerOpen: boolean;
  isDark: boolean;
  onOpenDrawer: () => void;
  onToggleTheme: () => void;
  /** 헤더 로그인 버튼 → 로그인 모달 */
  onLogin: () => void;
  /** 헤더 검색 버튼 → 검색창 */
  onSearch: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  titleDetail,
  titleAction,
  drawerOpen,
  isDark,
  onOpenDrawer,
  onToggleTheme,
  onLogin,
  onSearch,
}) => {
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
          {titleDetail && (
            <span className="crumb-detail" title={titleDetail}>
              &quot;{titleDetail}&quot;
            </span>
          )}
          {titleAction}
        </span>
      </h1>
      <span className="sp" />
      <div className="acts">
        <Button
          iconOnly
          icon={Search}
          className="btn-search"
          id="btn-search"
          data-btn="search"
          aria-label="검색"
          title="검색 (Ctrl+K)"
          onClick={onSearch}
        />

        {/* 헤더 프로필 & 로그인 유도 버튼 */}
        <HeaderProfileMenu onLogin={onLogin} />

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
          <i />
          <span className="k sun" aria-hidden="true">
            <Sun />
          </span>
          <span className="k moon" aria-hidden="true">
            <Moon />
          </span>
        </button>
      </div>
    </header>
  );
};
