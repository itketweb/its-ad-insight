import React from 'react';
import type { SourceShareItem } from '../../types/dashboard';

import { sourceTone } from '../../utils/format';
import { EmptyState } from '../common/EmptyState';

interface SourceBarChartProps {
  id: string;
  items: SourceShareItem[];
  emptyMessage?: string;
  /** 비교 기간 이름(예: '전월'). 주면 항목의 prevV 와 비교한 점유율 증감(%p)을 보여 준다 */
  compareLabel?: string;
  /** 기준 기간 이름(예: '11월'). 막대 툴팁 제목에 붙는다 */
  curLabel?: string;
}

// 유입 매체 비중: 순위형 가로 막대 (매체가 많아 도넛·누적 막대보다 순위·값이 잘 읽힌다)
export const SourceBarChart: React.FC<SourceBarChartProps> = ({
  id,
  items,
  emptyMessage = '유입경로 수집 데이터가 없습니다.',
  compareLabel,
  curLabel,
}) => {
  if (!items.length) {
    return (
      <div id={id}>
        <EmptyState message={emptyMessage} />
      </div>
    );
  }

  const fmtPct = (v: number) => (Number.isInteger(v) ? `${v}%` : `${v.toFixed(1)}%`);
  // 점유율 증감(%p): 기간 길이와 무관해 진행 중인 달에도 공정하게 비교된다
  const deltaOf = (s: SourceShareItem) =>
    compareLabel && s.prevV != null ? Math.round((s.v - s.prevV) * 10) / 10 : null;

  // 비교 모드는 가장 긴 막대(금월·전월 통틀어)를 칸 폭 전체로 보고 나머지를 비례시킨다 — 점유율 차이가 길이로 드러난다
  const scaleMax = compareLabel ? Math.max(1, ...items.map((s) => Math.max(s.v, s.prevV ?? 0))) : 100;
  // 비교 모드는 막대 오른쪽에 전월 값 글자가 붙으므로 가장 긴 막대도 78%까지만 쓴다
  const full = compareLabel ? 78 : 100;
  const wOf = (v: number) => (v > 0 ? Math.max(1.5, (v / scaleMax) * full) : 0);

  return (
    <div id={id} className={`src-bars-wrap${compareLabel ? ' cmp' : ''}`}>
      {/* 열 머리글: 아래 행과 같은 구조(.src-bar-row)를 써서 칸 폭이 어긋나지 않게 한다 */}
      <div className="src-bar-row src-bar-head" aria-hidden="true">
        <span className="src-bar-rank">#</span>
        <span className="src-pill-sp">매체</span>
        <div className="src-bar-bars">점유율</div>
        <div className="src-bar-val">
          <span className="count">건수</span>
          <span className="pct">점유율</span>
          {compareLabel && <span className="delta">증감</span>}
        </div>
      </div>
      {items.map((s, idx) => {
        const d = deltaOf(s);
        // 막대마다 따로 툴팁: 굵은 막대는 기준 기간, 얇은 막대는 비교 기간 값
        const curTip = `${curLabel ? `${s.k} · ${curLabel}` : s.k}|${
          s.count != null ? `${s.count.toLocaleString('ko-KR')}건 (${fmtPct(s.v)})` : fmtPct(s.v)
        }`;
        const prevTip = `${s.k} · ${compareLabel}|${(s.prevCount ?? 0).toLocaleString('ko-KR')}건 (${fmtPct(s.prevV ?? 0)})`;
        const tone = sourceTone(s.k);
        return (
        <div key={s.k} className={`src-bar-row${compareLabel ? ' has-prev' : ''}`}>
          <span className="src-bar-rank">{idx + 1}</span>
          <span
            className="pill src-pill"
            style={{ '--pill-bg': tone.bg, '--pill-ink': tone.ink } as React.CSSProperties}
          >
            {s.k}
          </span>
          <div className="src-bar-bars">
            <div className="src-bar-track">
              <div
                className="src-bar-fill"
                style={{
                  width: `${wOf(s.v)}%`,
                  background: tone.bar,
                }}
                data-tip={curTip}
              />
            </div>
            {compareLabel && (
              // 비교 기간은 같은 색의 얇고 옅은 막대로 아래에 겹쳐 놓아, 호버 없이도 길이로 비교된다
              <div className="src-bar-prev">
                <div
                  className="src-bar-prev-fill"
                  style={{
                    width: `${wOf(s.prevV ?? 0)}%`,
                    background: tone.bar,
                  }}
                  data-tip={prevTip}
                />
                <span className="src-bar-prev-val">
                  {fmtPct(s.prevV ?? 0)}
                </span>
              </div>
            )}
          </div>
          <div className="src-bar-val">
            {s.count != null && <span className="count">{s.count.toLocaleString('ko-KR')}건</span>}
            <span className="pct">{fmtPct(s.v)}</span>
            {compareLabel && (
              <span className={`delta${d == null || d === 0 ? '' : d > 0 ? ' up' : ' down'}`}>
                {d == null || d === 0 ? '–' : `${d > 0 ? '▲' : '▼'}${Math.abs(d)}%`}
              </span>
            )}
          </div>
        </div>
        );
      })}
    </div>
  );
};
