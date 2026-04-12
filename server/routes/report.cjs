const express = require('express');
const axios = require('axios');

// ─── 마스터 프롬프트 (개발사 보고용) ────────────────────────
const MASTER_PROMPT = `# Role: 게임 개발사 보고용 방송 모니터링 리포트 분석가

당신은 유튜브 게임 방송의 자막과 채팅을 분석하여 **게임 개발사에 전달할 리포트**를 작성합니다.

## ⛔ 절대 규칙 (위반 시 리포트 무효)

1. **게임과 무관한 내용은 절대 포함 금지**
   - ❌ 음식(지코바, 육개장, 치킨 등), 일상 이야기, 개인 소통
   - ❌ 캠 사용 여부, 구독자 수, 방송 텐션, BJ 컨디션
   - ❌ 도네이션, 후원, 팔로우, 구독 관련
   - ❌ 시청자와의 사적 대화, 잡담, 인사
   - 이런 내용이 자막/채팅에 아무리 많아도 **무시**하세요

2. **게임 플레이 내용만 추출**
   - ⭕ 강화, 영혼부여, 제련, 세팅, 빌드
   - ⭕ 보스레이드, 월드쟁, 공성전, PVP
   - ⭕ 거래소 시세, 골드 경제
   - ⭕ 업데이트, 패치, 밸런스 변경
   - ⭕ 길드, 가챠/뽑기, 이벤트/보상
   - ⭕ 게임 버그, 시스템 이슈

3. **게임 내용이 없으면 "해당 없음"으로 표기**
   - 방송이 잡담/소통 위주여서 게임 내용이 거의 없다면
   - 각 항목에 "게임 관련 내용 없음" 또는 "없음"으로 작성

## 게임별 용어 규칙
- 로드나인: ❌ "영지전" 금지 → "월드쟁" 사용 / 보스는 항상 "보스레이드"
- ROM(롬): ⭕ "영지전" 허용 / "월드쟁"과 구분
- 모든 게임: 보스 관련은 "보스레이드" 단일 용어만 사용, 상세 전술 묘사 금지

## 데이터 출처 규칙
- 🎮 게임 키워드 → **자막에서만** (채팅 참고 불가)
- 🔑 핵심 키워드 → **채팅에서만** (자막 참고 불가)
- 나머지 → 자막+채팅 모두 참고 가능

## 허용 버킷
강화·영혼부여 / 승급·세팅 / 거래·시세 / 복구비 / 길드 / 업데이트 / 보스레이드 / 월드쟁 / 영지전(ROM만) / 가챠·뽑기 / 이벤트

## 금지
- ❌ 전투·사냥 순수 묘사 제외
- ❌ 공지에 날짜/기간/시간 기입 금지
- ❌ BJ 평가, 감정 표현, 과장 금지
- ❌ BJ·개발사 이미지 훼손 내용 절대 제외

## 출력 형식 (이 순서, 이 형식 엄수)

🎮 게임 관련 한줄 키워드 요약
한 줄, " / " 구분, 최대 5개. 게임 내용 없으면 "게임 관련 내용 없음"

🔑 핵심 키워드
채팅 기반, 게임 관련 단어만, 3~5개, " / " 구분. 게임 키워드 없으면 "게임 관련 키워드 없음"

👥 시청자 반응
정확히 3줄. **게임 콘텐츠에 대한 반응만**. 음식/캠/구독자 등 게임 외 반응 절대 불포함.
게임 반응이 없으면 "게임 콘텐츠에 대한 시청자 반응 미확인" 1줄만.

📌 특이사항
게임 관련 특이사항만 1줄. 없으면 "없음"

⚠️ 부정동향
게임 관련 건설적 개선 의견 1줄. 없으면 "없음"

## 어투 규칙 (매우 중요)
- ❌ 일기장/서술체 금지: "~이루어졌다", "~이었다", "~보였다", "~나타났다", "~있었다"
- ⭕ 보고서 키워드 나열체 사용. 짧고 끊어서 작성.
- 예시:
  - ❌ "강화 관련 대화가 활발하게 이루어졌다" → ⭕ "강화 관련 반응 활발"
  - ❌ "보스레이드에 대한 시청자 반응이 긍정적이었다" → ⭕ "보스레이드 긍정 반응 확인"
  - ❌ "강화 성공률에 대한 불만이 제기되었으며" → ⭕ "강화 성공률 불만. 11강 시도 우려"
  - ❌ "신화 각성 관련 대화가 있었으며, 보스레이드에 대한 언급이 있었다" → ⭕ "신화 각성 관련 언급. 보스레이드 언급"
- 한 문장은 최대 15자 이내. 마침표(.)로 끊어서 나열.
- "~에 대한", "~관련된", "~으로 인한" 같은 수식어 최소화.

## 최종 점검
출력 전 모든 항목을 다시 읽고:
- 음식, 캠, 구독자, 일상, 소통 관련 내용이 포함되었으면 **삭제**
- 게임과 직접 관련 없는 키워드가 있으면 **삭제**
- "~이루어졌다", "~이었다", "~나타났다" 같은 서술체가 있으면 키워드체로 **수정**
- 한 문장이 15자 넘으면 **끊어서 분리**`;

module.exports = function(db) {
  const router = express.Router();

  // ─── AI 리포트 생성 ──────────────────────────────────────
  router.post('/generate', express.json({ limit: '10mb' }), async (req, res) => {
    const { transcript, chat } = req.body;
    if (!transcript && !chat) {
      return res.json({ ok: false, error: '자막 또는 채팅 데이터가 필요합니다' });
    }

    const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || '';
    const provider = process.env.AI_PROVIDER || 'openai'; // 'openai' or 'claude'

    if (!apiKey) {
      return res.json({ ok: false, error: 'AI API 키가 설정되지 않았습니다 (AI_API_KEY 환경변수)', needApiKey: true });
    }

    const userMessage = `다음은 유튜브 게임 방송의 자막과 채팅 데이터입니다. 위 규칙에 따라 리포트를 작성해주세요.

=== 자막 (콘텐츠 본문) ===
${(transcript || '자막 없음').substring(0, 15000)}

=== 채팅 로그 (시청자 반응) ===
${(chat || '채팅 없음').substring(0, 15000)}`;

    try {
      let reportText;

      if (provider === 'claude') {
        // Claude API
        const { data } = await axios.post('https://api.anthropic.com/v1/messages', {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          system: MASTER_PROMPT,
          messages: [{ role: 'user', content: userMessage }],
        }, {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          timeout: 60000,
        });
        reportText = data.content?.[0]?.text || '';

      } else {
        // OpenAI API (기본)
        const { data } = await axios.post('https://api.openai.com/v1/chat/completions', {
          model: process.env.AI_MODEL || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: MASTER_PROMPT },
            { role: 'user', content: userMessage },
          ],
          max_tokens: 2000,
          temperature: 0.3,
        }, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000,
        });
        reportText = data.choices?.[0]?.message?.content || '';
      }

      if (!reportText) {
        return res.json({ ok: false, error: 'AI 응답이 비어있습니다' });
      }

      // 리포트 텍스트를 구조화된 객체로 파싱
      const parsed = parseAIReport(reportText);

      console.log(`[AI Report] 생성 완료 (${provider}, ${reportText.length}자)`);
      res.json({
        ok: true,
        report: parsed,
        rawText: reportText,
        provider,
      });

    } catch (err) {
      const status = err.response?.status;
      const errMsg = err.response?.data?.error?.message || err.message;
      console.error(`[AI Report] 실패 (${status}):`, errMsg);

      if (status === 401) {
        return res.json({ ok: false, error: 'AI API 키가 유효하지 않습니다', needApiKey: true });
      }
      if (status === 429) {
        return res.json({ ok: false, error: 'AI API 요청 한도 초과. 잠시 후 다시 시도해주세요' });
      }
      res.json({ ok: false, error: `AI 리포트 생성 실패: ${errMsg}` });
    }
  });

  return router;
};

// ─── AI 응답 텍스트 → 구조화 객체 파싱 ──────────────────────
function parseAIReport(text) {
  const sections = {
    content: '', // 🎮
    keywords: '', // 🔑
    reaction: '', // 👥
    issues: '', // 📌
    negative: '', // ⚠️
  };

  // 섹션별 추출
  const contentMatch = text.match(/🎮[^\n]*\n([^\n🔑]+)/s);
  if (contentMatch) sections.content = contentMatch[1].trim().replace(/^[-•]\s*/, '');

  const keywordMatch = text.match(/🔑[^\n]*\n([^\n👥]+)/s);
  if (keywordMatch) sections.keywords = keywordMatch[1].trim().replace(/^[-•]\s*/, '');

  const reactionMatch = text.match(/👥[^\n]*\n([\s\S]*?)(?=📌|$)/);
  if (reactionMatch) {
    sections.reaction = reactionMatch[1].trim()
      .split('\n')
      .map(l => l.trim().replace(/^[-•]\s*/, '').replace(/^\d+\.\s*/, ''))
      .filter(l => l.length > 0)
      .slice(0, 3)
      .join('\n');
  }

  const issuesMatch = text.match(/📌[^\n]*\n([^\n⚠️]+)/s);
  if (issuesMatch) {
    const val = issuesMatch[1].trim().replace(/^[-•]\s*/, '');
    sections.issues = val === '없음' ? '' : val;
  }

  const negativeMatch = text.match(/⚠️[^\n]*\n([\s\S]*?)$/);
  if (negativeMatch) {
    const val = negativeMatch[1].trim().replace(/^[-•]\s*/, '');
    sections.negative = val === '없음' ? '' : val;
  }

  return sections;
}
