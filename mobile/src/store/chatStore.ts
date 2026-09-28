import { create } from 'zustand';

interface ChatState {
  activeConversationId: number | null;
  unreadCount: number;
  isWebSocketConnected: boolean;
  chatSectionTab: 'direct' | 'groups' | 'emp_chat';

  setActiveConversation: (id: number | null) => void;
  setUnreadCount: (count: number) => void;
  setWebSocketConnected: (isConnected: boolean) => void;
  setChatSectionTab: (tab: 'direct' | 'groups' | 'emp_chat') => void;
}

export const useChatStore = create<ChatState>()((set) => ({
  activeConversationId: null,
  unreadCount: 0,
  isWebSocketConnected: false,
  chatSectionTab: 'direct',

  setActiveConversation: (id) => set({ activeConversationId: id }),
  setUnreadCount: (count) => set({ unreadCount: count }),
  setWebSocketConnected: (isConnected) => set({ isWebSocketConnected: isConnected }),
  setChatSectionTab: (tab) => set({ chatSectionTab: tab }),
}));

