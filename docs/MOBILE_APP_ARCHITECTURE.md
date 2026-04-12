# LivedPulse Mobile App - Architecture Design Document

---

## 0. Platform Decision

### Why React Native (Expo)?

| Approach | Pros | Cons | Verdict |
|---|---|---|---|
| **React Native (Expo)** | iOS+Android 동시, React 코드 재사용, OTA 업데이트 | 네이티브 성능 한계 | **채택** |
| PWA | 개발 비용 최소 | 푸시 알림 제한(iOS), 앱스토어 부재 | 백업 플랜 |
| Flutter | 성능 우수 | Dart 학습, 기존 코드 재사용 불가 | 부적합 |
| Native (Swift/Kotlin) | 최고 성능 | 2x 개발 비용, 인력 부족 | 부적합 |

**결정: Expo SDK 52+ (React Native)**
- 기존 React 컴포넌트 로직 70%+ 재사용
- `marketplace-api.js` 서비스 레이어 그대로 사용
- Zustand 스토어 (`useMarketplaceStore.js`) 그대로 사용
- Expo Router (파일 기반 라우팅) = Next.js/Vite 라우팅과 유사

---

## 1. Full Architecture Diagram

```
                          ┌──────────────────────────┐
                          │      App Distribution     │
                          │  App Store / Google Play  │
                          │    + Expo OTA Updates     │
                          └────────────┬─────────────┘
                                       │
                 ┌─────────────────────┼─────────────────────┐
                 │                     │                     │
        ┌────────────────┐   ┌────────────────┐   ┌────────────────┐
        │  iOS App        │   │  Android App    │   │  Web (PWA)     │
        │  (Expo Build)   │   │  (Expo Build)   │   │  (기존 Vite)   │
        └───────┬────────┘   └───────┬────────┘   └───────┬────────┘
                │                     │                     │
                └─────────────────────┼─────────────────────┘
                                      │
                              ┌───────┴───────┐
                              │  Shared Layer  │
                              │  ─────────────│
                              │  API Service   │ ← marketplace-api.js (공유)
                              │  Auth Store    │ ← useAuthStore.js (공유)
                              │  Market Store  │ ← useMarketplaceStore.js (공유)
                              │  Types/Utils   │ ← 공유 유틸리티
                              └───────┬───────┘
                                      │
                              HTTPS (TLS 1.3)
                                      │
                          ┌───────────┴───────────┐
                          │     Cloudflare Edge    │
                          │  WAF + Rate Limit +    │
                          │  Zero Trust + DDoS     │
                          └───────────┬───────────┘
                                      │
                          ┌───────────┴───────────┐
                          │  Fly.io: API Server    │
                          │  Express 5 Backend     │
                          │  ──────────────────    │
                          │  /api/auth/*           │
                          │  /api/marketplace/*    │
                          │  /api/crawl/*          │
                          │  /api/mobile/*  (NEW)  │
                          └───────────┬───────────┘
                                      │
                     ┌────────────────┼────────────────┐
                     │                │                │
              ┌──────┴──────┐  ┌─────┴──────┐  ┌─────┴──────┐
              │   SQLite    │  │  Puppeteer  │  │  AI API    │
              │  (Fly Vol)  │  │  Scrapers   │  │  (Claude)  │
              └─────────────┘  └────────────┘  └────────────┘
```

### Layer Responsibilities

```
┌─────────────────────────────────────────────────────────────┐
│                    MOBILE APP LAYERS                         │
├──────────────┬──────────────────────────────────────────────┤
│  Screens     │  Login, Portfolio, Search, Campaign,         │
│  (UI)        │  Notifications, Profile, Settings            │
├──────────────┼──────────────────────────────────────────────┤
│  Navigation  │  Expo Router (Tab + Stack navigation)        │
│              │  Tab: Home, Search, Campaigns, Profile       │
├──────────────┼──────────────────────────────────────────────┤
│  State       │  Zustand stores (auth, marketplace)          │
│  Management  │  React Query for server cache                │
├──────────────┼──────────────────────────────────────────────┤
│  Services    │  marketplace-api.js (shared with web)        │
│  (API)       │  mobile-api.js (push token, device info)     │
├──────────────┼──────────────────────────────────────────────┤
│  Storage     │  expo-secure-store (tokens)                  │
│  (Local)     │  AsyncStorage (preferences, cache)           │
├──────────────┼──────────────────────────────────────────────┤
│  Platform    │  expo-notifications (push)                   │
│  (Native)    │  expo-image-picker (배너 업로드)              │
│              │  expo-linking (딥링크)                        │
└──────────────┴──────────────────────────────────────────────┘
```

---

## 2. API Specification (RESTful)

### 2.1 Existing Endpoints (Mobile Reuse)

모바일 앱은 기존 웹 API를 그대로 사용합니다. 추가 엔드포인트는 최소화.

```
Base URL: https://api.livedpulse.com/api

── AUTH ────────────────────────────────────────────────
POST   /auth/register          회원가입
POST   /auth/login             로그인
POST   /auth/refresh           토큰 갱신
POST   /auth/logout            로그아웃
GET    /auth/me                내 정보

── MARKETPLACE: PORTFOLIO ──────────────────────────────
GET    /marketplace/portfolio                크리에이터 목록 (공개)
GET    /marketplace/portfolio/:id            포트폴리오 상세 (공개)
PUT    /marketplace/portfolio/:id/metrics    지표 업데이트 (시스템)
PUT    /marketplace/portfolio/:id/visibility 공개 설정 변경

── MARKETPLACE: PROFILE ────────────────────────────────
POST   /marketplace/profile/creator          크리에이터 프로필 생성/수정
POST   /marketplace/profile/advertiser       광고주 프로필 생성/수정
GET    /marketplace/profile/me               내 프로필 조회

── MARKETPLACE: SEARCH ─────────────────────────────────
GET    /marketplace/search/creators          Smart Search
GET    /marketplace/search/categories        카테고리 목록
GET    /marketplace/search/similar/:id       유사 크리에이터

── MARKETPLACE: CAMPAIGNS ──────────────────────────────
GET    /marketplace/campaigns                캠페인 목록
POST   /marketplace/campaigns                캠페인 생성
GET    /marketplace/campaigns/:id            캠페인 상세
PUT    /marketplace/campaigns/:id/state      상태 전이
POST   /marketplace/campaigns/:id/match      크리에이터 매칭
PUT    /marketplace/campaigns/:cid/match/:mid 매칭 상태 변경
POST   /marketplace/campaigns/:id/messages   메시지 발송

── MARKETPLACE: SIMULATION ─────────────────────────────
GET    /marketplace/simulation/creator/:id   단일 ROI 시뮬레이션
POST   /marketplace/simulation/batch         배치 ROI 시뮬레이션

── MARKETPLACE: NOTIFICATIONS ──────────────────────────
GET    /marketplace/notifications             알림 목록
PUT    /marketplace/notifications/:id/read    읽음 처리
```

### 2.2 New Mobile-Only Endpoints

```
── MOBILE SPECIFIC (NEW) ──────────────────────────────

POST   /api/mobile/device
       Body: { platform, push_token, device_id, app_version, os_version }
       Desc: 디바이스 등록 + 푸시 토큰 저장
       Auth: Required
       Response: { ok: true, device_id }

DELETE /api/mobile/device/:device_id
       Desc: 디바이스 등록 해제 (로그아웃 시)
       Auth: Required

PUT    /api/mobile/device/push-token
       Body: { device_id, push_token }
       Desc: 푸시 토큰 갱신 (토큰 만료 시)
       Auth: Required

GET    /api/mobile/feed
       Query: ?page=1&limit=20
       Desc: 모바일 홈 피드 (추천 크리에이터 + 신규 캠페인 + 알림 통합)
       Auth: Required
       Response: {
         featured_creators: [...],
         new_campaigns: [...],
         recent_notifications: [...],
         stats: { total_creators, active_campaigns }
       }

POST   /api/mobile/upload/image
       Body: multipart/form-data (image file)
       Desc: 이미지 업로드 (배너, 프로필 사진)
       Auth: Required
       Response: { url, thumbnail_url }
```

### 2.3 API Response Envelope

모든 API 응답은 통일된 형식:

```json
// Success
{
  "ok": true,
  "data": { ... },
  "pagination": { "page": 1, "limit": 20, "total": 150, "totalPages": 8 }
}

// Error
{
  "ok": false,
  "error": "에러 메시지",
  "code": "ERROR_CODE",
  "details": { ... }
}
```

### 2.4 Authentication Flow (Mobile)

```
┌─────────┐                              ┌──────────┐
│  Mobile  │                              │  Server  │
│   App    │                              │          │
└────┬─────┘                              └────┬─────┘
     │  POST /auth/login                       │
     │  { email, password }                    │
     ├────────────────────────────────────────>│
     │                                         │
     │  { accessToken, refreshToken, user }    │
     │<────────────────────────────────────────┤
     │                                         │
     │  ┌─────────────────────────────┐        │
     │  │ Store in expo-secure-store  │        │
     │  │ accessToken → SecureStore   │        │
     │  │ refreshToken → SecureStore  │        │
     │  │ user → Zustand + AsyncStore │        │
     │  └─────────────────────────────┘        │
     │                                         │
     │  POST /mobile/device                    │
     │  { push_token, device_id, ... }         │
     ├────────────────────────────────────────>│
     │                                         │
     │  ── API Call (with accessToken) ──      │
     │  Authorization: Bearer <accessToken>    │
     ├────────────────────────────────────────>│
     │                                         │
     │  ── Token Expired (401) ──              │
     │<────────────────────────────────────────┤
     │                                         │
     │  POST /auth/refresh                     │
     │  { refreshToken }                       │
     ├────────────────────────────────────────>│
     │                                         │
     │  { newAccessToken, newRefreshToken }    │
     │<────────────────────────────────────────┤
     │                                         │
     │  Retry original request                 │
     ├────────────────────────────────────────>│
```

---

## 3. Database Design

### 3.1 Existing Tables (No Change)

기존 테이블은 변경 없음. 전체 목록:

```
Core:       users, refresh_tokens, password_reset_tokens, usage_logs
Analytics:  crawl_jobs, channels, videos, transcripts, chat_messages, comments, featured_cache
Market:     creator_profiles, advertiser_profiles, campaigns, campaign_creators,
            banner_verifications, verification_reports, campaign_messages, notifications
```

### 3.2 New Tables (Mobile Support)

```sql
-- ═══ 모바일 디바이스 관리 ═══

CREATE TABLE IF NOT EXISTS mobile_devices (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,              -- 디바이스 고유 ID (expo-device)
    platform TEXT NOT NULL,               -- 'ios' | 'android'
    push_token TEXT,                      -- Expo Push Token
    app_version TEXT DEFAULT '',
    os_version TEXT DEFAULT '',
    model TEXT DEFAULT '',
    last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_mobile_devices_user ON mobile_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_mobile_devices_push ON mobile_devices(push_token);

-- ═══ 푸시 알림 발송 로그 ═══

CREATE TABLE IF NOT EXISTS push_logs (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    device_id TEXT,
    notification_id TEXT REFERENCES notifications(id),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data_json TEXT DEFAULT '{}',
    status TEXT DEFAULT 'pending',        -- 'pending' | 'sent' | 'failed' | 'received'
    expo_receipt_id TEXT,
    error_message TEXT,
    sent_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_push_logs_user ON push_logs(user_id, created_at);

-- ═══ 앱 설정 (유저별) ═══

CREATE TABLE IF NOT EXISTS user_preferences (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    push_campaigns INTEGER DEFAULT 1,     -- 캠페인 알림 ON/OFF
    push_messages INTEGER DEFAULT 1,      -- 메시지 알림
    push_system INTEGER DEFAULT 1,        -- 시스템 알림
    language TEXT DEFAULT 'ko',
    theme TEXT DEFAULT 'dark',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 3.3 ERD Summary (Mobile 추가분)

```
users 1──* mobile_devices      (한 유저가 여러 디바이스)
users 1──1 user_preferences    (유저별 설정)
users 1──* push_logs           (푸시 발송 기록)
notifications 1──* push_logs   (알림당 다수 디바이스 발송)
```

---

## 4. Key Component Designs

### 4.1 Project Structure (Expo Router)

```
mobile/
├── app/                          # Expo Router (파일 기반 라우팅)
│   ├── _layout.tsx               # Root layout (auth check, theme)
│   ├── index.tsx                 # Splash -> redirect
│   ├── (auth)/                   # Auth group (비로그인)
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── (tabs)/                   # Tab navigation (로그인 후)
│   │   ├── _layout.tsx           # Tab bar config
│   │   ├── index.tsx             # Home (Feed)
│   │   ├── search.tsx            # Smart Search
│   │   ├── campaigns.tsx         # Campaigns
│   │   └── profile.tsx           # My Profile
│   ├── portfolio/[id].tsx        # Portfolio detail (stack)
│   ├── campaign/[id].tsx         # Campaign detail (stack)
│   └── settings.tsx              # Settings
├── components/
│   ├── ui/                       # Shared UI primitives
│   │   ├── GlassCard.tsx
│   │   ├── Badge.tsx
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   └── Modal.tsx
│   ├── marketplace/              # Marketplace components
│   │   ├── CreatorCard.tsx
│   │   ├── CampaignCard.tsx
│   │   ├── StateBadge.tsx
│   │   ├── VerifiedBadge.tsx
│   │   └── MetricBox.tsx
│   └── layout/
│       └── SafeArea.tsx
├── services/                     # API layer (웹과 공유)
│   ├── api-client.ts             # fetch wrapper + token refresh
│   ├── marketplace-api.ts        # 기존 marketplace-api.js 포팅
│   └── mobile-api.ts             # 모바일 전용 API
├── store/                        # Zustand (웹과 공유)
│   ├── useAuthStore.ts
│   └── useMarketplaceStore.ts
├── hooks/
│   ├── useNotifications.ts       # Push notification setup
│   └── useRefreshToken.ts        # Auto token refresh
├── constants/
│   ├── colors.ts                 # 웹 index.css 테마 → RN 컬러
│   └── layout.ts
├── app.json                      # Expo config
├── package.json
└── tsconfig.json
```

### 4.2 Login Component

```tsx
// mobile/app/(auth)/login.tsx

import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView,
         Platform, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { Sparkles } from 'lucide-react-native';
import useAuthStore from '../../store/useAuthStore';
import { colors } from '../../constants/colors';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore(s => s.login);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('입력 오류', '이메일과 비밀번호를 입력해주세요');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace('/(tabs)');
    } catch (e) {
      Alert.alert('로그인 실패', e.message || '이메일 또는 비밀번호를 확인해주세요');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: colors.dark900 }}
    >
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }}>
        {/* Logo */}
        <View style={{ alignItems: 'center', marginBottom: 48 }}>
          <View style={{
            width: 56, height: 56, borderRadius: 16,
            backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
            marginBottom: 12
          }}>
            <Sparkles size={28} color="#fff" />
          </View>
          <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800' }}>LivePulse</Text>
          <Text style={{ color: colors.slate500, fontSize: 12, marginTop: 4 }}>
            크리에이터 마켓플레이스
          </Text>
        </View>

        {/* Form */}
        <View style={{
          backgroundColor: colors.dark800, borderRadius: 20,
          borderWidth: 1, borderColor: colors.dark600 + '80',
          padding: 24
        }}>
          <Text style={{ color: colors.slate500, fontSize: 11, marginBottom: 6,
                         textTransform: 'uppercase', letterSpacing: 1 }}>
            이메일
          </Text>
          <TextInput
            value={email} onChangeText={setEmail}
            placeholder="email@example.com"
            placeholderTextColor={colors.slate600}
            keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
            style={{
              backgroundColor: colors.dark700, borderRadius: 12,
              borderWidth: 1, borderColor: colors.dark600 + '80',
              paddingHorizontal: 16, paddingVertical: 14,
              color: '#fff', fontSize: 14, marginBottom: 16
            }}
          />

          <Text style={{ color: colors.slate500, fontSize: 11, marginBottom: 6,
                         textTransform: 'uppercase', letterSpacing: 1 }}>
            비밀번호
          </Text>
          <TextInput
            value={password} onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.slate600}
            secureTextEntry
            style={{
              backgroundColor: colors.dark700, borderRadius: 12,
              borderWidth: 1, borderColor: colors.dark600 + '80',
              paddingHorizontal: 16, paddingVertical: 14,
              color: '#fff', fontSize: 14, marginBottom: 24
            }}
          />

          <TouchableOpacity
            onPress={handleLogin} disabled={loading}
            style={{
              backgroundColor: colors.accent, borderRadius: 12,
              paddingVertical: 16, alignItems: 'center',
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>
                로그인
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Register link */}
        <TouchableOpacity
          onPress={() => router.push('/(auth)/register')}
          style={{ alignItems: 'center', marginTop: 20 }}
        >
          <Text style={{ color: colors.slate500, fontSize: 13 }}>
            계정이 없으신가요?{' '}
            <Text style={{ color: colors.accentLight, fontWeight: '600' }}>회원가입</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
```

### 4.3 Dashboard (Home Feed) Component

```tsx
// mobile/app/(tabs)/index.tsx

import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, FlatList } from 'react-native';
import { router } from 'expo-router';
import { Sparkles, Search, Bell, TrendingUp, Megaphone } from 'lucide-react-native';
import useAuthStore from '../../store/useAuthStore';
import { getPortfolioList, getCampaigns, getNotifications } from '../../services/marketplace-api';
import { CreatorCard } from '../../components/marketplace/CreatorCard';
import { CampaignCard } from '../../components/marketplace/CampaignCard';
import { colors } from '../../constants/colors';

export default function HomeScreen() {
  const user = useAuthStore(s => s.user);
  const [refreshing, setRefreshing] = useState(false);
  const [creators, setCreators] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [creatorData, campaignData, notifData] = await Promise.allSettled([
        getPortfolioList(1, 10),
        getCampaigns({ page: 1, limit: 5 }),
        getNotifications(5),
      ]);
      if (creatorData.status === 'fulfilled') setCreators(creatorData.value.creators || []);
      if (campaignData.status === 'fulfilled') setCampaigns(campaignData.value.campaigns || []);
      if (notifData.status === 'fulfilled') setUnread(notifData.value.unreadCount || 0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, []);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  // ── Section Header ──
  const SectionHeader = ({ icon: Icon, title, action, onAction }) => (
    <View style={{
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, marginTop: 28, marginBottom: 12
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon size={16} color={colors.accentLight} />
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{title}</Text>
      </View>
      {action && (
        <TouchableOpacity onPress={onAction}>
          <Text style={{ color: colors.accentLight, fontSize: 12, fontWeight: '600' }}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.dark900 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh}
        tintColor={colors.accentLight} />}
    >
      {/* Header */}
      <View style={{
        paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <View>
          <Text style={{ color: colors.slate500, fontSize: 12 }}>
            안녕하세요, {user?.name || '사용자'}님
          </Text>
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 2 }}>
            LivePulse
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/notifications')}
          style={{ position: 'relative', padding: 8 }}
        >
          <Bell size={22} color={colors.slate400} />
          {unread > 0 && (
            <View style={{
              position: 'absolute', top: 4, right: 4,
              width: 16, height: 16, borderRadius: 8,
              backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center'
            }}>
              <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>
                {unread > 9 ? '9+' : unread}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Quick Actions */}
      <View style={{
        flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 8
      }}>
        {[
          { icon: Search, label: '크리에이터 검색', route: '/(tabs)/search', color: colors.accent },
          { icon: Megaphone, label: '캠페인 만들기', route: '/(tabs)/campaigns', color: '#8b5cf6' },
        ].map(item => (
          <TouchableOpacity
            key={item.label}
            onPress={() => router.push(item.route)}
            style={{
              flex: 1, backgroundColor: item.color + '15',
              borderRadius: 16, padding: 16,
              borderWidth: 1, borderColor: item.color + '30'
            }}
          >
            <item.icon size={20} color={item.color} />
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600', marginTop: 8 }}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Featured Creators */}
      <SectionHeader
        icon={TrendingUp} title="추천 크리에이터"
        action="전체보기" onAction={() => router.push('/(tabs)/search')}
      />
      <FlatList
        data={creators.slice(0, 10)}
        horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <CreatorCard
            creator={item} compact
            onPress={() => router.push(`/portfolio/${item.id}`)}
          />
        )}
      />

      {/* Recent Campaigns */}
      {campaigns.length > 0 && (
        <>
          <SectionHeader
            icon={Megaphone} title="최근 캠페인"
            action="전체보기" onAction={() => router.push('/(tabs)/campaigns')}
          />
          <View style={{ paddingHorizontal: 20, gap: 8 }}>
            {campaigns.slice(0, 3).map(c => (
              <CampaignCard
                key={c.id} campaign={c}
                onPress={() => router.push(`/campaign/${c.id}`)}
              />
            ))}
          </View>
        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}
```

### 4.4 Color Constants (Web -> Mobile)

```ts
// mobile/constants/colors.ts
// index.css 의 CSS custom properties -> React Native 컬러

export const colors = {
  // Dark palette
  dark900: '#0a0e1a',
  dark800: '#111827',
  dark700: '#1a2035',
  dark600: '#243049',
  dark500: '#374766',

  // Accent
  accent: '#6366f1',
  accentLight: '#818cf8',
  accentDim: '#4f46e5',

  // Semantic
  positive: '#22c55e',
  negative: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',

  // Slate scale
  slate300: '#cbd5e1',
  slate400: '#94a3b8',
  slate500: '#64748b',
  slate600: '#475569',

  // Glass panel equivalent
  glassBg: 'rgba(17,24,39,0.9)',
  glassBorder: 'rgba(55,71,102,0.5)',
} as const;
```

---

## 5. Security Architecture

### 5.1 Security Layer Diagram

```
┌──────────────────────────────────────────────────────────┐
│                     MOBILE APP                            │
│                                                          │
│  ┌─────────────────┐  ┌──────────────────────────────┐  │
│  │  expo-secure-    │  │  Certificate Pinning         │  │
│  │  store           │  │  (API domain SSL pin)        │  │
│  │  ─────────────   │  └──────────────────────────────┘  │
│  │  accessToken     │                                    │
│  │  refreshToken    │  ┌──────────────────────────────┐  │
│  │  (encrypted by   │  │  Biometric Auth (optional)   │  │
│  │   OS keychain)   │  │  expo-local-authentication   │  │
│  └─────────────────┘  └──────────────────────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │  Input Validation Layer                           │    │
│  │  - Email format check                             │    │
│  │  - Password strength (8+ chars)                   │    │
│  │  - XSS prevention (no HTML in inputs)             │    │
│  │  - SQL injection N/A (API handles parameterized)  │    │
│  └──────────────────────────────────────────────────┘    │
└───────────────────────────┬──────────────────────────────┘
                            │ HTTPS (TLS 1.3)
                            │ Certificate Pinning
                            │
┌───────────────────────────┴──────────────────────────────┐
│                    CLOUDFLARE EDGE                        │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌────────┐ │
│  │   WAF    │  │  Rate    │  │  DDoS     │  │ Bot    │ │
│  │  OWASP   │  │  Limit   │  │  Shield   │  │ Fight  │ │
│  │  Rules   │  │  /api/*  │  │  L3/L4/L7 │  │        │ │
│  └──────────┘  └──────────┘  └───────────┘  └────────┘ │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │  Cloudflare Access (Zero Trust)                   │    │
│  │  - /admin/* → Admin email OTP                     │    │
│  │  - /api/admin/* → Service Token                   │    │
│  └──────────────────────────────────────────────────┘    │
└───────────────────────────┬──────────────────────────────┘
                            │
┌───────────────────────────┴──────────────────────────────┐
│                    EXPRESS 5 SERVER                        │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │  Middleware Stack                                  │    │
│  │  1. helmet() - Security headers                   │    │
│  │  2. cors() - Origin whitelist                     │    │
│  │  3. express-rate-limit - Per-endpoint limits       │    │
│  │  4. requireAuth() - JWT verification              │    │
│  │  5. requireRole() - RBAC enforcement              │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │  JWT Configuration                                │    │
│  │  - Access Token: 15 min expiry                    │    │
│  │  - Refresh Token: 7 days, rotation on use         │    │
│  │  - Max 5 refresh tokens per user                  │    │
│  │  - bcrypt 12 rounds for passwords                 │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │  Data Encryption                                  │    │
│  │  - OAuth tokens: AES-256-GCM at rest              │    │
│  │  - Passwords: bcrypt (12 rounds)                  │    │
│  │  - Transport: HTTPS only (force_https: true)      │    │
│  │  - SQLite: WAL mode (integrity)                   │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │  Rate Limits (per IP, sliding window)             │    │
│  │  - /api/auth/*     : 20 req / 15 min             │    │
│  │  - /api/*          : 200 req / 15 min            │    │
│  │  - /api/crawl/*    : 30 req / 1 hour             │    │
│  │  - /api/mobile/*   : 100 req / 15 min (NEW)      │    │
│  └──────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

### 5.2 Mobile-Specific Security Checklist

| Item | Implementation | Priority |
|---|---|---|
| Token Storage | `expo-secure-store` (OS keychain) | P0 |
| No plaintext secrets | `.env` via `expo-constants`, not bundled | P0 |
| Certificate Pinning | Custom fetch config with SSL pin | P1 |
| Biometric unlock | `expo-local-authentication` for re-auth | P2 |
| Jailbreak detection | `expo-device` check on launch | P2 |
| Screenshot prevention | `FLAG_SECURE` (Android), screen capture prevention | P2 |
| Deep link validation | Validate all deep link params before navigation | P1 |
| Push token rotation | Re-register on app foreground resume | P1 |
| Session timeout | Auto-logout after 30 days inactive | P1 |
| Min app version | Server rejects outdated app versions via header | P1 |

### 5.3 App Version Enforcement

```
Mobile App sends header:
  X-App-Version: 1.0.0
  X-Platform: ios

Server middleware checks:
  if (req.headers['x-app-version'] < MIN_SUPPORTED_VERSION) {
    return res.status(426).json({
      error: '앱을 업데이트해주세요',
      code: 'APP_UPDATE_REQUIRED',
      store_url: 'https://apps.apple.com/...'
    });
  }
```

---

## 6. Implementation Roadmap

### Phase 1 (Week 1-4): Foundation
- [ ] Expo project 초기화 (TypeScript, Expo Router)
- [ ] 컬러/테마 시스템 (`colors.ts`)
- [ ] API client + token refresh 로직
- [ ] Auth 화면 (Login, Register)
- [ ] Tab navigation 구조

### Phase 2 (Week 5-8): Core Features
- [ ] Home Feed 화면
- [ ] Portfolio List + Detail 화면
- [ ] Smart Search 화면
- [ ] Campaign List + Detail 화면

### Phase 3 (Week 9-12): Mobile Native
- [ ] Push Notifications (expo-notifications)
- [ ] 모바일 전용 API 엔드포인트 (server/mobile/)
- [ ] 이미지 업로드 (배너, 프로필)
- [ ] Deep linking

### Phase 4 (Week 13-16): Polish + Launch
- [ ] 오프라인 캐시 (React Query persistence)
- [ ] 앱스토어 심사 준비
- [ ] TestFlight / Google Play 내부 테스트
- [ ] 성능 최적화 (FlashList, 이미지 캐시)
