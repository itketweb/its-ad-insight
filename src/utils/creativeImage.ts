import type { AdRow } from '../types/dashboard';

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

export const MEDIA_COLOR_VARS: Record<string, string> = {
  Google: '--c-g',
  Naver: '--c-n',
  Meta: '--c-m',
};

export function getCreativeImage(c: AdRow, usedImgs: Set<string>): string {
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

export function selectRoundRobinAds(ads: AdRow[], limit = 12): AdRow[] {
  const byCamp: Record<string, AdRow[]> = {};
  ads.forEach((a) => {
    const k = a.campaign || '기타';
    if (!byCamp[k]) byCamp[k] = [];
    byCamp[k].push(a);
  });
  const campKeys = Object.keys(byCamp);
  const result: AdRow[] = [];
  let roundIdx = 0;
  while (result.length < limit && campKeys.some((k) => byCamp[k].length > 0)) {
    const k = campKeys[roundIdx % campKeys.length];
    if (byCamp[k].length > 0) {
      result.push(byCamp[k].shift()!);
    }
    roundIdx++;
  }
  return result;
}
