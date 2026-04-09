# AIG Frontend Prototype

`PJT/ref`의 설계 문서와 두 개의 HTML 디자인 초안을 기준으로 만든 최소 프런트엔드 스캐폴드입니다.

구성 기준:

- `AIG_Frontend_Design.docx`의 Next.js App Router 구조 우선
- `AIT_full_platform.html`의 다크 블루 톤과 카드형 UI 반영
- `AIT_wireframes.html`의 핵심 화면 흐름 반영

포함 화면:

- 로그인 / 회원가입
- 과제 목록 / 과제 상세
- 세션 시작
- 웹 IDE 목업
- 제출 대기
- 피드백 리포트 / 타임라인
- 마이페이지

실행:

```bash
yarn install
yarn dev
```

배포:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-to-studio.ps1
```

배포 대상 서버는 `studio.pyan.kr`이고, 서버 내부에서는 `127.0.0.1:3002`에 Next.js 프로덕션 서버가 떠 있습니다.
