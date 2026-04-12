/**
 * Cache Fix Route - Featured 캐시 데이터 정리
 * roster_fallback/default 게임 → 실제 데이터로 교정
 * POST /api/admin/cache-fix → 캐시 클린업 실행
 */
const express = require('express');
const { detectGameForChannel } = require('../utils/game-detection.cjs');

module.exports = function (db) {
  const router = express.Router();

  // ─── 캐시 상태 확인 ───────────────────────────────────────
  router.get('/', (req, res) => {
    const cached = db.prepare("SELECT data_json, expires_at FROM featured_cache WHERE cache_key = 'featured_creators_v3'").get();
    if (!cached) return res.json({ ok: true, total: 0, message: 'No cache' });

    const data = JSON.parse(cached.data_json);
    const sources = {};
    const detSources = {};
    data.forEach(d => {
      sources[d._source || 'unknown'] = (sources[d._source || 'unknown'] || 0) + 1;
      detSources[d._detectionSource || 'none'] = (detSources[d._detectionSource || 'none'] || 0) + 1;
    });

    const needsFix = data.filter(d => d._detectionSource === 'roster_fallback' || d._detectionSource === 'default');

    res.json({
      ok: true,
      total: data.length,
      sources,
      detectionSources: detSources,
      needsFix: needsFix.length,
      needsFixSample: needsFix.slice(0, 10).map(d => ({ name: d.name, game: d.game, subs: d.subscribers })),
      expiresAt: cached.expires_at,
    });
  });

  // ─── 캐시 클린업: 잘못된 게임 교정 ───────────────────────
  router.post('/', async (req, res) => {
    const cached = db.prepare("SELECT data_json FROM featured_cache WHERE cache_key = 'featured_creators_v3'").get();
    if (!cached) return res.json({ ok: false, error: 'No cache to fix' });

    const data = JSON.parse(cached.data_json);
    let fixed = 0;
    let removed = 0;

    // Phase 1: 게임 미탐지/잘못된 항목 교정
    const needsFix = (d) => !d._detectionSource || d._detectionSource === 'roster_fallback' || d._detectionSource === 'default' || d._detectionSource === 'none';
    const fixCount = data.filter(needsFix).length;
    console.log(`[CacheFix] ${fixCount} creators need game detection fix`);

    for (const creator of data) {
      if (needsFix(creator)) {
        // 실제 API로 재탐지 시도
        if (creator.channelId) {
          try {
            const detection = await detectGameForChannel(creator.channelId, null);
            if (detection._detectionSource !== 'default' && detection._detectionSource !== 'roster_fallback') {
              creator.game = detection.game;
              creator.games = detection.games;
              creator.genre = detection.genre || '게임';
              creator._detectionSource = detection._detectionSource;
              creator._fixed = true;
              fixed++;
              continue;
            }
          } catch {}
        }

        // 재탐지 실패 → "종합"으로 변경 (거짓보다 나음)
        creator.game = '종합';
        creator.games = ['종합'];
        creator.genre = '종합';
        creator._detectionSource = 'fixed_to_general';
        creator._fixed = true;
        fixed++;
      }
    }

    // Phase 2: 구독자 100 미만 제거
    const before = data.length;
    const filtered = data.filter(d => (d.subscribers || 0) >= 100);
    removed = before - filtered.length;

    // Phase 3: 중복 제거 (channelId 기준)
    const seen = new Set();
    const deduped = [];
    for (const d of filtered) {
      const key = d.channelId || d.name;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(d);
      }
    }
    const dupRemoved = filtered.length - deduped.length;

    // 구독자순 정렬
    deduped.sort((a, b) => (b.subscribers || 0) - (a.subscribers || 0));

    // 캐시 갱신 (7일)
    const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare("DELETE FROM featured_cache WHERE cache_key = 'featured_creators_v3'").run();
    db.prepare("INSERT INTO featured_cache (cache_key, data_json, expires_at) VALUES (?, ?, ?)").run(
      'featured_creators_v3', JSON.stringify(deduped), expiry
    );

    res.json({
      ok: true,
      before,
      after: deduped.length,
      fixed,
      removed,
      duplicatesRemoved: dupRemoved,
    });
  });

  // ─── 캐시 완전 삭제 (재수집 강제) ────────────────────────
  router.delete('/', (req, res) => {
    db.prepare("DELETE FROM featured_cache WHERE cache_key = 'featured_creators_v3'").run();
    res.json({ ok: true, message: 'Cache cleared. Next /featured request will recollect.' });
  });

  return router;
};
