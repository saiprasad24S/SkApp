import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { getWsBaseUrl } from '../lib/api';
import { useChatStore } from '../store/chatStore';
import { ChatMessage } from '../types/chat';

interface UseWebSocketOptions {
  conversationId: number | null;
  onNewMessage?: (msg: ChatMessage) => void;
  onTyping?: (data: { employee_id: number; name: string; is_typing: boolean }) => void;
  onReadReceipt?: (data: { employee_id: number; conversation_id: number }) => void;
  onPresence?: (data: { employee_id: number; is_online: boolean; last_seen_at?: string | null }) => void;
}

export function useWebSocket({
  conversationId,
  onNewMessage,
  onTyping,
  onReadReceipt,
  onPresence,
}: UseWebSocketOptions) {
  const { getToken } = useAuth();
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const isExplicitCloseRef = useRef(false);
  const isConnectingRef = useRef(false);

  const callbacksRef = useRef({ onNewMessage, onTyping, onReadReceipt, onPresence });
  useEffect(() => {
    callbacksRef.current = { onNewMessage, onTyping, onReadReceipt, onPresence };
  }, [onNewMessage, onTyping, onReadReceipt, onPresence]);

  const setWebSocketConnected = useChatStore((state) => state.setWebSocketConnected);
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(async () => {
    if (!conversationId || isConnectingRef.current) return;
    isConnectingRef.current = true;

    try {
      const token = await getToken();
      if (!token) {
        isConnectingRef.current = false;
        return;
      }

      // Close existing cleanly
      if (socketRef.current) {
        isExplicitCloseRef.current = true;
        socketRef.current.close();
        socketRef.current = null;
      }

      const wsUrl = `${getWsBaseUrl()}/ws/chat/${conversationId}/?token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        isConnectingRef.current = false;
        setIsConnected(true);
        setWebSocketConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'new_message' && data.message) {
            callbacksRef.current.onNewMessage?.(data.message);
          } else if (data.type === 'typing') {
            callbacksRef.current.onTyping?.(data);
          } else if (data.type === 'read_receipt') {
            callbacksRef.current.onReadReceipt?.(data);
          } else if (data.type === 'presence') {
            callbacksRef.current.onPresence?.(data);
          }
        } catch (err) {
          // ignore parsing error
        }
      };

      ws.onclose = () => {
        isConnectingRef.current = false;
        setIsConnected(false);
        setWebSocketConnected(false);

        // Only attempt reconnect if disconnect was NOT intentional
        if (!isExplicitCloseRef.current) {
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 3000);
        }
        isExplicitCloseRef.current = false;
      };

      ws.onerror = () => {
        isConnectingRef.current = false;
        try {
          ws.close();
        } catch {}
      };

      socketRef.current = ws;
    } catch (err) {
      isConnectingRef.current = false;
      setIsConnected(false);
      setWebSocketConnected(false);
    }
  }, [conversationId, getToken, setWebSocketConnected]);

  useEffect(() => {
    connect();

    return () => {
      isExplicitCloseRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      setIsConnected(false);
      setWebSocketConnected(false);
    };
  }, [connect]);

  const sendMessage = useCallback((content: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          action: 'send_message',
          content,
        })
      );
      return true;
    }
    return false;
  }, []);

  const sendTyping = useCallback((isTyping: boolean) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          action: 'typing',
          is_typing: isTyping,
        })
      );
    }
  }, []);

  const markRead = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          action: 'mark_read',
        })
      );
    }
  }, []);

  return {
    isConnected,
    sendMessage,
    sendTyping,
    markRead,
  };
}
