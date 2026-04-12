/**
 * useNotificationStream - SSE 기반 실시간 알림 훅
 * 서버의 /api/marketplace/notifications/stream 에 연결
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import useAuthStore from '../store/useAuthStore';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export default function useNotificationStream(onNotification) {
  const { isLoggedIn } = useAuthStore();
  const [connected, setConnected] = useState(false);
  const [unread, setUnread] = useState(0);
  const eventSourceRef = useRef(null);
  const retryCount = useRef(0);

  const connect = useCallback(() => {
    if (!isLoggedIn) return;

    const token = localStorage.getItem('lp_accessToken');
    if (!token) return;

    // SSE doesn't support custom headers, pass token as query param
    const url = `${API_BASE}/marketplace/notifications/stream?token=${token}`;

    try {
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onopen = () => {
        setConnected(true);
        retryCount.current = 0;
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'notifications' && data.data?.length > 0) {
            setUnread(prev => prev + data.data.length);
            onNotification?.(data.data);
          }
        } catch { /* skip malformed data */ }
      };

      es.onerror = () => {
        es.close();
        setConnected(false);
        // Reconnect with exponential backoff (max 30s)
        const delay = Math.min(1000 * Math.pow(2, retryCount.current), 30000);
        retryCount.current++;
        setTimeout(connect, delay);
      };
    } catch {
      setConnected(false);
    }
  }, [isLoggedIn, onNotification]);

  useEffect(() => {
    connect();
    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, [connect]);

  const resetUnread = useCallback(() => setUnread(0), []);

  return { connected, unread, resetUnread };
}
