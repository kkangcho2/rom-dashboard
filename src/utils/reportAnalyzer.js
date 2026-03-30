import {
  GAME_CATS, NEGATIVE_KW, ACTIVITY_CATS,
  POSITIVE_WORDS, NEGATIVE_SENTIMENT_WORDS, PROFANITY_WORDS, SUGGESTION_WORDS,
  isBotMessage, isGameRelatedChat
} from './constants';

export function analyzeReport(transcriptText, chatText) {
  const all = (transcriptText + '\n' + chatText);
  const allLower = all.toLowerCase();

  // ── 채팅 전처리: 봇/Nightbot/명령어 필터링 ──
  const rawChatLines = chatText.split('\n').filter(l => l.trim());
  const chatLines = rawChatLines.filter(line => !isBotMessage(line));
  const filteredOutCount = rawChatLines.length - chatLines.length;

  // ── 게임 관련 채팅만 분리 ──
  const gameRelatedLines = chatLines.filter(line => isGameRelatedChat(line));
  const generalChatLines = chatLines.filter(line => !isGameRelatedChat(line));

  // Legacy category matching
  const matched = {};
  for (const [cat, words] of Object.entries(GAME_CATS)) {
    let cnt = 0;
    for (const w of words) { const m = allLower.match(new RegExp(w, 'gi')); if (m) cnt += m.length; }
    if (cnt > 0) matched[cat] = cnt;
  }
  const sorted = Object.entries(matched).sort((a, b) => b[1] - a[1]);
  const content = sorted.slice(0, 4).map(([c]) => c).join(' / ') || '일반 방송';

  const wf = {};
  for (const words of Object.values(GAME_CATS)) {
    for (const w of words) { const m = allLower.match(new RegExp(w, 'gi')); if (m && m.length >= 2) wf[w] = (wf[w] || 0) + m.length; }
  }
  const keywords = Object.entries(wf).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([w]) => w).join(' / ');

  // ── 게임 관련 채팅 반응 분석 (잡담 제외) ──
  const chatLower = chatLines.join('\n').toLowerCase();
  const reactionCats = {};
  for (const [cat, words] of Object.entries(GAME_CATS)) {
    let cnt = 0;
    for (const w of words) { const m = chatLower.match(new RegExp(w, 'gi')); if (m) cnt += m.length; }
    if (cnt > 0) reactionCats[cat] = cnt;
  }
  const topR = Object.entries(reactionCats).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c]) => c + ' 관련 반응 확인');
  const reaction = topR.length ? topR.join('. ') + '.' : '게임 관련 채팅이 소수 확인됨.';

  const negCats = {};
  for (const [cat, words] of Object.entries(NEGATIVE_KW)) {
    let cnt = 0;
    for (const w of words) { const m = chatLower.match(new RegExp(w, 'gi')); if (m) cnt += m.length; }
    if (cnt >= 2) negCats[cat] = cnt;
  }
  const negative = Object.entries(negCats).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([c]) => c).join(', ');

  const issues = [];
  if (chatLower.includes('버그') || chatLower.includes('오류')) issues.push('버그/오류 언급 확인');
  if (chatLower.includes('점검')) issues.push('서버 점검 관련 이슈');
  if (chatLower.includes('신규') || chatLower.includes('신캐')) issues.push('신규 콘텐츠 관련 언급');

  // ── Activity Segmentation with Sentiment (게임 반응 중심) ──
  const activities = [];
  for (const [actName, actWords] of Object.entries(ACTIVITY_CATS)) {
    let mentionCount = 0;
    for (const w of actWords) {
      const m = allLower.match(new RegExp(w, 'gi'));
      if (m) mentionCount += m.length;
    }
    if (mentionCount === 0) continue;

    // 이 활동과 관련된 채팅 라인 (봇 제외된 것에서)
    const relatedChatLines = chatLines.filter(line => {
      const lineLower = line.toLowerCase();
      return actWords.some(w => lineLower.includes(w.toLowerCase()));
    });
    const chatReactions = relatedChatLines.length;

    let posCount = 0, negCount = 0, neuCount = 0;
    for (const line of relatedChatLines) {
      const lineLower = line.toLowerCase();
      const hasPos = POSITIVE_WORDS.some(w => lineLower.includes(w));
      const hasNeg = NEGATIVE_SENTIMENT_WORDS.some(w => lineLower.includes(w));
      if (hasPos && !hasNeg) posCount++;
      else if (hasNeg && !hasPos) negCount++;
      else neuCount++;
    }
    if (chatReactions === 0) neuCount = 1;

    // 핵심 순간 (성공/실패)
    const keyMoments = [];
    const successWords = ['성공', '클리어', '잡았', '됐다', '축하', '대박'];
    const failWords = ['실패', '터짐', '깨짐', '파괴', '꽝', '망', '죽었'];
    for (const line of relatedChatLines.slice(0, 50)) {
      const lineLower = line.toLowerCase();
      if (successWords.some(w => lineLower.includes(w)) && keyMoments.length < 3) {
        keyMoments.push({ text: line.trim().substring(0, 60), type: 'success' });
      } else if (failWords.some(w => lineLower.includes(w)) && keyMoments.length < 3) {
        keyMoments.push({ text: line.trim().substring(0, 60), type: 'fail' });
      }
    }

    // 인용 채팅 (감성 점수 높은 순)
    const topQuotes = [];
    const scoredLines = relatedChatLines.map(line => {
      const lineLower = line.toLowerCase();
      let score = 0;
      POSITIVE_WORDS.forEach(w => { if (lineLower.includes(w)) score += 2; });
      NEGATIVE_SENTIMENT_WORDS.forEach(w => { if (lineLower.includes(w)) score += 2; });
      if (line.includes('!') || line.includes('ㄷㄷ') || line.includes('ㅋㅋㅋ')) score += 1;
      return { line: line.trim(), score };
    }).sort((a, b) => b.score - a.score);

    for (const { line } of scoredLines.slice(0, 5)) {
      if (!line || line.length < 2) continue;
      const lineLower = line.toLowerCase();
      const hasPos = POSITIVE_WORDS.some(w => lineLower.includes(w));
      const hasNeg = NEGATIVE_SENTIMENT_WORDS.some(w => lineLower.includes(w));
      const sentiment = hasPos && !hasNeg ? 'positive' : hasNeg && !hasPos ? 'negative' : 'neutral';
      topQuotes.push({ text: line.substring(0, 80), sentiment, activity: actName });
    }

    activities.push({
      name: actName, mentionCount, chatReactions,
      sentiment: { positive: posCount, negative: negCount, neutral: neuCount },
      keyMoments, topQuotes,
    });
  }
  activities.sort((a, b) => b.mentionCount - a.mentionCount);

  // ── 게임 이슈 타임라인 (컨텐츠별 주요 이슈) ──
  const contentIssues = [];
  for (const act of activities) {
    if (act.chatReactions === 0) continue;
    const sentTotal = act.sentiment.positive + act.sentiment.negative + act.sentiment.neutral || 1;
    const negRatio = act.sentiment.negative / sentTotal;

    // 부정 반응이 30% 이상인 활동 = 이슈
    if (negRatio >= 0.3 && act.sentiment.negative >= 3) {
      const issueQuotes = act.topQuotes
        .filter(q => q.sentiment === 'negative')
        .slice(0, 3)
        .map(q => q.text);

      contentIssues.push({
        activity: act.name,
        severity: negRatio >= 0.5 ? 'high' : 'medium',
        negativeCount: act.sentiment.negative,
        totalReactions: act.chatReactions,
        negRatio: Math.round(negRatio * 100),
        quotes: issueQuotes,
        summary: `${act.name} 중 부정 반응 ${Math.round(negRatio * 100)}% (${act.sentiment.negative}건)`,
      });
    }

    // 특정 이슈 키워드 감지
    const issueKeywords = {
      '확률 논란': ['확률', '사기', '조작', '깡'],
      '버그/렉': ['버그', '렉', '팅김', '튕김', '오류'],
      '밸런스': ['밸런스', '너프', '하향', '상향', '불공정'],
      '과금 불만': ['현질', '과금', '돈겜', '바가지'],
    };

    for (const [issueName, issueWords] of Object.entries(issueKeywords)) {
      const issueLines = act.topQuotes
        .filter(q => issueWords.some(w => q.text.toLowerCase().includes(w)))
        .slice(0, 2);
      if (issueLines.length > 0 && !contentIssues.find(ci => ci.activity === act.name && ci.issueType === issueName)) {
        contentIssues.push({
          activity: act.name,
          issueType: issueName,
          severity: 'medium',
          quotes: issueLines.map(q => q.text),
          summary: `${act.name} 중 "${issueName}" 관련 반응 감지`,
        });
      }
    }
  }

  // ── Overall Sentiment (봇 제외된 채팅 기준) ──
  let totalPos = 0, totalNeg = 0, totalNeu = 0;
  for (const line of chatLines) {
    const lineLower = line.toLowerCase();
    const hasPos = POSITIVE_WORDS.some(w => lineLower.includes(w));
    const hasNeg = NEGATIVE_SENTIMENT_WORDS.some(w => lineLower.includes(w));
    if (hasPos && !hasNeg) totalPos++;
    else if (hasNeg && !hasPos) totalNeg++;
    else totalNeu++;
  }
  const totalSentiment = totalPos + totalNeg + totalNeu || 1;
  const sentimentScore = Math.round(((totalPos / totalSentiment) * 100 - (totalNeg / totalSentiment) * 50 + 50));
  const overallSentiment = {
    positive: totalPos, negative: totalNeg, neutral: totalNeu,
    score: Math.max(0, Math.min(100, sentimentScore)),
  };

  // ── 게임 반응만 별도 감성 (잡담 제외) ──
  let gamePos = 0, gameNeg = 0, gameNeu = 0;
  for (const line of gameRelatedLines) {
    const lineLower = line.toLowerCase();
    const hasPos = POSITIVE_WORDS.some(w => lineLower.includes(w));
    const hasNeg = NEGATIVE_SENTIMENT_WORDS.some(w => lineLower.includes(w));
    if (hasPos && !hasNeg) gamePos++;
    else if (hasNeg && !hasPos) gameNeg++;
    else gameNeu++;
  }
  const gameSentTotal = gamePos + gameNeg + gameNeu || 1;
  const gameSentimentScore = Math.round(((gamePos / gameSentTotal) * 100 - (gameNeg / gameSentTotal) * 50 + 50));
  const gameSentiment = {
    positive: gamePos, negative: gameNeg, neutral: gameNeu,
    score: Math.max(0, Math.min(100, gameSentimentScore)),
    totalLines: gameRelatedLines.length,
  };

  // ── Top Quotes (봇 제외, 게임 반응 우선) ──
  const allScoredChat = chatLines.map(line => {
    const lineLower = line.toLowerCase();
    let score = 0;
    POSITIVE_WORDS.forEach(w => { if (lineLower.includes(w)) score += 2; });
    NEGATIVE_SENTIMENT_WORDS.forEach(w => { if (lineLower.includes(w)) score += 2; });
    if (line.includes('!') || line.includes('ㄷㄷ') || line.includes('ㅋㅋㅋ')) score += 1;
    // 게임 관련 채팅에 가산점
    if (isGameRelatedChat(line)) score += 3;
    return { line: line.trim(), score };
  }).filter(x => x.line.length >= 3).sort((a, b) => b.score - a.score);

  const topQuotes = [];
  const seenTexts = new Set();
  for (const { line } of allScoredChat) {
    if (topQuotes.length >= 8) break;
    const short = line.substring(0, 80);
    if (seenTexts.has(short)) continue;
    seenTexts.add(short);
    const lineLower = line.toLowerCase();
    const hasPos = POSITIVE_WORDS.some(w => lineLower.includes(w));
    const hasNeg = NEGATIVE_SENTIMENT_WORDS.some(w => lineLower.includes(w));
    const sentiment = hasPos && !hasNeg ? 'positive' : hasNeg && !hasPos ? 'negative' : 'neutral';
    let matchedAct = '';
    for (const [actName, actWords] of Object.entries(ACTIVITY_CATS)) {
      if (actWords.some(w => lineLower.includes(w.toLowerCase()))) { matchedAct = actName; break; }
    }
    topQuotes.push({
      text: short, sentiment,
      activity: matchedAct || '일반',
      isGameRelated: isGameRelatedChat(line),
    });
  }

  // ── Advertiser Metrics ──
  const chatDensity = chatLines.length;
  const positivityRatio = totalPos / totalSentiment;
  const adjustedEngagement = Math.round(Math.min(100,
    (Math.min(chatDensity, 500) / 500 * 40) + (positivityRatio * 60)
  ));

  let profanityCount = 0;
  for (const line of chatLines) {
    const lineLower = line.toLowerCase();
    if (PROFANITY_WORDS.some(w => lineLower.includes(w))) profanityCount++;
  }
  const profanityRatio = chatLines.length > 0 ? profanityCount / chatLines.length : 0;
  const brandSafety = profanityRatio < 0.01 ? 'high' : profanityRatio < 0.05 ? 'medium' : 'low';

  const peakActivity = activities.length > 0
    ? activities.reduce((best, a) => a.chatReactions > best.chatReactions ? a : best, activities[0])
    : null;

  let adRecommendation = '';
  if (peakActivity) {
    const peakSentTotal = peakActivity.sentiment.positive + peakActivity.sentiment.negative + peakActivity.sentiment.neutral || 1;
    const peakPositivity = peakActivity.sentiment.positive / peakSentTotal;
    if (peakPositivity > 0.5) {
      adRecommendation = `"${peakActivity.name}" 활동 중 긍정 반응이 높아 해당 시점 광고 배치 추천. 시청자 참여도가 가장 높은 구간입니다.`;
    } else if (peakPositivity > 0.3) {
      adRecommendation = `"${peakActivity.name}" 활동 구간에서 적절한 광고 배치 가능. 중립~긍정 반응이 혼재하므로 브랜드 톤에 맞는 소재 추천.`;
    } else {
      adRecommendation = `주요 활동 구간의 부정 반응이 높아 광고 배치 시 주의 필요. 소통/잡담 등 가벼운 구간 활용을 추천합니다.`;
    }
  } else {
    adRecommendation = '활동 구간 분석 데이터 부족. 방송 초반 또는 후반 소통 구간 광고 배치를 추천합니다.';
  }

  const advertiserMetrics = {
    engagementScore: adjustedEngagement, brandSafety,
    peakActivity: peakActivity ? peakActivity.name : '분석 데이터 부족',
    adRecommendation, chatDensity,
  };

  // ── Viewer Suggestions (봇 제외) ──
  const suggestions = [];
  const seenSuggestions = new Set();
  for (const line of chatLines) {
    const lineLower = line.toLowerCase();
    const isSuggestion = SUGGESTION_WORDS.some(w => lineLower.includes(w));
    if (!isSuggestion) continue;

    const cleaned = line.trim().substring(0, 100);
    if (cleaned.length < 5 || seenSuggestions.has(cleaned)) continue;
    seenSuggestions.add(cleaned);

    let category = '일반';
    if (['버그', '오류', '렉', '팅김', '튕김'].some(w => lineLower.includes(w))) category = '버그/오류';
    else if (['밸런스', '너프', '하향', '상향', '불공정'].some(w => lineLower.includes(w))) category = '밸런스';
    else if (['UI', 'ui', '인터페이스', '편의', '편의성', '불편'].some(w => lineLower.includes(w))) category = 'UI/편의';
    else if (['콘텐츠', '컨텐츠', '추가', '신규', '새로운'].some(w => lineLower.includes(w))) category = '콘텐츠 추가';
    else if (['이벤트', '보상', '쿠폰'].some(w => lineLower.includes(w))) category = '이벤트/보상';

    suggestions.push({ text: cleaned, category });
  }
  suggestions.splice(10);

  return {
    content, keywords, reaction,
    negative: negative ? negative + ' 관련 불만 일부 확인' : '',
    issues: issues.join('. '),
    activities, overallSentiment, gameSentiment, topQuotes,
    advertiserMetrics, suggestions, contentIssues,
    // 필터링 통계
    chatStats: {
      totalRaw: rawChatLines.length,
      afterBotFilter: chatLines.length,
      botFiltered: filteredOutCount,
      gameRelated: gameRelatedLines.length,
      generalChat: generalChatLines.length,
    },
  };
}
