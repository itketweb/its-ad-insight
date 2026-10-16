import React from 'react';
import type { DashboardData, SyncStatus } from '../types/dashboard';
import { DEFAULT_URL, getCfg } from '../hooks/useDashboardData';
import { fmt } from '../utils/format';

interface DataViewProps {
  data: DashboardData;
  status: SyncStatus;
  onReload: () => void;
}

export const DataView: React.FC<DataViewProps> = ({ data, status, onReload }) => {
  const live = status === 'live';
  const cfg = getCfg();

  return (
    <div className="view on" data-view="data" data-title="데이터 연결">
      <div className="mod-h">
        <div>
          <h2>데이터 연결 및 동기화</h2>
          <p>매체 API 및 견적 웹훅 수집 현황과 카테고리 매칭 기준</p>
        </div>
        <span className={`ex${live ? ' live' : ''}`} data-src>
          {live ? '실제 취합 데이터' : '데이터 대기 중'}
        </span>
      </div>

      {/* 실시간 연동 현황 및 제어 카드 */}
      <div className="card accent">
        <div className="card-head">
          <div>
            <h3>
              <span>현재 연동 상태</span>
              <span
                className={`pill ${live ? 'g' : status === 'error' ? 'm' : ''}`}
                id="dataViewBadge"
              >
                {live
                  ? '정상 연동 중 (상시 자동)'
                  : status === 'error'
                    ? '동기화 지연'
                    : '연결 중...'}
              </span>
            </h3>
            <p className="muted small" id="dataViewUpdated">
              {data.updated
                ? `마지막 데이터 수집: ${data.updated} (10분 주기 무인 동기화)`
                : '데이터 동기화 대기 중...'}
            </p>
          </div>
          <div>
            <button
              className="btn sm ic"
              id="syncBtn"
              onClick={onReload}
              title="구글 스프레드시트 최신 데이터 즉시 수집"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              <span>지금 동기화</span>
            </button>
          </div>
        </div>

        <table className="kv">
          <tbody>
            <tr>
              <th style={{ width: '130px' }}>취합 스프레드시트</th>
              <td>
                <a
                  href="https://docs.google.com/spreadsheets/d/1mxrTeh7bo50RTz_2_UNyQxtQrljoEK4-xgPy9fr8nIg/edit"
                  target="_blank"
                  rel="noopener"
                  className="link-acc"
                >
                  광고비·전환·견적 취합 시트 (1mxrTeh7bo...) ↗
                </a>
              </td>
            </tr>
            <tr>
              <th>Apps Script 웹앱</th>
              <td>
                <code
                  id="dataViewUrl"
                  className="url-code"
                >
                  {cfg.url || DEFAULT_URL}
                </code>
              </td>
            </tr>
            <tr>
              <th>현재 취합 데이터</th>
              <td id="dataViewStats">
                네이버 광고 <b>{fmt(data.spend.length)}</b>행 · 키워드{' '}
                <b>{fmt(data.keywords.length)}</b>개 · 견적 <b>{fmt(data.quotes.length)}</b>건 (0초
                SWR 캐시 활성)
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <section>
        <h2 className="sec">데이터 소스</h2>
        <div className="hier">
          <span>매체</span>›
          <span>
            캠페인 <small>≒ 카테고리</small>
          </span>
          ›<span>광고그룹</span>›
          <span>
            키워드 <small>SA</small> / 배너 <small>DA</small>
          </span>
        </div>
        <div className="card tw">
          <table className="stk">
            <thead>
              <tr>
                <th>소스</th>
                <th>수집 방식</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <span className="pill g">Google</span> SA·DA
                  <div className="sub-t">비용·노출·클릭·전환, 입찰가·품질점수, 소재</div>
                </td>
                <td>Google Ads Script → 시트 자동 적재</td>
                <td>
                  <span className="st ok">자동 연동</span>
                </td>
              </tr>
              <tr>
                <td>
                  <span className="pill n">Naver</span> 검색광고 SA
                  <div className="sub-t">비용·노출·클릭·전환, 입찰가·품질지수, 확장소재</div>
                </td>
                <td>검색광고 API → 시트 1시간 자동 적재</td>
                <td>
                  <span className="st ok">자동 연동</span>
                </td>
              </tr>
              <tr>
                <td>
                  <span className="pill n">Naver</span> 디스플레이 DA
                  <div className="sub-t">비용·노출·클릭·전환, 배너 소재</div>
                </td>
                <td>GFA 무인 스케줄러(Playwright) → 시트 자동 동기화</td>
                <td>
                  <span className="st ok">무인 수집</span>
                </td>
              </tr>
              <tr>
                <td>
                  <span className="pill it">견적</span> ITKET · 캐드코리아 · ZbyHP · 전화상담
                  <div className="sub-t">견적 일시·카테고리·유입 매체</div>
                </td>
                <td>쇼핑몰(고도몰5) 견적 접수 즉시 웹훅·시트 자동 적재</td>
                <td>
                  <span className="st ok">실시간 자동</span>
                </td>
              </tr>
              <tr>
                <td>
                  <span className="pill n">Naver</span> 스마트스토어
                  <div className="sub-t">수수료·프로모션비</div>
                </td>
                <td>스마트스토어 커머스 API → 매일 06:00 시트 자동 적재</td>
                <td>
                  <span className="st ok">API 자동 연동</span>
                </td>
              </tr>
              <tr>
                <td>
                  <span className="pill etc">MDF</span> 광고비 지원금
                  <div className="sub-t">제조사(HP 등) 협약 지원금</div>
                </td>
                <td>네이버·구글 검색광고 API → MDF 캠페인 자동 집계</td>
                <td>
                  <span className="st ok">API 자동 연동</span>
                </td>
              </tr>
              <tr>
                <td>
                  <span className="pill m">Meta</span> 광고비
                </td>
                <td>시트 manual 탭 한 줄 입력 (연 1회 내외)</td>
                <td>
                  <span className="st man">수동</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="muted small">
          과거 수치는 사내 공유 폴더의 월간보고서·키워드TFT 엑셀에서 1회 이관해 전년·전분기 비교에 사용.
        </p>
      </section>

      <section>
        <h2 className="sec">카테고리 매칭</h2>
        <p className="lead-t">
          매체마다 다른 캠페인명과 자주 바뀌는 견적 카테고리를 직접 잇지 않고,{' '}
          <b>표준 카테고리</b>를 가운데 두고 양쪽을 연결한다.
        </p>
        <div className="card">
          <div className="flow">
            <div className="col">
              <div className="col-h">매체 광고그룹</div>
              <div className="chip g">G · 서버_브랜드</div>
              <div className="chip g">G · 서버_일반</div>
              <div className="chip n">N · 서버/워크스테이션</div>
              <div className="chip n">N · 스토리지_NAS</div>
            </div>
            <div className="mid">N : M</div>
            <div className="col">
              <div className="col-h">표준 카테고리</div>
              <div className="chip s">서버</div>
              <div className="chip s">워크스테이션</div>
              <div className="chip s">스토리지</div>
            </div>
            <div className="mid">N : M</div>
            <div className="col">
              <div className="col-h">견적 카테고리</div>
              <div className="chip it">ITKET · 랙서버</div>
              <div className="chip it">캐드코리아 · 워크스테이션</div>
              <div className="chip it">ZbyHP · Z워크스테이션</div>
              <div className="chip it">전화상담 · 스토리지</div>
            </div>
          </div>
        </div>
        <div className="rules">
          <div>
            <b>관리자가 화면에서 매칭</b>이름 규칙으로 자동 추천, 확정은 사람이
          </div>
          <div>
            <b>새 항목은 알림</b>매칭 안 된 그룹·카테고리는 배지로 표시, 비용은 “미분류”로 보존
          </div>
          <div>
            <b>지난 달은 그대로</b>매칭에 적용 시작월을 둬서 카테고리가 바뀌어도 과거 집계 유지
          </div>
          <div>
            <b>여러 카테고리에 걸치면</b>배분 비율(%) 입력, 기본 100%
          </div>
        </div>
      </section>

      <section>
        <h2 className="sec">갱신 · 보안</h2>
        <div className="grid">
          <div className="card">
            <h3>갱신 주기</h3>
            <table className="kv">
              <tbody>
                <tr>
                  <th>매일 08:00</th>
                  <td>
                    전일 확정 수치 수집 <span className="muted">(기본)</span>
                  </td>
                </tr>
                <tr>
                  <th>1시간마다</th>
                  <td>
                    당일 비용·클릭 <span className="muted">— 잠정치로 표시</span>
                  </td>
                </tr>
                <tr>
                  <th>매월 초</th>
                  <td>
                    전월 재수집 <span className="muted">— 매체 사후 보정 반영</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="card warn">
            <h3>보안 정책</h3>
            <ul>
              <li>광고비·입찰가·견적 수는 사내 영업 정보 (외부 비공개)</li>
              <li>API 키는 저장소에 커밋하지 않고 브라우저 로컬 저장소 및 환경변수로 분리</li>
              <li>사내망 또는 인증 사용자만 열람 가능하도록 보안 유지</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
};
