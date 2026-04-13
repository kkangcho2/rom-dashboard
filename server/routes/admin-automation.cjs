'use strict';

/**
 * admin-automation.cjs — Admin API routes for campaign automation system.
 * Provides endpoints for dashboard, job queue, review queue, stream monitoring,
 * reports, and email delivery management.
 */

const express = require('express');

module.exports = function (db) {
  const router = express.Router();

  const jobQueue = require('../services/job-queue.cjs');
  const orchestrator = require('../services/campaign-orchestrator.cjs');
  const reviewQueueService = require('../services/review-queue.cjs');

  // ═══════════════════════════════════════════════════════════════
  //  대시보드
  // ═══════════════════════════════════════════════════════════════

  router.get('/dashboard', (req, res) => {
    try {
      // 진행 중 캠페인
      const activeCampaigns = db.prepare(
        "SELECT COUNT(*) as count FROM campaigns WHERE state IN ('confirmed','live')"
      ).get().count;

      // 오늘 감지된 방송
      const today = new Date().toISOString().slice(0, 10);
      const todayStreams = db.prepare(
        "SELECT COUNT(*) as count FROM stream_sessions WHERE date(discovered_at) = ?"
      ).get(today).count;

      // 매칭 성공 수
      const matchedCount = db.prepare(
        "SELECT COUNT(*) as count FROM campaign_broadcast_matches WHERE status = 'matched'"
      ).get().count;

      // 검수 대기
      const reviewPending = db.prepare(
        "SELECT COUNT(*) as count FROM review_queue WHERE status = 'pending'"
      ).get().count;

      // 리포트 실패
      const reportFailed = db.prepare(
        "SELECT COUNT(*) as count FROM delivery_reports WHERE status = 'failed'"
      ).get().count;

      // 이메일 실패
      const emailFailed = db.prepare(
        "SELECT COUNT(*) as count FROM email_deliveries WHERE status = 'failed'"
      ).get().count;

      // 잡 큐 상태
      const queueStats = jobQueue.getStats();

      // 최근 실패 잡
      const recentFailedJobs = db.prepare(`
        SELECT id, job_type, attempts, max_attempts, created_at, updated_at
        FROM job_queue WHERE status = 'failed'
        ORDER BY updated_at DESC LIMIT 5
      `).all();

      // 최근 캠페인 상태 변화
      const recentCampaigns = db.prepare(`
        SELECT id, title, state, brand_name, target_game, updated_at
        FROM campaigns
        ORDER BY updated_at DESC LIMIT 10
      `).all();

      // 오케스트레이터 상태
      const orchStatus = orchestrator.getStatus();

      // 전체 테이블 데이터 카운트 (운영 현황)
      const tableCounts = {};
      const countTables = [
        'campaigns', 'campaign_creators', 'creator_profiles',
        'verification_reports', 'banner_verifications',
        'videos', 'transcripts', 'chat_messages',
        'delivery_reports', 'email_deliveries', 'job_queue',
        'stream_sessions', 'campaign_broadcast_matches', 'review_queue',
        'notifications', 'audit_logs'
      ];
      for (const t of countTables) {
        try {
          tableCounts[t] = db.prepare(`SELECT COUNT(*) as cnt FROM ${t}`).get().cnt;
        } catch { tableCounts[t] = 0; }
      }

      // 검증 리포트 통계
      const verificationReportStats = {
        total: tableCounts.verification_reports,
        generating: 0, completed: 0, failed: 0,
      };
      try {
        const vrByStatus = db.prepare("SELECT status, COUNT(*) as cnt FROM verification_reports GROUP BY status").all();
        for (const r of vrByStatus) verificationReportStats[r.status] = r.cnt;
      } catch {}

      // 이메일 발송 통계
      const emailStats = { total: tableCounts.email_deliveries, sent: 0, pending: 0, failed: 0 };
      try {
        const emailByStatus = db.prepare("SELECT status, COUNT(*) as cnt FROM email_deliveries GROUP BY status").all();
        for (const r of emailByStatus) emailStats[r.status] = r.cnt;
      } catch {}

      // 캠페인 상태 분포
      const campaignsByState = {};
      try {
        const stateRows = db.prepare("SELECT state, COUNT(*) as cnt FROM campaigns GROUP BY state").all();
        for (const r of stateRows) campaignsByState[r.state] = r.cnt;
      } catch {}

      res.json({
        ok: true,
        data: {
          kpi: {
            activeCampaigns,
            todayStreams,
            matchedCount,
            reviewPending,
            reportFailed,
            emailFailed,
          },
          queueStats,
          recentFailedJobs,
          recentCampaigns,
          orchestrator: orchStatus,
          tableCounts,
          verificationReportStats,
          emailStats,
          campaignsByState,
        },
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  //  캠페인 목록 (자동화 관점)
  // ═══════════════════════════════════════════════════════════════

  router.get('/campaigns', (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(50, parseInt(req.query.limit) || 20);
      const offset = (page - 1) * limit;
      const state = req.query.state || '';

      let where = '';
      const params = [];
      if (state) {
        where = 'WHERE c.state = ?';
        params.push(state);
      }

      const total = db.prepare(`SELECT COUNT(*) as cnt FROM campaigns c ${where}`).get(...params).cnt;

      const campaigns = db.prepare(`
        SELECT
          c.id, c.title, c.brand_name, c.target_game, c.state,
          c.campaign_start_date, c.campaign_end_date, c.updated_at,
          (SELECT COUNT(*) FROM campaign_creators WHERE campaign_id = c.id) as creator_count,
          (SELECT COUNT(*) FROM stream_sessions WHERE campaign_id = c.id) as stream_count,
          (SELECT COUNT(*) FROM campaign_broadcast_matches WHERE campaign_id = c.id AND status = 'matched') as matched_count,
          (SELECT COUNT(*) FROM delivery_reports WHERE campaign_id = c.id) as report_count,
          (SELECT MAX(created_at) FROM delivery_reports WHERE campaign_id = c.id) as last_report_at,
          (SELECT COUNT(*) FROM email_deliveries WHERE campaign_id = c.id AND status = 'sent') as emails_sent,
          (SELECT COUNT(*) FROM review_queue WHERE campaign_id = c.id AND status = 'pending') as review_pending,
          u.email as advertiser_email, u.name as advertiser_name
        FROM campaigns c
        LEFT JOIN users u ON u.id = c.advertiser_id
        ${where}
        ORDER BY c.updated_at DESC
        LIMIT ? OFFSET ?
      `).all(...params, limit, offset);

      res.json({
        ok: true,
        campaigns,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  //  캠페인 상세 (자동화 데이터 통합)
  // ═══════════════════════════════════════════════════════════════

  // 캠페인 자동화 옵션 업데이트
  router.put('/campaigns/:id/automation', (req, res) => {
    try {
      const {
        auto_monitoring_enabled, auto_reporting_enabled, auto_email_enabled,
        force_review, match_threshold, custom_weights_json, report_recipient_email
      } = req.body;

      const campaign = db.prepare('SELECT id FROM campaigns WHERE id = ?').get(req.params.id);
      if (!campaign) return res.status(404).json({ error: '캠페인 없음' });

      db.prepare(`
        UPDATE campaigns SET
          auto_monitoring_enabled = COALESCE(?, auto_monitoring_enabled),
          auto_reporting_enabled = COALESCE(?, auto_reporting_enabled),
          auto_email_enabled = COALESCE(?, auto_email_enabled),
          force_review = COALESCE(?, force_review),
          match_threshold = COALESCE(?, match_threshold),
          custom_weights_json = COALESCE(?, custom_weights_json),
          report_recipient_email = COALESCE(?, report_recipient_email),
          updated_at = datetime('now')
        WHERE id = ?
      `).run(
        auto_monitoring_enabled ?? null,
        auto_reporting_enabled ?? null,
        auto_email_enabled ?? null,
        force_review ?? null,
        match_threshold ?? null,
        custom_weights_json ?? null,
        report_recipient_email ?? null,
        req.params.id
      );

      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  //  시스템 설정
  // ═══════════════════════════════════════════════════════════════

  router.get('/settings', (req, res) => {
    try {
      let row = db.prepare('SELECT * FROM system_settings WHERE id = 1').get();
      if (!row) {
        db.prepare('INSERT INTO system_settings (id) VALUES (1)').run();
        row = db.prepare('SELECT * FROM system_settings WHERE id = 1').get();
      }
      res.json({ ok: true, settings: row });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/settings', (req, res) => {
    try {
      const {
        default_match_threshold, default_review_threshold,
        default_retry_attempts, polling_interval_sec,
        auto_email_globally_enabled, scan_interval_min,
        game_keywords_json, sponsor_keywords_json, custom_weights_json
      } = req.body;

      db.prepare(`
        UPDATE system_settings SET
          default_match_threshold = COALESCE(?, default_match_threshold),
          default_review_threshold = COALESCE(?, default_review_threshold),
          default_retry_attempts = COALESCE(?, default_retry_attempts),
          polling_interval_sec = COALESCE(?, polling_interval_sec),
          auto_email_globally_enabled = COALESCE(?, auto_email_globally_enabled),
          scan_interval_min = COALESCE(?, scan_interval_min),
          game_keywords_json = COALESCE(?, game_keywords_json),
          sponsor_keywords_json = COALESCE(?, sponsor_keywords_json),
          custom_weights_json = COALESCE(?, custom_weights_json),
          updated_at = datetime('now')
        WHERE id = 1
      `).run(
        default_match_threshold ?? null,
        default_review_threshold ?? null,
        default_retry_attempts ?? null,
        polling_interval_sec ?? null,
        auto_email_globally_enabled ?? null,
        scan_interval_min ?? null,
        game_keywords_json ?? null,
        sponsor_keywords_json ?? null,
        custom_weights_json ?? null,
      );
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 수동 즉시 스캔 (모든 LIVE 캠페인)
  router.post('/scan-now', (req, res) => {
    try {
      const stats = orchestrator.triggerScanNow();
      res.json({ ok: true, stats });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  //  Creators
  // ═══════════════════════════════════════════════════════════════

  router.get('/creators', (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(50, parseInt(req.query.limit) || 20);
      const offset = (page - 1) * limit;
      const search = (req.query.search || '').trim();
      const platform = req.query.platform || '';

      let conditions = [];
      const params = [];
      if (search) {
        conditions.push('cp.display_name LIKE ?');
        params.push(`%${search}%`);
      }
      if (platform === 'youtube') conditions.push('cp.youtube_channel_id IS NOT NULL AND cp.youtube_channel_id != ""');
      if (platform === 'chzzk') conditions.push('cp.chzzk_channel_id IS NOT NULL AND cp.chzzk_channel_id != ""');
      if (platform === 'afreeca') conditions.push('cp.afreeca_channel_id IS NOT NULL AND cp.afreeca_channel_id != ""');
      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const total = db.prepare(`SELECT COUNT(*) as cnt FROM creator_profiles cp ${where}`).get(...params).cnt;

      const creators = db.prepare(`
        SELECT cp.*,
          u.email,
          (SELECT COUNT(*) FROM campaign_creators WHERE creator_profile_id = cp.id) as campaigns_joined,
          (SELECT COUNT(*) FROM creator_analysis_reports WHERE platform='youtube' AND channel_id = cp.youtube_channel_id) as analysis_reports
        FROM creator_profiles cp
        LEFT JOIN users u ON u.id = cp.user_id
        ${where}
        ORDER BY cp.avg_concurrent_viewers DESC, cp.created_at DESC
        LIMIT ? OFFSET ?
      `).all(...params, limit, offset);

      res.json({
        ok: true,
        creators,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Creator 상세
  router.get('/creators/:id', (req, res) => {
    try {
      const creator = db.prepare(`
        SELECT cp.*, u.email
        FROM creator_profiles cp
        LEFT JOIN users u ON u.id = cp.user_id
        WHERE cp.id = ?
      `).get(req.params.id);

      if (!creator) return res.status(404).json({ error: '크리에이터 없음' });

      // 캠페인 이력
      const campaigns = db.prepare(`
        SELECT cc.*, c.title as campaign_title, c.brand_name, c.target_game, c.state
        FROM campaign_creators cc
        LEFT JOIN campaigns c ON c.id = cc.campaign_id
        WHERE cc.creator_profile_id = ?
        ORDER BY cc.created_at DESC
      `).all(req.params.id);

      // 최근 분석 리포트
      let analysisReports = [];
      if (creator.youtube_channel_id) {
        analysisReports = db.prepare(`
          SELECT id, platform, channel_name, subscriber_count, status, marketing_insight, created_at
          FROM creator_analysis_reports
          WHERE platform = 'youtube' AND channel_id = ?
          ORDER BY created_at DESC LIMIT 5
        `).all(creator.youtube_channel_id);
      }

      // 최근 감지 방송
      const recentStreams = db.prepare(`
        SELECT ss.*, c.title as campaign_title
        FROM stream_sessions ss
        LEFT JOIN campaign_creators cc ON cc.id = ss.campaign_creator_id
        LEFT JOIN campaigns c ON c.id = ss.campaign_id
        WHERE cc.creator_profile_id = ?
        ORDER BY ss.discovered_at DESC LIMIT 20
      `).all(req.params.id);

      res.json({ ok: true, creator, campaigns, analysisReports, recentStreams });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/campaigns/:id', (req, res) => {
    try {
      const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
      if (!campaign) return res.status(404).json({ error: '캠페인 없음' });

      const creators = db.prepare(`
        SELECT cc.*, cp.display_name, cp.youtube_channel_id, cp.chzzk_channel_id,
               cp.afreeca_channel_id, cp.engagement_grade, cp.avg_concurrent_viewers,
               cp.thumbnail_url
        FROM campaign_creators cc
        JOIN creator_profiles cp ON cp.id = cc.creator_profile_id
        WHERE cc.campaign_id = ?
      `).all(req.params.id);

      res.json({ ok: true, campaign, creators });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 캠페인별 감지 방송
  router.get('/campaigns/:id/streams', (req, res) => {
    try {
      const streams = db.prepare(`
        SELECT ss.*,
          (SELECT status FROM campaign_broadcast_matches WHERE stream_session_id = ss.id LIMIT 1) as match_status,
          (SELECT confidence FROM campaign_broadcast_matches WHERE stream_session_id = ss.id LIMIT 1) as match_confidence,
          (SELECT review_required FROM campaign_broadcast_matches WHERE stream_session_id = ss.id LIMIT 1) as review_required,
          cp.display_name as creator_name
        FROM stream_sessions ss
        LEFT JOIN campaign_creators cc ON cc.id = ss.campaign_creator_id
        LEFT JOIN creator_profiles cp ON cp.id = cc.creator_profile_id
        WHERE ss.campaign_id = ?
        ORDER BY ss.discovered_at DESC
      `).all(req.params.id);

      res.json({ ok: true, streams });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 캠페인별 리포트 (기존 verification + 신규 delivery + 이메일)
  router.get('/campaigns/:id/reports', (req, res) => {
    try {
      // 기존 검증 리포트
      const verificationReports = db.prepare(`
        SELECT vr.*, cp.display_name as creator_name
        FROM verification_reports vr
        LEFT JOIN campaign_creators cc ON cc.id = vr.campaign_creator_id
        LEFT JOIN creator_profiles cp ON cp.id = cc.creator_profile_id
        WHERE vr.campaign_id = ?
        ORDER BY vr.created_at DESC
      `).all(req.params.id);

      // 신규 배송 리포트
      const deliveryReports = db.prepare(`
        SELECT * FROM delivery_reports WHERE campaign_id = ? ORDER BY created_at DESC
      `).all(req.params.id);

      // 이메일 발송 내역
      const emails = db.prepare(`
        SELECT * FROM email_deliveries WHERE campaign_id = ? ORDER BY created_at DESC
      `).all(req.params.id);

      res.json({ ok: true, verificationReports, deliveryReports, emails });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 캠페인별 자동화 로그 (job_queue)
  router.get('/campaigns/:id/jobs', (req, res) => {
    try {
      const jobs = db.prepare(`
        SELECT * FROM job_queue
        WHERE json_extract(payload_json, '$.campaignId') = ?
        ORDER BY created_at DESC
        LIMIT 50
      `).all(req.params.id);

      res.json({ ok: true, jobs });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 캠페인별 매칭 결과
  router.get('/campaigns/:id/matches', (req, res) => {
    try {
      const matches = db.prepare(`
        SELECT cbm.*, cp.display_name as creator_name, ss.title as stream_title,
               ss.platform, ss.stream_url
        FROM campaign_broadcast_matches cbm
        LEFT JOIN campaign_creators cc ON cc.id = cbm.campaign_creator_id
        LEFT JOIN creator_profiles cp ON cp.id = cc.creator_profile_id
        LEFT JOIN stream_sessions ss ON ss.id = cbm.stream_session_id
        WHERE cbm.campaign_id = ?
        ORDER BY cbm.created_at DESC
      `).all(req.params.id);

      res.json({ ok: true, matches });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  //  검수 큐
  // ═══════════════════════════════════════════════════════════════

  router.get('/review-queue', (req, res) => {
    try {
      const status = req.query.status || 'pending';
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(50, parseInt(req.query.limit) || 20);
      const offset = (page - 1) * limit;

      const total = db.prepare(
        'SELECT COUNT(*) as cnt FROM review_queue WHERE status = ?'
      ).get(status).cnt;

      const items = db.prepare(`
        SELECT rq.*,
          c.title as campaign_title, c.brand_name, c.target_game,
          cp.display_name as creator_name,
          ss.title as stream_title, ss.platform, ss.stream_url
        FROM review_queue rq
        LEFT JOIN campaigns c ON c.id = rq.campaign_id
        LEFT JOIN campaign_creators cc ON cc.id = rq.campaign_creator_id
        LEFT JOIN creator_profiles cp ON cp.id = cc.creator_profile_id
        LEFT JOIN stream_sessions ss ON ss.id = CAST(json_extract(rq.payload_json, '$.streamSessionId') AS INTEGER)
        WHERE rq.status = ?
        ORDER BY rq.created_at DESC
        LIMIT ? OFFSET ?
      `).all(status, limit, offset);

      res.json({
        ok: true,
        items: items.map(r => ({ ...r, payload: JSON.parse(r.payload_json || '{}') })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 검수 항목 상세 (transcript/chat 샘플 + 배너 + 영상 정보)
  router.get('/review-queue/:id/detail', (req, res) => {
    try {
      const item = db.prepare('SELECT * FROM review_queue WHERE id = ?').get(req.params.id);
      if (!item) return res.status(404).json({ error: '항목 없음' });

      const payload = JSON.parse(item.payload_json || '{}');
      const streamSessionId = payload.streamSessionId || payload.result?.streamSessionId;
      const campaignId = item.campaign_id;
      const campaignCreatorId = item.campaign_creator_id;

      // Campaign / Creator
      const campaign = campaignId ? db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId) : null;
      const campaignCreator = campaignCreatorId ? db.prepare(`
        SELECT cc.*, cp.display_name, cp.youtube_channel_id, cp.chzzk_channel_id, cp.afreeca_channel_id, cp.thumbnail_url
        FROM campaign_creators cc
        LEFT JOIN creator_profiles cp ON cp.id = cc.creator_profile_id
        WHERE cc.id = ?
      `).get(campaignCreatorId) : null;

      // Stream session
      const session = streamSessionId ? db.prepare('SELECT * FROM stream_sessions WHERE id = ?').get(streamSessionId) : null;

      // Try to resolve video
      let video = null;
      let transcript = null;
      let chatSample = [];
      if (session && session.video_id) {
        video = db.prepare('SELECT * FROM videos WHERE platform = ? AND video_id = ?').get(session.platform, session.video_id);
        if (video) {
          const tr = db.prepare('SELECT content, language FROM transcripts WHERE video_id = ? LIMIT 1').get(video.id);
          transcript = tr?.content || null;
          chatSample = db.prepare('SELECT timestamp, username, message FROM chat_messages WHERE video_id = ? ORDER BY id DESC LIMIT 50').all(video.id);
        }
      }

      // Banner verification
      const bannerVerification = campaignCreatorId ? db.prepare(`
        SELECT banner_detected, confidence, detection_method, checked_at, stream_url, screenshot_path
        FROM banner_verifications
        WHERE campaign_creator_id = ?
        ORDER BY checked_at DESC LIMIT 1
      `).get(campaignCreatorId) : null;

      // Match reasons from campaign_broadcast_matches
      const match = streamSessionId ? db.prepare(`
        SELECT confidence, reasons_json, matched, review_required, status
        FROM campaign_broadcast_matches
        WHERE stream_session_id = ?
        ORDER BY created_at DESC LIMIT 1
      `).get(streamSessionId) : null;

      const reasons = match?.reasons_json ? JSON.parse(match.reasons_json) : [];

      res.json({
        ok: true,
        item: { ...item, payload },
        campaign,
        campaignCreator,
        session,
        video,
        transcript,
        chatSample,
        bannerVerification,
        match: match ? { ...match, reasons } : null,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 검수 승인
  router.post('/review-queue/:id/approve', (req, res) => {
    try {
      reviewQueueService.resolve({ id: req.params.id, status: 'approved', reviewerId: req.user.id });

      // 승인 시 매칭 결과도 업데이트
      const item = db.prepare('SELECT * FROM review_queue WHERE id = ?').get(req.params.id);
      if (item) {
        const payload = JSON.parse(item.payload_json || '{}');
        if (payload.streamSessionId && item.campaign_id && item.campaign_creator_id) {
          db.prepare(`
            UPDATE campaign_broadcast_matches
            SET matched = 1, status = 'matched', review_required = 0, updated_at = datetime('now')
            WHERE campaign_id = ? AND campaign_creator_id = ? AND stream_session_id = ?
          `).run(item.campaign_id, item.campaign_creator_id, payload.streamSessionId);
        }
      }

      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 검수 거절
  router.post('/review-queue/:id/reject', (req, res) => {
    try {
      reviewQueueService.resolve({ id: req.params.id, status: 'rejected', reviewerId: req.user.id });

      const item = db.prepare('SELECT * FROM review_queue WHERE id = ?').get(req.params.id);
      if (item) {
        const payload = JSON.parse(item.payload_json || '{}');
        if (payload.streamSessionId && item.campaign_id && item.campaign_creator_id) {
          db.prepare(`
            UPDATE campaign_broadcast_matches
            SET matched = 0, status = 'rejected', review_required = 0, updated_at = datetime('now')
            WHERE campaign_id = ? AND campaign_creator_id = ? AND stream_session_id = ?
          `).run(item.campaign_id, item.campaign_creator_id, payload.streamSessionId);
        }
      }

      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  //  작업 큐
  // ═══════════════════════════════════════════════════════════════

  router.get('/jobs', (req, res) => {
    try {
      const status = req.query.status || '';
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, parseInt(req.query.limit) || 30);
      const offset = (page - 1) * limit;

      let where = '';
      const params = [];
      if (status) { where = 'WHERE status = ?'; params.push(status); }

      const total = db.prepare(`SELECT COUNT(*) as cnt FROM job_queue ${where}`).get(...params).cnt;

      const jobs = db.prepare(`
        SELECT * FROM job_queue ${where}
        ORDER BY
          CASE status WHEN 'running' THEN 0 WHEN 'pending' THEN 1 WHEN 'failed' THEN 2 ELSE 3 END,
          priority DESC, created_at DESC
        LIMIT ? OFFSET ?
      `).all(...params, limit, offset);

      res.json({
        ok: true,
        jobs: jobs.map(j => ({ ...j, payload: JSON.parse(j.payload_json || '{}') })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 잡 재시도
  router.post('/jobs/:id/retry', (req, res) => {
    try {
      const job = db.prepare('SELECT * FROM job_queue WHERE id = ?').get(req.params.id);
      if (!job) return res.status(404).json({ error: '잡 없음' });

      db.prepare(`
        UPDATE job_queue
        SET status = 'pending', attempts = 0, locked_at = NULL, locked_by = NULL,
            run_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).run(req.params.id);

      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 잡 취소
  router.post('/jobs/:id/cancel', (req, res) => {
    try {
      db.prepare(`
        UPDATE job_queue SET status = 'failed', updated_at = datetime('now') WHERE id = ?
      `).run(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  //  방송 모니터링 (전체)
  // ═══════════════════════════════════════════════════════════════

  router.get('/streams', (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(50, parseInt(req.query.limit) || 20);
      const offset = (page - 1) * limit;
      const platform = req.query.platform || '';
      const matchStatus = req.query.match_status || '';

      let conditions = [];
      const params = [];
      if (platform) { conditions.push('ss.platform = ?'); params.push(platform); }
      if (matchStatus) { conditions.push('cbm.status = ?'); params.push(matchStatus); }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const total = db.prepare(`
        SELECT COUNT(*) as cnt FROM stream_sessions ss
        LEFT JOIN campaign_broadcast_matches cbm ON cbm.stream_session_id = ss.id
        ${where}
      `).get(...params).cnt;

      const streams = db.prepare(`
        SELECT ss.*,
          c.title as campaign_title, c.brand_name,
          cp.display_name as creator_name,
          cbm.status as match_status, cbm.confidence as match_confidence,
          cbm.review_required, cbm.matched,
          (SELECT COUNT(*) FROM banner_verifications WHERE campaign_creator_id = ss.campaign_creator_id) as banner_count
        FROM stream_sessions ss
        LEFT JOIN campaigns c ON c.id = ss.campaign_id
        LEFT JOIN campaign_creators cc ON cc.id = ss.campaign_creator_id
        LEFT JOIN creator_profiles cp ON cp.id = cc.creator_profile_id
        LEFT JOIN campaign_broadcast_matches cbm ON cbm.stream_session_id = ss.id
        ${where}
        ORDER BY ss.discovered_at DESC
        LIMIT ? OFFSET ?
      `).all(...params, limit, offset);

      res.json({
        ok: true,
        streams,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 수동 매칭 강제 지정
  router.post('/streams/:id/force-match', (req, res) => {
    try {
      const session = db.prepare('SELECT * FROM stream_sessions WHERE id = ?').get(req.params.id);
      if (!session) return res.status(404).json({ error: '세션 없음' });

      db.prepare(`
        INSERT INTO campaign_broadcast_matches (campaign_id, campaign_creator_id, stream_session_id, matched, confidence, reasons_json, review_required, status)
        VALUES (?, ?, ?, 1, 1.0, ?, 0, 'matched')
        ON CONFLICT (campaign_id, campaign_creator_id, COALESCE(video_id, -1), COALESCE(stream_session_id, -1))
        DO UPDATE SET matched = 1, confidence = 1.0, status = 'matched', review_required = 0, updated_at = datetime('now')
      `).run(session.campaign_id, session.campaign_creator_id, session.id, JSON.stringify([{ type: 'manual', matched: true, score: 1.0, detail: 'admin forced match' }]));

      db.prepare('UPDATE stream_sessions SET processed_at = datetime(\'now\') WHERE id = ?').run(session.id);

      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 수동 제외
  router.post('/streams/:id/exclude', (req, res) => {
    try {
      const session = db.prepare('SELECT * FROM stream_sessions WHERE id = ?').get(req.params.id);
      if (!session) return res.status(404).json({ error: '세션 없음' });

      db.prepare(`
        INSERT INTO campaign_broadcast_matches (campaign_id, campaign_creator_id, stream_session_id, matched, confidence, reasons_json, review_required, status)
        VALUES (?, ?, ?, 0, 0, ?, 0, 'rejected')
        ON CONFLICT (campaign_id, campaign_creator_id, COALESCE(video_id, -1), COALESCE(stream_session_id, -1))
        DO UPDATE SET matched = 0, confidence = 0, status = 'rejected', review_required = 0, updated_at = datetime('now')
      `).run(session.campaign_id, session.campaign_creator_id, session.id, JSON.stringify([{ type: 'manual', matched: false, score: 0, detail: 'admin excluded' }]));

      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  //  리포트 센터 (기존 verification_reports + 신규 delivery_reports 통합)
  // ═══════════════════════════════════════════════════════════════

  router.get('/reports', (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(50, parseInt(req.query.limit) || 20);
      const offset = (page - 1) * limit;

      // 기존 검증 리포트 (verification_reports) — 실제 데이터가 여기에 있음
      const vrTotal = db.prepare('SELECT COUNT(*) as cnt FROM verification_reports').get().cnt;
      const verificationReports = db.prepare(`
        SELECT vr.id, vr.campaign_id, vr.campaign_creator_id,
               vr.total_stream_minutes, vr.banner_exposed_minutes, vr.exposure_rate,
               vr.avg_viewers_during, vr.peak_viewers, vr.total_impressions,
               vr.engagement_summary, vr.sentiment_summary, vr.report_data,
               vr.pdf_url, vr.web_url, vr.status, vr.created_at,
               c.title as campaign_title, c.brand_name, c.target_game,
               cp.display_name as creator_name
        FROM verification_reports vr
        LEFT JOIN campaigns c ON c.id = vr.campaign_id
        LEFT JOIN campaign_creators cc ON cc.id = vr.campaign_creator_id
        LEFT JOIN creator_profiles cp ON cp.id = cc.creator_profile_id
        ORDER BY vr.created_at DESC
        LIMIT ? OFFSET ?
      `).all(limit, offset);

      // 신규 배송 리포트 (delivery_reports) — 자동화 파이프라인용
      const drTotal = db.prepare('SELECT COUNT(*) as cnt FROM delivery_reports').get().cnt;
      const deliveryReports = db.prepare(`
        SELECT dr.*, c.title as campaign_title, c.brand_name, c.target_game
        FROM delivery_reports dr
        LEFT JOIN campaigns c ON c.id = dr.campaign_id
        ORDER BY dr.created_at DESC
        LIMIT ?
      `).all(limit);

      res.json({
        ok: true,
        verificationReports,
        deliveryReports,
        pagination: { page, limit, total: vrTotal, totalPages: Math.ceil(vrTotal / limit) },
        counts: { verification: vrTotal, delivery: drTotal },
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 리포트 상세 (verification_report)
  router.get('/reports/verification/:id', (req, res) => {
    try {
      const report = db.prepare(`
        SELECT vr.*,
               c.title as campaign_title, c.brand_name, c.target_game,
               c.campaign_start_date, c.campaign_end_date,
               cp.display_name as creator_name, cp.youtube_channel_id,
               cp.chzzk_channel_id, cp.afreeca_channel_id
        FROM verification_reports vr
        LEFT JOIN campaigns c ON c.id = vr.campaign_id
        LEFT JOIN campaign_creators cc ON cc.id = vr.campaign_creator_id
        LEFT JOIN creator_profiles cp ON cp.id = cc.creator_profile_id
        WHERE vr.id = ?
      `).get(req.params.id);

      if (!report) return res.status(404).json({ error: '리포트 없음' });

      res.json({ ok: true, report });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 리포트 재생성
  router.post('/reports/:campaignId/regenerate', async (req, res) => {
    try {
      jobQueue.enqueue({
        jobType: 'generate_campaign_report',
        payload: { campaignId: req.params.campaignId },
        dedupeKey: `campaign:${req.params.campaignId}:regenerate_report:${Date.now()}`,
        priority: 10,
      });
      res.json({ ok: true, message: '리포트 재생성 잡 등록됨' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  //  이메일 발송
  // ═══════════════════════════════════════════════════════════════

  router.get('/emails', (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(50, parseInt(req.query.limit) || 20);
      const offset = (page - 1) * limit;

      const total = db.prepare('SELECT COUNT(*) as cnt FROM email_deliveries').get().cnt;

      const emails = db.prepare(`
        SELECT ed.*, c.title as campaign_title
        FROM email_deliveries ed
        LEFT JOIN campaigns c ON c.id = ed.campaign_id
        ORDER BY ed.created_at DESC
        LIMIT ? OFFSET ?
      `).all(limit, offset);

      res.json({
        ok: true,
        emails,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 이메일 재발송
  router.post('/emails/:campaignId/resend', (req, res) => {
    try {
      jobQueue.enqueue({
        jobType: 'send_campaign_email',
        payload: { campaignId: req.params.campaignId },
        dedupeKey: `campaign:${req.params.campaignId}:resend_email:${Date.now()}`,
        priority: 5,
      });
      res.json({ ok: true, message: '이메일 재발송 잡 등록됨' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  //  수동 트리거
  // ═══════════════════════════════════════════════════════════════

  // 수동으로 스트림 스캔 트리거
  router.post('/campaigns/:id/scan-streams', (req, res) => {
    try {
      jobQueue.enqueue({
        jobType: 'sync_campaign_streams',
        payload: { campaignId: req.params.id },
        dedupeKey: `campaign:${req.params.id}:manual_scan:${Date.now()}`,
        priority: 10,
      });
      res.json({ ok: true, message: '스트림 스캔 잡 등록됨' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 수동으로 매칭 재실행
  router.post('/streams/:id/rematch', (req, res) => {
    try {
      const session = db.prepare('SELECT * FROM stream_sessions WHERE id = ?').get(req.params.id);
      if (!session) return res.status(404).json({ error: '세션 없음' });

      // Reset processed_at
      db.prepare('UPDATE stream_sessions SET processed_at = NULL WHERE id = ?').run(session.id);

      jobQueue.enqueue({
        jobType: 'match_campaign_broadcast',
        payload: {
          campaignId: session.campaign_id,
          campaignCreatorId: session.campaign_creator_id,
          streamSessionId: session.id,
          platform: session.platform,
        },
        dedupeKey: `campaign:${session.campaign_id}:rematch:stream_session:${session.id}:${Date.now()}`,
        priority: 8,
      });
      res.json({ ok: true, message: '재매칭 잡 등록됨' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
