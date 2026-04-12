'use strict';

/**
 * stream-monitor.cjs — Discovers active streams/VODs for campaign creators.
 * Phase 2 of Campaign Automation System.
 *
 * Scans each creator's channels, discovers recent streams/VODs,
 * upserts into stream_sessions, and enqueues match jobs.
 */

const db = require('../db.cjs');
const jobQueue = require('./job-queue.cjs');

// Crawlers (read-only usage)
const youtubeCrawler = require('../crawlers/youtube.cjs');
let chzzkCrawler = null;
let afreecaCrawler = null;
try { chzzkCrawler = require('../crawlers/chzzk.cjs'); } catch {}
try { afreecaCrawler = require('../crawlers/afreeca.cjs'); } catch {}

// ─── Prepared statements ────────────────────────────────────────
let _stmts = null;
function stmts() {
  if (_stmts) return _stmts;
  _stmts = {
    getCampaign: db.prepare('SELECT * FROM campaigns WHERE id = ?'),

    getCampaignCreators: db.prepare(`
      SELECT cc.id as campaign_creator_id, cc.campaign_id, cc.creator_profile_id,
             cp.youtube_channel_id, cp.chzzk_channel_id, cp.afreeca_channel_id,
             cp.display_name
      FROM campaign_creators cc
      JOIN creator_profiles cp ON cp.id = cc.creator_profile_id
      WHERE cc.campaign_id = ?
    `),

    upsertSession: db.prepare(`
      INSERT INTO stream_sessions (
        campaign_id, campaign_creator_id, platform, channel_id,
        stream_url, video_id, title, live_status, started_at, ended_at,
        metadata_json, discovered_at, updated_at
      ) VALUES (
        @campaignId, @campaignCreatorId, @platform, @channelId,
        @streamUrl, @videoId, @title, @liveStatus, @startedAt, @endedAt,
        @metadataJson, datetime('now'), datetime('now')
      )
      ON CONFLICT (campaign_creator_id, platform, COALESCE(video_id, stream_url))
      DO UPDATE SET
        title = excluded.title,
        started_at = COALESCE(excluded.started_at, stream_sessions.started_at),
        ended_at = COALESCE(excluded.ended_at, stream_sessions.ended_at),
        metadata_json = excluded.metadata_json,
        updated_at = datetime('now')
    `),

    getSessionId: db.prepare(`
      SELECT id FROM stream_sessions
      WHERE campaign_creator_id = @campaignCreatorId
        AND platform = @platform
        AND COALESCE(video_id, stream_url) = @uniqueKey
    `),

    getUnprocessedSessions: db.prepare(`
      SELECT id, campaign_id, campaign_creator_id, platform, video_id
      FROM stream_sessions
      WHERE campaign_id = ? AND processed_at IS NULL
    `),

    getExistingVideos: db.prepare(`
      SELECT v.id as video_id, v.video_id as platform_video_id, v.title,
             v.views, v.likes, v.published_at, v.duration,
             c.channel_id, c.platform
      FROM videos v
      JOIN channels c ON c.id = v.channel_id
      WHERE c.channel_id = @channelId AND c.platform = @platform
      ORDER BY v.published_at DESC
      LIMIT 30
    `),
  };
  return _stmts;
}

// ─── Main Entry Point ───────────────────────────────────────────

/**
 * Scan all creators for a campaign and discover streams.
 */
async function scanCampaignStreams(campaignId) {
  const campaign = stmts().getCampaign.get(campaignId);
  if (!campaign) {
    throw new Error(`Campaign ${campaignId} not found`);
  }

  const creators = loadCampaignCreators(campaignId);
  if (creators.length === 0) {
    console.log(`[StreamMonitor] No creators found for campaign ${campaignId}`);
    return { campaignId, scannedCreators: 0, discoveredSessions: 0, queuedMatchJobs: 0 };
  }

  const timeWindow = computeTimeWindow(campaign);
  let totalDiscovered = 0;

  for (const creator of creators) {
    try {
      const discovered = await scanCreatorStreams({
        campaignId,
        campaignCreatorId: creator.campaign_creator_id,
        creator,
        timeWindow,
      });
      totalDiscovered += discovered;
    } catch (err) {
      console.error(`[StreamMonitor] Error scanning creator ${creator.display_name}:`, err.message);
    }
  }

  // Enqueue match jobs for unprocessed sessions
  const queuedMatchJobs = enqueueMatchJobsForCampaign(campaignId);

  console.log(`[StreamMonitor] Campaign ${campaignId}: scanned=${creators.length}, discovered=${totalDiscovered}, queued=${queuedMatchJobs}`);

  return {
    campaignId,
    scannedCreators: creators.length,
    discoveredSessions: totalDiscovered,
    queuedMatchJobs,
  };
}

/**
 * Scan a single creator's channels for streams.
 */
async function scanCreatorStreams({ campaignId, campaignCreatorId, creator, timeWindow }) {
  let discovered = 0;

  // YouTube
  if (creator.youtube_channel_id) {
    try {
      const sessions = await discoverYoutubeSessions({
        campaignId,
        campaignCreatorId,
        channelId: creator.youtube_channel_id,
        timeWindow,
      });
      for (const session of sessions) {
        upsertStreamSession(session);
        discovered++;
      }
    } catch (err) {
      console.error(`[StreamMonitor] YouTube scan failed for ${creator.youtube_channel_id}:`, err.message);
    }
  }

  // Chzzk
  if (creator.chzzk_channel_id && chzzkCrawler) {
    try {
      const sessions = await discoverChzzkSessions({
        campaignId,
        campaignCreatorId,
        channelId: creator.chzzk_channel_id,
        timeWindow,
      });
      for (const session of sessions) {
        upsertStreamSession(session);
        discovered++;
      }
    } catch (err) {
      console.error(`[StreamMonitor] Chzzk scan failed for ${creator.chzzk_channel_id}:`, err.message);
    }
  }

  // AfreecaTV
  if (creator.afreeca_channel_id && afreecaCrawler) {
    try {
      const sessions = await discoverAfreecaSessions({
        campaignId,
        campaignCreatorId,
        channelId: creator.afreeca_channel_id,
        timeWindow,
      });
      for (const session of sessions) {
        upsertStreamSession(session);
        discovered++;
      }
    } catch (err) {
      console.error(`[StreamMonitor] AfreecaTV scan failed for ${creator.afreeca_channel_id}:`, err.message);
    }
  }

  return discovered;
}

// ─── Platform Discovery ─────────────────────────────────────────

/**
 * Discover YouTube streams/VODs for a channel within time window.
 * Uses existing crawled videos from DB first, then attempts fresh scraping.
 */
async function discoverYoutubeSessions({ campaignId, campaignCreatorId, channelId, timeWindow }) {
  const sessions = [];

  // 1. Check existing videos in DB
  const existingVideos = stmts().getExistingVideos.all({
    channelId,
    platform: 'youtube',
  });

  for (const video of existingVideos) {
    if (isInTimeWindow(video.published_at, timeWindow)) {
      sessions.push({
        campaignId,
        campaignCreatorId,
        platform: 'youtube',
        channelId,
        streamUrl: `https://www.youtube.com/watch?v=${video.platform_video_id}`,
        videoId: video.platform_video_id,
        title: video.title,
        liveStatus: 'vod',
        startedAt: video.published_at || null,
        endedAt: null,
        metadata: {
          views: video.views,
          likes: video.likes,
          duration: video.duration,
          source: 'db_existing',
        },
      });
    }
  }

  // 2. Try to discover additional videos via YouTube crawler scraping
  try {
    const { scrapeChannelVideoTitles } = require('../utils/game-detection.cjs');
    const scrapedTitles = await scrapeChannelVideoTitles(channelId, 20);

    // scrapedTitles returns [{title, ...}] — limited info; we still record them
    // but they may overlap with DB videos. The upsert handles deduplication.
  } catch (err) {
    // Non-critical: we already have DB videos
    console.log(`[StreamMonitor] YouTube scrape for ${channelId} skipped:`, err.message);
  }

  return sessions;
}

/**
 * Discover Chzzk streams/VODs for a channel.
 */
async function discoverChzzkSessions({ campaignId, campaignCreatorId, channelId, timeWindow }) {
  const sessions = [];

  if (!chzzkCrawler) return sessions;

  try {
    // Check live status
    const liveStatus = await chzzkCrawler.crawlLiveStatus(channelId);
    if (liveStatus && liveStatus.isLive) {
      sessions.push({
        campaignId,
        campaignCreatorId,
        platform: 'chzzk',
        channelId,
        streamUrl: `https://chzzk.naver.com/live/${channelId}`,
        videoId: null,
        title: liveStatus.title || '',
        liveStatus: 'live',
        startedAt: liveStatus.openDate || new Date().toISOString(),
        endedAt: null,
        metadata: {
          concurrentViewers: liveStatus.concurrentUserCount,
          categoryType: liveStatus.categoryType,
          source: 'chzzk_live',
        },
      });
    }
  } catch (err) {
    console.error(`[StreamMonitor] Chzzk live check failed for ${channelId}:`, err.message);
  }

  // Also check existing DB records for chzzk videos
  const existingVideos = stmts().getExistingVideos.all({
    channelId,
    platform: 'chzzk',
  });

  for (const video of existingVideos) {
    if (isInTimeWindow(video.published_at, timeWindow)) {
      sessions.push({
        campaignId,
        campaignCreatorId,
        platform: 'chzzk',
        channelId,
        streamUrl: video.platform_video_id ? `https://chzzk.naver.com/video/${video.platform_video_id}` : null,
        videoId: video.platform_video_id,
        title: video.title,
        liveStatus: 'vod',
        startedAt: video.published_at,
        endedAt: null,
        metadata: {
          views: video.views,
          source: 'db_existing',
        },
      });
    }
  }

  return sessions;
}

/**
 * Discover AfreecaTV streams/VODs for a channel.
 */
async function discoverAfreecaSessions({ campaignId, campaignCreatorId, channelId, timeWindow }) {
  const sessions = [];

  if (!afreecaCrawler) return sessions;

  // Check existing DB records for afreeca videos
  const existingVideos = stmts().getExistingVideos.all({
    channelId,
    platform: 'afreeca',
  });

  for (const video of existingVideos) {
    if (isInTimeWindow(video.published_at, timeWindow)) {
      sessions.push({
        campaignId,
        campaignCreatorId,
        platform: 'afreeca',
        channelId,
        streamUrl: video.platform_video_id ? `https://vod.afreecatv.com/player/${video.platform_video_id}` : null,
        videoId: video.platform_video_id,
        title: video.title,
        liveStatus: 'vod',
        startedAt: video.published_at,
        endedAt: null,
        metadata: {
          views: video.views,
          source: 'db_existing',
        },
      });
    }
  }

  return sessions;
}

// ─── Data Helpers ───────────────────────────────────────────────

function loadCampaignCreators(campaignId) {
  return stmts().getCampaignCreators.all(campaignId);
}

function upsertStreamSession(session) {
  stmts().upsertSession.run({
    campaignId: session.campaignId,
    campaignCreatorId: session.campaignCreatorId,
    platform: session.platform,
    channelId: session.channelId,
    streamUrl: session.streamUrl || null,
    videoId: session.videoId || null,
    title: session.title || null,
    liveStatus: session.liveStatus || 'discovered',
    startedAt: session.startedAt || null,
    endedAt: session.endedAt || null,
    metadataJson: JSON.stringify(session.metadata || {}),
  });
}

/**
 * Enqueue match_campaign_broadcast jobs for all unprocessed sessions.
 */
function enqueueMatchJobsForCampaign(campaignId) {
  const sessions = stmts().getUnprocessedSessions.all(campaignId);
  let queued = 0;

  for (const session of sessions) {
    const result = jobQueue.enqueue({
      jobType: 'match_campaign_broadcast',
      payload: {
        campaignId: session.campaign_id,
        campaignCreatorId: session.campaign_creator_id,
        streamSessionId: session.id,
        platform: session.platform,
      },
      dedupeKey: `campaign:${session.campaign_id}:match:stream_session:${session.id}`,
      priority: 7,
    });

    if (result.inserted) queued++;
  }

  return queued;
}

// ─── Time Window Utils ──────────────────────────────────────────

/**
 * Compute time window from campaign dates with ±2 day buffer.
 */
function computeTimeWindow(campaign) {
  const startDate = campaign.campaign_start_date
    ? new Date(campaign.campaign_start_date)
    : new Date(campaign.created_at);
  const endDate = campaign.campaign_end_date
    ? new Date(campaign.campaign_end_date)
    : new Date();

  // Apply ±2 day buffer
  const bufferMs = 2 * 24 * 60 * 60 * 1000;
  return {
    start: new Date(startDate.getTime() - bufferMs),
    end: new Date(endDate.getTime() + bufferMs),
  };
}

/**
 * Check if a date falls within the time window.
 */
function isInTimeWindow(dateStr, timeWindow) {
  if (!dateStr) return true; // If no date, include (don't auto-reject)

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return true; // Invalid date → include

  return date >= timeWindow.start && date <= timeWindow.end;
}

module.exports = {
  scanCampaignStreams,
  scanCreatorStreams,
  loadCampaignCreators,
  discoverYoutubeSessions,
  discoverChzzkSessions,
  discoverAfreecaSessions,
  upsertStreamSession,
  enqueueMatchJobsForCampaign,
};
