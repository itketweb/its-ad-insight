# 네이버 커머스(스마트스토어) API 연동 가이드

스마트스토어의 수수료 및 프로모션 할인 금액을 Apps Script를 통해 매일 오전 06:00에 자동 수집하여 대시보드 "스토어" 항목에 반영합니다.

---

## 1. 커머스 API 센터 가입 및 애플리케이션 등록
1. [네이버 커머스API 센터](https://commerce.naver.com) 에 스마트스토어 판매자 계정으로 로그인합니다.
2. 상단 메뉴의 **[애플리케이션 등록]** 을 클릭합니다.
3. 애플리케이션 정보를 입력합니다:
   - **애플리케이션 이름**: `its-ad-insight`
   - **사용 API 카테고리**: `정산 API` (Settlement) 체크
4. 등록 완료 후 발급되는 **Client ID** 와 **Client Secret** 을 확인합니다.

---

## 2. Google Apps Script 스크립트 속성 등록
1. Google Apps Script 프로젝트 열기 (`script.google.com`)
2. 좌측 톱니바퀴 아이콘 **[프로젝트 설정]** 클릭
3. **[스크립트 속성]** 섹션에서 [스크립트 속성 추가] 클릭:
   - 속성명: `COMMERCE_CLIENT_ID` / 값: 발급받은 Client ID
   - 속성명: `COMMERCE_CLIENT_SECRET` / 값: 발급받은 Client Secret
4. **[스크립트 속성 저장]** 을 누릅니다.

---

## 3. 동기화 확인
- Apps Script의 `collectCommerce` 함수를 직접 1회 실행(디버깅)하거나,
- 매일 오전 06:00에 예약된 트리거에 의해 자동으로 전월·당월 스마트스토어 비용이 `manual` 시트의 `STORE` 항목에 적재됩니다.
