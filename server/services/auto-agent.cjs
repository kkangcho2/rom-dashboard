/**
 * Auto Agent - 24시간 자동 분석 에이전트
 *
 * 서버 시작 시 자동 실행. 등록된 크리에이터를 순회하며:
 * 1. 통합 분석 (creator-analyzer) -- 없거나 7일 지났으면 실행
 * 2. 프로필 자동 업데이트
 *
 * 크리에이터 간 딜레이로 YouTube 레이트리밋 방지
 * 전체 순회 후 대기 -> 24시간 주기 반복
 */
const CreatorAnalyzer = require('./creator-analyzer.cjs');

class AutoAgent {
  constructor(db) {
    this.db = db;
    this.analyzer = new CreatorAnalyzer(db);
    this.running = false;
    this.paused = false;
    this.stats = {
      lastRunAt: null,
      totalProcessed: 0,
      analyzed: 0,
      errors: 0,
      currentCreator: null,
      cycleCount: 0,
    };
    this._timer = null;
  }

  /**
   * 에이전트 시작 -- 서버 부팅 시 호출
   * @param {number} delayMinutes - 첫 실행 전 대기 (서버 안정화)
   */
  start(delayMinutes = 2) {
    if (this.running) return;
    this.running = true;

    console.log(`[AutoAgent] Starting in ${delayMinutes} minutes...`);
    this._timer = setTimeout(() => this._runCycle(), delayMinutes * 60 * 1000);
  }

  stop() {
    this.running = false;
    this.paused = false;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    console.log('[AutoAgent] Stopped');
  }

  pause() { this.paused = true; console.log('[AutoAgent] Paused'); }
  resume() { this.paused = false; console.log('[AutoAgent] Resumed'); }

  getStatus() {
    return {
      running: this.running,
      paused: this.paused,
      ...this.stats,
    };
  }

  async _runCycle() {
    if (!this.running) return;

    this.stats.cycleCount++;
    this.stats.lastRunAt = new Date().toISOString();
    console.log(`[AutoAgent] Cycle #${this.stats.cycleCount} starting...`);

    try {
      // 분석이 필요한 크리에이터 목록
      const creators = this.db.prepare(`
        SELECT cp.id, cp.display_name, cp.youtube_channel_id, cp.updated_at
        FROM creator_profiles cp
        JOIN users u ON u.id = cp.user_id
        WHERE u.status = 'active'
          AND cp.youtube_channel_id IS NOT NULL
          AND cp.youtube_channel_id != ''
        ORDER BY cp.updated_at ASC
      `).all();

      console.log(`[AutoAgent] ${creators.length} creators to process`);

      for (let i = 0; i < creators.length; i++) {
        if (!this.running) break;
        while (this.paused) {
          await new Promise(r => setTimeout(r, 5000));
          if (!this.running) return;
        }

        const c = creators[i];
        this.stats.currentCreator = c.display_name;

        try {
          // 완료된 리포트가 있는지 확인
          const existing = this.db.prepare(`
            SELECT id, completed_at FROM creator_analysis_reports
            WHERE channel_id = ? AND status = 'completed'
            ORDER BY completed_at DESC LIMIT 1
          `).get(c.youtube_channel_id);

          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
          const needsAnalysis = !existing || (existing.completed_at && existing.completed_at < sevenDaysAgo);

          if (needsAnalysis) {
            console.log(`[AutoAgent] Analyzing: ${c.display_name}`);
            const channelUrl = `https://www.youtube.com/channel/${c.youtube_channel_id}`;
            await this.analyzer.analyze(channelUrl, null);
            this.stats.analyzed++;
            await this._delay(5000); // 5초 대기 (통합 분석은 영상 크롤링 포함)
          }

          this.stats.totalProcessed++;

          // 진행 로그 (20명마다)
          if ((i + 1) % 20 === 0) {
            console.log(`[AutoAgent] Progress: ${i + 1}/${creators.length} (analyzed: ${this.stats.analyzed})`);
          }

        } catch (err) {
          this.stats.errors++;
          console.warn(`[AutoAgent] Error for ${c.display_name}:`, err.message);
          await this._delay(2000);
        }
      }

      this.stats.currentCreator = null;
      console.log(`[AutoAgent] Cycle #${this.stats.cycleCount} complete. Analyzed: ${this.stats.analyzed}, Errors: ${this.stats.errors}`);

    } catch (err) {
      console.error('[AutoAgent] Cycle failed:', err.message);
    }

    // 다음 사이클 예약 (24시간 후)
    if (this.running) {
      const nextRunMs = 24 * 60 * 60 * 1000;
      console.log(`[AutoAgent] Next cycle in 24 hours`);
      this._timer = setTimeout(() => this._runCycle(), nextRunMs);
    }
  }

  _delay(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
}

module.exports = AutoAgent;
