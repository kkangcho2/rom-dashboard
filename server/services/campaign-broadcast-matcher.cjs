'use strict';

/**
 * campaign-broadcast-matcher.cjs — Multi-signal matcher for campaign broadcasts.
 * Phase 3 of Campaign Automation System.
 *
 * Deterministic scoring (no LLM). 8 weighted signals producing confidence 0~1.
 */

const db = require('../db.cjs');
const reviewQueue = require('./review-queue.cjs');

// Game detection utility
let gameDetection = null;
try { gameDetection = require('../utils/game-detection.cjs'); } catch {}

// ─── Constants ──────────────────────────────────────────────────

const SIGNAL_WEIGHTS = {
  channel_match: 0.25,
  date_window: 0.15,
  target_game_title_match: 0.20,
  detected_game_match: 0.10,
  sponsor_pattern: 0.08,
  banner_detected: 0.15,
  transcript_target_mention: 0.05,
  chat_target_mention: 0.02,
};

const THRESHOLDS = {
  MATCHED: 0.80,
  REVIEW: 0.50,
};

const CHAT_SAMPLE_LIMIT = 500;

// Sponsor detection patterns (reference from creator-analyzer.cjs:32-40)
const SPONSOR_PATTERNS = [
  /\[ad\]/i, /\[광고\]/, /\[협찬\]/, /\[스폰서\]/, /\[sponsored\]/i,
  /#ad\b/i, /#광고/, /#협찬/, /#스폰서/, /#sponsored/i, /#paidpromotion/i,
  /유료\s*광고/, /유료광고\s*포함/, /협찬\s*받/, /협찬\s*영상/, /스폰서\s*영상/,
  /광고\s*포함/, /제공\s*받/, /의뢰\s*받/, /광고\s*제공/,
  /paid\s*promotion/i, /paid\s*partnership/i, /sponsored\s*by/i, /includes?\s*paid/i,
  /본\s*영상은.*광고/, /본\s*영상은.*협찬/, /본\s*컨텐츠는.*광고/,
];

// ─── Prepared Statements ────────────────────────────────────────
let _stmts = null;
function stmts() {
  if (_stmts) return _stmts;
  _stmts = {
    getCampaign: db.prepare('SELECT * FROM campaigns WHERE id = ?'),
    getCampaignCreator: db.prepare('SELECT * FROM campaign_creators WHERE id = ?'),
    getCreatorProfile: db.prepare('SELECT * FROM creator_profiles WHERE id = ?'),
    getStreamSession: db.prepare('SELECT * FROM stream_sessions WHERE id = ?'),
    getVideoByPlatformId: db.prepare('SELECT * FROM videos WHERE platform = ? AND video_id = ?'),
    getVideoById: db.prepare('SELECT * FROM videos WHERE id = ?'),
    getTranscripts: db.prepare('SELECT content FROM transcripts WHERE video_id = ?'),
    getChatMessages: db.prepare('SELECT message FROM chat_messages WHERE video_id = ? ORDER BY id DESC LIMIT ?'),
    getBannerVerification: db.prepare(`
      SELECT banner_detected, confidence
      FROM banner_verifications
      WHERE campaign_creator_id = ?
      ORDER BY checked_at DESC LIMIT 1
    `),
    upsertMatch: db.prepare(`
      INSERT INTO campaign_broadcast_matches (
        campaign_id, campaign_creator_id, video_id, stream_session_id,
        matched, confidence, reasons_json, review_required, status
      ) VALUES (
        @campaignId, @campaignCreatorId, @videoId, @streamSessionId,
        @matched, @confidence, @reasonsJson, @reviewRequired, @status
      )
      ON CONFLICT (campaign_id, campaign_creator_id, COALESCE(video_id, -1), COALESCE(stream_session_id, -1))
      DO UPDATE SET
        matched = excluded.matched,
        confidence = excluded.confidence,
        reasons_json = excluded.reasons_json,
        review_required = excluded.review_required,
        status = excluded.status,
        updated_at = datetime('now')
    `),
    markSessionProcessed: db.prepare(`
      UPDATE stream_sessions SET processed_at = datetime('now') WHERE id = ?
    `),
  };
  return _stmts;
}

// ─── Main Entry Point ───────────────────────────────────────────

/**
 * Match a broadcast against a campaign.
 *
 * @param {Object} params
 * @param {string} params.campaignId
 * @param {string} params.campaignCreatorId
 * @param {number} [params.streamSessionId]
 * @param {number} [params.videoId]
 * @returns {Object} match result
 */
async function matchBroadcast({ campaignId, campaignCreatorId, streamSessionId = null, videoId = null }) {
  // 1. Load all context
  const context = loadMatchContext({ campaignId, campaignCreatorId, streamSessionId, videoId });

  if (!context.campaign || !context.campaignCreator) {
    throw new Error(`Missing campaign or campaign_creator data for campaign=${campaignId}, cc=${campaignCreatorId}`);
  }

  // 2. Compute signals
  const signals = computeSignals(context);

  // 3. Compute confidence
  const confidence = computeConfidence(signals);

  // 4. Build reasons
  const reasons = buildReasons(signals);

  // 5. Determine status
  let matched = false;
  let reviewRequired = false;
  let status = 'rejected';

  if (confidence >= THRESHOLDS.MATCHED) {
    matched = true;
    status = 'matched';
  } else if (confidence >= THRESHOLDS.REVIEW) {
    reviewRequired = true;
    status = 'needs_review';
  }

  const result = {
    campaignId,
    campaignCreatorId,
    videoId: context.resolvedVideoId || null,
    streamSessionId: streamSessionId || null,
    matched,
    confidence: Math.round(confidence * 1000) / 1000,
    reviewRequired,
    status,
    reasons,
  };

  // 6. Save result
  saveMatchResult(result);

  // 7. Mark stream session as processed
  if (streamSessionId) {
    stmts().markSessionProcessed.run(streamSessionId);
  }

  // 8. Enqueue review if needed
  if (status === 'needs_review') {
    try {
      reviewQueue.enqueueReview({
        queueType: 'campaign_broadcast_match',
        campaignId,
        campaignCreatorId,
        payload: {
          streamSessionId,
          videoId: context.resolvedVideoId,
          confidence,
          reason: 'Matcher confidence in review band',
          result,
        },
      });
    } catch (err) {
      console.error('[Matcher] Failed to enqueue review:', err.message);
    }
  }

  console.log(`[Matcher] Campaign ${campaignId}, CC ${campaignCreatorId}: ${status} (confidence=${result.confidence})`);
  return result;
}

// ─── Context Loading ────────────────────────────────────────────

function loadMatchContext({ campaignId, campaignCreatorId, streamSessionId = null, videoId = null }) {
  const campaign = stmts().getCampaign.get(campaignId);
  const campaignCreator = stmts().getCampaignCreator.get(campaignCreatorId);

  let creatorProfile = null;
  if (campaignCreator) {
    creatorProfile = stmts().getCreatorProfile.get(campaignCreator.creator_profile_id);
  }

  let streamSession = null;
  if (streamSessionId) {
    streamSession = stmts().getStreamSession.get(streamSessionId);
  }

  // Resolve video — from stream session or direct videoId
  let video = null;
  let resolvedVideoId = videoId || null;

  if (streamSession && streamSession.video_id && streamSession.platform) {
    video = stmts().getVideoByPlatformId.get(streamSession.platform, streamSession.video_id);
    if (video) resolvedVideoId = video.id;
  }

  if (!video && videoId) {
    video = stmts().getVideoById.get(videoId);
  }

  // Load transcripts & chat for the video
  let transcripts = [];
  let chatMessages = [];
  if (video) {
    transcripts = stmts().getTranscripts.all(video.id);
    chatMessages = stmts().getChatMessages.all(video.id, CHAT_SAMPLE_LIMIT);
  }

  // Banner verification
  let bannerVerification = null;
  if (campaignCreatorId) {
    bannerVerification = stmts().getBannerVerification.get(campaignCreatorId);
  }

  return {
    campaign,
    campaignCreator,
    creatorProfile,
    streamSession,
    video,
    resolvedVideoId,
    transcripts,
    chatMessages,
    bannerVerification,
  };
}

// ─── Signal Computation ─────────────────────────────────────────

function computeSignals(context) {
  const { campaign, creatorProfile, streamSession, video, bannerVerification, transcripts, chatMessages } = context;

  const targetGame = campaign?.target_game || '';
  const targetKeywords = buildTargetKeywords(targetGame, campaign?.brand_name);

  // Determine the title to analyze (from stream session or video)
  const title = streamSession?.title || video?.title || '';

  // Determine channel_id for the stream
  const streamChannelId = streamSession?.channel_id || '';
  const streamPlatform = streamSession?.platform || video?.platform || '';

  const signals = {};

  // A: Channel match
  signals.channel_match = computeChannelMatch(creatorProfile, streamChannelId, streamPlatform);

  // B: Date window
  signals.date_window = computeDateWindow(campaign, streamSession, video);

  // C: Target game title match
  signals.target_game_title_match = computeTitleTargetGameMatch(title, targetKeywords);

  // D: Detected game match
  signals.detected_game_match = computeDetectedGameMatch(title, targetGame);

  // E: Sponsor pattern
  signals.sponsor_pattern = computeSponsorPattern(title);

  // F: Banner detected
  signals.banner_detected = computeBannerDetected(bannerVerification);

  // G: Transcript target mention
  signals.transcript_target_mention = computeTranscriptMention(transcripts, targetKeywords);

  // H: Chat target mention
  signals.chat_target_mention = computeChatMention(chatMessages, targetKeywords);

  return signals;
}

// ─── Individual Signal Functions ────────────────────────────────

/**
 * Signal A: Channel match — does the stream belong to the expected creator?
 */
function computeChannelMatch(creatorProfile, streamChannelId, streamPlatform) {
  if (!creatorProfile || !streamChannelId) {
    return { matched: false, score: 0, detail: 'no creator profile or channel info' };
  }

  let expectedChannelId = null;
  if (streamPlatform === 'youtube') expectedChannelId = creatorProfile.youtube_channel_id;
  else if (streamPlatform === 'chzzk') expectedChannelId = creatorProfile.chzzk_channel_id;
  else if (streamPlatform === 'afreeca') expectedChannelId = creatorProfile.afreeca_channel_id;

  if (!expectedChannelId) {
    return { matched: false, score: 0, detail: `no ${streamPlatform} channel_id on profile` };
  }

  const isMatch = normalizeText(expectedChannelId) === normalizeText(streamChannelId);
  return {
    matched: isMatch,
    score: isMatch ? SIGNAL_WEIGHTS.channel_match : 0,
    detail: isMatch ? 'creator channel matches stream channel' : 'channel mismatch',
  };
}

/**
 * Signal B: Date window — is the stream within campaign period ±2 days?
 */
function computeDateWindow(campaign, streamSession, video) {
  if (!campaign) {
    return { matched: false, score: 0, detail: 'no campaign data' };
  }

  const startDate = campaign.campaign_start_date ? new Date(campaign.campaign_start_date) : null;
  const endDate = campaign.campaign_end_date ? new Date(campaign.campaign_end_date) : null;

  if (!startDate && !endDate) {
    // No date constraints → neutral positive
    return { matched: true, score: SIGNAL_WEIGHTS.date_window * 0.5, detail: 'no campaign dates defined' };
  }

  const streamDate = streamSession?.started_at
    ? new Date(streamSession.started_at)
    : (video?.published_at ? new Date(video.published_at) : null);

  if (!streamDate || isNaN(streamDate.getTime())) {
    return { matched: false, score: 0, detail: 'no stream date available' };
  }

  const bufferMs = 2 * 24 * 60 * 60 * 1000;
  const windowStart = startDate ? new Date(startDate.getTime() - bufferMs) : new Date(0);
  const windowEnd = endDate ? new Date(endDate.getTime() + bufferMs) : new Date(Date.now() + bufferMs);

  const isInWindow = streamDate >= windowStart && streamDate <= windowEnd;
  return {
    matched: isInWindow,
    score: isInWindow ? SIGNAL_WEIGHTS.date_window : 0,
    detail: isInWindow ? 'stream is inside campaign date window' : 'stream is outside campaign date window',
  };
}

/**
 * Signal C: Title contains target game (normalized comparison).
 */
function computeTitleTargetGameMatch(title, targetKeywords) {
  if (!title || targetKeywords.length === 0) {
    return { matched: false, score: 0, detail: 'no title or target game' };
  }

  const normalizedTitle = normalizeText(title);
  const isMatch = targetKeywords.some(kw => normalizedTitle.includes(normalizeText(kw)));

  return {
    matched: isMatch,
    score: isMatch ? SIGNAL_WEIGHTS.target_game_title_match : 0,
    detail: isMatch ? 'normalized title contains target game' : 'title does not contain target game',
  };
}

/**
 * Signal D: Detected game via game-detection.cjs matches target.
 */
function computeDetectedGameMatch(title, targetGame) {
  if (!title || !targetGame || !gameDetection) {
    return { matched: false, score: 0, detail: 'no title, target game, or game detection module' };
  }

  try {
    const detected = gameDetection.detectGamesFromTitles([title]);
    const normalizedTarget = normalizeText(targetGame);

    const isMatch = detected.some(d => normalizeText(d.game) === normalizedTarget);
    return {
      matched: isMatch,
      score: isMatch ? SIGNAL_WEIGHTS.detected_game_match : 0,
      detail: isMatch
        ? `game-detection detected target game`
        : `game-detection found: [${detected.map(d => d.game).join(', ')}]`,
    };
  } catch {
    return { matched: false, score: 0, detail: 'game detection failed' };
  }
}

/**
 * Signal E: Title contains sponsor/advertising patterns.
 */
function computeSponsorPattern(title) {
  if (!title) {
    return { matched: false, score: 0, detail: 'no title' };
  }

  const isMatch = SPONSOR_PATTERNS.some(p => p.test(title));
  return {
    matched: isMatch,
    score: isMatch ? SIGNAL_WEIGHTS.sponsor_pattern : 0,
    detail: isMatch ? 'title contains advertising marker' : 'no sponsor pattern detected',
  };
}

/**
 * Signal F: Banner verification result.
 */
function computeBannerDetected(bannerVerification) {
  if (!bannerVerification) {
    return { matched: false, score: 0, detail: 'no banner verification data (neutral)' };
  }

  const detected = bannerVerification.banner_detected === 1;
  const confidence = bannerVerification.confidence || 0;

  if (detected && confidence > 0.5) {
    return {
      matched: true,
      score: SIGNAL_WEIGHTS.banner_detected,
      detail: `banner verification found with positive confidence (${confidence})`,
    };
  }

  // Explicit negative: slight reduction (return score 0, but don't actively penalize)
  return {
    matched: false,
    score: 0,
    detail: detected ? `banner detected but low confidence (${confidence})` : 'banner not detected',
  };
}

/**
 * Signal G: Transcript mentions target game.
 */
function computeTranscriptMention(transcripts, targetKeywords) {
  if (!transcripts || transcripts.length === 0 || targetKeywords.length === 0) {
    return { matched: false, score: 0, detail: 'no transcripts or target keywords (neutral)' };
  }

  const allContent = transcripts.map(t => t.content || '').join(' ');
  const normalizedContent = normalizeText(allContent);

  let mentionCount = 0;
  for (const kw of targetKeywords) {
    const normalizedKw = normalizeText(kw);
    if (!normalizedKw) continue;

    // Count occurrences
    let idx = 0;
    while ((idx = normalizedContent.indexOf(normalizedKw, idx)) !== -1) {
      mentionCount++;
      idx += normalizedKw.length;
    }
  }

  const isMatch = mentionCount > 0;
  // Minor boost for multiple mentions (capped at weight)
  const boost = Math.min(mentionCount / 5, 1);
  const score = isMatch ? SIGNAL_WEIGHTS.transcript_target_mention * boost : 0;

  return {
    matched: isMatch,
    score: Math.round(score * 1000) / 1000,
    detail: isMatch ? `transcript mentions target game (${mentionCount}x)` : 'no target mentions in transcript',
  };
}

/**
 * Signal H: Chat messages mention target game.
 */
function computeChatMention(chatMessages, targetKeywords) {
  if (!chatMessages || chatMessages.length === 0 || targetKeywords.length === 0) {
    return { matched: false, score: 0, detail: 'no chat messages or target keywords (neutral)' };
  }

  let mentionCount = 0;
  for (const msg of chatMessages) {
    const normalizedMsg = normalizeText(msg.message || '');
    for (const kw of targetKeywords) {
      if (normalizedMsg.includes(normalizeText(kw))) {
        mentionCount++;
        break; // Count each message only once
      }
    }
  }

  const isMatch = mentionCount > 0;
  const ratio = mentionCount / chatMessages.length;
  // Scale score: even a few mentions give some signal
  const boost = Math.min(ratio * 10, 1);
  const score = isMatch ? SIGNAL_WEIGHTS.chat_target_mention * boost : 0;

  return {
    matched: isMatch,
    score: Math.round(score * 1000) / 1000,
    detail: isMatch
      ? `chat mentions target (${mentionCount}/${chatMessages.length} messages)`
      : 'no target mentions in chat',
  };
}

// ─── Scoring ────────────────────────────────────────────────────

function computeConfidence(signals) {
  let total = 0;
  for (const key of Object.keys(signals)) {
    total += signals[key].score || 0;
  }
  return Math.min(total, 1.0);
}

function buildReasons(signals) {
  return Object.entries(signals).map(([type, signal]) => ({
    type,
    matched: signal.matched,
    score: signal.score,
    detail: signal.detail,
  }));
}

// ─── Persistence ────────────────────────────────────────────────

function saveMatchResult(result) {
  stmts().upsertMatch.run({
    campaignId: result.campaignId,
    campaignCreatorId: result.campaignCreatorId,
    videoId: result.videoId || null,
    streamSessionId: result.streamSessionId || null,
    matched: result.matched ? 1 : 0,
    confidence: result.confidence,
    reasonsJson: JSON.stringify(result.reasons),
    reviewRequired: result.reviewRequired ? 1 : 0,
    status: result.status,
  });
}

// ─── Text Utilities ─────────────────────────────────────────────

/**
 * Normalize text for comparison: lowercase, trim, remove whitespace.
 */
function normalizeText(input) {
  return (input || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '');
}

/**
 * Build keyword set for target game matching.
 */
function buildTargetKeywords(targetGame, brandName) {
  if (!targetGame) return [];

  const keywords = new Set();

  // Original
  keywords.add(targetGame);
  // Lowercase
  keywords.add(targetGame.toLowerCase());
  // No-space
  keywords.add(targetGame.replace(/\s+/g, ''));
  keywords.add(targetGame.toLowerCase().replace(/\s+/g, ''));

  // brand_name as weak auxiliary (only if different from target_game)
  // Not added to primary keywords to avoid false positives

  return [...keywords].filter(k => k.length > 0);
}

module.exports = {
  matchBroadcast,
  loadMatchContext,
  normalizeText,
  computeSignals,
  computeConfidence,
  buildReasons,
  saveMatchResult,
  buildTargetKeywords,
  SIGNAL_WEIGHTS,
  THRESHOLDS,
};
