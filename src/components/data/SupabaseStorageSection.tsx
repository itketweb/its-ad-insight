import React, { useState } from 'react';
import type { DashboardData } from '../../types/dashboard';
import { StatusBadge } from '../common/StatusBadge';
import { saveDashboardSnapshot, testSupabaseConnection } from '../../lib/supabase';

interface SupabaseStorageSectionProps {
  data: DashboardData;
}

export const SupabaseStorageSection: React.FC<SupabaseStorageSectionProps> = ({ data }) => {
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [showSql, setShowSql] = useState(false);
  const [copied, setCopied] = useState(false);

  const sqlCode = `-- Supabase SQL Editor 에서 붙여넣고 [Run] 실행:
create table if not exists public.dashboard_snapshots (
  id text primary key,
  updated_at timestamptz default now() not null,
  month text,
  stats jsonb default '{}'::jsonb,
  data jsonb not null
);

alter table public.dashboard_snapshots enable row level security;

create policy "Allow public read dashboard_snapshots"
  on public.dashboard_snapshots for select to anon, authenticated using (true);

create policy "Allow public insert dashboard_snapshots"
  on public.dashboard_snapshots for insert to anon, authenticated with check (true);

create policy "Allow public update dashboard_snapshots"
  on public.dashboard_snapshots for update to anon, authenticated using (true) with check (true);`;

  const handleTest = async () => {
    setTesting(true);
    setMsg(null);
    const res = await testSupabaseConnection();
    setTesting(false);
    setMsg({ text: res.message, ok: res.ok });
  };

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    const res = await saveDashboardSnapshot(data);
    setSaving(false);
    setMsg({ text: res.message, ok: res.ok });
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="card card-supabase-storage" id="card-supabase-storage" data-card="supabase-storage" style={{ marginTop: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>Supabase 클라우드 저장소</span>
          <StatusBadge level="ok">연동됨</StatusBadge>
        </h3>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn"
            style={{ fontSize: '0.8125rem', padding: '0.375rem 0.75rem' }}
            onClick={handleTest}
            disabled={testing || saving}
          >
            {testing ? '연결 확인 중...' : '연결 상태 확인'}
          </button>
          <button
            type="button"
            className="btn acc"
            style={{ fontSize: '0.8125rem', padding: '0.375rem 0.75rem', fontWeight: 600 }}
            onClick={handleSave}
            disabled={saving || testing}
          >
            {saving ? 'Supabase에 저장 중...' : '지금 Supabase에 저장'}
          </button>
        </div>
      </div>

      {msg && (
        <div
          style={{
            padding: '0.625rem 0.875rem',
            marginBottom: '0.875rem',
            fontSize: '0.8125rem',
            borderRadius: '0',
            background: msg.ok ? 'var(--grp-naver-bg, #f2faf5)' : 'var(--warnbg, #fbeccb)',
            color: msg.ok ? 'var(--grp-naver-ink, #166534)' : 'var(--warn, #7a4a00)',
            border: `1px solid ${msg.ok ? 'color-mix(in srgb, var(--ok) 30%, transparent)' : 'color-mix(in srgb, var(--warn) 30%, transparent)'}`,
          }}
        >
          {msg.ok ? '✅ ' : '⚠️ '}
          {msg.text}
        </div>
      )}

      <table className="kv">
        <tbody>
          <tr>
            <th>프로젝트 URL</th>
            <td>
              <code className="url-code">https://airzyqygxtdnlkzjsmec.supabase.co</code>
            </td>
          </tr>
          <tr>
            <th>저장 대상</th>
            <td>
              대시보드 통합 스냅샷 (광고비 {data.spend.length.toLocaleString()}행 · 키워드 {data.keywords.length.toLocaleString()}개 · 소재 {data.ads.length.toLocaleString()}개 · 견적 요약 {data.quotes.length.toLocaleString()}행)
            </td>
          </tr>
          <tr>
            <th>테이블 설정</th>
            <td>
              <span>테이블명: <code>dashboard_snapshots</code> (PostgreSQL JSONB) · </span>
              <button
                type="button"
                className="link-btn"
                style={{ fontSize: '0.8125rem', color: 'var(--acc)', cursor: 'pointer', background: 'none', border: 'none', textDecoration: 'underline' }}
                onClick={() => setShowSql((v) => !v)}
              >
                {showSql ? 'SQL 스키마 닫기' : '테이블 생성 SQL 쿼리 보기'}
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      {showSql && (
        <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--bg)', border: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <small className="muted">Supabase 대시보드 › SQL Editor에 붙여넣고 실행하세요:</small>
            <button
              type="button"
              className="btn"
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
              onClick={handleCopySql}
            >
              {copied ? '복사됨!' : 'SQL 복사'}
            </button>
          </div>
          <pre style={{ margin: 0, fontSize: '0.75rem', fontFamily: 'monospace', overflowX: 'auto', background: 'var(--card)', padding: '0.625rem', border: '1px solid var(--line)' }}>
            {sqlCode}
          </pre>
        </div>
      )}
    </div>
  );
};
