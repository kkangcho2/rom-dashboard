# LivedPulse Marketplace - Implementation Workflow Plan

> Generated: 2026-04-03
> Status: 34 files, 4,194 LOC, 24 DB tables, 32 tests passing

---

## Current State Assessment

### DONE (Phase 0 - Foundation)

| Component | Status | Files | Tests |
|---|---|---|---|
| DB Schema (24 tables) | COMPLETE | `server/db.cjs` | 8 tests |
| Marketplace API (portfolio/campaign/search/simulation) | COMPLETE | 6 route files | - |
| Admin Marketplace API (stats/creators/campaigns/audit) | COMPLETE | 1 route file | - |
| RBAC Middleware (7 roles, permission-based) | COMPLETE | `rbac.cjs` | 7 tests |
| Campaign State Machine (10 states) | COMPLETE | `campaign.cjs` | 6 tests |
| Banner Verification Service | COMPLETE | `banner-verify.cjs` | - |
| Portfolio Auto-Generator | COMPLETE | `portfolio-generator.cjs` | 11 tests |
| Mobile API (device/feed/prefs) | COMPLETE | `mobile.cjs` | - |
| SSE Notification Stream | COMPLETE | `marketplace/index.cjs` | - |
| Frontend: Marketplace Pages (4) | COMPLETE | `src/pages/marketplace/` | - |
| Frontend: Shared Components (8) | COMPLETE | `src/components/marketplace/` | - |
| Frontend: Onboarding Page | COMPLETE | `OnboardingPage.jsx` | - |
| Frontend: Admin Dashboard (4 tabs) | COMPLETE | `MarketplaceAdminPage.jsx` | - |
| API Service Layer | COMPLETE | `marketplace-api.js` | - |
| Zustand Store | COMPLETE | `useMarketplaceStore.js` | - |
| Notification Hook (SSE) | COMPLETE | `useNotificationStream.js` | - |
| Vitest Setup + 32 Tests | COMPLETE | `tests/` | 32 pass |

### NOT DONE (Phases 1-5)

```
Phase 1: Production Readiness     [CRITICAL - Week 1-2]
Phase 2: OAuth + Channel Verify   [HIGH - Week 3-4]
Phase 3: Communication Layer      [MEDIUM - Week 5-6]
Phase 4: Advanced Features        [MEDIUM - Week 7-10]
Phase 5: Mobile + Scale           [LOW - Week 11-16]
```

---

## Phase 1: Production Readiness

> Priority: CRITICAL | Timeline: Week 1-2
> Goal: 현재 코드를 실제 배포 가능한 상태로 만들기

### 1.1 Cloudflare Security Setup

```
Dependencies: None
Persona: Security + DevOps
Duration: 2-3 hours
```

**Tasks:**
- [ ] 1.1.1 Cloudflare WAF 활성화 (OWASP Core Ruleset)
- [ ] 1.1.2 SSL Full(Strict) 모드 설정
- [ ] 1.1.3 `/admin/*` 경로에 Cloudflare Access (Zero Trust) 적용
- [ ] 1.1.4 Bot Fight Mode 활성화
- [ ] 1.1.5 Rate Limiting Rules 설정 (API별 차등)

**Validation:** Cloudflare 대시보드에서 WAF Active 확인, Access 로그인 테스트

### 1.2 Fly.io Production Config

```
Dependencies: None
Persona: DevOps
Duration: 1-2 hours
```

**Tasks:**
- [ ] 1.2.1 리전 변경: `iad` → `nrt` (도쿄, 한국 근접)
- [ ] 1.2.2 메모리 업그레이드: 512MB → 1GB (Puppeteer 안정성)
- [ ] 1.2.3 `min_machines_running = 1` (콜드 스타트 방지)
- [ ] 1.2.4 환경변수 설정: `JWT_SECRET`, `AI_API_KEY` (fly secrets set)
- [ ] 1.2.5 Health check 엔드포인트 추가 (`GET /api/health`)

**Validation:** `fly status`, 응답 시간 < 200ms 확인

### 1.3 Error Monitoring + Logging

```
Dependencies: 1.2
Persona: DevOps
Duration: 3-4 hours
```

**Tasks:**
- [ ] 1.3.1 구조화된 로깅 (pino 또는 winston) 적용
- [ ] 1.3.2 에러 핸들링 미들웨어 (글로벌 catch-all)
- [ ] 1.3.3 Sentry 또는 BetterStack 연동 (선택)
- [ ] 1.3.4 서버 시작/종료 graceful shutdown

**Validation:** 의도적 에러 발생 → 로그 확인

### 1.4 CORS Hardening

```
Dependencies: 1.1
Persona: Security
Duration: 1 hour
```

**Tasks:**
- [ ] 1.4.1 CORS origin 화이트리스트 확정 (`livedpulse.com` + 배포 도메인)
- [ ] 1.4.2 개발 중 허용(`cb(null, true)`) 코드 제거 → 엄격 모드
- [ ] 1.4.3 credentials, methods, headers 설정 검토

**Validation:** 허용되지 않은 origin에서 API 호출 시 CORS 에러 확인

---

## Phase 2: OAuth Channel Verification

> Priority: HIGH | Timeline: Week 3-4
> Goal: 크리에이터의 채널 소유권을 OAuth로 검증하여 인증 배지 부여

### 2.1 YouTube OAuth

```
Dependencies: Phase 1 완료
Persona: Backend + Security
Duration: 1-2 days
```

**Tasks:**
- [ ] 2.1.1 Google Cloud Console에서 OAuth 2.0 클라이언트 ID 생성
- [ ] 2.1.2 `server/routes/oauth.cjs` 신규 생성
  - `GET /api/auth/oauth/youtube` → Google 인증 페이지 리디렉트
  - `GET /api/auth/oauth/youtube/callback` → 콜백 처리
- [ ] 2.1.3 콜백에서 YouTube Data API로 채널 ID 조회
- [ ] 2.1.4 `creator_profiles.youtube_channel_id` + `youtube_verified = 1` 업데이트
- [ ] 2.1.5 OAuth 토큰 AES-256-GCM 암호화 저장 (`oauth_tokens_encrypted`)

**Validation:** 실제 YouTube 계정으로 인증 → 배지 표시 확인

### 2.2 Chzzk (Naver) OAuth

```
Dependencies: 2.1 (패턴 동일)
Persona: Backend
Duration: 1 day
```

**Tasks:**
- [ ] 2.2.1 Naver Developers에서 OAuth 앱 등록
- [ ] 2.2.2 Chzzk 채널 ID 매칭 로직 (Naver API → Chzzk 채널)
- [ ] 2.2.3 `chzzk_verified` 플래그 업데이트

### 2.3 Frontend OAuth Flow

```
Dependencies: 2.1, 2.2
Persona: Frontend
Duration: 1 day
```

**Tasks:**
- [ ] 2.3.1 포트폴리오 설정 페이지에 "채널 연동" 버튼 추가
- [ ] 2.3.2 OAuth 팝업 플로우 (window.open → 콜백 → 메시지 수신)
- [ ] 2.3.3 연동 상태 표시 (인증됨/미인증 토글)

---

## Phase 3: Communication Layer

> Priority: MEDIUM | Timeline: Week 5-6
> Goal: 이메일 알림 + 실시간 메시지 강화

### 3.1 Email Notification Service

```
Dependencies: Phase 1
Persona: Backend
Duration: 1-2 days
```

**Tasks:**
- [ ] 3.1.1 이메일 서비스 선택: Resend / Postmark / AWS SES
- [ ] 3.1.2 `server/services/email.cjs` 생성
- [ ] 3.1.3 이메일 템플릿: 캠페인 제안, 수락/거절, 리포트 완료
- [ ] 3.1.4 `notifications` 테이블 INSERT 시 이메일 트리거 (DB 트리거 or 미들웨어)
- [ ] 3.1.5 `user_preferences.push_campaigns` 설정에 따른 발송 분기

**Validation:** 캠페인 상태 변경 시 이메일 수신 확인

### 3.2 Google Sheets Integration

```
Dependencies: Phase 1
Persona: Backend
Duration: 2 days
```

**Tasks:**
- [ ] 3.2.1 Google Service Account 생성 + Sheets API 활성화
- [ ] 3.2.2 `server/services/sheets-sync.cjs` 생성
- [ ] 3.2.3 양방향 싱크: 캠페인 상태/리포트 → Sheets, 캠페인 생성 ← Sheets
- [ ] 3.2.4 Google Apps Script 트리거 (onEdit → 플랫폼 API 호출)

---

## Phase 4: Advanced Features

> Priority: MEDIUM | Timeline: Week 7-10
> Goal: 차별화 기능 (AI 리포트, OBS 오버레이, 화이트라벨)

### 4.1 AI Campaign Report Generation

```
Dependencies: 기존 report.cjs 패턴 활용
Persona: Backend + Frontend
Duration: 3 days
```

**Tasks:**
- [ ] 4.1.1 캠페인 완료 시 AI 리포트 자동 생성 트리거
- [ ] 4.1.2 `server/marketplace/services/report-generator.cjs`
  - 시계열 데이터 집계 (stream_metrics 대체: crawl 결과 활용)
  - Claude/OpenAI로 인사이트 요약 생성
  - 배너 검증 결과 포함
- [ ] 4.1.3 PDF 렌더링 (Puppeteer + React 템플릿)
- [ ] 4.1.4 공유 URL 생성 (livedpulse.com/report/{id})
- [ ] 4.1.5 프론트엔드 리포트 뷰어

### 4.2 OBS Overlay System

```
Dependencies: None (독립)
Persona: Frontend + Backend
Duration: 2-3 days
```

**Tasks:**
- [ ] 4.2.1 `server/marketplace/routes/overlay.cjs` - 오버레이 데이터 API
- [ ] 4.2.2 `src/pages/overlay/` - 경량 React 페이지 (OBS Browser Source용)
- [ ] 4.2.3 Socket.IO 연동 (Redis Pub/Sub는 나중에, 초기엔 폴링)
- [ ] 4.2.4 오버레이 타입: 캠페인 진행률, 스폰서 배너, 도네이션 트래커
- [ ] 4.2.5 커스텀 설정 (위치/색상/투명도) JSONB 저장

### 4.3 White-Label Basic

```
Dependencies: Phase 1
Persona: Backend + Frontend
Duration: 2 days
```

**Tasks:**
- [ ] 4.3.1 `tenants` 테이블 활용 (이미 DB 설계에 포함)
- [ ] 4.3.2 테넌트 미들웨어: 서브도메인/헤더 기반 테넌트 식별
- [ ] 4.3.3 브랜딩: 로고/컬러 CSS 변수 동적 주입
- [ ] 4.3.4 리포트 PDF에 테넌트 브랜딩 적용

### 4.4 Payment Integration (SaaS 과금)

```
Dependencies: Phase 1
Persona: Backend + Security
Duration: 3-4 days
```

**Tasks:**
- [ ] 4.4.1 결제 서비스 선택: Toss Payments / PortOne (한국) 또는 Stripe
- [ ] 4.4.2 구독 플랜 테이블 + 과금 로직
- [ ] 4.4.3 플랜별 기능 제한 미들웨어
- [ ] 4.4.4 프론트엔드 결제 페이지 (기존 PricingPage 확장)

---

## Phase 5: Mobile + Scale

> Priority: LOW | Timeline: Week 11-16
> Goal: 모바일 앱 + 인프라 확장

### 5.1 Expo React Native App

```
Dependencies: Phase 1-3 완료
Persona: Frontend (Mobile)
Duration: 4-6 weeks (별도 설계서 참조: docs/MOBILE_APP_ARCHITECTURE.md)
```

**Tasks:**
- [ ] 5.1.1 Expo SDK 52 프로젝트 초기화
- [ ] 5.1.2 `mobile/services/api-client.ts` 연동 (이미 작성됨)
- [ ] 5.1.3 Auth 화면 (login.tsx 코드 이미 설계됨)
- [ ] 5.1.4 Tab Navigation (Home/Search/Campaigns/Profile)
- [ ] 5.1.5 Push Notification 연동 (expo-notifications)
- [ ] 5.1.6 앱스토어 배포

### 5.2 Infrastructure Scale

```
Dependencies: 유저 100+ 도달 시
Persona: DevOps + Architect
Duration: 1-2 weeks
```

**Tasks:**
- [ ] 5.2.1 SQLite → PostgreSQL 마이그레이션 (Fly Postgres)
- [ ] 5.2.2 Redis 도입 (BullMQ 잡 큐, 세션 캐시)
- [ ] 5.2.3 스크래퍼 분리 (별도 Fly Machine, 동적 스케일)
- [ ] 5.2.4 CDN 정적 에셋 최적화

---

## Dependency Graph

```
Phase 1 (Production)
  ├── 1.1 Cloudflare ──┐
  ├── 1.2 Fly.io ──────┤
  ├── 1.3 Logging ─────┤ (depends on 1.2)
  └── 1.4 CORS ────────┘ (depends on 1.1)
          │
          ▼
Phase 2 (OAuth)            Phase 3 (Comms)
  ├── 2.1 YouTube OAuth      ├── 3.1 Email
  ├── 2.2 Chzzk OAuth        └── 3.2 Sheets
  └── 2.3 Frontend OAuth
          │                        │
          ▼                        ▼
Phase 4 (Advanced) ◄──────────────┘
  ├── 4.1 AI Reports
  ├── 4.2 OBS Overlay
  ├── 4.3 White-label
  └── 4.4 Payments
          │
          ▼
Phase 5 (Mobile + Scale)
  ├── 5.1 Expo App
  └── 5.2 Infra Scale
```

**Phase 2 / Phase 3 은 병렬 진행 가능.**
**Phase 4 내 항목들도 서로 독립적이므로 병렬 가능.**

---

## Quality Gates

### Phase 1 Exit Criteria
- [ ] Cloudflare WAF 활성 + Access 동작
- [ ] Fly.io NRT 리전, 1GB RAM, 헬스체크 응답
- [ ] 구조화 로깅 + 에러 모니터링 연동
- [ ] CORS 엄격 모드 (허용 origin만 통과)
- [ ] `npm run build` 성공 + `npm test` 32/32 pass

### Phase 2 Exit Criteria
- [ ] YouTube OAuth로 채널 인증 → `youtube_verified = 1` 확인
- [ ] 인증 배지가 포트폴리오에 표시
- [ ] OAuth 토큰 암호화 저장 확인

### Phase 4 Exit Criteria
- [ ] 캠페인 완료 → AI 리포트 자동 생성 → PDF 다운로드
- [ ] OBS Browser Source에서 오버레이 정상 표시
- [ ] 결제 플로우: 플랜 선택 → 결제 → 기능 해제

### Launch Criteria (Go-Live)
- [ ] Phase 1 + Phase 2 완료
- [ ] 디자인 파트너 대행사 3곳 온보딩
- [ ] 크리에이터 30+ 포트폴리오 생성
- [ ] 캠페인 5건 이상 전체 라이프사이클 완료

---

## Immediate Next Steps (This Week)

```
Day 1: Phase 1.1 + 1.2 (Cloudflare + Fly.io 설정)
Day 2: Phase 1.3 (로깅 + 에러 핸들링)
Day 3: Phase 1.4 + 테스트 보강
Day 4: Phase 2.1 시작 (Google OAuth Console 설정)
Day 5: Phase 2.1 완료 (OAuth 콜백 + DB 업데이트)
```

---

## Metrics to Track

| Metric | Current | Phase 1 Target | Launch Target |
|---|---|---|---|
| DB Tables | 24 | 24 | 24+ |
| API Endpoints | 30+ | 32+ | 40+ |
| Test Count | 32 | 50+ | 80+ |
| Test Coverage | ~40% | 60%+ | 70%+ |
| Build Time | 775ms | <1s | <2s |
| Registered Creators | 0 | 5+ | 30+ |
| Active Campaigns | 0 | 1+ | 5+ |
