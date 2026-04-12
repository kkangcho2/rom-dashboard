/**
 * Banner Verification Service
 * 방송 중 광고 배너 노출 여부를 자동 검증
 *
 * Phase 1: pixel-match 기반 이미지 비교 (무료)
 * Phase 2: Claude Vision API (고정확도, 유료)
 */
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

class BannerVerifyService {
  constructor(db, options = {}) {
    this.db = db;
    this.screenshotDir = options.screenshotDir || path.join(__dirname, '../../data/screenshots');
    this.method = options.method || 'pixel_match'; // 'pixel_match' | 'vision_api'
    this.aiApiKey = options.aiApiKey || process.env.AI_API_KEY;
    this.aiProvider = options.aiProvider || process.env.AI_PROVIDER || 'claude';

    // 스크린샷 디렉토리 생성
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir, { recursive: true });
    }
  }

  /**
   * 방송 스크린샷을 캡처하고 배너 존재 여부를 검증
   * @param {object} params
   * @param {string} params.campaignCreatorId - campaign_creators.id
   * @param {string} params.streamUrl - 방송 URL
   * @param {Buffer} params.screenshot - 스크린샷 이미지 버퍼
   * @param {Buffer} params.bannerImage - 광고주 배너 이미지 버퍼
   * @returns {object} { detected: boolean, confidence: number }
   */
  async verify({ campaignCreatorId, streamUrl, screenshot, bannerImage }) {
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    // 스크린샷 저장
    const screenshotFilename = `${campaignCreatorId}_${Date.now()}.png`;
    const screenshotPath = path.join(this.screenshotDir, screenshotFilename);

    if (screenshot) {
      fs.writeFileSync(screenshotPath, screenshot);
    }

    let detected = false;
    let confidence = 0;

    try {
      if (this.method === 'vision_api' && this.aiApiKey) {
        const result = await this._verifyWithVisionAPI(screenshot, bannerImage);
        detected = result.detected;
        confidence = result.confidence;
      } else {
        const result = await this._verifyWithPixelMatch(screenshot, bannerImage);
        detected = result.detected;
        confidence = result.confidence;
      }
    } catch (err) {
      console.error('[BannerVerify] 검증 실패:', err.message);
      confidence = 0;
    }

    // DB에 기록
    this.db.prepare(`
      INSERT INTO banner_verifications (id, campaign_creator_id, stream_url, screenshot_path, banner_detected, confidence, detection_method, checked_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, campaignCreatorId, streamUrl, screenshotPath, detected ? 1 : 0, confidence, this.method, timestamp);

    return { id, detected, confidence, method: this.method };
  }

  /**
   * Phase 1: 단순 이미지 비교 (pixel-match 기반)
   * pixel-match npm 패키지 또는 간단한 색상 히스토그램 비교
   */
  async _verifyWithPixelMatch(screenshot, bannerImage) {
    // pixel-match가 없으면 기본 로직
    // 실제 구현 시: npm install pixelmatch pngjs
    try {
      const pixelmatch = require('pixelmatch');
      const { PNG } = require('pngjs');

      const img1 = PNG.sync.read(screenshot);
      const img2 = PNG.sync.read(bannerImage);

      // 배너 이미지를 스크린샷 여러 위치에서 매칭 시도
      // 간소화: 전체 이미지 비교 -> 유사도 계산
      const { width, height } = img1;
      const diff = new PNG({ width, height });

      const mismatch = pixelmatch(img1.data, img2.data, diff.data, width, height, { threshold: 0.1 });
      const totalPixels = width * height;
      const similarity = 1 - (mismatch / totalPixels);

      return {
        detected: similarity > 0.1, // 10% 이상 매칭 시 배너 존재로 판단
        confidence: Math.min(similarity * 5, 1.0), // 정규화
      };
    } catch {
      // pixelmatch 미설치 시 기본 반환
      console.warn('[BannerVerify] pixelmatch 미설치 - 기본 검증 스킵');
      return { detected: false, confidence: 0 };
    }
  }

  /**
   * Phase 2: Claude Vision API 기반 검증
   */
  async _verifyWithVisionAPI(screenshot, bannerImage) {
    const axios = require('axios');

    const screenshotBase64 = screenshot.toString('base64');
    const bannerBase64 = bannerImage.toString('base64');

    if (this.aiProvider === 'claude') {
      const response = await axios.post('https://api.anthropic.com/v1/messages', {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: '방송 스크린샷에서 광고 배너가 보이는지 확인해주세요. 두 번째 이미지가 찾아야 할 배너입니다. JSON으로 응답: {"detected": true/false, "confidence": 0.0-1.0, "location": "위치 설명"}' },
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: screenshotBase64 } },
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: bannerBase64 } },
          ],
        }],
      }, {
        headers: {
          'x-api-key': this.aiApiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
      });

      const text = response.data.content?.[0]?.text || '';
      const jsonMatch = text.match(/\{[^}]+\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return { detected: !!result.detected, confidence: parseFloat(result.confidence) || 0 };
      }
    }

    return { detected: false, confidence: 0 };
  }

  /**
   * 캠페인 완료 후 검증 리포트 생성
   */
  generateReport(campaignCreatorId) {
    const verifications = this.db.prepare(`
      SELECT * FROM banner_verifications
      WHERE campaign_creator_id = ?
      ORDER BY checked_at ASC
    `).all(campaignCreatorId);

    if (verifications.length === 0) {
      return null;
    }

    const totalChecks = verifications.length;
    const detectedChecks = verifications.filter(v => v.banner_detected).length;
    const checkInterval = 1; // 분 단위 (30초-1분 간격 체크)

    const totalStreamMinutes = totalChecks * checkInterval;
    const bannerExposedMinutes = detectedChecks * checkInterval;
    const exposureRate = totalChecks > 0 ? detectedChecks / totalChecks : 0;

    // 캠페인 정보
    const campaignCreator = this.db.prepare(`
      SELECT cc.*, c.title as campaign_title, c.brand_name,
             cp.display_name as creator_name, cp.avg_concurrent_viewers
      FROM campaign_creators cc
      JOIN campaigns c ON c.id = cc.campaign_id
      JOIN creator_profiles cp ON cp.id = cc.creator_profile_id
      WHERE cc.id = ?
    `).get(campaignCreatorId);

    const avgViewers = campaignCreator?.avg_concurrent_viewers || 0;
    const totalImpressions = avgViewers * bannerExposedMinutes;

    const reportId = crypto.randomUUID();
    const reportData = {
      campaign_title: campaignCreator?.campaign_title,
      brand_name: campaignCreator?.brand_name,
      creator_name: campaignCreator?.creator_name,
      total_checks: totalChecks,
      detected_checks: detectedChecks,
      check_interval_minutes: checkInterval,
      verifications_summary: verifications.map(v => ({
        time: v.checked_at,
        detected: !!v.banner_detected,
        confidence: v.confidence,
      })),
    };

    this.db.prepare(`
      INSERT INTO verification_reports (
        id, campaign_creator_id, campaign_id,
        total_stream_minutes, banner_exposed_minutes, exposure_rate,
        avg_viewers_during, peak_viewers, total_impressions,
        report_data, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')
    `).run(
      reportId, campaignCreatorId, campaignCreator?.campaign_id,
      totalStreamMinutes, bannerExposedMinutes, exposureRate,
      avgViewers, avgViewers, totalImpressions,
      JSON.stringify(reportData)
    );

    return {
      id: reportId,
      total_stream_minutes: totalStreamMinutes,
      banner_exposed_minutes: bannerExposedMinutes,
      exposure_rate: Math.round(exposureRate * 100),
      avg_viewers: avgViewers,
      total_impressions: totalImpressions,
    };
  }
}

module.exports = BannerVerifyService;
