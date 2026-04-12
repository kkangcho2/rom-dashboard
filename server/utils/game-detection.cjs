const axios = require('axios');
const { ytApiGet } = require('./google-auth.cjs');

// ─── Comprehensive Game Keywords ──────────────────────────────
// Maps keyword patterns (lowercase, spaces stripped) to canonical game name.
// Order matters: longer / more specific patterns first to avoid false positives.
const GAME_KEYWORDS = [
  // --- Lineage franchise (order: most specific first) ---
  { patterns: ['리니지클래식', '리니지 클래식', '린클', 'lineageclassic', 'lineage classic'], game: '리니지클래식' },
  { patterns: ['리니지2m', '리니지ii모바일', 'lineage2m'], game: '리니지2M' },
  { patterns: ['리니지w', 'lineagew'], game: '리니지W' },
  { patterns: ['리니지m', 'lineagem'], game: '리니지M' },
  // bare "리니지" without qualifier - only match if none of the above matched
  { patterns: ['리니지'], game: '리니지M' },

  // --- Major Korean mobile MMORPGs ---
  { patterns: ['로드나인', 'lord nine', 'lordnine', 'lord9'], game: '로드나인' },
  { patterns: ['레이븐2', 'raven2', 'raven 2', '레이븐 2'], game: '레이븐2' },
  { patterns: ['rf온라인', 'rf online', 'rfonline', 'rf 온라인'], game: 'RF온라인' },
  { patterns: ['히트2', 'hit2', 'hit 2'], game: '히트2' },
  { patterns: ['뮤오리진3', '뮤 오리진3', '뮤 오리진 3', 'mu origin 3', 'muorigin3'], game: '뮤 오리진3' },
  { patterns: ['뮤오리진2', '뮤 오리진2', '뮤 오리진 2', 'mu origin 2', 'muorigin2'], game: '뮤 오리진2' },
  { patterns: ['뮤오리진', '뮤 오리진', 'mu origin', 'muorigin'], game: '뮤 오리진' },
  { patterns: ['미르m', 'mirm', 'mir m', '미르 m'], game: '미르M' },
  { patterns: ['미르4', 'mir4', 'mir 4'], game: 'MIR4' },
  { patterns: ['미르2', 'mir2'], game: '미르2' },
  { patterns: ['아키텍트', 'architect'], game: '아키텍트' },
  { patterns: ['나이트크로우', 'night crow', 'nightcrow', 'night crows'], game: '나이트크로우' },
  { patterns: ['블소neo', '블소 neo', 'bns neo', '블레이드앤소울neo'], game: '블소 NEO' },
  { patterns: ['블레이드앤소울', '블소', 'blade and soul', 'blade&soul'], game: '블소 NEO' },

  // --- MMORPG / RPG ---
  { patterns: ['아이온2', 'aion2', 'aion 2'], game: '아이온2' },
  { patterns: ['오딘', '발할라라이징', 'odin', 'valhalla rising'], game: '오딘' },
  { patterns: ['검은사막 모바일', '검은사막m', 'black desert mobile'], game: '검은사막 모바일' },
  { patterns: ['검은사막', 'black desert', 'blackdesert'], game: '검은사막 모바일' },
  { patterns: ['마비노기 모바일', '마비노기모바일', 'mabinogi mobile'], game: '마비노기 모바일' },
  { patterns: ['마비노기'], game: '마비노기 모바일' },
  { patterns: ['조선협객전', '조선 협객전'], game: '조선협객전' },
  { patterns: ['로스트아크', 'lost ark', 'lostark'], game: '로스트아크' },
  { patterns: ['메이플스토리m', '메이플m', 'maplestory m'], game: '메이플스토리M' },
  { patterns: ['메이플 키우기', '메이플키우기'], game: '메이플 키우기' },
  { patterns: ['메이플스토리', '메이플', 'maplestory'], game: '메이플스토리' },
  { patterns: ['세븐나이츠 리버스', '세나 리버스', '세븐나이츠리버스'], game: '세븐나이츠 리버스' },
  { patterns: ['세븐나이츠', '세나'], game: '세븐나이츠 리버스' },
  { patterns: ['스톤에이지 키우기', '스톤에이지키우기'], game: '스톤에이지 키우기' },
  { patterns: ['스톤에이지'], game: '스톤에이지 키우기' },
  { patterns: ['창세기전 키우기', '창세기전키우기'], game: '창세기전 키우기' },
  { patterns: ['창세기전'], game: '창세기전 키우기' },
  { patterns: ['일곱개의대죄', '일곱 개의 대죄', '7대죄', 'seven deadly sins'], game: '일곱 개의 대죄' },
  { patterns: ['뱀피르', 'vampyr'], game: '뱀피르' },
  { patterns: ['그랑사가', 'gran saga'], game: '그랑사가' },
  { patterns: ['기적의검', '기적의 검'], game: '기적의검' },
  { patterns: ['카이저', 'kaiser'], game: '카이저' },
  { patterns: ['천애명월도m', '천애명월도 m', '천명m'], game: '천애명월도M' },
  { patterns: ['천애명월도', '천명'], game: '천애명월도' },
  { patterns: ['v4'], game: 'V4' },
  { patterns: ['이카루스m', '이카루스 m'], game: '이카루스M' },
  { patterns: ['아르카', 'arca'], game: '아르카' },
  { patterns: ['라그나로크', 'ragnarok'], game: '라그나로크' },
  { patterns: ['뮤탈리스크', 'mutalisk'], game: '뮤탈리스크' },

  // --- Gacha / RPG ---
  { patterns: ['승리의여신니케', '승리의 여신 니케', '니케', 'nikke', 'goddess of victory'], game: '승리의 여신: 니케' },
  { patterns: ['블루아카이브', '블루 아카이브', '블아', 'blue archive'], game: '블루 아카이브' },
  { patterns: ['원신', 'genshin', 'genshin impact'], game: '원신' },
  { patterns: ['붕괴스타레일', '붕괴 스타레일', '스타레일', 'honkai star rail', 'star rail'], game: '붕괴: 스타레일' },
  { patterns: ['붕괴3rd', '붕괴3', 'honkai impact'], game: '붕괴3rd' },
  { patterns: ['명일방주', 'arknights', '아크나이츠'], game: '명일방주' },
  { patterns: ['우마무스메', '우마 무스메', 'uma musume'], game: '우마무스메' },
  { patterns: ['에픽세븐', '에픽 세븐', 'epic seven', 'epic7'], game: '에픽세븐' },
  { patterns: ['킹스레이드', "king's raid", 'kingsraid'], game: '킹스레이드' },
  { patterns: ['프린세스커넥트', '프리코네', 'priconne'], game: '프린세스 커넥트' },
  { patterns: ['소녀전선', 'girls frontline'], game: '소녀전선' },
  { patterns: ['라스트오리진', '라스트 오리진', 'last origin'], game: '라스트오리진' },
  { patterns: ['그랑블루판타지', '그랑블루', 'granblue'], game: '그랑블루 판타지' },
  { patterns: ['fgo', '페이트 그랜드 오더', 'fate grand order'], game: 'FGO' },
  { patterns: ['쿠키런킹덤', '쿠키런 킹덤', 'cookie run kingdom'], game: '쿠키런: 킹덤' },
  { patterns: ['쿠키런', 'cookie run'], game: '쿠키런' },

  // --- Casual / Action / Sports ---
  { patterns: ['로블록스', 'roblox'], game: '로블록스' },
  { patterns: ['브롤스타즈', '브롤 스타즈', 'brawl stars'], game: '브롤스타즈' },
  { patterns: ['두근두근타운', '두근두근 타운'], game: '두근두근타운' },
  { patterns: ['컴투스프로야구', '컴프야', 'com2us baseball'], game: '컴투스프로야구' },
  { patterns: ['서머너즈워', '서머너즈 워', 'summoners war'], game: '서머너즈워' },
  { patterns: ['클래시로얄', '클래시 로얄', 'clash royale'], game: '클래시 로얄' },
  { patterns: ['클래시오브클랜', '클래시 오브 클랜', 'clash of clans'], game: '클래시 오브 클랜' },
  { patterns: ['모바일레전드', '모바일 레전드', 'mobile legends'], game: '모바일 레전드' },
  { patterns: ['배틀그라운드 모바일', 'pubg mobile', '배그 모바일', '배그m'], game: 'PUBG 모바일' },
  { patterns: ['배틀그라운드', 'pubg', '배그'], game: 'PUBG' },
  { patterns: ['발로란트', 'valorant'], game: '발로란트' },
  { patterns: ['리그오브레전드', '롤', 'league of legends', 'lol'], game: 'LoL' },

  // --- Strategy ---
  { patterns: ['삼국지 전략판', '삼국지전략판', '삼전'], game: '삼국지 전략판' },
  { patterns: ['dx각성자들', 'dx 각성자들', 'dx: 각성자들'], game: 'DX: 각성자들' },

  // --- Other notable Korean mobile games ---
  { patterns: ['카운터사이드', 'counterside', '카사'], game: '카운터사이드' },
  { patterns: ['데스티니차일드', '데스차', 'destiny child'], game: '데스티니 차일드' },
  { patterns: ['디스라이트', 'dislyte'], game: '디스라이트' },
  { patterns: ['이터널리턴', 'eternal return'], game: '이터널 리턴' },
  { patterns: ['제5인격', '제5 인격', 'identity v'], game: '제5인격' },
  { patterns: ['와일드리프트', '와일드 리프트', 'wild rift'], game: '와일드 리프트' },
  { patterns: ['팬텀게이트', 'phantom gate'], game: '팬텀게이트' },
  { patterns: ['가디언테일즈', '가디언 테일즈', 'guardian tales'], game: '가디언 테일즈' },
  { patterns: ['에버소울', 'eversoul'], game: '에버소울' },
  { patterns: ['드래곤빌리지m', '드래곤빌리지', 'dragon village'], game: '드래곤빌리지' },
  { patterns: ['다크앤다커모바일', '다크앤다커 모바일', 'dark and darker mobile'], game: '다크앤다커 모바일' },
  { patterns: ['엘더스크롤 온라인', 'eso', 'elder scrolls online'], game: '엘더스크롤 온라인' },
  { patterns: ['전투의신', '전투의 신'], game: '전투의신' },
  { patterns: ['삼국블레이드', '삼국 블레이드'], game: '삼국블레이드' },
  { patterns: ['소울워커', 'soulworker'], game: '소울워커' },
  { patterns: ['제노니아', 'zenonia'], game: '제노니아' },
];

// ─── Game Genre Map ────────────────────────────────────────
function getGenreForGame(game) {
  const map = {
    '리니지M': 'MMORPG', '리니지W': 'MMORPG', '리니지2M': 'MMORPG',
    '리니지클래식': 'MMORPG', '레이븐2': 'MMORPG', 'RF온라인': 'MMORPG',
    '로드나인': 'MMORPG', '오딘': 'MMORPG', '로스트아크': 'MMORPG',
    '아이온2': '롤플레잉', '마비노기 모바일': 'MMORPG', '검은사막 모바일': 'MMORPG',
    '나이트크로우': 'MMORPG', '조선협객전': 'MMORPG', 'MIR4': 'MMORPG', '블소 NEO': 'MMORPG',
    '미르M': 'MMORPG', '미르2': 'MMORPG', '히트2': 'MMORPG',
    '뮤 오리진': 'MMORPG', '뮤 오리진2': 'MMORPG', '뮤 오리진3': 'MMORPG',
    '아키텍트': 'MMORPG', '그랑사가': 'MMORPG',
    '메이플스토리M': 'MMORPG', '메이플스토리': 'MMORPG',
    '메이플 키우기': '롤플레잉', '세븐나이츠 리버스': '롤플레잉',
    '스톤에이지 키우기': '롤플레잉', '창세기전 키우기': '롤플레잉', '뱀피르': '롤플레잉',
    '일곱 개의 대죄': '롤플레잉',
    '원신': '롤플레잉', '붕괴: 스타레일': '롤플레잉', '붕괴3rd': '롤플레잉',
    '승리의 여신: 니케': '롤플레잉', '블루 아카이브': '롤플레잉',
    '명일방주': '롤플레잉', '에픽세븐': '롤플레잉',
    '로블록스': '캐주얼', '브롤스타즈': '액션',
    '두근두근타운': '시뮬레이션', '컴투스프로야구': '스포츠',
    '삼국지 전략판': '전략', 'DX: 각성자들': '전략',
    '서머너즈워': '롤플레잉', '쿠키런: 킹덤': '롤플레잉', '쿠키런': '캐주얼',
    '카운터사이드': '롤플레잉', '가디언 테일즈': '롤플레잉',
    'PUBG 모바일': '액션', 'PUBG': '액션', '발로란트': 'FPS', 'LoL': 'MOBA',
    '천애명월도M': 'MMORPG', '천애명월도': 'MMORPG',
    'V4': 'MMORPG', '이카루스M': 'MMORPG', '아르카': 'MMORPG',
    '라그나로크': 'MMORPG', '기적의검': 'MMORPG', '카이저': 'MMORPG',
    '다크앤다커 모바일': 'MMORPG', '소울워커': 'MMORPG',
  };
  return map[game] || 'MMORPG';
}

function nameSimilarity(a, b) {
  const la = a.toLowerCase().replace(/\s/g, '');
  const lb = b.toLowerCase().replace(/\s/g, '');
  if (la === lb) return 1;
  if (la.includes(lb) || lb.includes(la)) return 0.8;
  const bigrams = (s) => { const bg = []; for (let i = 0; i < s.length - 1; i++) bg.push(s.slice(i, i + 2)); return bg; };
  const ba = bigrams(la), bb = bigrams(lb);
  const intersection = ba.filter(g => bb.includes(g)).length;
  const union = new Set([...ba, ...bb]).size;
  return union ? intersection / union : 0;
}

// ─── Detect games from an array of video titles ──────────────
// Returns array of { game, count } sorted by count descending.
function detectGamesFromTitles(titles) {
  if (!titles || titles.length === 0) return [];

  const counts = {};

  for (const rawTitle of titles) {
    const title = rawTitle.toLowerCase().replace(/\s/g, '');
    const matched = new Set(); // avoid double-counting same game in one title

    for (const entry of GAME_KEYWORDS) {
      if (matched.has(entry.game)) continue;
      for (const pat of entry.patterns) {
        const normalizedPat = pat.toLowerCase().replace(/\s/g, '');
        if (title.includes(normalizedPat)) {
          matched.add(entry.game);
          counts[entry.game] = (counts[entry.game] || 0) + 1;
          break;
        }
      }
    }
  }

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([game, count]) => ({ game, count }));
}

// ─── YouTube Data API: fetch recent video titles for a channel ─
// Uses playlistItems endpoint (1 unit per call) with the channel's
// "uploads" playlist (replace UC prefix with UU).
async function getChannelRecentVideoTitles(channelId, maxResults = 15) {
  if (!channelId || !channelId.startsWith('UC')) return [];

  const uploadsPlaylistId = 'UU' + channelId.slice(2);

  try {
    const data = await ytApiGet('playlistItems', {
      part: 'snippet',
      playlistId: uploadsPlaylistId,
      maxResults,
    });

    if (!data?.items) return [];

    return data.items
      .map(item => item.snippet?.title)
      .filter(Boolean);
  } catch (err) {
    console.warn(`[Creators] playlistItems API failed for ${channelId}:`, err.message);
    return [];
  }
}

// ─── Fallback: scrape channel /videos page for titles ──────────
async function scrapeChannelVideoTitles(channelId, maxTitles = 15) {
  try {
    const url = `https://www.youtube.com/channel/${channelId}/videos`;
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
      },
      timeout: 15000,
    });

    const titles = [];

    // Extract from ytInitialData
    const dataMatch = html.match(/var ytInitialData = ({.*?});<\/script>/s);
    if (dataMatch) {
      const data = JSON.parse(dataMatch[1]);
      // Navigate to the videos tab grid
      const tabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
      for (const tab of tabs) {
        const items = tab?.tabRenderer?.content?.richGridRenderer?.contents || [];
        for (const item of items) {
          const vr = item?.richItemRenderer?.content?.videoRenderer;
          if (vr?.title?.runs?.[0]?.text) {
            titles.push(vr.title.runs[0].text);
            if (titles.length >= maxTitles) break;
          }
        }
        if (titles.length > 0) break;
      }
    }

    // Additional extraction: look for videoRenderer title patterns in raw HTML
    if (titles.length === 0) {
      const titleMatches = html.matchAll(/"videoRenderer":\{[^}]*?"title":\{"runs":\[\{"text":"([^"]+)"/g);
      for (const m of titleMatches) {
        titles.push(m[1]);
        if (titles.length >= maxTitles) break;
      }
    }

    return titles;
  } catch (err) {
    console.warn(`[Creators] Channel scrape failed for ${channelId}:`, err.message);
    return [];
  }
}

// ─── Detect game for a channel using the fallback chain ─────────
// 1. YouTube Data API (playlistItems) -> detect from real titles
// 2. Web scraping channel /videos page -> detect from titles
// 3. Roster data (lowest priority)
// 4. Final fallback: '종합'
async function detectGameForChannel(channelId, rosterEntry) {
  // --- Step 1: YouTube Data API ---
  let titles = await getChannelRecentVideoTitles(channelId, 15);
  if (titles.length > 0) {
    const detected = detectGamesFromTitles(titles);
    if (detected.length > 0) {
      console.log(`[Creators] API detection for ${channelId}: ${detected[0].game} (${detected[0].count}/${titles.length} titles)`);
      return {
        game: detected[0].game,
        games: detected.map(d => d.game).slice(0, 5),
        _detectionSource: 'youtube_api',
        _titleCount: titles.length,
        _topMatch: `${detected[0].game}(${detected[0].count})`,
      };
    }
  }

  // --- Step 2: Web scraping fallback ---
  if (titles.length === 0) {
    titles = await scrapeChannelVideoTitles(channelId, 15);
    if (titles.length > 0) {
      const detected = detectGamesFromTitles(titles);
      if (detected.length > 0) {
        console.log(`[Creators] Scrape detection for ${channelId}: ${detected[0].game} (${detected[0].count}/${titles.length} titles)`);
        return {
          game: detected[0].game,
          games: detected.map(d => d.game).slice(0, 5),
          _detectionSource: 'scrape',
          _titleCount: titles.length,
          _topMatch: `${detected[0].game}(${detected[0].count})`,
        };
      }
    }
  }

  // --- Step 3: If API gave titles but no game matched, still try roster ---
  if (rosterEntry && rosterEntry.games && rosterEntry.games.length > 0) {
    console.log(`[Creators] Roster fallback for ${channelId}: ${rosterEntry.games[0]}`);
    return {
      game: rosterEntry.games[0],
      games: [...rosterEntry.games],
      _detectionSource: 'roster_fallback',
    };
  }

  // --- Step 4: Final fallback ---
  return {
    game: '종합',
    games: ['종합'],
    _detectionSource: 'default',
  };
}

/**
 * 영향력 등급 계산 (구독자 규모 + 절대 참여 규모 복합)
 * 대형 채널은 참여율이 낮아도 절대 참여자 수가 크므로 높은 등급
 */
function calculateInfluenceGrade(subscribers, engagementRate) {
  const rate = engagementRate || (subscribers > 100000 ? 2.5 : subscribers > 10000 ? 5 : 8);
  const absEngagement = Math.round(subscribers * (rate / 100));
  let score = 0;
  if (absEngagement >= 10000) score += 70;
  else if (absEngagement >= 3000) score += 55;
  else if (absEngagement >= 1000) score += 40;
  else if (absEngagement >= 300) score += 25;
  else if (absEngagement >= 100) score += 15;
  else score += 5;
  if (subscribers >= 500000) score += 30;
  else if (subscribers >= 100000) score += 25;
  else if (subscribers >= 50000) score += 20;
  else if (subscribers >= 10000) score += 15;
  else if (subscribers >= 1000) score += 8;
  else score += 3;
  if (score >= 80) return 'S';
  if (score >= 60) return 'A';
  if (score >= 40) return 'B';
  return 'C';
}

module.exports = {
  GAME_KEYWORDS,
  getGenreForGame,
  nameSimilarity,
  detectGamesFromTitles,
  getChannelRecentVideoTitles,
  scrapeChannelVideoTitles,
  detectGameForChannel,
  calculateInfluenceGrade,
};
