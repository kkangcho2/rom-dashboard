const express = require('express');
const youtube = require('../crawlers/youtube.cjs');
const CREATOR_ROSTER = require('../data/creator-roster.json');

// ─── Featured Creators Configuration ─────────────────────────
const SEED_QUERIES = [
  // 1~5위
  { query: '아이온2 모바일 공략 방송', game: '아이온2', genre: '롤플레잉', tier: 'S' },
  { query: '리니지M 공략 방송', game: '리니지M', genre: 'MMORPG', tier: 'S' },
  { query: '로블록스 게임 스트리머', game: '로블록스', genre: '캐주얼', tier: 'S' },
  { query: '마비노기 모바일 공략', game: '마비노기 모바일', genre: 'MMORPG', tier: 'S' },
  { query: '조선협객전 클래식 공략', game: '조선협객전', genre: 'MMORPG', tier: 'S' },

  // 6~10위
  { query: '세븐나이츠 리버스 공략', game: '세븐나이츠 리버스', genre: '롤플레잉', tier: 'A' },
  { query: '스톤에이지 키우기 공략', game: '스톤에이지 키우기', genre: '롤플레잉', tier: 'A' },
  { query: '메이플 키우기 공략', game: '메이플 키우기', genre: '롤플레잉', tier: 'A' },
  { query: '두근두근타운 공략', game: '두근두근타운', genre: '시뮬레이션', tier: 'A' },
  { query: '오딘 발할라라이징 공략', game: '오딘', genre: 'MMORPG', tier: 'A' },

  // 11~15위
  { query: '니케 공략 리뷰', game: '승리의 여신: 니케', genre: '롤플레잉', tier: 'A' },
  { query: '창세기전 키우기 공략', game: '창세기전 키우기', genre: '롤플레잉', tier: 'A' },
  { query: '브롤스타즈 공략 스트리머', game: '브롤스타즈', genre: '액션', tier: 'A' },
  { query: '뱀피르 모바일 공략', game: '뱀피르', genre: '롤플레잉', tier: 'B' },
  { query: '로드나인 공략 방송', game: '로드나인', genre: 'MMORPG', tier: 'B' },

  // 16~20위
  { query: '컴투스프로야구 공략', game: '컴투스프로야구', genre: '스포츠', tier: 'B' },
  { query: '검은사막 모바일 공략', game: '검은사막 모바일', genre: 'MMORPG', tier: 'A' },
  { query: '리니지2M 공략 방송', game: '리니지2M', genre: 'MMORPG', tier: 'S' },
  { query: '일곱 개의 대죄 오리진 공략', game: '일곱 개의 대죄', genre: '롤플레잉', tier: 'B' },
  { query: 'DX 각성자들 모바일', game: 'DX: 각성자들', genre: '전략', tier: 'B' },

  // ── 종합 검색 ──
  { query: '모바일게임 스트리머 추천', game: '종합', genre: '롤플레잉', tier: 'S' },
  { query: '모바일 MMORPG 리뷰 2026', game: '종합', genre: 'MMORPG', tier: 'S' },
];

// ─── Game Detection Keywords ─────────────────────────────────
const GAME_KEYWORDS = {
  '리니지M': ['리니지m', '리니지M', '린M', '리니지 모바일'],
  '리니지W': ['리니지w', '리니지W', '린W'],
  '리니지2M': ['리니지2m', '리니지2M', '린2M'],
  '로드나인': ['로드나인', 'lord nine', '로나', 'LORDNINE'],
  '오딘': ['오딘', '발할라', 'ODIN'],
  '로스트아크': ['로스트아크', '로아', 'lost ark'],
  '아이온2': ['아이온2', 'AION2', '아이온 2'],
  '마비노기 모바일': ['마비노기', '마비 모바일'],
  '검은사막 모바일': ['검은사막', '검사모'],
  '메이플 키우기': ['메이플', '메키'],
  '원신': ['원신', 'genshin'],
  '붕괴: 스타레일': ['스타레일', '붕스', '붕괴'],
  '승리의 여신: 니케': ['니케', 'nikke'],
  '블루 아카이브': ['블루아카', '블아'],
  '나이트크로우': ['나이트크로우', '나크'],
  '로블록스': ['로블록스', 'roblox'],
  '브롤스타즈': ['브롤', 'brawl stars'],
  '세븐나이츠 리버스': ['세븐나이츠', '세나'],
  '조선협객전': ['조선협객전', '조협전'],
  '스톤에이지 키우기': ['스톤에이지', '스에키'],
  '두근두근타운': ['두근두근', '두근타운'],
  '창세기전 키우기': ['창세기전', '창키'],
  '뱀피르': ['뱀피르', 'vampyr'],
  '컴투스프로야구': ['프로야구', '컴프야'],
  '일곱 개의 대죄': ['대죄', '일곱개의대죄'],
  'MIR4': ['미르4', 'mir4'],
  '블소 NEO': ['블소', '블레이드앤소울'],
  '삼국지 전략판': ['삼국지', '전략판'],
  'DX: 각성자들': ['DX', '각성자'],
};

// ─── Helper Functions ───────────────────────────────────────
function detectGamesFromTitles(titles) {
  const detected = new Set();
  const lowerTitles = titles.map(t => t.toLowerCase());
  for (const [game, keywords] of Object.entries(GAME_KEYWORDS)) {
    for (const kw of keywords) {
      if (lowerTitles.some(t => t.includes(kw.toLowerCase()))) {
        detected.add(game);
        break;
      }
    }
  }
  return [...detected];
}

function getGenreForGame(game) {
  const map = {
    '리니지M': 'MMORPG', '리니지W': 'MMORPG', '리니지2M': 'MMORPG',
    '로드나인': 'MMORPG', '오딘': 'MMORPG', '로스트아크': 'MMORPG',
    '아이온2': '롤플레잉', '마비노기 모바일': 'MMORPG', '검은사막 모바일': 'MMORPG',
    '나이트크로우': 'MMORPG', '조선협객전': 'MMORPG', 'MIR4': 'MMORPG', '블소 NEO': 'MMORPG',
    '메이플 키우기': '롤플레잉', '세븐나이츠 리버스': '롤플레잉',
    '스톤에이지 키우기': '롤플레잉', '창세기전 키우기': '롤플레잉', '뱀피르': '롤플레잉',
    '일곱 개의 대죄': '롤플레잉',
    '원신': '롤플레잉', '붕괴: 스타레일': '롤플레잉',
    '승리의 여신: 니케': '롤플레잉', '블루 아카이브': '롤플레잉',
    '로블록스': '캐주얼', '브롤스타즈': '액션',
    '두근두근타운': '시뮬레이션', '컴투스프로야구': '스포츠',
    '삼국지 전략판': '전략', 'DX: 각성자들': '전략',
  };
  return map[game] || '롤플레잉';
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

// ─── Featured Cache ─────────────────────────────────────────
let featuredCache = null;
let featuredCacheTime = 0;
const FEATURED_CACHE_TTL = 1000 * 60 * 60; // 1시간 캐시

module.exports = function(db) {
  const router = express.Router();

  // ─── API: Creator Roster ────────────────────────────────────
  router.get('/roster', (req, res) => {
    res.json(CREATOR_ROSTER);
  });

  router.get('/roster/search', async (req, res) => {
    const { name } = req.query;
    if (!name) return res.status(400).json({ error: 'name required' });
    try {
      const channels = await youtube.searchChannels(name, 3);
      res.json({ ok: true, results: channels });
    } catch (err) {
      res.json({ ok: false, results: [], error: err.message });
    }
  });

  // ─── API: Featured Creators ─────────────────────────────────
  router.get('/featured', async (req, res) => {
    const forceRefresh = req.query.force === '1';
    // 캐시된 결과 반환 (1시간 이내)
    if (!forceRefresh && featuredCache && Date.now() - featuredCacheTime < FEATURED_CACHE_TTL) {
      return res.json(featuredCache);
    }

    try {
      const results = [];
      for (const seed of SEED_QUERIES) {
        try {
          const channels = await youtube.searchChannels(seed.query, 5);
          for (const ch of channels) {
            if (ch.subscribers > 0 && !results.find(r => r.channelId === ch.channelId)) {
              results.push({
                ...ch,
                game: seed.game,
                genre: seed.genre || '',
                tier: seed.tier || 'C',
                _source: 'youtube_search',
                _searchedAt: new Date().toISOString(),
              });
            }
          }
          // Rate limiting: 500ms between searches
          await new Promise(r => setTimeout(r, 500));
        } catch (e) {
          console.warn(`Featured search failed for "${seed.query}":`, e.message);
        }
      }

      // ── Roster 크리에이터 YouTube 검색 (고도화 Phase 1) ──────────
      const unmatched = CREATOR_ROSTER.filter(entry =>
        !results.find(r => r.name === entry.name || r.name.includes(entry.name) || entry.name.includes(r.name))
      );

      console.log(`[Roster] ${unmatched.length}명 YouTube 검색 시작 (전체 ${CREATOR_ROSTER.length}명 중 ${CREATOR_ROSTER.length - unmatched.length}명 이미 매칭)`);
      let rosterOk = 0, rosterFail = 0;

      // 3명씩 배치 (안정성 우선)
      for (let i = 0; i < unmatched.length; i += 3) {
        const batch = unmatched.slice(i, i + 3);
        const searches = batch.map(async (entry) => {
          const isShortName = entry.name.length <= 2;
          const searchQuery = isShortName ? `${entry.name} 게임 방송` : entry.name;

          for (let attempt = 0; attempt < 2; attempt++) {
            try {
              // 1단계: 채널 검색
              const channels = await youtube.searchChannels(searchQuery, 3);
              if (channels.length > 0) {
                const candidates = channels.filter(c => c.subscribers > 0);
                if (candidates.length === 0) break;

                candidates.sort((a, b) => nameSimilarity(b.name, entry.name) - nameSimilarity(a.name, entry.name));
                const best = candidates[0];
                const sim = nameSimilarity(best.name, entry.name);

                if (sim >= 0.3 && !results.find(r => r.channelId === best.channelId)) {
                  // 2단계: 최근 영상 20개 분석으로 게임 자동 감지
                  let detectedGames = [];
                  try {
                    // 채널명으로 검색 (영상 20개)
                    const videos = await youtube.searchVideos(best.name, 20);
                    // 해당 채널의 영상만 필터 (이름 유사도 0.5 이상)
                    const myVideos = videos.filter(v =>
                      v.channelName === best.name ||
                      nameSimilarity(v.channelName, best.name) >= 0.5
                    );
                    // 내 영상이 3개 이상이면 그것만, 아니면 전체에서 추출
                    const titles = myVideos.length >= 3
                      ? myVideos.map(v => v.title)
                      : videos.slice(0, 10).map(v => v.title);
                    detectedGames = detectGamesFromTitles(titles);

                    // 감지 실패 시 채널 설명에서도 시도
                    if (detectedGames.length === 0 && best.description) {
                      detectedGames = detectGamesFromTitles([best.description]);
                    }
                  } catch (e) {
                    // 영상 검색 실패 시 무시
                  }

                  // 게임이 감지되지 않으면 '종합'으로 (로드나인 강제 배정 방지)
                  const games = detectedGames.length > 0
                    ? detectedGames
                    : ['종합'];
                  const mainGame = games[0];
                  const genre = getGenreForGame(mainGame);

                  results.push({
                    ...best,
                    game: mainGame,
                    games: games,
                    genre: genre,
                    tier: 'B',
                    _source: 'roster_yt',
                    _searchedAt: new Date().toISOString(),
                  });
                  rosterOk++;
                  if ((rosterOk + rosterFail) % 20 === 0) {
                    console.log(`[Roster] ${rosterOk + rosterFail}/${unmatched.length} 처리 (성공: ${rosterOk}, 실패: ${rosterFail})`);
                  }
                  return;
                }
              }
              break;
            } catch (e) {
              if (attempt === 0) {
                await new Promise(r => setTimeout(r, 1000));
                continue;
              }
            }
          }
          rosterFail++;
        });
        await Promise.all(searches);
        if (i + 3 < unmatched.length) {
          await new Promise(r => setTimeout(r, 500));
        }
      }
      console.log(`[Roster] 완료: ${rosterOk}명 매칭 성공, ${rosterFail}명 미매칭 (총 ${results.length}명)`);

      // 구독자 순으로 정렬 (YouTube매칭 우선, roster는 뒤에)
      results.sort((a, b) => (b.subscribers || 0) - (a.subscribers || 0));
      const featured = results; // 전체 포함 (roster 크리에이터도 대시보드 카드로 노출)

      featuredCache = featured;
      featuredCacheTime = Date.now();

      res.json(featured);
    } catch (err) {
      // 캐시가 있으면 오래된 것이라도 반환
      if (featuredCache) return res.json(featuredCache);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
