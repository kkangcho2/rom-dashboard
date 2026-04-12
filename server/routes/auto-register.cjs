/**
 * Auto Register - Featured 게임 크리에이터를 마켓플레이스에 자동 등록
 * POST /api/admin/auto-register → 게임 크리에이터만 필터링 후 creator_profiles에 등록
 */
const express = require('express');
const crypto = require('crypto');
const { getGenreForGame } = require('../utils/game-detection.cjs');

// 게임 관련이 아닌 장르/카테고리
const NON_GAME_GENRES = ['IRL', '먹방', '음악', '교육', 'IT', '뷰티', '부동산', '재테크'];

module.exports = function (db) {
  const router = express.Router();

  router.get('/', (req, res) => {
    // 현재 상태 확인
    const profileCount = db.prepare('SELECT COUNT(*) as c FROM creator_profiles').get().c;
    const cached = db.prepare("SELECT data_json FROM featured_cache WHERE cache_key = 'featured_creators_v3'").get();
    const featuredCount = cached ? JSON.parse(cached.data_json).length : 0;

    res.json({ ok: true, profileCount, featuredCount });
  });

  router.post('/', (req, res) => {
    const cached = db.prepare("SELECT data_json FROM featured_cache WHERE cache_key = 'featured_creators_v3'").get();
    if (!cached) return res.status(404).json({ ok: false, error: 'Featured cache not found. Run /api/featured first.' });

    const featured = JSON.parse(cached.data_json);

    // 게임 크리에이터만 필터링 (종합/IRL/먹방 등 제외)
    const gameCreators = featured.filter(d => {
      if (d.game && d.game !== '종합') return true;
      if (d.genre && !NON_GAME_GENRES.includes(d.genre) && d.genre !== '종합') return true;
      return false;
    });

    // 구독자 100 미만 제거
    const filtered = gameCreators.filter(d => (d.subscribers || 0) >= 100);

    let created = 0;
    let updated = 0;
    let skipped = 0;

    const insertUser = db.prepare(`
      INSERT INTO users (email, password_hash, name, role, status, plan)
      VALUES (?, 'placeholder_no_login', ?, 'creator', 'active', 'Free')
    `);

    const insertProfile = db.prepare(`
      INSERT INTO creator_profiles (
        id, user_id, display_name, bio, categories,
        avg_concurrent_viewers, peak_viewers, engagement_grade, verified_viewer_badge,
        top_games_json, audience_keywords_json,
        youtube_channel_id, youtube_verified,
        total_streams_analyzed, trust_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 0.7)
    `);

    const updateProfile = db.prepare(`
      UPDATE creator_profiles SET
        display_name = ?, bio = ?, categories = ?,
        avg_concurrent_viewers = ?, peak_viewers = ?,
        engagement_grade = ?, verified_viewer_badge = ?,
        top_games_json = ?, youtube_channel_id = ?,
        total_streams_analyzed = ?, updated_at = datetime('now')
      WHERE youtube_channel_id = ?
    `);

    // 시스템 유저 (admin) ID
    const adminUser = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
    const systemUserId = adminUser?.id || 1;

    for (const c of filtered) {
      const channelId = c.channelId;
      if (!channelId) { skipped++; continue; }

      // 이미 등록된 크리에이터인지 확인 (youtube_channel_id로)
      const existing = db.prepare('SELECT id FROM creator_profiles WHERE youtube_channel_id = ?').get(channelId);

      const subs = c.subscribers || 0;
      const estimatedViewers = Math.round(subs * 0.02); // 구독자 2%를 평균 시청자로 추정
      const peakViewers = Math.round(subs * 0.05);
      const { calculateInfluenceGrade } = require('../utils/game-detection.cjs');
      const grade = calculateInfluenceGrade(subs);
      const badge = subs >= 100000 ? 'gold' : subs >= 30000 ? 'silver' : subs >= 5000 ? 'bronze' : null;

      const games = c.games || (c.game ? [c.game] : []);
      const genre = c.genre || getGenreForGame(c.game) || '게임';
      const categories = [...new Set([genre, ...games.map(g => getGenreForGame(g)).filter(Boolean)])];

      const bio = games.length > 0
        ? `${games.slice(0, 3).join(', ')} 전문 스트리머 | ${subs.toLocaleString()} 구독자`
        : `게임 크리에이터 | ${subs.toLocaleString()} 구독자`;

      if (existing) {
        updateProfile.run(
          c.name, bio, JSON.stringify(categories),
          estimatedViewers, peakViewers, grade, badge,
          JSON.stringify(games), channelId,
          10, channelId
        );
        updated++;
      } else {
        // 새 유저 생성 (비밀번호 없는 플레이스홀더 - 실제로는 크리에이터가 가입 시 연결)
        const profileId = crypto.randomUUID();

        try {
          // 플레이스홀더 유저 생성 (크리에이터가 나중에 가입하면 연결)
          const email = `yt_${channelId}@placeholder.livedpulse.com`;
          const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
          let userId;
          if (existingUser) {
            userId = existingUser.id;
          } else {
            const userResult = insertUser.run(email, c.name);
            userId = userResult.lastInsertRowid;
          }

          insertProfile.run(
            profileId, userId, c.name, bio, JSON.stringify(categories),
            estimatedViewers, peakViewers, grade, badge,
            JSON.stringify(games), JSON.stringify(games.slice(0, 5)),
            channelId, 10
          );
          created++;
        } catch (err) {
          skipped++;
        }
      }
    }

    // 비게임 크리에이터 카운트
    const nonGameCount = featured.length - gameCreators.length;

    res.json({
      ok: true,
      total_featured: featured.length,
      game_creators: filtered.length,
      non_game_excluded: nonGameCount,
      created,
      updated,
      skipped,
      total_profiles: db.prepare('SELECT COUNT(*) as c FROM creator_profiles').get().c,
    });
  });

  // ─── 전체 구독자 수 보정 (YouTube 실제 데이터) ──────────
  router.post('/fix-subscribers', async (req, res) => {
    const youtube = require('../crawlers/youtube.cjs');
    const profiles = db.prepare(`
      SELECT id, display_name, youtube_channel_id, subscriber_count, avg_concurrent_viewers
      FROM creator_profiles WHERE youtube_channel_id IS NOT NULL AND youtube_channel_id != ''
    `).all();

    res.json({ ok: true, message: `구독자 보정 시작: ${profiles.length}명`, total: profiles.length });

    // 백그라운드
    (async () => {
      let fixed = 0, failed = 0;
      for (let i = 0; i < profiles.length; i++) {
        const p = profiles[i];
        try {
          const results = await youtube.searchChannels(p.display_name, 3);
          const match = results?.find(r => r.channelId === p.youtube_channel_id) || results?.[0];
          if (match && match.subscribers > 0) {
            const subs = match.subscribers;
            const { calculateInfluenceGrade } = require('../utils/game-detection.cjs');
            db.prepare(`
              UPDATE creator_profiles SET
                subscriber_count = ?, avg_concurrent_viewers = ?, peak_viewers = ?,
                engagement_grade = ?, verified_viewer_badge = ?,
                thumbnail_url = CASE WHEN thumbnail_url IS NULL OR thumbnail_url = '' THEN ? ELSE thumbnail_url END,
                updated_at = datetime('now')
              WHERE id = ?
            `).run(
              subs, Math.round(subs * 0.02), Math.round(subs * 0.05),
              calculateInfluenceGrade(subs),
              subs >= 100000 ? 'gold' : subs >= 30000 ? 'silver' : subs >= 5000 ? 'bronze' : null,
              match.thumbnail || '', p.id
            );
            fixed++;
          }
        } catch { failed++; }
        if (i < profiles.length - 1) await new Promise(r => setTimeout(r, 600));
        if ((i + 1) % 30 === 0) console.log(`[FixSubs] ${i + 1}/${profiles.length} (fixed: ${fixed})`);
      }
      console.log(`[FixSubs] Complete: ${fixed} fixed, ${failed} failed`);
    })().catch(e => console.error('[FixSubs] Fatal:', e.message));
  });

  // ─── 등록된 크리에이터 영상 분석 + 프로필 업데이트 ────────
  // 194명의 youtube_channel_id로 영상 30개 수집 → 게임 재탐지 + 프로필 업데이트
  router.post('/analyze-all', async (req, res) => {
    const profiles = db.prepare(`
      SELECT id, display_name, youtube_channel_id, categories, top_games_json
      FROM creator_profiles WHERE youtube_channel_id IS NOT NULL AND youtube_channel_id != ''
    `).all();

    if (profiles.length === 0) return res.json({ ok: false, error: 'No profiles with channel IDs' });

    const { detectGamesFromTitles, getChannelRecentVideoTitles, scrapeChannelVideoTitles, getGenreForGame } = require('../utils/game-detection.cjs');

    res.json({ ok: true, message: `분석 시작: ${profiles.length}명`, total: profiles.length });

    // 백그라운드 실행
    (async () => {
      let updated = 0, failed = 0;

      for (let i = 0; i < profiles.length; i++) {
        const p = profiles[i];
        try {
          // 영상 제목 수집 (API → scrape fallback)
          let titles = [];
          if (p.youtube_channel_id && p.youtube_channel_id.startsWith('UC')) {
            titles = await getChannelRecentVideoTitles(p.youtube_channel_id, 30);
          }
          if (titles.length === 0 && p.youtube_channel_id) {
            titles = await scrapeChannelVideoTitles(p.youtube_channel_id, 30);
          }
          // 채널 ID가 @핸들인 경우 이름으로 YouTube 검색하여 UC ID 먼저 가져오기
          if (titles.length === 0 && p.youtube_channel_id && !p.youtube_channel_id.startsWith('UC')) {
            try {
              const youtube = require('../crawlers/youtube.cjs');
              const results = await youtube.searchChannels(p.display_name, 1);
              if (results?.[0]?.channelId?.startsWith('UC')) {
                // DB 업데이트
                db.prepare('UPDATE creator_profiles SET youtube_channel_id = ?, thumbnail_url = ? WHERE id = ?')
                  .run(results[0].channelId, results[0].thumbnail || '', p.id);
                titles = await getChannelRecentVideoTitles(results[0].channelId, 30);
                if (titles.length === 0) titles = await scrapeChannelVideoTitles(results[0].channelId, 30);
              }
            } catch {}
          }

          if (titles.length === 0) { failed++; continue; }

          // Shorts 제외
          const nonShorts = titles.filter(t => !/#shorts/i.test(t));

          // 게임 탐지
          const detected = detectGamesFromTitles(nonShorts.length > 0 ? nonShorts : titles);
          const totalTitles = nonShorts.length || 1;

          // 게임 분류
          const games = [];
          for (const d of detected) {
            const pct = (d.count / totalTitles) * 100;
            const role = pct >= 40 ? 'Main' : pct >= 10 ? 'Sub' : 'One-off';
            games.push({ game: d.game, role, count: d.count, genre: getGenreForGame(d.game) });
          }

          const mainGame = games.find(g => g.role === 'Main')?.game || games[0]?.game || '종합';
          const allGameNames = games.map(g => g.game);
          const allGenres = [...new Set(games.map(g => g.genre))];
          const categories = allGenres.length > 0 ? allGenres : ['게임'];

          // 등급 재계산 (기존 subscribers 기반)
          const existingFull = db.prepare('SELECT avg_concurrent_viewers FROM creator_profiles WHERE id = ?').get(p.id);

          // 프로필 업데이트
          db.prepare(`
            UPDATE creator_profiles SET
              categories = ?,
              top_games_json = ?,
              audience_keywords_json = ?,
              total_streams_analyzed = ?,
              updated_at = datetime('now')
            WHERE id = ?
          `).run(
            JSON.stringify(categories),
            JSON.stringify(allGameNames.slice(0, 10)),
            JSON.stringify(allGameNames.slice(0, 5)),
            nonShorts.length,
            p.id
          );

          updated++;
          if ((i + 1) % 20 === 0) {
            console.log(`[AnalyzeAll] Progress: ${i + 1}/${profiles.length} (updated: ${updated})`);
          }
        } catch (err) {
          failed++;
        }

        // Rate limit
        if (i < profiles.length - 1) {
          await new Promise(r => setTimeout(r, 600));
        }
      }

      console.log(`[AnalyzeAll] Complete: ${updated} updated, ${failed} failed out of ${profiles.length}`);
    })().catch(e => console.error('[AnalyzeAll] Fatal:', e.message));
  });

  // ─── featured 캐시를 프로필 분석 결과로 동기화 ────────────
  router.post('/sync-featured', (req, res) => {
    const cached = db.prepare("SELECT data_json FROM featured_cache WHERE cache_key = 'featured_creators_v3'").get();
    if (!cached) return res.json({ ok: false, error: 'No featured cache' });

    const featured = JSON.parse(cached.data_json);
    let synced = 0;

    // 프로필에서 게임 정보 가져와서 featured 캐시 업데이트
    for (const f of featured) {
      if (!f.channelId) continue;
      const profile = db.prepare('SELECT top_games_json, categories FROM creator_profiles WHERE youtube_channel_id = ?').get(f.channelId);
      if (!profile) continue;

      const games = JSON.parse(profile.top_games_json || '[]');
      if (games.length > 0 && games[0] !== '종합') {
        const { getGenreForGame } = require('../utils/game-detection.cjs');
        f.game = games[0];
        f.games = games;
        f.genre = getGenreForGame(games[0]);
        f._detectionSource = 'profile_sync';
        synced++;
      }
    }

    // 저장
    const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare("DELETE FROM featured_cache WHERE cache_key = 'featured_creators_v3'").run();
    db.prepare("INSERT INTO featured_cache (cache_key, data_json, expires_at) VALUES (?, ?, ?)").run(
      'featured_creators_v3', JSON.stringify(featured), expiry
    );

    res.json({ ok: true, synced, total: featured.length });
  });

  // 비게임 크리에이터 프로필 삭제
  router.delete('/non-game', (req, res) => {
    // categories에 게임 관련 키워드가 없는 프로필 삭제
    const all = db.prepare('SELECT id, display_name, categories, top_games_json FROM creator_profiles').all();
    let deleted = 0;

    for (const p of all) {
      const cats = JSON.parse(p.categories || '[]');
      const games = JSON.parse(p.top_games_json || '[]');

      const isGame = games.length > 0 || cats.some(c =>
        !NON_GAME_GENRES.includes(c) && c !== '종합'
      );

      if (!isGame) {
        db.prepare('DELETE FROM creator_profiles WHERE id = ?').run(p.id);
        deleted++;
      }
    }

    res.json({ ok: true, deleted, remaining: db.prepare('SELECT COUNT(*) as c FROM creator_profiles').get().c });
  });

  return router;
};
