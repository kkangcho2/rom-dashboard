/**
 * Batch Crawl API - 크리에이터 일괄 수집
 * 로스터의 모든 크리에이터를 YouTube에서 검색하여 채널 매칭 + DB 저장
 * 구독자 100명 미만은 자동 제외
 *
 * POST /api/admin/batch-crawl    → 배치 크롤링 시작
 * GET  /api/admin/batch-crawl    → 진행 상태 확인
 */
const express = require('express');
const youtube = require('../crawlers/youtube.cjs');
const ROSTER = require('../data/creator-roster.json');

const MIN_SUBSCRIBERS = 100;

// 진행 상태 (인메모리)
let batchState = {
  running: false,
  total: 0,
  processed: 0,
  matched: 0,
  skipped: 0,
  failed: 0,
  filtered_low_subs: 0,
  startedAt: null,
  completedAt: null,
  results: [],
  errors: [],
};

module.exports = function (db) {
  const router = express.Router();

  // ─── 배치 크롤링 시작 ─────────────────────────────────────
  router.post('/', async (req, res) => {
    if (batchState.running) {
      return res.status(409).json({
        ok: false,
        error: '이미 배치 크롤링이 진행 중입니다',
        progress: `${batchState.processed}/${batchState.total}`,
      });
    }

    const forceAll = req.query.force === '1';
    const batchSize = Math.min(parseInt(req.query.batch) || 3, 5);
    const delayMs = Math.max(parseInt(req.query.delay) || 800, 500);

    // 이미 DB에 있는 채널은 스킵 (force=1이면 전부 재수집)
    const existingNames = new Set();
    if (!forceAll) {
      const cached = db.prepare("SELECT data_json FROM featured_cache WHERE cache_key = 'featured_creators'").get();
      if (cached) {
        try {
          const data = JSON.parse(cached.data_json);
          data.forEach(c => { if (c._rosterName) existingNames.add(c._rosterName); });
        } catch {}
      }
    }

    const toProcess = ROSTER.filter(c => forceAll || !existingNames.has(c.name));

    // 즉시 응답 후 백그라운드 실행
    batchState = {
      running: true,
      total: toProcess.length,
      processed: 0,
      matched: 0,
      skipped: existingNames.size,
      failed: 0,
      filtered_low_subs: 0,
      startedAt: new Date().toISOString(),
      completedAt: null,
      results: [],
      errors: [],
    };

    res.json({
      ok: true,
      message: `배치 크롤링 시작: ${toProcess.length}명 (기존 스킵: ${existingNames.size}명)`,
      total: toProcess.length,
    });

    // 백그라운드 실행
    (async () => {
      console.log(`[BatchCrawl] Starting: ${toProcess.length} creators (batch=${batchSize}, delay=${delayMs}ms)`);

      for (let i = 0; i < toProcess.length; i += batchSize) {
        const batch = toProcess.slice(i, i + batchSize);

        const promises = batch.map(async (entry) => {
          const searchQuery = entry.name.length <= 2
            ? `${entry.name} 게임 방송 스트리머`
            : `${entry.name} 유튜브`;

          try {
            const channels = await youtube.searchChannels(searchQuery, 3);
            const candidates = channels.filter(c => c.subscribers >= MIN_SUBSCRIBERS);

            if (candidates.length === 0) {
              // 구독자 100명 미만이거나 매칭 실패
              const lowSubs = channels.filter(c => c.subscribers > 0 && c.subscribers < MIN_SUBSCRIBERS);
              if (lowSubs.length > 0) {
                batchState.filtered_low_subs++;
                return { name: entry.name, status: 'filtered', reason: `구독자 ${lowSubs[0].subscribers}명 (<${MIN_SUBSCRIBERS})` };
              }
              batchState.failed++;
              return { name: entry.name, status: 'not_found' };
            }

            // 매칭 우선순위: 이름 유사도 + 모바일 게임 관련 채널 우선
            candidates.sort((a, b) => {
              const simA = nameSimilarity(a.name, entry.name);
              const simB = nameSimilarity(b.name, entry.name);
              // 모바일 게임 키워드 보너스 (+0.3)
              const mobileKeywords = /게임|game|모바일|mobile|스트리머|streamer|방송|공략|리니지|로드나인|mmorpg|rpg/i;
              const descA = (a.description || '').toLowerCase();
              const descB = (b.description || '').toLowerCase();
              const bonusA = mobileKeywords.test(descA) || mobileKeywords.test(a.name) ? 0.3 : 0;
              const bonusB = mobileKeywords.test(descB) || mobileKeywords.test(b.name) ? 0.3 : 0;
              return (simB + bonusB) - (simA + bonusA);
            });
            const best = candidates[0];

            // DB channels 테이블에 저장
            const existing = db.prepare('SELECT id FROM channels WHERE platform = ? AND channel_id = ?').get('youtube', best.channelId);
            if (!existing) {
              db.prepare(`
                INSERT INTO channels (platform, channel_id, channel_name, subscribers, total_views, thumbnail_url, crawled_at)
                VALUES ('youtube', ?, ?, ?, 0, ?, datetime('now'))
              `).run(best.channelId, best.name, best.subscribers, best.thumbnail || '');
            } else {
              db.prepare(`
                UPDATE channels SET channel_name = ?, subscribers = ?, thumbnail_url = ?, crawled_at = datetime('now')
                WHERE platform = 'youtube' AND channel_id = ?
              `).run(best.name, best.subscribers, best.thumbnail || '', best.channelId);
            }

            batchState.matched++;
            return {
              name: entry.name, status: 'matched',
              channelName: best.name, channelId: best.channelId,
              subscribers: best.subscribers, thumbnail: best.thumbnail,
              games: entry.games, genre: entry.genre,
            };
          } catch (err) {
            batchState.failed++;
            batchState.errors.push({ name: entry.name, error: err.message });
            return { name: entry.name, status: 'error', error: err.message };
          }
        });

        const batchResults = await Promise.all(promises);
        batchState.results.push(...batchResults);
        batchState.processed += batch.length;

        // 진행 로그
        if (batchState.processed % 30 === 0 || batchState.processed === toProcess.length) {
          console.log(`[BatchCrawl] Progress: ${batchState.processed}/${toProcess.length} (matched: ${batchState.matched}, failed: ${batchState.failed}, filtered: ${batchState.filtered_low_subs})`);
        }

        // 레이트리밋 방지 딜레이
        if (i + batchSize < toProcess.length) {
          await new Promise(r => setTimeout(r, delayMs));
        }
      }

      // 완료: 매칭된 결과를 featured 캐시에도 저장
      const matched = batchState.results.filter(r => r.status === 'matched');
      if (matched.length > 0) {
        const featuredData = matched.map(r => ({
          name: r.channelName,
          channelId: r.channelId,
          subscribers: r.subscribers,
          thumbnail: r.thumbnail,
          game: r.games?.[0] || '종합',
          games: r.games || [],
          genre: r.genre || '게임',
          tier: r.subscribers >= 100000 ? 'S' : r.subscribers >= 50000 ? 'A' : r.subscribers >= 10000 ? 'B' : 'C',
          _source: 'batch_crawl',
          _rosterName: r.name,
          _searchedAt: new Date().toISOString(),
        }));

        // 기존 캐시와 합치기
        let existingFeatured = [];
        try {
          const cached = db.prepare("SELECT data_json FROM featured_cache WHERE cache_key = 'featured_creators'").get();
          if (cached) existingFeatured = JSON.parse(cached.data_json);
        } catch {}

        // 중복 제거 (channelId 기준)
        const idSet = new Set(featuredData.map(c => c.channelId));
        const mergedFeatured = [
          ...featuredData,
          ...existingFeatured.filter(c => !idSet.has(c.channelId)),
        ];
        mergedFeatured.sort((a, b) => (b.subscribers || 0) - (a.subscribers || 0));

        // 캐시 갱신 (7일)
        const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        db.prepare("DELETE FROM featured_cache WHERE cache_key = 'featured_creators'").run();
        db.prepare("INSERT INTO featured_cache (cache_key, data_json, expires_at) VALUES (?, ?, ?)").run(
          'featured_creators', JSON.stringify(mergedFeatured), expiry
        );
        console.log(`[BatchCrawl] Updated featured cache: ${mergedFeatured.length} creators`);
      }

      batchState.running = false;
      batchState.completedAt = new Date().toISOString();
      console.log(`[BatchCrawl] Complete: ${batchState.matched} matched, ${batchState.failed} failed, ${batchState.filtered_low_subs} filtered (<${MIN_SUBSCRIBERS} subs)`);
    })().catch(err => {
      batchState.running = false;
      batchState.completedAt = new Date().toISOString();
      console.error('[BatchCrawl] Fatal error:', err.message);
    });
  });

  // ─── 진행 상태 조회 ──────────────────────────────────────
  router.get('/', (req, res) => {
    res.json({
      ok: true,
      data: {
        running: batchState.running,
        total: batchState.total,
        processed: batchState.processed,
        matched: batchState.matched,
        failed: batchState.failed,
        filtered_low_subs: batchState.filtered_low_subs,
        skipped: batchState.skipped,
        progress: batchState.total > 0 ? Math.round((batchState.processed / batchState.total) * 100) : 0,
        startedAt: batchState.startedAt,
        completedAt: batchState.completedAt,
        errors: batchState.errors.slice(-20),
      },
    });
  });

  // ─── 결과 다운로드 ───────────────────────────────────────
  router.get('/results', (req, res) => {
    res.json({
      ok: true,
      total: batchState.results.length,
      matched: batchState.results.filter(r => r.status === 'matched').length,
      results: batchState.results,
    });
  });

  return router;
};

// ─── Helper: 이름 유사도 ────────────────────────────────────
function nameSimilarity(a, b) {
  const la = (a || '').toLowerCase().replace(/\s+/g, '');
  const lb = (b || '').toLowerCase().replace(/\s+/g, '');
  if (la === lb) return 1;
  if (la.includes(lb) || lb.includes(la)) return 0.8;

  // Jaccard on character bigrams
  const bigramsA = new Set();
  const bigramsB = new Set();
  for (let i = 0; i < la.length - 1; i++) bigramsA.add(la.slice(i, i + 2));
  for (let i = 0; i < lb.length - 1; i++) bigramsB.add(lb.slice(i, i + 2));
  if (bigramsA.size === 0 || bigramsB.size === 0) return 0;
  let inter = 0;
  for (const b of bigramsA) if (bigramsB.has(b)) inter++;
  return inter / (bigramsA.size + bigramsB.size - inter);
}
