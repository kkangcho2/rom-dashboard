import { create } from 'zustand';
import { startCrawl, pollCrawlStatus, getVideoAnalysis } from '../services/api';
import { buildRealAnalysis } from '../utils/analysis';

const useCrawlStore = create((set, get) => ({
  // Crawl state
  step: 0,
  analysisRunning: false,
  analysisComplete: false,
  crawlError: null,
  data: null,

  // Input state
  url: '',
  transcript: '',
  chatData: '',
  tone: 'objective',

  // Setters
  setUrl: (url) => set({ url }),
  setTranscript: (transcript) => set({ transcript }),
  setChatData: (chatData) => set({ chatData }),
  setTone: (tone) => set({ tone }),

  // Actions
  runAnalysis: async () => {
    const { url, transcript, chatData } = get();
    set({ analysisRunning: true, analysisComplete: false, step: 1, crawlError: null });

    try {
      const { jobId } = await startCrawl(url);
      set({ step: 2 });

      const crawlResult = await pollCrawlStatus(jobId, (progress) => {
        if (progress >= 30) set({ step: 3 });
        if (progress >= 70) set({ step: 4 });
      });

      set({ step: 5 });

      let analysisData = null;
      try {
        const videoId = crawlResult.videoId || '';
        if (videoId) {
          analysisData = await getVideoAnalysis(videoId);
        }
      } catch (e) {
        console.log('Analysis API unavailable, using crawl result only:', e.message);
      }

      // Auto-fill transcript and chat
      const updates = {};
      if (crawlResult.transcript && !transcript) {
        updates.transcript = crawlResult.transcript;
      }
      if (crawlResult.chatMessages?.length && !chatData) {
        updates.chatData = crawlResult.chatMessages.map(m => `${m.username}: ${m.message}`).join('\n');
      }
      if (crawlResult.comments?.length && !chatData && !crawlResult.chatMessages?.length) {
        updates.chatData = crawlResult.comments.slice(0, 30).map(c => `${c.username}: ${c.content}`).join('\n');
      }

      const realData = buildRealAnalysis(crawlResult, analysisData);
      realData._crawlPlatform = crawlResult.platform;

      set({
        ...updates,
        data: realData,
        analysisRunning: false,
        analysisComplete: true,
      });
    } catch (err) {
      console.log('Crawl API unavailable:', err.message);
      set({
        crawlError: `크롤링 서버에 연결할 수 없습니다. 서버를 실행해주세요: npm run server`,
        analysisRunning: false,
      });
    }
  },

  loadDemoData: () => {
    set({
      url: 'https://www.youtube.com/watch?v=GAME_DEMO_2026',
      transcript: '안녕하세요 여러분~ 오늘도 게임 방송 시작합니다! 오늘은 신규 업데이트 리뷰하고, 보스전 공략도 진행할 예정입니다. 이번 시즌 밸런스 패치가 꽤 크게 왔는데... 같이 살펴보겠습니다. PvP 랭킹도 도전해볼게요!',
      chatData: 'ㅋㅋㅋ 가챠 ㄱㄱ\n이번 업데이트 좋다\n밸런스 패치 실화냐\n신캐릭 너무 강함\n와 보스 클리어!!\n렉 걸리네\nPvP 언제 시작?\n서버 튕겼어 ㅡㅡ\n이벤트 보상 뭐임?\n초보인데 뭐 해야 해요?',
    });
  },

  reset: () => set({
    step: 0, analysisRunning: false, analysisComplete: false,
    crawlError: null, data: null, url: '', transcript: '', chatData: '', tone: 'objective',
  }),
}));

export default useCrawlStore;
