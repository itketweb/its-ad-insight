import React, { useEffect, useState } from 'react';
import { Lock, TriangleAlert, X, Zap } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { TextInput } from '../common/TextInput';

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * 관리자 로그인 모달 — 지금 보고 있는 화면 위에 띄운다 (Supabase Auth 아이디·비밀번호, 회원가입 없음).
 * 바탕을 누르거나 Esc 로 닫고, 로그인에 성공하면 닫힌다.
 */
export const LoginModal: React.FC<LoginModalProps> = ({ open, onClose }) => {
  const { loginWithPassword, loginAsDevAdmin } = useAuth();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 열 때마다 비밀번호·오류는 비운다 (아이디는 남겨 둔다)
  useEffect(() => {
    if (!open) return;
    setPassword('');
    setError('');
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const res = await loginWithPassword(loginId, password);
    setSubmitting(false);
    if (res.error) {
      setError(res.error);
    } else {
      setPassword('');
      onClose();
    }
  };

  return (
    <div className="login-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card login-modal" role="dialog" aria-modal="true" aria-labelledby="login-modal-title">
        <button type="button" className="login-close" aria-label="닫기" onClick={onClose}>
          <X size={16} aria-hidden="true" />
        </button>
        <div className="gate-icon">
          <Lock size={20} aria-hidden="true" />
        </div>
        <h2 id="login-modal-title">관리자 로그인</h2>
        <p>지정된 관리자 계정으로 접속하면 견적 원본 데이터를 편집·저장할 수 있습니다.</p>

        <form className="gate-form" onSubmit={handleSubmit}>
          <TextInput
            className={`gate-input${error ? ' err' : ''}`}
            name="username"
            autoComplete="username"
            placeholder="아이디"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            autoFocus
          />
          <TextInput
            className={`gate-input${error ? ' err' : ''}`}
            type="password"
            name="password"
            autoComplete="current-password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <div className="gate-error" role="alert">
              <TriangleAlert size={12} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}
          <button type="submit" className="btn acc btn-login" data-btn="login-submit" disabled={submitting}>
            {submitting ? '확인 중...' : '로그인'}
          </button>
        </form>

        {/* 개발 환경 전용 즉시 로그인 */}
        {import.meta.env.DEV && (
          <button
            type="button"
            className="btn btn-dev-login"
            data-btn="dev-login"
            onClick={() => {
              loginAsDevAdmin();
              onClose();
            }}
          >
            <Zap size={12} aria-hidden="true" />
            <span>테스트용 관리자로 바로 시작</span>
          </button>
        )}
      </div>
    </div>
  );
};
