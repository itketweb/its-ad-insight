import React, { useState } from 'react';
import type { AdRow, CategoryMap, DashboardData, KeywordRow, SyncStatus } from '../types/dashboard';
import { catSum, fmt, THIS_M } from '../utils/format';

interface KeywordsViewProps {
  data: DashboardData;
  categoryMap: CategoryMap;
  status: SyncStatus;
}

const IMAGE_MAP = {
  cad: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=600&auto=format&fit=crop&q=80',
  ai: 'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=600&auto=format&fit=crop&q=80',
  ups: 'https://images.unsplash.com/photo-1563770660941-20978e870e26?w=600&auto=format&fit=crop&q=80',
  ha: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=80',
  lease: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&auto=format&fit=crop&q=80',
  monitor: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=600&auto=format&fit=crop&q=80',
  mobileWs: 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=600&auto=format&fit=crop&q=80',
  desktopWs: 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=600&auto=format&fit=crop&q=80',
  laptop: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&auto=format&fit=crop&q=80',
  desktop: 'https://images.unsplash.com/photo-1587831990711-23ca6441447b?w=600&auto=format&fit=crop&q=80',
  server: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&auto=format&fit=crop&q=80',
  storage: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=600&auto=format&fit=crop&q=80',
};

const BACKUP_POOL = [
  'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1547082299-de196ea013d6?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=600&auto=format&fit=crop&q=80',
];

function getCreativeImage(c: AdRow, usedImgs: Set<string>): string {
  if (c.image && c.image.trim()) {
    if (!usedImgs.has(c.image)) {
      usedImgs.add(c.image);
      return c.image;
    }
  }
  const text = `${c.campaign || ''} ${c.adgroup || ''} ${c.title || ''}`.toLowerCase();
  let img = '';
  if (/gstarcad|cad|캐드|도면/i.test(text)) img = IMAGE_MAP.cad;
  else if (/data\s*science|데이터사이언스|gpu|딥러닝|머신러닝|인공지능|ai/i.test(text)) img = IMAGE_MAP.ai;
  else if (/ups|apc|무정전|전원/i.test(text)) img = IMAGE_MAP.ups;
  else if (/이중화|솔루션|solution|roseha|ha/i.test(text)) img = IMAGE_MAP.ha;
  else if (/리스|렌탈|lease|rental/i.test(text)) img = IMAGE_MAP.lease;
  else if (/모니터|monitor|display/i.test(text)) img = IMAGE_MAP.monitor;
  else if (/모바일\s*워크스테이션|mobile\s*workstation|zbook/i.test(text)) img = IMAGE_MAP.mobileWs;
  else if (/워크스테이션|workstation|z1|z2|z4|z6|z8/i.test(text)) img = IMAGE_MAP.desktopWs;
  else if (/노트북|laptop/i.test(text)) img = IMAGE_MAP.laptop;
  else if (/데스크탑|desktop|엘리트데스크|프로데스크|\bpc\b/i.test(text)) img = IMAGE_MAP.desktop;
  else if (/서버|server|proliant|poweredge|랙|rack|\bdl\d|\bml\d/i.test(text)) img = IMAGE_MAP.server;
  else if (/스토리지|storage|\bnas\b|\bsan\b|\bdas\b|시놀로지|synology|netapp|백업/i.test(text))
    img = IMAGE_MAP.storage;
  else img = IMAGE_MAP.server;

  if (usedImgs.has(img)) {
    for (const b of BACKUP_POOL) {
      if (!usedImgs.has(b)) {
        img = b;
        break;
      }
    }
  }
  usedImgs.add(img);
  return img;
}

export const KeywordsView: React.FC<KeywordsViewProps> = ({ data, categoryMap, status }) => {
  const live = status === 'live';
  const [media, setMedia] = useState<'all' | 'Google' | 'Naver'>('all');
  const [type, setType] = useState<'SA' | 'DA'>('SA');
  const [kwTabIdx, setKwTabIdx] = useState<number>(0);

  const pass = (r: { media: string; type: string }) =>
    (media === 'all' || r.media === media) && r.type === type;

  const renderPill = (m: string) => (
    <span className={`pill ${m === 'Google' ? 'g' : m === 'Naver' ? 'n' : 'm'}`}>{m}</span>
  );

  const ms = [...new Set(data.spend.map((r) => r.month))].sort();
  const mo = ms.filter((m) => m <= THIS_M).pop() || ms[ms.length - 1] || THIS_M;
  const rows = data.spend.filter((r) => r.month === mo && pass(r));
  const cost = catSum(categoryMap, rows, (r) => r.cost);
  const clk = catSum(categoryMap, rows, (r) => r.clk);
  const conv = catSum(categoryMap, rows, (r) => r.conv);
  const ck = Object.keys(cost).sort((a, b) => cost[b] - cost[a]);

  // 키워드 그룹 집계 (SA)
  const ks = data.keywords.filter(pass);
  const groups: Record<
    string,
    { media: string; campaign: string; adgroup: string; cost: number; list: KeywordRow[] }
  > = {};
  ks.forEach((k) => {
    const g = [k.media, k.campaign, k.adgroup].join('\u0001');
    if (!groups[g]) {
      groups[g] = {
        media: k.media,
        campaign: k.campaign,
        adgroup: k.adgroup,
        cost: 0,
        list: [],
      };
    }
    groups[g].list.push(k);
    groups[g].cost += k.cost;
  });
  const gs = Object.values(groups)
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 10);

  const safeKwIdx = kwTabIdx >= 0 && kwTabIdx <= gs.length ? kwTabIdx : 0;
  const displayGroups = safeKwIdx === 0 ? gs : [gs[safeKwIdx - 1]];
  const selectedGroup = safeKwIdx > 0 ? gs[safeKwIdx - 1] : null;

  // 소재 라운드로빈 12개 추출
  const filteredAds = data.ads.filter(pass);
  const byCamp: Record<string, AdRow[]> = {};
  filteredAds.forEach((a) => {
    const k = a.campaign || '기타';
    if (!byCamp[k]) byCamp[k] = [];
    byCamp[k].push(a);
  });
  const campKeys = Object.keys(byCamp);
  const ads: AdRow[] = [];
  let roundIdx = 0;
  while (ads.length < 12 && campKeys.some((k) => byCamp[k].length > 0)) {
    const k = campKeys[roundIdx % campKeys.length];
    if (byCamp[k].length > 0) {
      ads.push(byCamp[k].shift()!);
    }
    roundIdx++;
  }

  const usedImgs = new Set<string>();
  const mediaColors: Record<string, string> = {
    Google: '--c-g',
    Naver: '--c-n',
    Meta: '--c-m',
  };

  return (
    <div className="view on" data-view="keywords" data-title="키워드 · 소재">
      <div className="mod-h">
        <div>
          <h2>키워드 · 소재 성과</h2>
          <p>광고그룹별 검색 키워드 입찰/품질/전환 지표 및 배너·확장 소재 현황</p>
        </div>
        <span className={`ex${live ? ' live' : ''}`} data-src>
          {live ? '실제 취합 데이터' : '데이터 대기 중'}
        </span>
      </div>
      <p className="sec-src">
        <a href="https://ads.google.com" target="_blank" rel="noopener">
          Google Ads API
        </a>
        <a href="https://searchad.naver.com" target="_blank" rel="noopener">
          네이버 검색광고 API
        </a>
        <a
          href="https://docs.google.com/spreadsheets/d/1mxrTeh7bo50RTz_2_UNyQxtQrljoEK4-xgPy9fr8nIg/edit"
          target="_blank"
          rel="noopener"
        >
          취합 스프레드시트
        </a>
        <span>키워드·소재·입찰가·품질지수 포함</span>
      </p>

      <div className="mock-bar">
        <span className="seg" data-k="media">
          {(['all', 'Google', 'Naver'] as const).map((m) => (
            <button
              key={m}
              data-v={m}
              className={media === m ? 'on' : ''}
              onClick={() => {
                setMedia(m);
                setKwTabIdx(0);
              }}
            >
              {m === 'all' ? '전체' : m}
            </button>
          ))}
        </span>
        <span className="seg" data-k="type">
          {(['SA', 'DA'] as const).map((t) => (
            <button
              key={t}
              data-v={t}
              className={type === t ? 'on' : ''}
              onClick={() => {
                setType(t);
                setKwTabIdx(0);
              }}
            >
              {t}
            </button>
          ))}
        </span>
        <span className="sp" />
      </div>

      {/* 1. 카테고리별 전환 · 소진 */}
      <div className="card">
        <h3 id="ttCatConv">카테고리별 전환 · 소진</h3>
        <div className="tw">
          <table id="tbCatConv">
            {ck.length ? (
              <>
                <thead>
                  <tr>
                    <th>카테고리</th>
                    <th className="n">광고비</th>
                    <th className="n">클릭</th>
                    <th className="n">전환</th>
                    <th className="n">전환당 비용</th>
                  </tr>
                </thead>
                <tbody>
                  {ck.map((k) => (
                    <tr key={k}>
                      <td>{k}</td>
                      <td className="n">{fmt(cost[k])}원</td>
                      <td className="n">{fmt(clk[k])}</td>
                      <td className="n">{fmt(conv[k])}</td>
                      <td className="n">{conv[k] ? `${fmt(cost[k] / conv[k])}원` : '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </>
            ) : (
              <tbody>
                <tr>
                  <td>
                    <div className="empty">
                      {type === 'DA' ? (
                        <>
                          수집된 디스플레이 광고(DA) 데이터가 없습니다.
                          <br />
                          <small className="muted">GFA 무인 스케줄러 동기화 후 자동 집계됩니다.</small>
                        </>
                      ) : media === 'Google' ? (
                        <>
                          수집된 Google 검색광고 데이터가 없습니다.
                          <br />
                          <small className="muted">스크립트 실행 후 데이터가 집계됩니다.</small>
                        </>
                      ) : (
                        '조회 조건에 해당하는 광고 데이터가 없습니다.'
                      )}
                    </div>
                  </td>
                </tr>
              </tbody>
            )}
          </table>
        </div>
      </div>

      {/* 2. 키워드 */}
      <div className="card">
        <h3 id="ttKw">
          {type === 'DA' ? (
            '키워드'
          ) : !gs.length ? (
            <span>
              키워드 <span className="muted">최근 30일 · 광고비 상위 광고그룹</span>
            </span>
          ) : safeKwIdx === 0 ? (
            <span>
              키워드{' '}
              <span className="muted">
                최근 30일 · 광고비 상위 {gs.length}개 그룹, 그룹당 상위 10개
              </span>
            </span>
          ) : (
            <span>
              키워드{' '}
              <span className="muted">
                {selectedGroup && renderPill(selectedGroup.media)} {selectedGroup?.campaign} ›{' '}
                {selectedGroup?.adgroup}
              </span>
            </span>
          )}
        </h3>

        {type === 'SA' && gs.length > 0 && (
          <div id="kwTabBar" className="kw-tabs">
            {['전체', ...gs.map((g) => (g.adgroup.length > 13 ? g.adgroup.slice(0, 12) + '…' : g.adgroup))].map(
              (lbl, i) => (
                <button
                  key={i}
                  className={safeKwIdx === i ? 'on' : ''}
                  title={
                    i === 0 ? '전체 광고그룹' : `${gs[i - 1].campaign} › ${gs[i - 1].adgroup}`
                  }
                  onClick={() => setKwTabIdx(i)}
                >
                  {lbl}
                </button>
              )
            )}
          </div>
        )}

        <div className="tw">
          <table className="stk" id="tbKw">
            {type === 'DA' ? (
              <tbody>
                <tr>
                  <td>
                    <div className="empty">
                      디스플레이 광고(DA)는 키워드 입찰을 진행하지 않습니다.
                      <br />
                      <small className="muted">
                        타겟팅 배너로 운영되어 키워드 목록이 없습니다.
                      </small>
                    </div>
                  </td>
                </tr>
              </tbody>
            ) : !gs.length ? (
              <>
                <thead>
                  <tr>
                    <th>캠페인 › 광고그룹 / 키워드</th>
                    <th className="n">현재 입찰가</th>
                    <th>품질</th>
                    <th className="n">노출</th>
                    <th className="n">클릭</th>
                    <th className="n">CTR</th>
                    <th className="n">전환</th>
                    <th className="n">광고비</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={8}>
                      <div className="empty">
                        {media === 'Google' ? (
                          <>
                            수집된 Google 검색광고 키워드가 없습니다.
                            <br />
                            <small className="muted">
                              Google Ads 스크립트 실행 후 자동 수집됩니다.
                            </small>
                          </>
                        ) : (
                          '조회 조건에 해당하는 키워드가 없습니다.'
                        )}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </>
            ) : (
              <>
                <thead>
                  <tr>
                    <th>캠페인 › 광고그룹 / 키워드</th>
                    <th className="n">현재 입찰가</th>
                    <th>품질</th>
                    <th className="n">노출</th>
                    <th className="n">클릭</th>
                    <th className="n">CTR</th>
                    <th className="n">전환</th>
                    <th className="n">광고비</th>
                  </tr>
                </thead>
                <tbody>
                  {displayGroups.map((g) => {
                    const sortedKws = [...g.list]
                      .sort((a, b) => b.cost - a.cost || b.clk - a.clk)
                      .slice(0, 10);
                    return (
                      <React.Fragment key={`${g.media}-${g.campaign}-${g.adgroup}`}>
                        <tr className="grp">
                          <td colSpan={8}>
                            {renderPill(g.media)} {g.campaign} › {g.adgroup}
                          </td>
                        </tr>
                        {sortedKws.map((k, ki) => {
                          const max = k.media === 'Naver' ? 7 : 10;
                          return (
                            <tr key={`${k.keyword}-${ki}`}>
                              <td className="ind">{k.keyword}</td>
                              <td className="n">{fmt(k.bid)}원</td>
                              <td>
                                {k.quality ? (
                                  <>
                                    <span
                                      className="qs-bar"
                                      data-tip={`품질${k.media === 'Naver' ? '지수' : '점수'}|${k.quality} / ${max}`}
                                    >
                                      {Array.from({ length: max }, (_, idx) => (
                                        <i key={idx} className={idx < k.quality ? 'on' : ''} />
                                      ))}
                                    </span>
                                    {k.quality}
                                  </>
                                ) : (
                                  <span className="muted">–</span>
                                )}
                              </td>
                              <td className="n">{fmt(k.imp)}</td>
                              <td className="n">{fmt(k.clk)}</td>
                              <td className="n">
                                {k.imp ? `${((k.clk / k.imp) * 100).toFixed(1)}%` : '–'}
                              </td>
                              <td className="n">{fmt(k.conv)}</td>
                              <td className="n">{fmt(k.cost)}원</td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </>
            )}
          </table>
        </div>
      </div>

      {/* 3. 주요 · 확장 소재 */}
      <div className="card">
        <h3 className="sub-h">주요 · 확장 소재</h3>
        <div className="creatives" id="creatives">
          {ads.length ? (
            ads.map((c, idx) => {
              const imgUrl = getCreativeImage(c, usedImgs);
              const title =
                (c.title && c.title !== 'RSA_AD' && c.title !== 'TEXT_45'
                  ? c.title
                  : `${c.campaign} · ${c.adgroup}`) || '파워링크 검색광고';
              return (
                <div key={`${c.campaign}-${c.adgroup}-${idx}`} className="cr">
                  <div
                    className="img"
                    style={{ background: `var(${mediaColors[c.media] || '--c-it'})` }}
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
            })
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
      </div>
    </div>
  );
};
