import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ViewId } from './types/dashboard';
import { VALID_VIEWS, VIEW_TITLES } from './utils/constants';
import { THIS_M, THIS_Y } from './utils/format';
import { useDashboardData } from './hooks/useDashboardData';
import { Sidebar } from './components/Layout/Sidebar';
import { Header } from './components/Layout/Header';
import { Tooltip } from './components/Layout/Tooltip';
import { PeriodNav } from './components/common/PeriodNav';
import { lastMonthOfYear, TOTAL_PERIOD_VIEWS } from './utils/allPeriod';
import { SkeletonView } from './components/common/SkeletonView';
import { OverviewView } from './views/OverviewView';
import { AdsView } from './views/AdsView';
import { CatEfficiencyView } from './views/CatEfficiencyView';
import { KeywordsView } from './views/KeywordsView';
import { QuotesView } from './views/QuotesView';
import { DataView } from './views/DataView';
import { AdminView } from './views/AdminView';
import { LoginModal } from './components/Layout/LoginModal';
import { useAuth } from './context/AuthContext';

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
  const { data, categoryMap, status, isSyncing, load, updateQuotesRaw, updateQuotesSites } = useDashboardData();
  const [currentView, setCurrentView] = useState<ViewId>(getInitialView);
  const { isLoggedIn, loading: authLoading } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);
  const wasLoggedIn = useRef(false);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [isDark, setIsDark] = useState<boolean>(getInitialDark);

  // 캐시가 없어 보여 줄 데이터가 하나도 없는 첫 동기화 동안만 스켈레톤 (캐시가 있으면 이전 데이터를 그대로 보여 준다)
  const hasData = data.spend.length > 0 || data.quotes.length > 0;
  // 데이터 연결 화면은 연결 설정을 봐야 하므로 스켈레톤 없이 바로 보여 준다
  const isLoading = !hasData && (status === 'init' || isSyncing) && currentView !== 'data' && currentView !== 'admin';

  const allMonths = useMemo(() => {
    return [
      ...new Set([
        ...(data.spend || []).map((r) => r.month),
        ...(data.quotes || []).map((r) => r.month),
      ]),
    ]
      .filter(Boolean)
      .sort();
  }, [data.spend, data.quotes]);

  const maxAvailableMonth = useMemo(() => {
    return (
      allMonths.filter((m) => m <= THIS_M).pop() ||
      allMonths[allMonths.length - 1] ||
      THIS_M
    );
  }, [allMonths]);

  // 기준월 선택에서 데이터가 없는 이른 달(예: 2021년 1~11월)은 고를 수 없게 한다
  const minAvailableMonth = useMemo(
    () => allMonths.find((m) => /^\d{4}-\d{2}$/.test(m)) || maxAvailableMonth,
    [allMonths, maxAvailableMonth]
  );

  const availableYears = useMemo(() => {
    const yrs = [...new Set(allMonths.map((m) => m.slice(0, 4)))].sort((a, b) =>
      b.localeCompare(a)
    );
    if (!yrs.includes(String(THIS_Y))) {
      yrs.unshift(String(THIS_Y));
    }
    return yrs.length > 0 ? yrs : [String(THIS_Y)];
  }, [allMonths]);

  const [selectedYear, setSelectedYear] = useState<string>(String(THIS_Y));
  const [selectedMonth, setSelectedMonth] = useState<string>(THIS_M);
  // 기간 선택의 '전체' — 지원하는 화면에서만 켜지고, 달을 고르면 풀린다. 고른 달은 그대로 남겨 다른 화면에서 쓴다
  const [allPeriodOn, setAllPeriodOn] = useState(false);
  const supportsTotal = TOTAL_PERIOD_VIEWS.includes(currentView);
  const allPeriod = allPeriodOn && supportsTotal;
  // 월 선택의 '전체' — 선택 연도의 1월~최신 달 합계. 화면에는 그 마지막 달을 기준월로 넘긴다
  const [yearTotalOn, setYearTotalOn] = useState(false);
  const yearTotal = yearTotalOn && supportsTotal && !allPeriod;
  const viewMonth = yearTotal ? lastMonthOfYear(selectedMonth, maxAvailableMonth) : selectedMonth;

  useEffect(() => {
    if (maxAvailableMonth) {
      setSelectedYear((prev) => prev || maxAvailableMonth.slice(0, 4));
      setSelectedMonth((prev) => prev || maxAvailableMonth);
    }
  }, [maxAvailableMonth]);

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

  // 설정·연동(데이터 연결·어드민 관리)은 로그인한 관리자만. 로그아웃하면 종합 요약으로, 로그인 없이 주소(#data·#admin)로 들어오면 종합 요약 + 로그인 모달
  useEffect(() => {
    if (authLoading) return;
    if ((currentView === 'data' || currentView === 'admin') && !isLoggedIn) {
      handleNavigate('overview');
      if (!wasLoggedIn.current) setLoginOpen(true);
    }
    wasLoggedIn.current = isLoggedIn;
  }, [authLoading, isLoggedIn, currentView]);

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
            onNavigate={handleNavigate}
            onLogin={() => setLoginOpen(true)}
          />
          {currentView !== 'data' && (
            <PeriodNav
              years={availableYears}
              selectedYear={selectedYear}
              selectedMonth={selectedMonth}
              minAvailableMonth={minAvailableMonth}
              maxAvailableMonth={maxAvailableMonth}
              onSelectYear={setSelectedYear}
              onSelectMonth={(m) => {
                setAllPeriodOn(false);
                setYearTotalOn(false);
                setSelectedMonth(m);
              }}
              allPeriod={allPeriod}
              onSelectAll={
                supportsTotal
                  ? () => {
                      setAllPeriodOn(true);
                      setYearTotalOn(false);
                    }
                  : undefined
              }
              yearTotal={yearTotal}
              onSelectYearTotal={
                supportsTotal
                  ? (m) => {
                      setAllPeriodOn(false);
                      setYearTotalOn(true);
                      setSelectedMonth(m);
                    }
                  : undefined
              }
            />
          )}
          <div className="cont">
            <main id="main">
              {isLoading && (
                <SkeletonView
                  title={VIEW_TITLES[currentView]}
                  variant={currentView === 'keywords' ? 'table' : 'dashboard'}
                />
              )}
              {!isLoading && currentView === 'overview' && (
                <OverviewView
                  data={data}
                  categoryMap={categoryMap}
                  status={status}
                  selectedMonth={viewMonth}
                  allPeriod={allPeriod}
                  yearTotal={yearTotal}
                />
              )}
              {!isLoading && currentView === 'ads' && (
                <AdsView
                  data={data}
                  status={status}
                  selectedMonth={viewMonth}
                  allPeriod={allPeriod}
                  yearTotal={yearTotal}
                />
              )}
              {!isLoading && currentView === 'cat-efficiency' && (
                <CatEfficiencyView
                  data={data}
                  categoryMap={categoryMap}
                  status={status}
                  selectedMonth={viewMonth}
                  allPeriod={allPeriod}
                  yearTotal={yearTotal}
                />
              )}
              {!isLoading && currentView === 'keywords' && (
                <KeywordsView
                  data={data}
                  categoryMap={categoryMap}
                  status={status}
                  isSyncing={isSyncing}
                  selectedMonth={viewMonth}
                  allPeriod={allPeriod}
                  yearTotal={yearTotal}
                />
              )}
              {!isLoading && currentView === 'quotes' && (
                <QuotesView
                  data={data}
                  status={status}
                  isSyncing={isSyncing}
                  selectedMonth={viewMonth}
                  allPeriod={allPeriod}
                  yearTotal={yearTotal}
                />
              )}
              {currentView === 'data' && authLoading && <SkeletonView title={VIEW_TITLES.data} variant="table" />}
              {currentView === 'data' && isLoggedIn && (
                <DataView loading={!hasData && (status === 'init' || isSyncing)} data={data} categoryMap={categoryMap} status={status} />
              )}
              {/* 로그인 세션을 확인하는 동안은 표 자리표시, 로그인한 경우에만 어드민 화면 */}
              {currentView === 'admin' && authLoading && <SkeletonView title={VIEW_TITLES.admin} variant="table" />}
              {currentView === 'admin' && isLoggedIn && (
                <AdminView data={data} isSyncing={isSyncing || status === 'init'} onUpdateQuotesRaw={updateQuotesRaw} onUpdateQuotesSites={updateQuotesSites} onReload={load} />
              )}
            </main>
          </div>
        </div>
      </div>
      <Tooltip />
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
};
