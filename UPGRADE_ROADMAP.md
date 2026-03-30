# LivePulse 사이트 고도화 로드맵

## 현황 진단

| 영역 | 현재 상태 | 심각도 |
|------|----------|--------|
| 코드 구조 | App.jsx 2,737줄 모놀리식, 인라인 컴포넌트 혼재 | 🔴 심각 |
| 라우팅 | state 기반 (URL 라우팅 없음, 뒤로가기 불가) | 🔴 심각 |
| 상태 관리 | useState 20개+, props drilling | 🟡 보통 |
| 타입 안전성 | TypeScript 없음 | 🟡 보통 |
| 서버 구조 | 단일 파일 index.cjs (946줄) | 🟡 보통 |
| 보안 | 하드코딩 인증, 입력 검증 없음 | 🔴 심각 |
| 에러 처리 | Error Boundary 없음, 조용한 실패 | 🟡 보통 |
| 테스트 | 전무 | 🟡 보통 |
| 성능 | 불필요 리렌더, 번들 최적화 없음 | 🟡 보통 |
| UI/UX | 기본 기능 작동하나 일관성 부족 | 🟢 경미 |

---

## Phase 1: 코드 구조 리팩토링 (기반 작업)

> 다른 모든 개선의 토대가 되는 가장 중요한 단계

### 1-1. 프로젝트 폴더 구조 재편

```
src/
├── components/          # 재사용 가능한 UI 컴포넌트
│   ├── ui/              # 기본 UI (GlassCard, StatCard, Badge 등)
│   ├── charts/          # 차트 관련 (SentimentGauge, CustomTooltip 등)
│   └── layout/          # 레이아웃 (Header, Sidebar, MobileMenu)
├── pages/               # 페이지 단위 컴포넌트
│   ├── Dashboard/       # 대시보드 (탭별 분리)
│   ├── CreatorSearch/   # 크리에이터 검색
│   ├── Admin/           # 관리자 페이지들
│   ├── Auth/            # 로그인/회원가입
│   └── Report/          # 리포트 생성
├── hooks/               # 커스텀 훅
│   ├── useCrawl.js      # 크롤링 상태 관리
│   ├── useAuth.js       # 인증 상태
│   └── useSentiment.js  # 감성 분석 로직
├── utils/               # 유틸리티 함수
│   ├── analysis.js      # buildRealAnalysis, analyze 등
│   ├── format.js        # 숫자/날짜 포맷팅
│   └── constants.js     # 게임 카테고리, 키워드 리스트
├── services/            # API 통신 레이어
│   └── api.js           # 기존 api.js 확장
├── store/               # 전역 상태 (Zustand)
└── App.jsx              # 라우터 설정만
```

### 1-2. React Router 도입

```jsx
// App.jsx (리팩토링 후 - 라우터만 담당)
<BrowserRouter>
  <Routes>
    <Route path="/" element={<CreatorSearch />} />
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/dashboard/:videoId" element={<Dashboard />} />
    <Route path="/report" element={<DailyReport />} />
    <Route path="/admin/*" element={<AdminLayout />}>
      <Route path="system" element={<SuperAdminPage />} />
      <Route path="payments" element={<PaymentAdminPage />} />
      <Route path="team" element={<TeamSettings />} />
    </Route>
    <Route path="/login" element={<AuthPage />} />
    <Route path="/pricing" element={<PricingPage />} />
    <Route path="/my" element={<UserMyPage />} />
  </Routes>
</BrowserRouter>
```

### 1-3. App.jsx 분리 (2,737줄 → 개별 모듈)

| 현재 위치 (App.jsx 내) | 분리 대상 | 예상 크기 |
|------------------------|----------|----------|
| buildRealAnalysis (22-146줄) | `utils/analysis.js` | ~130줄 |
| GlassCard, StatCard 등 (215-317줄) | `components/ui/` | 각 20-40줄 |
| analyze 함수 (318-1556줄) | `utils/reportAnalyzer.js` | ~1,200줄 |
| Dashboard 컴포넌트 (1558-2670줄) | `pages/Dashboard/` | 탭별 분리 |
| 라우팅 로직 (2672-2737줄) | `App.jsx` (React Router) | ~30줄 |

### 1-4. 상태 관리 (Zustand 도입)

```js
// store/useAuthStore.js
export const useAuthStore = create((set) => ({
  user: null,
  role: 'user',
  login: (user) => set({ user, role: user.role }),
  logout: () => set({ user: null, role: 'user' }),
}))

// store/useCrawlStore.js
export const useCrawlStore = create((set) => ({
  jobs: [],
  activeJob: null,
  analysisData: null,
  startCrawl: async (url) => { ... },
}))
```

### 1-5. 서버 모듈화

```
server/
├── index.cjs            # Express 앱 초기화
├── routes/
│   ├── crawl.cjs        # /api/crawl 라우트
│   ├── channels.cjs     # /api/channels 라우트
│   ├── search.cjs       # /api/search 라우트
│   ├── videos.cjs       # /api/videos 라우트
│   └── auth.cjs         # /api/auth 라우트 (신규)
├── services/
│   ├── youtube.cjs      # YouTube 크롤링 로직
│   ├── sentiment.cjs    # 감성 분석 엔진
│   └── featured.cjs     # 추천 크리에이터 로직
├── middleware/
│   ├── auth.cjs         # 인증 미들웨어
│   ├── validation.cjs   # 입력 검증
│   └── rateLimit.cjs    # 요청 제한
└── db/
    ├── db.cjs           # DB 초기화
    └── migrations/      # 스키마 마이그레이션
```

---

## Phase 2: UI/UX 개선

### 2-1. 디자인 시스템 정립

- 컬러 토큰, 타이포그래피, 스페이싱 통일
- 공통 UI 컴포넌트 라이브러리 구축 (Button, Input, Modal, Badge, Card 등)
- 다크/라이트 테마 전환 지원

### 2-2. 반응형 강화

- 모바일 퍼스트 레이아웃 재설계
- 대시보드 3-패널 → 모바일에서 탭 전환 방식
- 터치 친화적 인터랙션 (스와이프, 풀다운 등)

### 2-3. 인터랙션 개선

- 페이지 전환 애니메이션 (Framer Motion)
- 스켈레톤 로딩 UI (현재 스피너만 존재)
- Toast 알림 시스템
- 키보드 단축키 지원
- 데이터 테이블 정렬/필터 UX 개선

### 2-4. 접근성(a11y)

- 시맨틱 HTML 태그 적용
- ARIA 속성 추가
- 키보드 네비게이션 지원
- 색각 이상 대응 차트 색상

---

## Phase 3: 기능 추가/개선

### 3-1. 인증 체계 강화

- JWT 기반 토큰 인증 (현재 하드코딩 제거)
- 서버사이드 세션 관리
- 비밀번호 암호화 (bcrypt)
- 역할 기반 접근 제어 (RBAC)

### 3-2. 실시간 기능

- WebSocket 도입 (크롤링 진행률 실시간 전송)
- 현재 polling(1초 간격) → Socket.IO 전환
- 실시간 채팅 모니터링 대시보드

### 3-3. 데이터 기능 확장

- 크리에이터 즐겨찾기/북마크
- 분석 히스토리 저장 및 비교
- 자동 주기적 크롤링 (스케줄러)
- 리포트 PDF 내보내기
- 다국어 지원 (i18n)

### 3-4. API 고도화

- API 버저닝 (`/api/v1/...`)
- 페이지네이션 지원
- 응답 캐싱 (Redis or 메모리)
- Swagger/OpenAPI 문서화

---

## Phase 4: 성능 최적화

### 4-1. 프론트엔드 성능

- React.memo / useMemo 적극 활용 (불필요 리렌더 방지)
- 코드 스플리팅 (React.lazy + Suspense)
  - 대시보드, 관리자 페이지 lazy 로딩
- Recharts 트리쉐이킹 (필요 차트만 import)
- 이미지 최적화 (WebP, lazy loading)
- 번들 분석 및 최적화 (vite-plugin-visualizer)

### 4-2. 서버 성능

- DB 인덱싱 (channel_id, video_id, created_at)
- 쿼리 최적화 (N+1 문제 해결)
- 응답 압축 (gzip/brotli)
- 크롤링 작업 큐 (동시 실행 제한)

### 4-3. 빌드/배포

- 빌드 타임 최적화
- 에셋 CDN 활용
- Service Worker 캐싱 (PWA)

---

## 실행 우선순위 & 예상 작업량

| 순서 | 단계 | 핵심 작업 | 예상 규모 |
|------|------|----------|----------|
| 1 | Phase 1-3 | App.jsx 분리 + 폴더 구조 | 대규모 |
| 2 | Phase 1-2 | React Router 도입 | 중규모 |
| 3 | Phase 1-4 | Zustand 상태 관리 | 중규모 |
| 4 | Phase 2-1 | UI 컴포넌트 정리 | 중규모 |
| 5 | Phase 3-1 | 인증 체계 강화 | 중규모 |
| 6 | Phase 4-1 | 프론트 성능 최적화 | 소규모 |
| 7 | Phase 2-2~3 | 반응형 + 인터랙션 | 중규모 |
| 8 | Phase 1-5 | 서버 모듈화 | 중규모 |
| 9 | Phase 3-2~4 | 기능 확장 | 대규모 |
| 10 | Phase 4-2~3 | 서버/배포 최적화 | 소규모 |

---

## 권장 시작점

**Phase 1-3 (App.jsx 분리)**부터 시작하는 것을 강력히 추천합니다.

이유:
1. 현재 2,737줄 단일 파일은 모든 수정의 병목
2. 분리 후에야 개별 페이지/컴포넌트 단위로 UI 개선 가능
3. React Router, 상태 관리 도입의 전제 조건
4. 기능이 이미 작동하므로 동작 유지하면서 구조만 변경 가능
