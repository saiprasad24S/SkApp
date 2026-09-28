import React, { useState, useEffect } from 'react';
import { StyleSheet, View, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/store/authStore';
import { useChatStore } from '../../src/store/chatStore';
import ConversationList from '../../src/components/chat/ConversationList';
import GroupList from '../../src/components/chat/GroupList';
import AdminEmployeeChatViewer from '../../src/components/chat/AdminEmployeeChatViewer';
import ChatWindow from '../../src/components/chat/ChatWindow';
import { ConversationItem } from '../../src/types/chat';

export default function ChatScreen() {
  const [activeConversation, setActiveConversation] = useState<ConversationItem | null>(null);
  const setActiveConversationId = useChatStore((state) => state.setActiveConversation);
  const chatSectionTab = useChatStore((state) => state.chatSectionTab);
  const setChatSectionTab = useChatStore((state) => state.setChatSectionTab);

  const role = useAuthStore((state) => state.role);
  const profile = useAuthStore((state) => state.profile);
  const isAdmin = role === 'ADMIN' || profile?.employee_id === 'ADMIN';

  useEffect(() => {
    setActiveConversationId(activeConversation ? activeConversation.id : null);
  }, [activeConversation, setActiveConversationId]);

  // Handle Android back button
  useEffect(() => {
    const onBackPress = () => {
      if (activeConversation) {
        setActiveConversation(null);
        return true;
      }
      if (chatSectionTab !== 'direct') {
        setChatSectionTab('direct');
        return true;
      }
      return false; // Returns to Home via employee layout handler
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [activeConversation, chatSectionTab, setChatSectionTab]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {activeConversation ? (
        <ChatWindow
          conversation={activeConversation}
          onBack={() => setActiveConversation(null)}
        />
      ) : chatSectionTab === 'groups' ? (
        <GroupList onSelectConversation={(convo) => setActiveConversation(convo)} />
      ) : chatSectionTab === 'emp_chat' && isAdmin ? (
        <AdminEmployeeChatViewer />
      ) : (
        <ConversationList
          onSelectConversation={(convo) => setActiveConversation(convo)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});
