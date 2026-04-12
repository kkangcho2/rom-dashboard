import { create } from 'zustand';
import {
  startCreatorAnalysis,
  getAnalysisStatus,
  getAnalysisResult,
  startBatchAnalysis,
  getBatchAnalysisStatus,
  getAnalysisReports,
} from '../services/api';

const useAnalysisStore = create((set, get) => ({
  // Single analysis state
  currentReport: null,
  analysisStatus: 'idle', // 'idle' | 'running' | 'completed' | 'error'
  analysisId: null,
  error: null,

  // Batch state
  batchState: null,

  // Reports list
  reports: [],
  reportsTotal: 0,

  // Actions
  startAnalysis: async (input) => {
    set({ analysisStatus: 'running', currentReport: null, error: null, analysisId: null });
    try {
      const result = await startCreatorAnalysis(input);

      if (result.status === 'completed' && result.report) {
        set({
          analysisId: result.id,
          currentReport: result.report,
          analysisStatus: 'completed',
        });
        return result;
      }

      if (result.status === 'filtered') {
        set({
          analysisId: result.id,
          currentReport: { _filtered: true, filter_reason: result.filter_reason, ...result },
          analysisStatus: 'completed',
        });
        return result;
      }

      if (result.status === 'error') {
        set({ analysisStatus: 'error', error: result.error || 'Analysis failed' });
        return result;
      }

      // If status is processing, start polling
      set({ analysisId: result.id });
      get().pollStatus(result.id);
      return result;
    } catch (err) {
      set({ analysisStatus: 'error', error: err.message });
      throw err;
    }
  },

  pollStatus: async (id) => {
    const maxAttempts = 60;
    let attempt = 0;

    const poll = async () => {
      if (attempt >= maxAttempts) {
        set({ analysisStatus: 'error', error: 'Analysis timed out' });
        return;
      }
      attempt++;

      try {
        const status = await getAnalysisStatus(id);

        if (status.status === 'completed') {
          const fullResult = await getAnalysisResult(id);
          set({
            currentReport: fullResult.report,
            analysisStatus: 'completed',
          });
          return;
        }

        if (status.status === 'error' || status.status === 'filtered') {
          set({
            currentReport: status.status === 'filtered'
              ? { _filtered: true, filter_reason: status.filter_reason, ...status }
              : null,
            analysisStatus: status.status === 'filtered' ? 'completed' : 'error',
            error: status.status === 'error' ? (status.filter_reason || 'Analysis failed') : null,
          });
          return;
        }

        // Still processing, poll again
        setTimeout(poll, 2000);
      } catch (err) {
        set({ analysisStatus: 'error', error: err.message });
      }
    };

    poll();
  },

  startBatch: async (names) => {
    try {
      const result = await startBatchAnalysis(names);
      set({ batchState: { ...result, status: 'running' } });
      return result;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  refreshBatchStatus: async () => {
    try {
      const result = await getBatchAnalysisStatus();
      set({ batchState: result });
    } catch (err) {
      console.error('Batch status fetch failed:', err);
    }
  },

  fetchReports: async (params = {}) => {
    try {
      const result = await getAnalysisReports(params);
      set({ reports: result.rows || [], reportsTotal: result.total || 0 });
    } catch (err) {
      console.error('Reports fetch failed:', err);
    }
  },

  clearReport: () => set({
    currentReport: null,
    analysisStatus: 'idle',
    analysisId: null,
    error: null,
  }),

  reset: () => set({
    currentReport: null,
    analysisStatus: 'idle',
    analysisId: null,
    error: null,
    batchState: null,
    reports: [],
    reportsTotal: 0,
  }),
}));

export default useAnalysisStore;
