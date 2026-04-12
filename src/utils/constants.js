import {
  Crosshair, Swords, Gem, Package, ShoppingCart, Star, Gamepad2, Users, Settings, MessageCircle, Activity
} from 'lucide-react';

// 게임 키워드 사전 (일반 모바일 게임 대응)
export const GAME_CATS = {
  '강화·제련': ['강화','영혼부여','영혼','제련','카드강화','인챈트','슬롯','깨짐','파괴','안전강화','축복','미라클'],
  '세팅·빌드': ['승급','전직','스킬','스탯','세팅','장비','룬','카드','덱','빌드','전투력','특성','초월','각성'],
  '거래·시세': ['거래소','시세','가격','매매','거래','경매','물가','폭락','폭등','수수료'],
  '길드': ['길드','공성','영지전','GVG','길드전','점령','방어','공격'],
  '보스·레이드': ['보스','레이드','MVP','네임드','토벌','원정','주간보스'],
  '업데이트': ['업데이트','패치','신규','이벤트','보상','쿠폰','개편','변경','신캐','신장비'],
  'PVP': ['대전','아레나','PVP','콜로세움','전장','랭킹'],
  '콘텐츠': ['퀘스트','탐험','도감','수집','제작','펫','탈것','코스튬','가챠','뽑기'],
};

export const NEGATIVE_KW = {
  '확률 불만': ['확률','사기','조작','깡','날렸','깨짐','파괴','환불'],
  '밸런스 불만': ['밸런스','너프','하향','불공정','편향','사기캐'],
  '시스템 이슈': ['렉','팅김','버그','오류','튕김','서버불안','점검','먹통'],
  '과금 불만': ['현질','과금','페이투윈','돈겜','뽑기','가챠','바가지'],
  '운영 불만': ['운영','소통','무시','대응','보상부족','소통부재'],
};

export const ACTIVITY_CATS = {
  '보스/레이드': ['보스', '레이드', 'MVP', '네임드', '토벌', '원정', '주간보스', '보스전', '클리어', '파밍'],
  'PVP/대전': ['PVP', 'pvp', '대전', '아레나', '콜로세움', '전장', '결투', '결투장', '랭킹전', '공성'],
  '강화/제련': ['강화', '제련', '인챈트', '영혼부여', '슬롯', '깨짐', '파괴', '안전강화', '축복', '성공', '실패', '터짐', '꽝'],
  '업데이트/패치': ['업데이트', '패치', '패치노트', '신규', '변경', '개편', '리뉴얼', '시즌', '신캐'],
  '거래/경제': ['거래소', '시세', '가격', '매매', '경매', '물가', '수수료', '골드', '다이아'],
  '가챠/뽑기': ['뽑기', '가챠', '소환', '픽업', '천장', '확률', '당첨', '꽝', 'SSR', 'UR'],
  '스토리/퀘스트': ['퀘스트', '스토리', '메인', '서브', '에피소드', '시나리오', '컷신'],
  '길드/소셜': ['길드', '클랜', '공성전', '영지전', 'GVG', '파티', '던전'],
  '세팅/빌드': ['세팅', '빌드', '스킬', '스탯', '장비', '룬', '카드', '특성', '초월', '각성'],
  '소통/잡담': ['소통', '질문', '답변', '잡담', '리뷰', '토크', '상담'],
};

export const ACTIVITY_ICONS = {
  '보스/레이드': Crosshair,
  'PVP/대전': Swords,
  '강화/제련': Gem,
  '업데이트/패치': Package,
  '거래/경제': ShoppingCart,
  '가챠/뽑기': Star,
  '스토리/퀘스트': Gamepad2,
  '길드/소셜': Users,
  '세팅/빌드': Settings,
  '소통/잡담': MessageCircle,
};

export const ACTIVITY_COLORS = {
  '보스/레이드': '#ef4444',
  'PVP/대전': '#f97316',
  '강화/제련': '#eab308',
  '업데이트/패치': '#22c55e',
  '거래/경제': '#14b8a6',
  '가챠/뽑기': '#a855f7',
  '스토리/퀘스트': '#3b82f6',
  '길드/소셜': '#6366f1',
  '세팅/빌드': '#8b5cf6',
  '소통/잡담': '#ec4899',
};

export const POSITIVE_WORDS = ['ㅋㅋ', 'ㄱㄱ', '와', '대박', '갓', '미쳤', '레전드', '역대급', 'ㅎㅎ', '좋다', '최고', '짱', '굿', 'GG', 'gg', '클리어', '성공', '축하', '기대', '재밌', '개꿀', '존잼', '쩐다', 'ㄷㄷ', '오오'];

export const NEGATIVE_SENTIMENT_WORDS = ['ㅡㅡ', 'ㅠㅠ', 'ㅜㅜ', '아쉽', '에이', '왜', '렉', '버그', '망', '답없', '노잼', '별로', '실망', '환불', '사기', '폭망', '짜증', '화남', '쓰레기', '최악'];

export const PROFANITY_WORDS = ['시발', 'ㅅㅂ', '병신', 'ㅄ', '개새', 'ㅗ', '존나', 'ㅈㄴ'];

// ★ 건의사항 키워드: 게임/콘텐츠 관련만 포함. 개인 소통 요청("캠켜줘", "디코 들어와줘") 제외
export const SUGGESTION_WORDS = ['건의', '요청', '제안', '고쳐', '추가해', '개선', '불편', '문제점', '아쉬운', '아쉽', '필요', '만들어', '넣어', '수정', '패치해', '버그', '오류', '밸런스'];

// ★ 개인 소통 키워드 (게임과 무관한 스트리머-시청자 소통)
export const PERSONAL_CHAT_WORDS = [
  '디코', '디스코드', '인스타', '트위터', '캠', '마이크', '화면', '음량',
  '노래', '틀어', '브금', '구독', '팔로우', '좋아요', '알림', '벨',
  '몇살', '나이', '얼굴', '실물', '목소리', '잘생', '예쁘', '귀여',
  '커플', '여친', '남친', '생일', '인사', '안녕', '하이', '바이',
  '식사', '밥', '간식', '치킨', '피자', '야식', '커피',
  '잠', '피곤', '쉬어', '자러', '출근', '퇴근', '학교',
  '카톡', '번호', 'SNS', '페북', '유튜브', '쇼츠',
  '웃겨', '레알', 'ㄹㅇ', 'ㅎㅇ', 'ㅂㅂ',
];

// ── 봇/Nightbot 필터링 ──
export const BOT_NAMES = [
  'nightbot', 'streamelements', 'streamlabs', 'moobot', 'fossabot',
  'wizebot', 'phantombot', 'serybot', '나이트봇', '스트림엘리먼트',
];
export const BOT_PREFIXES = ['!', '/', '$']; // 명령어 프리픽스
export const BOT_PATTERNS = [
  /^![\w]+/,                              // !명령어
  /has subscribed/i,                      // 구독 알림
  /just subscribed/i,
  /님이 후원/,                              // 후원 알림
  /님이 구독/,                              // 구독 알림
  /팔로우.*감사/,                            // 팔로우 감사 메시지
  /https?:\/\/\S+/,                       // 링크만 있는 메시지
  /^@\w+\s*$/,                            // @멘션만 있는 메시지
];

// 채팅 라인이 봇/노이즈인지 판단
export function isBotMessage(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 2) return true;

  const lower = trimmed.toLowerCase();

  // 봇 이름 체크 (라인에 "Nightbot:" 등 포함)
  if (BOT_NAMES.some(bot => lower.startsWith(bot + ':') || lower.startsWith(bot + ' '))) return true;

  // 명령어 프리픽스
  if (BOT_PREFIXES.some(p => trimmed.startsWith(p))) return true;

  // 패턴 매칭
  if (BOT_PATTERNS.some(p => p.test(trimmed))) return true;

  return false;
}

// ★ 개인 소통인지 판단
export function isPersonalChat(line) {
  const lower = line.toLowerCase();
  return PERSONAL_CHAT_WORDS.some(w => lower.includes(w));
}

// ★ 게임 키워드가 명시적으로 포함된 채팅 (정밀 매칭)
export function hasExplicitGameKeyword(line) {
  const lower = line.toLowerCase();
  const gameActivityCats = Object.entries(ACTIVITY_CATS)
    .filter(([name]) => name !== '소통/잡담')
    .map(([, words]) => words)
    .flat();
  const allGameWords = [
    ...Object.values(GAME_CATS).flat(),
    ...gameActivityCats,
    ...Object.values(NEGATIVE_KW).flat(),
  ];
  return allGameWords.some(w => lower.includes(w.toLowerCase()));
}

// ★ 게임 관련 채팅인지 판단 (역발상: 개인 소통/잡담이 아니면 게임 맥락으로 간주)
// 게임 방송 채팅에서 "ㅋㅋㅋ", "대박", "ㄷㄷ" 등은 게임 반응임
export function isGameRelatedChat(line) {
  if (isPersonalChat(line)) return false;
  // 봇 메시지도 제외
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 2) return false;
  // 명시적 게임 키워드가 있으면 확실히 게임 관련
  if (hasExplicitGameKeyword(line)) return true;
  // 감정 표현/리액션은 게임 맥락으로 간주 (게임 방송 중 나온 반응이므로)
  const lower = line.toLowerCase();
  const reactionWords = ['ㅋㅋ', 'ㄷㄷ', 'ㅎㅎ', 'ㅠㅠ', 'ㅜㅜ', '와', '오오', '대박', '미쳤', '레전드', 'gg', 'ㄱㄱ', '가즈아', '갑시다', '축하', '짱', '굿', '최고'];
  if (reactionWords.some(w => lower.includes(w))) return true;
  // 2글자 이상이고 개인 소통이 아니면 게임 맥락
  return trimmed.length >= 3;
}

export const WORKFLOW_STEPS = [
  { label: '링크 입력', iconName: 'Globe' },
  { label: '데이터 수집', iconName: 'Database' },
  { label: 'AI 분석', iconName: 'Sparkles' },
  { label: '검토', iconName: 'Eye' },
  { label: '리포트 추출', iconName: 'FileSpreadsheet' },
];

export const CENTER_TABS = [
  { id: 'overview', label: '시청 지표', iconName: 'BarChart3' },
  { id: 'creator', label: '크리에이터 진단', iconName: 'Users' },
  { id: 'sentiment', label: '감성 분석', iconName: 'Activity' },
  { id: 'timeline', label: '타임라인', iconName: 'Clock' },
  { id: 'report', label: '엑셀 리포트', iconName: 'FileSpreadsheet' },
  { id: 'qa', label: 'QA 트래커', iconName: 'Bug' },
];
