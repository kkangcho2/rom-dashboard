const express = require('express');
const axios = require('axios');
const youtube = require('../crawlers/youtube.cjs');
const { ytApiGet } = require('../utils/google-auth.cjs');
const CREATOR_ROSTER = require('../data/creator-roster.json');
const { GAME_KEYWORDS, getGenreForGame, nameSimilarity, detectGamesFromTitles, getChannelRecentVideoTitles, scrapeChannelVideoTitles, detectGameForChannel } = require('../utils/game-detection.cjs');

// ─── Featured Creators Configuration ─────────────────────────
const SEED_QUERIES = [
  { query: '아이온2 모바일 공략 방송', game: '아이온2', genre: '롤플레잉', tier: 'S' },
  { query: '리니지M 공략 방송', game: '리니지M', genre: 'MMORPG', tier: 'S' },
  { query: '로블록스 게임 스트리머', game: '로블록스', genre: '캐주얼', tier: 'S' },
  { query: '마비노기 모바일 공략', game: '마비노기 모바일', genre: 'MMORPG', tier: 'S' },
  { query: '조선협객전 클래식 공략', game: '조선협객전', genre: 'MMORPG', tier: 'S' },
  { query: '세븐나이츠 리버스 공략', game: '세븐나이츠 리버스', genre: '롤플레잉', tier: 'A' },
  { query: '스톤에이지 키우기 공략', game: '스톤에이지 키우기', genre: '롤플레잉', tier: 'A' },
  { query: '메이플 키우기 공략', game: '메이플 키우기', genre: '롤플레잉', tier: 'A' },
  { query: '두근두근타운 공략', game: '두근두근타운', genre: '시뮬레이션', tier: 'A' },
  { query: '오딘 발할라라이징 공략', game: '오딘', genre: 'MMORPG', tier: 'A' },
  { query: '니케 공략 리뷰', game: '승리의 여신: 니케', genre: '롤플레잉', tier: 'A' },
  { query: '창세기전 키우기 공략', game: '창세기전 키우기', genre: '롤플레잉', tier: 'A' },
  { query: '브롤스타즈 공략 스트리머', game: '브롤스타즈', genre: '액션', tier: 'A' },
  { query: '뱀피르 모바일 공략', game: '뱀피르', genre: '롤플레잉', tier: 'B' },
  { query: '로드나인 공략 방송', game: '로드나인', genre: 'MMORPG', tier: 'B' },
  { query: '컴투스프로야구 공략', game: '컴투스프로야구', genre: '스포츠', tier: 'B' },
  { query: '검은사막 모바일 공략', game: '검은사막 모바일', genre: 'MMORPG', tier: 'A' },
  { query: '리니지2M 공략 방송', game: '리니지2M', genre: 'MMORPG', tier: 'S' },
  { query: '일곱 개의 대죄 오리진 공략', game: '일곱 개의 대죄', genre: '롤플레잉', tier: 'B' },
  { query: 'DX 각성자들 모바일', game: 'DX: 각성자들', genre: '전략', tier: 'B' },
  { query: '모바일게임 스트리머 추천', game: '종합', genre: '롤플레잉', tier: 'S' },
];

// ─── SQLite cache: 3-day TTL ──────────────────────────────────
const CACHE_KEY = 'featured_creators_v3';
const CACHE_TTL_MS = 1000 * 60 * 60 * 72; // 72h = 3 days

function getCachedFeatured(db) {
  try {
    const row = db.prepare('SELECT data_json, expires_at FROM featured_cache WHERE cache_key = ?').get(CACHE_KEY);
    if (row && new Date(row.expires_at) > new Date()) {
      return JSON.parse(row.data_json);
    }
  } catch {}
  return null;
}

function setCachedFeatured(db, data) {
  const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();
  const json = JSON.stringify(data);
  try {
    db.prepare('INSERT OR REPLACE INTO featured_cache (cache_key, data_json, expires_at) VALUES (?, ?, ?)').run(CACHE_KEY, json, expiresAt);
    console.log(`[Featured Cache] Saved (${data.length} creators, expires: ${expiresAt})`);
  } catch (e) {
    console.error('[Featured Cache] Save failed:', e.message);
  }
}

module.exports = function(db) {
  const router = express.Router();

  // ─── Roster ────────────────────────────────────────────────
  router.get('/roster', (req, res) => res.json(CREATOR_ROSTER));

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

  // ─── Featured Creators (SQLite cache, 3-day TTL) ──────────
  router.get('/featured', async (req, res) => {
    const forceRefresh = req.query.force === '1';

    // 1) Return cache if valid (unless force) + DB 프로필 병합
    if (!forceRefresh) {
      const cached = getCachedFeatured(db);
      if (cached) {
        const gameOnly = cached.filter(c => c.game && c.game !== '종합');

        // DB의 실제 subscriber_count로 캐시 보정
        try {
          const dbSubs = db.prepare("SELECT youtube_channel_id, subscriber_count FROM creator_profiles WHERE subscriber_count > 0").all();
          const subMap = new Map(dbSubs.map(r => [r.youtube_channel_id, r.subscriber_count]));
          for (const c of gameOnly) {
            if (c.channelId && subMap.has(c.channelId)) c.subscribers = subMap.get(c.channelId);
          }
        } catch {}

        // DB에 등록된 크리에이터 중 캐시에 없는 항목 병합
        const cachedIds = new Set(gameOnly.map(c => c.channelId).filter(Boolean));
        const dbCreators = db.prepare(`
          SELECT cp.display_name, cp.youtube_channel_id, cp.avg_concurrent_viewers,
                 cp.engagement_grade, cp.verified_viewer_badge, cp.top_games_json, cp.categories,
                 cp.thumbnail_url, cp.subscriber_count
          FROM creator_profiles cp
          JOIN users u ON u.id = cp.user_id
          WHERE u.status = 'active' AND cp.youtube_channel_id IS NOT NULL AND cp.youtube_channel_id != ''
        `).all();

        for (const p of dbCreators) {
          if (cachedIds.has(p.youtube_channel_id)) continue;
          const games = JSON.parse(p.top_games_json || '[]');
          const actualGames = games.filter(g => g && g !== '종합');
          // 게임이 없어도 DB에 등록된 크리에이터는 포함
          const mainGame = actualGames[0] || JSON.parse(p.categories || '["게임"]')[0] || '게임';
          const subs = p.subscriber_count || (p.avg_concurrent_viewers || 0) * 50;
          gameOnly.push({
            name: p.display_name,
            channelId: p.youtube_channel_id,
            subscribers: subs,
            thumbnail: p.thumbnail_url || '',
            game: mainGame,
            games: actualGames.length > 0 ? actualGames : [mainGame],
            genre: JSON.parse(p.categories || '["게임"]')[0] || '게임',
            tier: p.engagement_grade === 'S' ? 'S' : p.engagement_grade === 'A' ? 'A' : 'B',
            _source: 'db_profile',
          });
        }

        gameOnly.sort((a, b) => (b.subscribers || 0) - (a.subscribers || 0));
        return res.json(gameOnly);
      }
    }

    // 2) Cache expired or force -> collect fresh data
    console.log(`[Featured] Starting fresh collection (force: ${forceRefresh})`);
    try {
      const results = [];

      // Phase 1: Seed queries -> YouTube channel search
      for (const seed of SEED_QUERIES) {
        try {
          const channels = await youtube.searchChannels(seed.query, 5);
          for (const ch of channels) {
            if (ch.subscribers > 0 && !results.find(r => r.channelId === ch.channelId)) {
              results.push({
                ...ch, game: seed.game, genre: seed.genre || '', tier: seed.tier || 'C',
                _source: 'youtube_search', _searchedAt: new Date().toISOString(),
              });
            }
          }
          await new Promise(r => setTimeout(r, 500));
        } catch (e) {
          console.warn(`[Featured] Seed search failed "${seed.query}":`, e.message);
        }
      }

      // Phase 1.5: For seed-query results, also detect games from real videos
      // (seed.game is a hint, but the creator might actually play something else)
      console.log(`[Featured] Verifying ${results.length} seed results with real video data...`);
      for (let i = 0; i < results.length; i += 5) {
        const batch = results.slice(i, i + 5);
        await Promise.all(batch.map(async (creator) => {
          try {
            const detection = await detectGameForChannel(creator.channelId, null);
            if (detection._detectionSource !== 'default') {
              creator.game = detection.game;
              creator.games = detection.games;
              creator.genre = getGenreForGame(detection.game);
              creator._detectionSource = detection._detectionSource;
            }
          } catch {
            // keep seed game on failure
          }
        }));
        if (i + 5 < results.length) await new Promise(r => setTimeout(r, 300));
      }

      // Phase 2: Roster creators - find on YouTube, then detect games from REAL content
      const unmatched = CREATOR_ROSTER.filter(entry =>
        !results.find(r => r.name === entry.name || r.name.includes(entry.name) || entry.name.includes(r.name))
      );

      console.log(`[Roster] Searching ${unmatched.length} creators`);
      let rosterOk = 0, rosterFail = 0;

      for (let i = 0; i < unmatched.length; i += 3) {
        const batch = unmatched.slice(i, i + 3);
        const searches = batch.map(async (entry) => {
          const searchQuery = entry.name.length <= 2 ? `${entry.name} 게임 방송` : entry.name;
          try {
            const channels = await youtube.searchChannels(searchQuery, 3);
            const candidates = channels.filter(c => c.subscribers > 0);
            if (candidates.length === 0) { rosterFail++; return; }

            candidates.sort((a, b) => nameSimilarity(b.name, entry.name) - nameSimilarity(a.name, entry.name));
            const best = candidates[0];
            if (nameSimilarity(best.name, entry.name) < 0.3 || results.find(r => r.channelId === best.channelId)) {
              rosterFail++; return;
            }

            // KEY CHANGE: detect game from the channel's ACTUAL recent videos
            const detection = await detectGameForChannel(best.channelId, entry);

            results.push({
              ...best,
              game: detection.game,
              games: detection.games || [detection.game],
              genre: getGenreForGame(detection.game),
              tier: 'B',
              _source: 'roster_yt',
              _rosterName: entry.name,
              _detectionSource: detection._detectionSource,
              _searchedAt: new Date().toISOString(),
            });
            rosterOk++;
          } catch {
            rosterFail++;
          }
        });
        await Promise.all(searches);
        if (i + 3 < unmatched.length) await new Promise(r => setTimeout(r, 500));
      }
      console.log(`[Roster] Done: ${rosterOk} matched, ${rosterFail} unmatched (total ${results.length})`);

      // Sort by subscriber count
      results.sort((a, b) => (b.subscribers || 0) - (a.subscribers || 0));

      // Save to SQLite cache (3 days)
      setCachedFeatured(db, results);

      // 게임 크리에이터만 반환
      const gameOnly = results.filter(c => c.game && c.game !== '종합');
      res.json(gameOnly);
    } catch (err) {
      // On error, return stale cache if available
      const stale = getCachedFeatured(db);
      if (stale) return res.json(stale);
      console.error('[Featured] Collection failed:', err.message);
      res.json([]);
    }
  });

  return router;
};
