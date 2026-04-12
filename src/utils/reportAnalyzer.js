import {
  GAME_CATS, NEGATIVE_KW, ACTIVITY_CATS,
  POSITIVE_WORDS, NEGATIVE_SENTIMENT_WORDS, PROFANITY_WORDS, SUGGESTION_WORDS,
  PERSONAL_CHAT_WORDS,
  isBotMessage, isGameRelatedChat, isPersonalChat, hasExplicitGameKeyword
} from './constants';

// ═══════════════════════════════════════════════════════════════
//  개발사 보고용 방송 리포트 v4
//  - 마스터 프롬프트 형식
//  - 자연어 기반 텍스트 생성 (키워드 나열 → 문장형)
// ═══════════════════════════════════════════════════════════════

const REPORT_BUCKETS = [
  { name: '보스레이드', keywords: ['보스', '레이드', 'mvp', '네임드', '토벌', '원정', '주간보스', '보스전', '클리어', '파밍'] },
  { name: '월드쟁', keywords: ['월드쟁', '대규모', '교전', '공성', '공성전', '전쟁', '세력전', '점령', '영토'] },
  { name: '영지전', keywords: ['영지전', '영지', 'gvg'] },
  { name: '강화·영혼부여·세팅', keywords: ['강화', '영혼부여', '영혼', '제련', '인챈트', '슬롯', '축복', '미라클', '안전강화', '승급', '전직', '세팅', '빌드'] },
  { name: '거래·시세', keywords: ['거래소', '시세', '가격', '매매', '거래', '경매', '물가', '폭락', '폭등'] },
  { name: '복구비', keywords: ['복구비', '복구', '부활비', '수리비'] },
  { name: '길드', keywords: ['길드', '클랜', '길드전', '길드원', '가입'] },
  { name: '업데이트', keywords: ['업데이트', '패치', '신규', '개편', '변경', '리뉴얼', '시즌'] },
  { name: '가챠·뽑기', keywords: ['뽑기', '가챠', '소환', '픽업', '천장', '확률'] },
  { name: '이벤트', keywords: ['이벤트', '보상', '쿠폰', '출석'] },
  { name: '공지', keywords: ['공지', '브리핑', '안내', '발표'] },
];

function detectGameContext(tLower, cLower) {
  const all = tLower + ' ' + cLower;
  const rom = (all.match(/rom|롬|왕권/gi) || []).length;
  const ln = (all.match(/로드나인|lord\s?nine|로나/gi) || []).length;
  const li = (all.match(/리니지/gi) || []).length;
  if (rom > ln && rom > li) return 'ROM';
  if (ln > 0) return '로드나인';
  if (li > 0) return '리니지';
  return '기타';
}

// ─── 1️⃣ 방송 내용 (자막 기반, 문장형) ──────────────────────
function buildContent(tLower, gameCtx) {
  const matched = [];
  for (const b of REPORT_BUCKETS) {
    if (b.name === '영지전' && gameCtx === '로드나인') continue;
    let cnt = 0;
    for (const kw of b.keywords) { const m = tLower.match(new RegExp(kw, 'gi')); if (m) cnt += m.length; }
    if (cnt >= 2) matched.push({ name: b.name, count: cnt });
  }
  matched.sort((a, b) => b.count - a.count);
  if (matched.length === 0) return '일반 방송';

  // 공지 처리
  const names = matched.slice(0, 5).map(m => m.name === '공지' ? '공지내용 확인' : m.name);
  return names.join(' / ');
}

// ─── 2️⃣ 핵심 키워드 (채팅 기반, 빈도+점유율) ──────────────
function buildKeywords(chatLines) {
  const gameChatOnly = chatLines.filter(l => !isPersonalChat(l));
  if (gameChatOnly.length === 0) return { text: '특이 키워드 없음', stats: [] };

  const chatText = gameChatOnly.join(' ').toLowerCase();
  const total = gameChatOnly.length;
  const allKws = [...Object.values(GAME_CATS).flat(), ...REPORT_BUCKETS.flatMap(b => b.keywords)];

  const kwMap = {};
  for (const w of allKws) {
    if (w.length < 2) continue;
    const m = chatText.match(new RegExp(w, 'gi'));
    if (m && m.length >= 2) {
      const lines = gameChatOnly.filter(l => l.toLowerCase().includes(w.toLowerCase())).length;
      kwMap[w] = { freq: m.length, lines, share: Math.round((lines / total) * 100) };
    }
  }

  const sorted = Object.entries(kwMap).sort((a, b) => b[1].freq - a[1].freq).slice(0, 5);
  if (sorted.length === 0) return { text: '특이 키워드 없음', stats: [] };
  return {
    text: sorted.map(([w]) => w).join(' / '),
    stats: sorted.map(([w, s]) => ({ word: w, ...s })),
  };
}

// ─── 3️⃣ 시청자 반응 (3줄, 자연어) ──────────────────────────
function buildReaction(chatLines, activities, gSent, keyMomentsAll) {
  const lines = [];
  const total = gSent.positive + gSent.negative + gSent.neutral || 1;
  const posP = Math.round((gSent.positive / total) * 100);
  const negP = Math.round((gSent.negative / total) * 100);
  const neuP = 100 - posP - negP;

  // 줄 1: 전체 분위기
  if (gSent.totalLines >= 10) {
    if (posP >= 50) lines.push(`시청자 반응 전반적으로 긍정적이며 방송 몰입도 양호 (긍정 ${posP}%, 부정 ${negP}%, 분석대상 ${gSent.totalLines}건)`);
    else if (posP >= 30) lines.push(`긍정·중립 반응이 혼재하며 일부 부정 의견 관찰됨 (긍정 ${posP}%, 부정 ${negP}%, 분석대상 ${gSent.totalLines}건)`);
    else if (negP >= 30) lines.push(`부정 반응 비율이 다소 높아 모니터링 필요 (긍정 ${posP}%, 부정 ${negP}%, 분석대상 ${gSent.totalLines}건)`);
    else lines.push(`중립 반응 위주로 특별한 쏠림 없이 안정적 (긍정 ${posP}%, 중립 ${neuP}%, 분석대상 ${gSent.totalLines}건)`);
  } else {
    lines.push(`게임 관련 시청자 반응 ${gSent.totalLines}건으로 표본 제한적`);
  }

  // 줄 2: 가장 뜨거운 활동 + 핵심 순간
  const hotActs = activities.filter(a => a.chatReactions >= 3 && a.name !== '소통/잡담')
    .sort((a, b) => b.chatReactions - a.chatReactions);
  if (hotActs.length > 0) {
    const hot = hotActs[0];
    const actLabel = hot.name.includes('보스') ? '보스레이드' : hot.name;
    const hSentT = hot.sentiment.positive + hot.sentiment.negative + hot.sentiment.neutral || 1;
    const hPosP = Math.round((hot.sentiment.positive / hSentT) * 100);
    let line2 = `${actLabel} 관련 반응 가장 활발 (${hot.chatReactions}건`;
    if (hPosP >= 60) line2 += ', 긍정 우세)';
    else if (hPosP >= 40) line2 += ', 긍정/부정 혼재)';
    else line2 += ', 부정 비율 주의)';

    // 핵심 순간 추가
    if (hot.keyMoments.length > 0) {
      const m = hot.keyMoments[0];
      const label = m.type === 'success' ? '성공' : '실패';
      line2 += `. ${label} 관련 집중 반응 발생`;
    }
    lines.push(line2);
  } else if (hotActs.length === 0 && activities.length > 0) {
    const top = activities[0];
    lines.push(`${top.name} 관련 언급이 가장 많으나 채팅 반응은 소규모`);
  } else {
    lines.push('특정 활동에 대한 집중 반응 미감지');
  }

  // 줄 3: 2번째 활동 또는 채팅 분위기
  if (hotActs.length >= 2) {
    const second = hotActs[1];
    const sLabel = second.name.includes('보스') ? '보스레이드' : second.name;
    lines.push(`${sLabel} 관련 반응도 관찰됨 (${second.chatReactions}건)`);
  } else {
    const personalCount = chatLines.filter(l => isPersonalChat(l)).length;
    const totalChat = chatLines.length || 1;
    const personalP = Math.round((personalCount / totalChat) * 100);
    if (personalP >= 30) lines.push(`소통/잡담 비율 ${personalP}%로 커뮤니티 친화적 방송 분위기`);
    else lines.push(`게임 집중도 높은 방송 진행`);
  }

  return lines.slice(0, 3).join('\n');
}

// ─── 4️⃣ 특이사항 (1줄 또는 없음) ──────────────────────────
function buildIssues(tLower, cLower, activities) {
  const items = [];
  if (tLower.includes('공지') || tLower.includes('브리핑')) items.push('공지내용 확인');
  if (tLower.includes('업데이트') || tLower.includes('패치')) items.push('업데이트 관련 언급');
  if (cLower.includes('버그') || cLower.includes('오류') || cLower.includes('렉')) items.push('버그/오류 시청자 반응 감지');
  if (cLower.includes('점검') || cLower.includes('서버')) items.push('서버 관련 언급');

  // 강화 실패 집중
  const enhanceAct = activities.find(a => a.name.includes('강화'));
  if (enhanceAct && enhanceAct.keyMoments.filter(m => m.type === 'fail').length >= 2) {
    items.push('강화 실패 다수 발생');
  }

  return items.length > 0 ? items.slice(0, 2).join(', ') : '';
}

// ─── 5️⃣ 부정동향 (건설적 1줄 또는 없음) ───────────────────
function buildNegative(chatLines) {
  const gameChatOnly = chatLines.filter(l => !isPersonalChat(l));
  const cLower = gameChatOnly.join(' ').toLowerCase();
  let topNeg = null, topCount = 0;
  for (const [cat, words] of Object.entries(NEGATIVE_KW)) {
    let cnt = 0;
    for (const w of words) { const m = cLower.match(new RegExp(w, 'gi')); if (m) cnt += m.length; }
    if (cnt > topCount) { topCount = cnt; topNeg = cat; }
  }
  if (!topNeg || topCount < 3) return '';
  const map = {
    '확률 불만': `강화/뽑기 확률 체감 관련 시청자 불만 ${topCount}건 감지, 확률 체감 개선 검토 필요`,
    '밸런스 불만': `밸런스 관련 시청자 의견 ${topCount}건, 직업/콘텐츠 조정 검토 권장`,
    '시스템 이슈': `렉/버그 관련 불만 ${topCount}건, 클라이언트 안정성 점검 권장`,
    '과금 불만': `과금 가치 관련 부정 의견 ${topCount}건, 밸류 체감 개선 검토 권장`,
    '운영 불만': `운영 소통 관련 아쉬움 ${topCount}건, 커뮤니케이션 강화 권장`,
  };
  return map[topNeg] || '';
}

// ═══════════════════════════════════════════════════════════════
//  MAIN ANALYZER
// ═══════════════════════════════════════════════════════════════
export function analyzeReport(transcriptText, chatText) {
  const tLower = (transcriptText || '').toLowerCase();
  const cTextLower = (chatText || '').toLowerCase();
  const allLower = tLower + '\n' + cTextLower;

  // ── 채팅 전처리 ──
  const rawChatLines = chatText.split('\n').filter(l => l.trim());
  const chatLines = rawChatLines.filter(line => !isBotMessage(line));
  const filteredOutCount = rawChatLines.length - chatLines.length;
  const gameRelatedLines = chatLines.filter(l => isGameRelatedChat(l));

  // ── 게임 식별 ──
  const gameContext = detectGameContext(tLower, cTextLower);

  // ── Activity Segmentation ──
  const activities = [];
  for (const [actName, actWords] of Object.entries(ACTIVITY_CATS)) {
    let mentionCount = 0;
    for (const w of actWords) {
      const m = allLower.match(new RegExp(w, 'gi'));
      if (m) mentionCount += m.length;
    }
    if (mentionCount === 0) continue;
    const relatedChatLines = chatLines.filter(line => actWords.some(w => line.toLowerCase().includes(w.toLowerCase())));
    const chatReactions = relatedChatLines.length;
    let posCount = 0, negCount = 0, neuCount = 0;
    for (const line of relatedChatLines) {
      const ll = line.toLowerCase();
      const hasPos = POSITIVE_WORDS.some(w => ll.includes(w));
      const hasNeg = NEGATIVE_SENTIMENT_WORDS.some(w => ll.includes(w));
      if (hasPos && !hasNeg) posCount++;
      else if (hasNeg && !hasPos) negCount++;
      else neuCount++;
    }
    if (chatReactions === 0) neuCount = 1;
    const keyMoments = [];
    const successW = ['성공', '클리어', '잡았', '됐다', '축하', '대박'];
    const failW = ['실패', '터짐', '깨짐', '파괴', '꽝', '망', '죽었'];
    for (const line of relatedChatLines.slice(0, 50)) {
      const ll = line.toLowerCase();
      if (successW.some(w => ll.includes(w)) && keyMoments.length < 3) keyMoments.push({ text: line.trim().substring(0, 60), type: 'success' });
      else if (failW.some(w => ll.includes(w)) && keyMoments.length < 3) keyMoments.push({ text: line.trim().substring(0, 60), type: 'fail' });
    }
    const topQuotes = [];
    const scored = relatedChatLines.map(line => {
      const ll = line.toLowerCase();
      let score = 0;
      POSITIVE_WORDS.forEach(w => { if (ll.includes(w)) score += 2; });
      NEGATIVE_SENTIMENT_WORDS.forEach(w => { if (ll.includes(w)) score += 2; });
      if (hasExplicitGameKeyword(line)) score += 3;
      if (isPersonalChat(line)) score -= 3;
      return { line: line.trim(), score };
    }).sort((a, b) => b.score - a.score);
    for (const { line } of scored.slice(0, 5)) {
      if (!line || line.length < 2) continue;
      const ll = line.toLowerCase();
      const hasPos = POSITIVE_WORDS.some(w => ll.includes(w));
      const hasNeg = NEGATIVE_SENTIMENT_WORDS.some(w => ll.includes(w));
      const sentiment = hasPos && !hasNeg ? 'positive' : hasNeg && !hasPos ? 'negative' : 'neutral';
      topQuotes.push({ text: line.substring(0, 80), sentiment, activity: actName });
    }
    activities.push({ name: actName, mentionCount, chatReactions, sentiment: { positive: posCount, negative: negCount, neutral: neuCount }, keyMoments, topQuotes });
  }
  activities.sort((a, b) => b.mentionCount - a.mentionCount);

  // ── Sentiment ──
  let gamePos = 0, gameNeg = 0, gameNeu = 0;
  for (const line of gameRelatedLines) {
    const ll = line.toLowerCase();
    const hasPos = POSITIVE_WORDS.some(w => ll.includes(w));
    const hasNeg = NEGATIVE_SENTIMENT_WORDS.some(w => ll.includes(w));
    if (hasPos && !hasNeg) gamePos++;
    else if (hasNeg && !hasPos) gameNeg++;
    else gameNeu++;
  }
  const gameSentTotal = gamePos + gameNeg + gameNeu || 1;
  const gameSentScore = Math.round(((gamePos / gameSentTotal) * 100 - (gameNeg / gameSentTotal) * 50 + 50));
  const gameSentiment = { positive: gamePos, negative: gameNeg, neutral: gameNeu, score: Math.max(0, Math.min(100, gameSentScore)), totalLines: gameRelatedLines.length };

  let totalPos = 0, totalNeg = 0, totalNeu = 0;
  for (const line of chatLines) {
    const ll = line.toLowerCase();
    const hasPos = POSITIVE_WORDS.some(w => ll.includes(w));
    const hasNeg = NEGATIVE_SENTIMENT_WORDS.some(w => ll.includes(w));
    if (hasPos && !hasNeg) totalPos++;
    else if (hasNeg && !hasPos) totalNeg++;
    else totalNeu++;
  }
  const totalSent = totalPos + totalNeg + totalNeu || 1;
  const sentScore = Math.round(((totalPos / totalSent) * 100 - (totalNeg / totalSent) * 50 + 50));
  const overallSentiment = { positive: totalPos, negative: totalNeg, neutral: totalNeu, score: Math.max(0, Math.min(100, sentScore)) };

  // ══ 5개 항목 생성 ══
  const content = buildContent(tLower, gameContext);
  const kwResult = buildKeywords(chatLines);
  const keywords = kwResult.text;
  const reaction = buildReaction(chatLines, activities, gameSentiment, []);
  const issues = buildIssues(tLower, cTextLower, activities);
  const negative = buildNegative(chatLines);

  // ── Content Issues ──
  const contentIssues = [];
  for (const act of activities) {
    if (act.chatReactions === 0) continue;
    const st = act.sentiment.positive + act.sentiment.negative + act.sentiment.neutral || 1;
    const nr = act.sentiment.negative / st;
    if (nr >= 0.3 && act.sentiment.negative >= 3) {
      contentIssues.push({ activity: act.name, severity: nr >= 0.5 ? 'high' : 'medium', negativeCount: act.sentiment.negative, totalReactions: act.chatReactions, negRatio: Math.round(nr * 100), quotes: act.topQuotes.filter(q => q.sentiment === 'negative').slice(0, 3).map(q => q.text), summary: `${act.name} 부정 ${Math.round(nr * 100)}% (${act.sentiment.negative}건)` });
    }
  }

  // ── Top Quotes ──
  const allScoredChat = chatLines.map(line => {
    const ll = line.toLowerCase();
    let score = 0;
    POSITIVE_WORDS.forEach(w => { if (ll.includes(w)) score += 2; });
    NEGATIVE_SENTIMENT_WORDS.forEach(w => { if (ll.includes(w)) score += 2; });
    if (hasExplicitGameKeyword(line)) score += 5;
    if (isPersonalChat(line)) score -= 3;
    return { line: line.trim(), score };
  }).filter(x => x.line.length >= 3).sort((a, b) => b.score - a.score);
  const topQuotes = [];
  const seenTexts = new Set();
  for (const { line } of allScoredChat) {
    if (topQuotes.length >= 8) break;
    const short = line.substring(0, 80);
    if (seenTexts.has(short)) continue;
    seenTexts.add(short);
    const ll = line.toLowerCase();
    const hasPos = POSITIVE_WORDS.some(w => ll.includes(w));
    const hasNeg = NEGATIVE_SENTIMENT_WORDS.some(w => ll.includes(w));
    const sentiment = hasPos && !hasNeg ? 'positive' : hasNeg && !hasPos ? 'negative' : 'neutral';
    let matchedAct = '';
    for (const [actName, actWords] of Object.entries(ACTIVITY_CATS)) { if (actWords.some(w => ll.includes(w.toLowerCase()))) { matchedAct = actName; break; } }
    topQuotes.push({ text: short, sentiment, activity: matchedAct || '일반', isGameRelated: isGameRelatedChat(line) });
  }

  // ── Advertiser Metrics ──
  const chatDensity = chatLines.length;
  const positivityRatio = totalPos / totalSent;
  const adjustedEngagement = Math.round(Math.min(100, (Math.min(chatDensity, 500) / 500 * 40) + (positivityRatio * 60)));
  let profanityCount = 0;
  for (const line of chatLines) { if (PROFANITY_WORDS.some(w => line.toLowerCase().includes(w))) profanityCount++; }
  const profanityRatio = chatLines.length > 0 ? profanityCount / chatLines.length : 0;
  const brandSafety = profanityRatio < 0.01 ? 'high' : profanityRatio < 0.05 ? 'medium' : 'low';
  const peakActivity = activities.length > 0 ? activities.reduce((b, a) => a.chatReactions > b.chatReactions ? a : b, activities[0]) : null;
  const advertiserMetrics = { engagementScore: adjustedEngagement, brandSafety, peakActivity: peakActivity ? peakActivity.name : '-', adRecommendation: '', chatDensity };

  // ── Suggestions ──
  const suggestions = [];
  const seenSugg = new Set();
  for (const line of chatLines) {
    const ll = line.toLowerCase();
    if (isPersonalChat(line)) continue;
    if (!SUGGESTION_WORDS.some(w => ll.includes(w))) continue;
    if (!hasExplicitGameKeyword(line)) continue;
    const cleaned = line.trim().substring(0, 100);
    if (cleaned.length < 5 || seenSugg.has(cleaned)) continue;
    seenSugg.add(cleaned);
    let cat = '일반';
    if (['버그', '오류', '렉'].some(w => ll.includes(w))) cat = '버그/오류';
    else if (['밸런스', '너프', '하향'].some(w => ll.includes(w))) cat = '밸런스';
    else if (['콘텐츠', '추가', '신규'].some(w => ll.includes(w))) cat = '콘텐츠 추가';
    else if (['이벤트', '보상'].some(w => ll.includes(w))) cat = '이벤트/보상';
    suggestions.push({ text: cleaned, category: cat });
  }
  suggestions.splice(10);

  return {
    content, keywords, reaction,
    negative, issues,
    activities, overallSentiment, gameSentiment, topQuotes,
    advertiserMetrics, suggestions, contentIssues,
    gameContext, chatKeywordStats: kwResult.stats,
    chatStats: {
      totalRaw: rawChatLines.length,
      afterBotFilter: chatLines.length,
      botFiltered: filteredOutCount,
      gameRelated: gameRelatedLines.length,
      personalChat: chatLines.filter(l => isPersonalChat(l)).length,
      generalChat: chatLines.filter(l => !isGameRelatedChat(l) && !isPersonalChat(l)).length,
    },
  };
}
