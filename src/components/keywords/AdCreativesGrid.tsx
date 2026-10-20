import React, { useState } from 'react';
import type { AdRow } from '../../types/dashboard';
import { displayAdTitle, getCreativeImage, MEDIA_COLOR_VARS } from '../../utils/creativeImage';

interface AdCreativesGridProps {
  ads: AdRow[];
  media: 'all' | 'Google' | 'Naver';
  type: 'SA' | 'DA';
}

/** 수집된 실제 이미지만 보여 주고, 없거나 주소가 깨지면 텍스트 광고 표시로 바꾼다 */
const CreativeThumb: React.FC<{ ad: AdRow; title: string }> = ({ ad, title }) => {
  const src = getCreativeImage(ad);
  const [broken, setBroken] = useState(false);
  const showImg = src && !broken;

  return (
    <div className="img" style={{ background: `var(${MEDIA_COLOR_VARS[ad.media] || '--c-it'})` }}>
      {showImg ? (
        <img src={src} alt={title} referrerPolicy="no-referrer" onError={() => setBroken(true)} />
      ) : (
        <>
          {title}
          <small>
            {broken ? '이미지를 불러오지 못함' : ad.type === 'SA' ? '텍스트 광고 · 이미지 소재 없음' : '이미지 소재 없음'}
          </small>
        </>
      )}
    </div>
  );
};

export const AdCreativesGrid: React.FC<AdCreativesGridProps> = ({ ads, media, type }) => {
  return (
    <div className="card" id="ad-creatives">
      <h3>주요 · 확장 소재</h3>
      {ads.length > 0 ? (
        <div className="creatives" id="creatives">
          {ads.map((c, idx) => {
            const title =
              (c.title && c.title !== 'RSA_AD' && c.title !== 'TEXT_45'
                ? displayAdTitle(c.title)
                : `${c.campaign} · ${c.adgroup}`) || '파워링크 검색광고';
            return (
              <div key={`${c.media}-${c.campaign}-${c.adgroup}-${c.title}-${idx}`} className="cr">
                <CreativeThumb key={getCreativeImage(c)} ad={c} title={title} />
                <div className="meta">
                  <b title={c.title !== title ? `원문: ${c.title}` : undefined}>{title}</b>
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
