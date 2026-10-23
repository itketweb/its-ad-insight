import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { ViewId } from '../../types/dashboard';
import { Lock, User, Zap } from 'lucide-react';
import { SkelBar } from '../common/SkeletonView';

interface HeaderProfileMenuProps {
  onNavigate?: (view: ViewId) => void;
}

export const HeaderProfileMenu: React.FC<HeaderProfileMenuProps> = ({ onNavigate }) => {
  const { user, isLoggedIn, loading, loginAsDevAdmin, logout } = useAuth();
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

  const avatar = user?.avatarUrl ? <img src={user.avatarUrl} alt="" /> : (user?.name || user?.email || 'A')[0].toUpperCase();

  // 저장된 로그인 세션을 확인하는 동안은 버튼 자리만 잡아 둔다
  if (loading) {
    return (
      <div className="profile-menu" aria-busy="true">
        <SkelBar w="5rem" h="2rem" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="profile-menu">
      {/* 헤더 프로필 트리거 버튼 */}
      <button
        type="button"
        className={`btn ic header-profile-btn${isLoggedIn ? ' on' : ''}`}
        id="btn-profile"
        data-btn="profile"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={isLoggedIn ? '사용자 프로필' : '관리자 로그인'}
        title={isLoggedIn ? `${user?.name || user?.email} (관리자)` : '관리자 로그인'}
      >
        {isLoggedIn ? (
          <>
            <span className="pm-avatar">{avatar}</span>
            <span className="pm-name">{user?.name || '관리자'}</span>
          </>
        ) : (
          <>
            <User size={14} />
            <span>로그인</span>
          </>
        )}
      </button>

      {/* 팝오버 메뉴 */}
      {open && (
        <div role="dialog" className="pm-pop">
          {isLoggedIn ? (
            /* 로그인된 상태 */
            <>
              <div className="pm-user">
                <div className="pm-avatar lg">{avatar}</div>
                <div className="pm-user-info">
                  <div className="pm-user-name">{user?.name || '관리자'}</div>
                  <div className="pm-user-email">{user?.email}</div>
                </div>
              </div>

              <div className="pm-foot">
                <button
                  type="button"
                  className="btn btn-logout"
                  id="btn-logout"
                  data-btn="logout"
                  onClick={() => {
                    setOpen(false);
                    logout();
                  }}
                >
                  로그아웃
                </button>
              </div>
            </>
          ) : (
            /* 미로그인 상태: 로그인 유도 */
            <>
              <div className="pm-intro">
                <h4>관리자 로그인</h4>
                <p>견적 원본 데이터 관리 및 저장을 사용하려면 로그인하세요.</p>
              </div>

              <div className="pm-actions">
                {/* 로그인 화면(어드민 관리)으로 이동 */}
                <button
                  type="button"
                  className="btn acc btn-go-login"
                  id="btn-go-login"
                  data-btn="go-login"
                  onClick={handleGoAdmin}
                >
                  <Lock size={14} aria-hidden="true" />
                  <span>아이디로 로그인</span>
                </button>

                {/* 개발 환경 전용 즉시 로그인 */}
                {import.meta.env.DEV && (
                  <button
                    type="button"
                    className="btn btn-dev-login"
                    id="btn-dev-login"
                    data-btn="dev-login"
                    onClick={() => {
                      setOpen(false);
                      loginAsDevAdmin();
                    }}
                  >
                    <Zap size={12} aria-hidden="true" />
                    <span>테스트용 관리자 계정으로 로그인</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
