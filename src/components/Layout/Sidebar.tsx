import React from 'react';
import type { ViewId } from '../../types/dashboard';

interface SidebarProps {
  currentView: ViewId;
  drawerOpen: boolean;
  onNavigate: (view: ViewId) => void;
  onCloseDrawer: () => void;
}

const NAV_ITEMS: { id: ViewId; label: string; icon: React.ReactNode }[] = [
  {
    id: 'overview',
    label: '종합 요약',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    id: 'ads',
    label: '월별 광고비',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    id: 'cat-efficiency',
    label: '카테고리 효율',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" />
        <path d="m19 9-5 5-4-4-3 3" />
      </svg>
    ),
  },
  {
    id: 'keywords',
    label: '키워드 · 소재',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
    ),
  },
  {
    id: 'quotes',
    label: '견적 상세',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  drawerOpen,
  onNavigate,
  onCloseDrawer,
}) => {
  return (
    <>
      <div className={`scrim${drawerOpen ? ' on' : ''}`} id="scrim" onClick={onCloseDrawer} />
      <aside className={`side${drawerOpen ? ' open' : ''}`} id="side">
        <button className="btn ic sclose" id="sclose" aria-label="메뉴 닫기" onClick={onCloseDrawer}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        <a
          className="brand"
          id="brand"
          href="./"
          title="처음으로"
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
            e.preventDefault();
            onNavigate('overview');
          }}
        >
          <i>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
            </svg>
          </i>
          <span>아이티캣 광고 인사이트</span>
        </a>
        <div className="sm">
          <div className="lbl">대시보드</div>
          <nav className="toc" id="toc">
            {NAV_ITEMS.map((item) => {
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  className={`nv${isActive ? ' on' : ''}`}
                  data-v={item.id}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => onNavigate(item.id)}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
        <div className="sm">
          <div className="lbl">설정 · 연동</div>
          <nav className="toc">
            <button
              className={`nv${currentView === 'data' ? ' on' : ''}`}
              data-v="data"
              aria-current={currentView === 'data' ? 'page' : undefined}
              onClick={() => onNavigate('data')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
              </svg>
              <span>데이터 연결</span>
            </button>
          </nav>
        </div>
        {/* 마케팅팀 · 배포 날짜 기준 릴리즈 (같은 날 여러 번이면 -2, -3 …) */}
        <div className="sfoot">
          마케팅팀 ·{' '}
          <span className="rel" title={__APP_COMMIT__ ? `커밋 ${__APP_COMMIT__}` : undefined}>
            {__APP_RELEASE__}
          </span>
        </div>
      </aside>
    </>
  );
};
