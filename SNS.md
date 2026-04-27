# CLAUDE.md

이 파일은 Claude Code (claude.ai/code)가 이 저장소에서 작업할 때 참고하는 가이드입니다.

---

## 프로젝트 개요

**LivePulse (rom-dashboard)** — YouTube/AfreecaTV/Chzzk 모바일 게임 크리에이터 분석 SaaS 플랫폼 + SNS 자동화 시스템

- **프로덕션 URL**: https://livedpulse.com
- **백엔드 API**: https://rom-dashboard.fly.dev/api
- **프론트엔드**: Cloudflare Pages (project: `livepulse`)
- **백엔드**: Fly.io (app: `rom-dashboard`)
- **언어**: UI 한국어, 코드 영문/한글 혼용

---

## 기술 스택

### 프론트엔드
- **프레임워크**: React 19.2.4 + Vite 8
- **스타일**: Tailwind CSS 4 (`@tailwindcss/vite` plugin)
- **차트**: Recharts 3.8
- **아이콘**: lucide-react 1.7
- **HTTP**: fetch (native) via `src/api.js`
- **상태관리**: useState (Context/Redux 없음)
- **라우팅**: React Router 없음 — `page` state로 수동 라우팅

### 백엔드
- **런타임**: Node.js 20 (Express 5)
- **DB**: SQLite (better-sqlite3, WAL 모드)
- **크롤링**: Cheerio, Puppeteer-core, yt-dlp CLI
- **플랫폼**: YouTube, AfreecaTV, Chzzk

---

## 배포 구조

```
[사용자 브라우저]
    ↓
[Cloudflare Pages] ──── livedpulse.com (프론트)
    │ project: livepulse
    │ deploy: VITE_API_URL=https://rom-dashboard.fly.dev/api npm run deploy
    ↓
[Fly.io] ──── rom-dashboard.fly.dev (백엔드)
    │ app: rom-dashboard
    │ deploy: fly deploy
    │ Dockerfile: node:20-slim
    │ 포트: 8080 (PORT env)
    │ volume: /data (SQLite 영구 저장용)
    ↓
[SQLite] ──── server/promo_insight.db
```

### 배포 명령
```bash
# 백엔드
fly deploy

# 프론트엔드
VITE_API_URL=https://rom-dashboard.fly.dev/api npm run deploy
```

### 환경변수
- **빌드 시**: `VITE_API_URL` (프론트의 API base)
- **런타임**: `PORT` (Fly.io가 8080 주입, 없으면 3001)

---

## 디렉토리 구조

```
rom-dashboard/
├── public/                           # Cloudflare Pages static
│   ├── favicon.svg
│   ├── icons.svg
│   └── _redirects                    # SPA 라우팅 (/* → /index.html 200)
│
├── src/                              # 프론트엔드
│   ├── main.jsx                      # React 진입점
│   ├── App.jsx                       # 메인 앱 (2744줄, 페이지 라우팅)
│   ├── CreatorSearch.jsx             # 크리에이터 검색/발견 (1156줄)
│   ├── SaasAdmin.jsx                 # SaaS 관리자 콘솔
│   ├── api.js                        # API 클라이언트 (fetch wrappers)
│   ├── index.css                     # Tailwind + 커스텀 애니메이션
│   ├── App.css
│   │
│   └── components/
│       ├── shared.jsx                # GlassCard, MiniTooltip, GradeTag, PlatformIcon
│       ├── AuthPage.jsx              # 로그인/가입
│       ├── ChannelCompare.jsx        # 멀티 채널 비교
│       ├── CreatorCards.jsx          # 크리에이터 카드 그리드
│       ├── SentimentTab.jsx          # 감성 분석 UI
│       ├── SuperAdminPage.jsx        # 관리자 대시보드
│       ├── PaymentAdminPage.jsx      # 결제 관리
│       ├── PricingPage.jsx           # 요금제
│       ├── TeamSettings.jsx          # 워크스페이스 설정
│       ├── UserMyPage.jsx            # 유저 프로필
│       │
│       └── sns-automation/           # ★ SNS 자동화 시스템 (별도 폴더)
│           ├── index.jsx             # barrel export
│           ├── SnsAutomation.jsx     # 메인 (대시보드 + 7탭 네비)
│           ├── ContentPlanningTab.jsx
│           ├── ScriptGeneratorTab.jsx
│           ├── UploadSchedulerTab.jsx
│           ├── AutoResponseTab.jsx
│           ├── LeadManagementTab.jsx
│           └── PricingPackagesTab.jsx
│
├── server/                           # 백엔드 (Express + SQLite)
│   ├── index.cjs                     # 메인 서버 (771줄, 크롤/검색 API)
│   ├── db.cjs                        # SQLite 스키마 (13 테이블)
│   ├── sns-routes.cjs                # ★ SNS 자동화 라우터 (별도 모듈)
│   └── crawlers/
│       ├── youtube.cjs               # YouTube 크롤러
│       ├── afreeca.cjs               # AfreecaTV 크롤러
│       └── chzzk.cjs                 # 치지직 크롤러
│
├── Dockerfile                        # Fly.io용 (node:20-slim)
├── fly.toml                          # Fly.io 앱 설정
├── .dockerignore                     # 백엔드 이미지에서 프론트 제외
├── vite.config.js                    # Vite + Tailwind plugin
├── eslint.config.js                  # Flat config
├── index.html                        # SPA 진입 HTML
├── package.json                      # 스크립트: dev, server, dev:all, build, deploy
└── .env.example                      # VITE_API_URL
```

---

## 라우팅 / 페이지 구조

`src/App.jsx`에서 `page` state로 수동 라우팅:

| page | 렌더링 컴포넌트 |
|---|---|
| `'search'` (기본) | `<CreatorSearch>` - 크리에이터 검색/탐색 |
| `'dashboard'` | `<Dashboard>` - 영상/채널 분석 대시보드 |
| `'report'` | `<Dashboard initialDashSection="broadcast">` - 방송 리포트 |
| `'admin'` | `<SaasAdmin>` - SaaS 관리 콘솔 |
| `'sns'` | `<SnsAutomation>` - SNS 자동화 시스템 |

네비게이션: `CreatorSearch.jsx`의 상단 nav에서 `onGoToReport`, `onGoToAdmin`, `onGoToSns` props로 이동.

---

## 데이터베이스 스키마 (SQLite)

### 분석 시스템 (기존)
- `crawl_jobs` — 크롤링 작업 상태
- `channels` — 크리에이터 채널 정보
- `videos` — 영상 메타데이터
- `transcripts` — 자막
- `chat_messages` — 라이브 채팅
- `comments` — 영상 댓글

### SNS 자동화 시스템 (신규)
- `sns_content_plans` — 콘텐츠 기획 (업종/제목/상태/타겟 플랫폼)
- `sns_scripts` — AI 생성 스크립트 (prompt + 결과)
- `sns_upload_schedules` — 업로드 예약 (날짜/플랫폼/상태)
- `sns_auto_responses` — 댓글/DM 자동응대 규칙 (트리거 키워드 + 템플릿)
- `sns_leads` — 리드/고객 관리 (연락처/문의유형/전환상태)
- `sns_industry_templates` — 업종별 프롬프트 시드 (미용실/병원/헬스/카페/교육)

---

## API 엔드포인트

### 크롤링 & 분석 (`/api/*`)
- `POST /api/crawl` — 크롤 작업 시작
- `GET /api/crawl/:jobId` — 진행률 조회
- `GET /api/search/channels?q=` — 채널 검색
- `GET /api/search/videos?q=` — 영상 검색
- `GET /api/featured-creators` — 추천 크리에이터
- `GET /api/videos/:id/analysis` — 영상 종합 분석
- `GET /api/videos/:id/sentiment` — 감성 분석
- `GET /api/yt/transcript?url=` — yt-dlp 자막
- `GET /api/yt/chat?url=` — yt-dlp 라이브 채팅
- `GET /api/video-info?url=` — 영상 메타데이터
- `GET /api/stats` — 시스템 통계

### SNS 자동화 (`/api/sns/*`) — `server/sns-routes.cjs`
- `GET /api/sns/stats` — SNS 대시보드 통계
- `GET|POST|PUT|DELETE /api/sns/content-plans` — 콘텐츠 기획 CRUD
- `GET|POST|PUT|DELETE /api/sns/scripts` — 스크립트 CRUD
- `GET|POST|PUT|DELETE /api/sns/schedules` — 업로드 예약 CRUD
- `GET|POST|PUT|DELETE /api/sns/auto-responses` — 자동응대 규칙 CRUD
- `GET|POST|PUT|DELETE /api/sns/leads` — 리드 CRUD
- `GET|POST /api/sns/templates` — 업종별 템플릿

---

## 개발 워크플로우

### 로컬 개발
```bash
# 프론트 + 백엔드 동시 실행
npm run dev:all

# 개별 실행
npm run dev        # Vite 개발 서버 (포트 5173)
npm run server     # Express 백엔드 (포트 3001)
```

### 빌드
```bash
npm run build      # dist/ 생성
```

### Lint
```bash
npm run lint
```

---

## UI 디자인 시스템

### 색상 (Tailwind 커스텀)
```
Primary:        #6366f1 (indigo)
Dark BG:        #0a0e1a
Dark Cards:     #111827 → #1a2035 (gradient)
Border:         #374766 (30-50% opacity)
Success:        #22c55e
Danger:         #ef4444
Warning:        #f59e0b
```

### 공통 컴포넌트 (`src/components/shared.jsx`)
- `GlassCard` — 글래스모피즘 카드
- `MiniTooltip` — Recharts용 툴팁
- `GradeTag` — S/A/B/C 등급 뱃지
- `PlatformIcon` — 플랫폼별 아이콘

### 스타일 규칙
- 다크 테마만 지원
- 모바일 최적화 (responsive)
- `fadeInUp`, `pulse-glow` 애니메이션 사용
- 폰트: 시스템 기본 (한국어 우선)

---

## SNS 자동화 시스템 상세

### 목적
SNS 콘텐츠 제작 → 업로드 → 고객응대까지 실전 사업용 자동화 (미용실/병원/헬스/카페/학원)

### 탭 구성 (7개)

1. **대시보드** — KPI 카드, 차트, 전체 파이프라인 시각화, Zapier 시나리오 가이드
2. **콘텐츠 기획** — 업종별 프롬프트 템플릿, 콘텐츠 CRUD, 상태/플랫폼/날짜 관리
3. **스크립트 생성** — AI 프롬프트 작성, 생성 스크립트 관리, 복사 기능
4. **업로드 자동화** — 날짜별 타임라인, 플랫폼 필터, 예약 관리
5. **자동응대** — 댓글/DM/멘션 트리거, 키워드 기반 응대 규칙, 활성/비활성 토글
6. **리드 관리** — 신규/연락/상담/전환/이탈 파이프라인, CSV 내보내기, 인라인 편집
7. **패키지 관리** — 기본형(20-30만)/성장형(50-80만)/프리미엄(100-200만) 수익화

### 지원 업종
- `beauty_salon` — 미용실
- `hospital` — 병원 (피부과/치과)
- `fitness` — 헬스/PT
- `restaurant` — 카페/레스토랑
- `education` — 학원/교육

### Zapier 연동 시나리오
1. Google Sheets 주제 입력 → ChatGPT 스크립트 생성 → Notion 저장
2. Notion "제작" 상태 → CapCut 영상 툴 → Google Drive 저장
3. Drive 업로드 → Buffer 예약 업로드 → 제목/태그 자동 입력
4. DM/댓글 수신 → 키워드 분석 → ChatGPT 답변 → Sheets 고객 DB

---

## Git 브랜치

- `master` — 프로덕션 배포 대상 (Fly.io + Cloudflare)
- `main` — 레거시 (사용 안 함)
- `claude/sns-automation-system-6sX3p` — SNS 자동화 원 브랜치
- `flyio-new-files` — Fly.io 초기 설정 브랜치 (레거시 `gostatic` Dockerfile)

---

## 알려진 이슈 / 주의사항

### 보안
- **비밀번호 하드코딩**: `CreatorSearch.jsx:650`, `AuthPage.jsx:163`에 `'livedpulse2026'` 노출
- **데모 이메일**: `SuperAdminPage.jsx:28`의 `kangeun1@naver.com`
- 백엔드 인증 미들웨어가 존재할 수 있음 (`AUTH_REQUIRED` 응답) — git에는 없지만 프로덕션에는 있을 수 있음

### 빌드 경고
- JS 번들 891KB — 500KB 제한 초과 (code-splitting 권장)
- 동적 import 미적용

### 배포 주의
- **Fly.io 배포 전 확인**: 로컬 `server/index.cjs`가 git과 동기화되어 있는지 확인 (인증 미들웨어 등 로컬 추가 코드 가능성)
- **Cloudflare 배포 시**: `CLOUDFLARE_API_TOKEN` 환경변수 필요
- **DNS**: `api.livedpulse.com`은 DNS 미설정 (직접 `rom-dashboard.fly.dev` 사용)

### Fly.io 머신 정책
- `auto_stop_machines = 'stop'` — 트래픽 없으면 자동 중지 (비용 절감)
- `auto_start_machines = true` — 요청 시 자동 재시작 (첫 요청 ~2-3초 지연)
- 항상 가동하려면 `min_machines_running = 1` 설정

---

## 코드 스타일 가이드

- **파일 확장자**: 프론트 `.jsx`, 백엔드 `.cjs` (CommonJS)
- **import**: `import { Component } from '../shared'` (상대 경로)
- **함수형 컴포넌트**만 사용 (class 없음)
- **네이밍**: 컴포넌트 PascalCase, 함수 camelCase, 상수 UPPER_SNAKE
- **주석**: 한국어 섹션 헤더 (`// ─── 섹션명 ───`)
- **에러 처리**: try/catch + console.error, UI는 fallback 표시

---

## 작업 시 참고사항

### 새 컴포넌트 추가
1. `src/components/` 또는 하위 폴더에 `.jsx` 생성
2. `GlassCard` 등 shared 컴포넌트 재사용
3. Tailwind 다크테마 스타일 유지
4. 한국어 UI 텍스트

### 새 API 엔드포인트 추가
1. `server/index.cjs` 또는 별도 라우터 파일에 정의
2. `src/api.js`에 클라이언트 함수 추가
3. DB 스키마 변경 시 `server/db.cjs`의 `CREATE TABLE IF NOT EXISTS` 수정

### 배포 전 체크리스트
- [ ] `npm run build` 성공
- [ ] `VITE_API_URL` 프로덕션 값 확인
- [ ] git 로컬과 원격 동기화
- [ ] Fly.io 배포 시 Dockerfile 포함 여부 확인

---

## 관련 문서 / 링크
- Cloudflare Pages: https://dash.cloudflare.com (project: livepulse)
- Fly.io: https://fly.io/apps/rom-dashboard
- GitHub: https://github.com/kkangcho2/rom-dashboard
