import React from 'react';
import type { ViewId } from '../../types/dashboard';
import { useAuth } from '../../context/AuthContext';
import { ChartColumnIncreasing, ChartLine, Database, DollarSign, FileText, LayoutGrid, Lock, Search, X } from 'lucide-react';
import { Button } from '../common/Button';

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
      <LayoutGrid />
    ),
  },
  {
    id: 'ads',
    label: '월별 광고비',
    icon: (
      <DollarSign />
    ),
  },
  {
    id: 'cat-efficiency',
    label: '카테고리 효율',
    icon: (
      <ChartLine />
    ),
  },
  {
    id: 'keywords',
    label: '키워드 · 소재',
    icon: (
      <Search />
    ),
  },
  {
    id: 'quotes',
    label: '견적 상세',
    icon: (
      <FileText />
    ),
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  drawerOpen,
  onNavigate,
  onCloseDrawer,
}) => {
  const { isLoggedIn } = useAuth();
  return (
    <>
      <div className={`scrim${drawerOpen ? ' on' : ''}`} id="scrim" onClick={onCloseDrawer} />
      <aside className={`side${drawerOpen ? ' open' : ''}`} id="side">
        <Button iconOnly icon={X} className="sclose" id="sclose" data-btn="close" aria-label="메뉴 닫기" onClick={onCloseDrawer} />
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
            <ChartColumnIncreasing />
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
                  className={`nv nv-${item.id}${isActive ? ' on' : ''}`}
                  id={`nav-${item.id}`}
                  data-v={item.id}
                  data-btn={item.id}
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
              className={`nv nv-data${currentView === 'data' ? ' on' : ''}`}
              id="nav-data"
              data-v="data"
              data-btn="data"
              aria-current={currentView === 'data' ? 'page' : undefined}
              onClick={() => onNavigate('data')}
            >
              <Database />
              <span>데이터 연결</span>
            </button>
            {isLoggedIn && (
            <button
              className={`nv nv-admin${currentView === 'admin' ? ' on' : ''}`}
              id="nav-admin"
              data-v="admin"
              data-btn="admin"
              aria-current={currentView === 'admin' ? 'page' : undefined}
              onClick={() => onNavigate('admin')}
            >
              <Lock />
              <span>어드민 관리</span>
            </button>
          )}
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
