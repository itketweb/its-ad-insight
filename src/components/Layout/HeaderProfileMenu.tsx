import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { ViewId } from '../../types/dashboard';

interface HeaderProfileMenuProps {
  onNavigate?: (view: ViewId) => void;
}

export const HeaderProfileMenu: React.FC<HeaderProfileMenuProps> = ({ onNavigate }) => {
  const { user, isLoggedIn, loginWithGoogle, loginAsDevAdmin, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 바깥 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    const handleDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const handleGoAdmin = () => {
    setOpen(false);
    if (onNavigate) {
      onNavigate('admin');
    } else {
      window.location.hash = '#admin';
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* 헤더 프로필 트리거 버튼 */}
      <button
        type="button"
        className="btn ic header-profile-btn"
        id="btn-profile"
        data-btn="profile"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={isLoggedIn ? '사용자 프로필' : '관리자 로그인'}
        title={isLoggedIn ? `${user?.name || user?.email} (관리자)` : 'Google 계정 로그인'}
        style={{
          height: '2rem',
          padding: isLoggedIn ? '0 0.5rem' : '0 0.625rem',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.375rem',
          borderRadius: '0',
          border: '1px solid var(--line)',
          background: isLoggedIn ? 'var(--accbg)' : 'var(--card)',
          color: isLoggedIn ? 'var(--accink)' : 'var(--ink)',
          fontSize: '0.75rem',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        {isLoggedIn ? (
          <>
            <span
              style={{
                width: '1.25rem',
                height: '1.25rem',
                borderRadius: '50%',
                background: 'var(--acc)',
                color: '#fff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.6875rem',
                fontWeight: 700,
                overflow: 'hidden',
              }}
            >
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                (user?.name || user?.email || 'A')[0].toUpperCase()
              )}
            </span>
            <span style={{ maxWidth: '6rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.name || '관리자'}
            </span>
          </>
        ) : (
          <>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span>로그인</span>
          </>
        )}
      </button>

      {/* 팝오버 메뉴 */}
      {open && (
        <div
          role="dialog"
          style={{
            position: 'absolute',
            top: 'calc(100% + 0.375rem)',
            right: 0,
            width: '18rem',
            background: 'var(--card)',
            border: '1px solid var(--line2)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
            padding: '1rem',
            zIndex: 100,
          }}
        >
          {isLoggedIn ? (
            /* 로그인된 상태 */
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--line)' }}>
                <div
                  style={{
                    width: '2.25rem',
                    height: '2.25rem',
                    borderRadius: '50%',
                    background: 'var(--accbg)',
                    color: 'var(--accink)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.9375rem',
                    overflow: 'hidden',
                  }}
                >
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    (user?.name || user?.email || 'A')[0].toUpperCase()
                  )}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user?.name || '관리자'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--sub)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user?.email}
                  </div>
                </div>
              </div>

              <div style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <button
                  type="button"
                  className="link-btn"
                  id="btn-go-admin"
                  data-btn="go-admin"
                  onClick={handleGoAdmin}
                  style={{ textAlign: 'left', padding: '0.375rem 0.5rem', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <span>어드민 관리 (견적 원장)</span>
                </button>
              </div>

              <div style={{ paddingTop: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-logout"
                  id="btn-logout"
                  data-btn="logout"
                  onClick={() => {
                    setOpen(false);
                    logout();
                  }}
                  style={{ width: '100%', fontSize: '0.8125rem', padding: '0.4rem', color: 'var(--sub)' }}
                >
                  로그아웃
                </button>
              </div>
            </div>
          ) : (
            /* 미로그인 상태: 로그인 유도 */
            <div>
              <div style={{ marginBottom: '0.875rem' }}>
                <h4 style={{ margin: '0 0 0.25rem', fontSize: '0.9375rem', fontWeight: 600 }}>관리자 로그인</h4>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--sub)', lineHeight: 1.5 }}>
                  견적 원본 데이터 관리 및 저장을 사용하려면 로그인하세요.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {/* 구글 로그인 버튼 */}
                <button
                  type="button"
                  className="btn btn-google"
                  id="btn-google"
                  data-btn="google"
                  onClick={() => {
                    setOpen(false);
                    loginWithGoogle();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    height: '2.375rem',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    background: '#fff',
                    color: '#3c4043',
                    border: '1px solid #dadce0',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    aria-hidden="true"
                    style={{ width: '16px', height: '16px', minWidth: '16px', maxWidth: '16px', flexShrink: 0, display: 'inline-block' }}
                  >
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.27v3.15C3.25 21.37 7.33 24 12 24z" />
                    <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.27C.46 8.2 0 10.04 0 12s.46 3.8 1.27 5.42l4.01-3.15z" />
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.25 2.63 1.27 6.58l4.01 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
                  </svg>
                  <span>Google 계정으로 로그인</span>
                </button>

                {/* 테스트용 즉시 로그인 */}
                <button
                  type="button"
                  className="btn btn-dev-login"
                  id="btn-dev-login"
                  data-btn="dev-login"
                  onClick={() => {
                    setOpen(false);
                    loginAsDevAdmin();
                  }}
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--sub)',
                    background: 'var(--bg)',
                    border: '1px dashed var(--line2)',
                    padding: '0.375rem',
                  }}
                >
                  ⚡ 테스트용 관리자 계정으로 로그인
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
