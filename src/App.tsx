import React, { useEffect, useState } from 'react';
import type { ViewId } from './types/dashboard';
import { VALID_VIEWS, VIEW_TITLES } from './utils/constants';
import { useDashboardData } from './hooks/useDashboardData';
import { Sidebar } from './components/Layout/Sidebar';
import { Header } from './components/Layout/Header';
import { Tooltip } from './components/Layout/Tooltip';
import { OverviewView } from './views/OverviewView';
import { AdsView } from './views/AdsView';
import { CatEfficiencyView } from './views/CatEfficiencyView';
import { KeywordsView } from './views/KeywordsView';
import { QuotesView } from './views/QuotesView';
import { DataView } from './views/DataView';

function getInitialView(): ViewId {
  const hash = window.location.hash.slice(1) as ViewId;
  return VALID_VIEWS.includes(hash) ? hash : 'overview';
}

function getInitialDark(): boolean {
  try {
    const t = localStorage.getItem('theme');
    if (t) {
      document.documentElement.dataset.theme = t;
      return t === 'dark';
    }
  } catch {
    // ignore
  }
  const r = document.documentElement;
  return r.dataset.theme
    ? r.dataset.theme === 'dark'
    : window.matchMedia('(prefers-color-scheme:dark)').matches;
}

export const App: React.FC = () => {
  const { data, categoryMap, status, isSyncing, load } = useDashboardData();
  const [currentView, setCurrentView] = useState<ViewId>(getInitialView);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [isDark, setIsDark] = useState<boolean>(getInitialDark);

  const closeDrawer = () => {
    setDrawerOpen(false);
    document.body.classList.remove('lock');
  };

  const handleNavigate = (view: ViewId) => {
    const target = VALID_VIEWS.includes(view) ? view : 'overview';
    setCurrentView(target);
    closeDrawer();
    document.title = `${VIEW_TITLES[target]} · 아이티캣 광고 인사이트`;
    window.history.replaceState(
      null,
      '',
      target === 'overview' ? window.location.pathname + window.location.search : `#${target}`
    );
    window.scrollTo({ top: 0 });
  };

  useEffect(() => {
    document.title = `${VIEW_TITLES[currentView]} · 아이티캣 광고 인사이트`;
  }, [currentView]);

  useEffect(() => {
    const onHashChange = () => {
      const h = window.location.hash.slice(1) as ViewId;
      setCurrentView(VALID_VIEWS.includes(h) ? h : 'overview');
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer();
    };
    const onResize = () => {
      if (window.innerWidth > 768) closeDrawer();
    };
    const mq = window.matchMedia('(prefers-color-scheme:dark)');
    const onSystemThemeChange = () => {
      if (!document.documentElement.dataset.theme) {
        setIsDark(mq.matches);
      }
    };

    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);
    mq.addEventListener('change', onSystemThemeChange);

    return () => {
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
      mq.removeEventListener('change', onSystemThemeChange);
    };
  }, []);

  const handleToggleTheme = () => {
    const nextDark = !isDark;
    const nextTheme = nextDark ? 'dark' : 'light';
    document.documentElement.dataset.theme = nextTheme;
    try {
      localStorage.setItem('theme', nextTheme);
    } catch {
      // ignore
    }
    setIsDark(nextDark);
  };

  const handleOpenDrawer = () => {
    setDrawerOpen(true);
    document.body.classList.add('lock');
  };

  return (
    <>
      <div className="app">
        <Sidebar
          currentView={currentView}
          drawerOpen={drawerOpen}
          onNavigate={handleNavigate}
          onCloseDrawer={closeDrawer}
        />
        <div className="wrap">
          <Header
            title={VIEW_TITLES[currentView]}
            status={status}
            updated={data.updated}
            isSyncing={isSyncing}
            drawerOpen={drawerOpen}
            isDark={isDark}
            onOpenDrawer={handleOpenDrawer}
            onToggleTheme={handleToggleTheme}
            onReload={load}
          />
          <div className="cont">
            <main id="main">
              {currentView === 'overview' && (
                <OverviewView data={data} categoryMap={categoryMap} status={status} />
              )}
              {currentView === 'ads' && <AdsView data={data} status={status} />}
              {currentView === 'cat-efficiency' && (
                <CatEfficiencyView data={data} categoryMap={categoryMap} status={status} />
              )}
              {currentView === 'keywords' && (
                <KeywordsView data={data} categoryMap={categoryMap} status={status} />
              )}
              {currentView === 'quotes' && <QuotesView data={data} status={status} />}
              {currentView === 'data' && (
                <DataView data={data} categoryMap={categoryMap} status={status} />
              )}
            </main>
          </div>
        </div>
      </div>
      <Tooltip />
    </>
  );
};
