/* 이 파일을 js/config.js 로 복사하고 값을 채운다. config.js 는 비밀키가 들어가므로 저장소에 올리지 않는다(.gitignore).
   url : Apps Script 웹앱 주소 (배포 → 웹 앱 URL, .../exec)
   key : Apps Script 의 setup 실행 로그에 나온 웹앱 비밀키
   둘 중 하나라도 비어 있으면 대시보드는 예시 데이터를 보여 준다. */
window.ADI = { url: '', key: '' };
