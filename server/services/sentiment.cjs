// ─── Sentiment Analysis Service ──────────────────────────────

const POSITIVE_KEYWORDS = [
  '좋아', '최고', '감사', '대박', '꿀잼', '잘한다', '멋지다', '재밌',
  '사랑', '응원', '추천', '개꿀', '갓', '레전드', '꿀팁', '유익', '굿',
];

const NEGATIVE_KEYWORDS = [
  '별로', '싫어', '최악', '노잼', '구리다', '아쉽', '실망', '광고',
  '거짓', '사기', '짜증', '쓰레기', '폭망', '환불', '비추',
];

/**
 * Analyze sentiment from a list of texts
 * @param {string[]} texts - Array of text strings to analyze
 * @returns {Object} Sentiment analysis result with positive, negative, neutral percentages and keywords
 */
function analyzeSentiment(texts) {
  const keywordCounts = new Map();
  let positiveCount = 0;
  let negativeCount = 0;
  let neutralCount = 0;

  for (const text of texts) {
    let foundPositive = false;
    let foundNegative = false;

    for (const kw of POSITIVE_KEYWORDS) {
      const regex = new RegExp(kw, 'g');
      const matches = text.match(regex);
      if (matches) {
        foundPositive = true;
        const prev = keywordCounts.get(kw) || { text: kw, count: 0, sentiment: 'positive' };
        prev.count += matches.length;
        keywordCounts.set(kw, prev);
      }
    }

    for (const kw of NEGATIVE_KEYWORDS) {
      const regex = new RegExp(kw, 'g');
      const matches = text.match(regex);
      if (matches) {
        foundNegative = true;
        const prev = keywordCounts.get(kw) || { text: kw, count: 0, sentiment: 'negative' };
        prev.count += matches.length;
        keywordCounts.set(kw, prev);
      }
    }

    if (foundPositive && !foundNegative) positiveCount++;
    else if (foundNegative && !foundPositive) negativeCount++;
    else if (foundPositive && foundNegative) {
      // Mixed sentiment - count both
      positiveCount++;
      negativeCount++;
    } else {
      neutralCount++;
    }
  }

  const total = texts.length;
  const keywords = Array.from(keywordCounts.values())
    .sort((a, b) => b.count - a.count);

  return {
    positive: total > 0 ? parseFloat(((positiveCount / total) * 100).toFixed(1)) : 0,
    negative: total > 0 ? parseFloat(((negativeCount / total) * 100).toFixed(1)) : 0,
    neutral: total > 0 ? parseFloat(((neutralCount / total) * 100).toFixed(1)) : 0,
    keywords,
    total,
  };
}

module.exports = {
  analyzeSentiment,
  POSITIVE_KEYWORDS,
  NEGATIVE_KEYWORDS,
};
