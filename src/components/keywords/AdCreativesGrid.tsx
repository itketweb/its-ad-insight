import React from 'react';
import type { AdRow } from '../../types/dashboard';
import { getCreativeImage, MEDIA_COLOR_VARS } from '../../utils/creativeImage';

interface AdCreativesGridProps {
  ads: AdRow[];
  media: 'all' | 'Google' | 'Naver';
  type: 'SA' | 'DA';
}

export const AdCreativesGrid: React.FC<AdCreativesGridProps> = ({ ads, media, type }) => {
  const usedImgs = new Set<string>();

  return (
    <div className="card" id="ad-creatives">
      <h3>주요 · 확장 소재</h3>
      {ads.length > 0 ? (
        <div className="creatives" id="creatives">
          {ads.map((c, idx) => {
            const imgUrl = getCreativeImage(c, usedImgs);
            const title =
              (c.title && c.title !== 'RSA_AD' && c.title !== 'TEXT_45'
                ? c.title
                : `${c.campaign} · ${c.adgroup}`) || '파워링크 검색광고';
            return (
              <div key={`${c.campaign}-${c.adgroup}-${idx}`} className="cr">
                <div
                  className="img"
                  style={{ background: `var(${MEDIA_COLOR_VARS[c.media] || '--c-it'})` }}
                >
                  {imgUrl ? (
                    <img
                      src={imgUrl}
                      alt={title}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.remove();
                      }}
                    />
                  ) : (
                    <>
                      {title}
                      <small>{c.type === 'SA' ? '텍스트 광고' : '이미지 없음'}</small>
                    </>
                  )}
                </div>
                <div className="meta">
                  <b>{title}</b>
                  {c.media} {c.type} · {c.campaign} › {c.adgroup}
                  <br />
                  {c.url && (
                    <a href={c.url} target="_blank" rel="noopener">
                      {c.url}
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty">
          {media === 'Google' ? (
            <>
              수집된 Google 광고 소재가 없습니다.
              <br />
              <small className="muted">Google Ads 스크립트 실행 후 자동 수집됩니다.</small>
            </>
          ) : type === 'DA' ? (
            <>
              수집된 디스플레이 광고(DA) 배너 소재가 없습니다.
              <br />
              <small className="muted">GFA 무인 스케줄러 동기화 후 자동 표시됩니다.</small>
            </>
          ) : (
            '조회 조건에 해당하는 소재가 없습니다.'
          )}
        </div>
      )}
    </div>
  );
};
