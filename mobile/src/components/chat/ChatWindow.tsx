import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
  Clipboard,
  ToastAndroid,
  TextInput as RNTextInput,
  Modal,
} from 'react-native';
import {
  Text,
  IconButton,
  Avatar,
  ActivityIndicator,
  Menu,
} from 'react-native-paper';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-expo';
import { useAuthStore } from '../../store/authStore';
import {
  getConversationMessages,
  sendChatMessage,
  markConversationAsRead,
  deleteChatMessage,
  toggleReaction,
  getConversationPresence,
} from '../../api/chatApi';
import { useWebSocket } from '../../hooks/useWebSocket';
import { ConversationItem, ChatMessage } from '../../types/chat';
import ColleagueProfileSheet from './ColleagueProfileSheet';
import { formatLastSeen } from '../../utils/timeFormat';

interface ChatWindowProps {
  conversation: ConversationItem;
  onBack: () => void;
}

const REACTION_EMOJIS = ['👍', '❤️', '😆', '😮', '😢', '😠'];

export default function ChatWindow({ conversation, onBack }: ChatWindowProps) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const currentProfileId = useAuthStore((state) => state.profile?.id);

  const [inputContent, setInputContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [profileVisible, setProfileVisible] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const typingTimerRef = useRef<any>(null);

  // Reaction & message context menu
  const [selectedMsg, setSelectedMsg] = useState<ChatMessage | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);

  // Modern Input & Image Attachment States
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [imagePreviewModalVisible, setImagePreviewModalVisible] = useState(false);
  const [attachedImageUri, setAttachedImageUri] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [inputHeight, setInputHeight] = useState(40);

  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // WebSocket callbacks
  const handleNewMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
    // If incoming message, mark as read
    if (!msg.is_self) {
      getToken().then((token) => {
        if (token) markConversationAsRead(conversation.id, token);
      });
    }
  }, [conversation.id, getToken]);

  const handleTypingEvent = useCallback((data: { name: string; is_typing: boolean }) => {
    if (data.is_typing) {
      setTypingUser(data.name);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => setTypingUser(null), 3000);
    } else {
      setTypingUser(null);
    }
  }, []);

  const handleReadReceipt = useCallback(() => {
    setMessages((prev) =>
      prev.map((m) => (m.is_self ? { ...m, status: 'READ' } : m))
    );
  }, []);

  // Presence State & Sync
  const [partnerOnline, setPartnerOnline] = useState<boolean>(
    Boolean(conversation.other_member?.is_online)
  );
  const [partnerLastSeen, setPartnerLastSeen] = useState<string | null | undefined>(
    conversation.other_member?.last_seen_at
  );

  useEffect(() => {
    setPartnerOnline(Boolean(conversation.other_member?.is_online));
    setPartnerLastSeen(conversation.other_member?.last_seen_at);
  }, [conversation.id, conversation.other_member?.is_online, conversation.other_member?.last_seen_at]);

  // Query conversation presence initially & periodic background refresh
  const { data: presenceData } = useQuery({
    queryKey: ['conversation-presence', conversation.id],
    queryFn: async () => {
      const token = await getToken();
      if (!token) return null;
      return getConversationPresence(conversation.id, token);
    },
    enabled: conversation.type === 'DIRECT',
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (presenceData && conversation.type === 'DIRECT') {
      if (typeof presenceData.is_online === 'boolean') {
        setPartnerOnline(presenceData.is_online);
      }
      if (presenceData.last_seen_at !== undefined) {
        setPartnerLastSeen(presenceData.last_seen_at);
      }
    }
  }, [presenceData, conversation.type]);

  const handlePresenceEvent = useCallback(
    (data: { employee_id: number; is_online: boolean; last_seen_at?: string | null }) => {
      if (
        conversation.type === 'DIRECT' &&
        (!conversation.other_member?.id || conversation.other_member.id === data.employee_id)
      ) {
        setPartnerOnline(data.is_online);
        if (data.last_seen_at !== undefined) {
          setPartnerLastSeen(data.last_seen_at);
        }
      }
    },
    [conversation.type, conversation.other_member?.id]
  );

  // Hook WebSocket connection
  const { isConnected, sendMessage: wsSend, sendTyping } = useWebSocket({
    conversationId: conversation.id,
    onNewMessage: handleNewMessage,
    onTyping: handleTypingEvent,
    onReadReceipt: handleReadReceipt,
    onPresence: handlePresenceEvent,
  });

  // Fetch initial message history with 5s polling fallback when offline/no-ws
  const { data: initialMessages = [], isLoading } = useQuery({
    queryKey: ['chat-messages', conversation.id],
    queryFn: async () => {
      const token = await getToken();
      if (!token) return [];
      return getConversationMessages(conversation.id, token);
    },
    refetchInterval: isConnected ? false : 5000,
  });

  useEffect(() => {
    if (initialMessages.length > 0) {
      setMessages((prev) => {
        if (prev.length === 0) return initialMessages;
        if (initialMessages.length !== prev.length) return initialMessages;
        const lastInit = initialMessages[initialMessages.length - 1];
        const lastPrev = prev[prev.length - 1];
        if (lastInit?.id !== lastPrev?.id || lastInit?.status !== lastPrev?.status) {
          return initialMessages;
        }
        return prev;
      });
    }
  }, [initialMessages]);

  // Mark conversation read on mount
  useEffect(() => {
    const markRead = async () => {
      try {
        const token = await getToken();
        if (token) await markConversationAsRead(conversation.id, token);
      } catch {}
    };
    markRead();
  }, [conversation.id, getToken]);

  // Handle typing debounce
  const handleInputChange = (text: string) => {
    setInputContent(text);
    sendTyping(text.length > 0);
  };

  const handleSend = async () => {
    const content = inputContent.trim();
    const imageToSend = attachedImageUri;
    if ((!content && !imageToSend) || isSending || isUploading) return;

    // 1. If sending an image attachment
    if (imageToSend) {
      setIsUploading(true);
      try {
        const token = await getToken();
        if (!token) throw new Error('Authentication required');
        const newMsg = await sendChatMessage(conversation.id, content, token, imageToSend);
        setMessages((prev) => [...prev, newMsg]);
        setAttachedImageUri(null);
        setInputContent('');
      } catch (err: any) {
        Alert.alert(
          'Upload Failed',
          'Could not send image attachment. Would you like to retry?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Retry', onPress: () => handleSend() },
          ]
        );
      } finally {
        setIsUploading(false);
      }
      return;
    }

    // 2. Text-only message
    setInputContent('');
    sendTyping(false);

    // Try WebSocket first
    const sentViaWs = wsSend(content);
    if (!sentViaWs) {
      // Fallback to REST API
      setIsSending(true);
      try {
        const token = await getToken();
        if (token) {
          const newMsg = await sendChatMessage(conversation.id, content, token);
          setMessages((prev) => [...prev, newMsg]);
        }
      } catch (err: any) {
        Alert.alert('Message Failed', 'Could not send message. Please check your connection.');
      } finally {
        setIsSending(false);
      }
    }
  };

  const handlePickAttachment = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false, // Requirement 5: Do NOT open crop interface automatically!
        quality: 0.9,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        setSelectedImageUri(result.assets[0].uri);
        setImagePreviewModalVisible(true);
      }
    } catch {
      Alert.alert('Error', 'Could not access image library.');
    }
  };

  const handleOpenCrop = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true, // Only open crop interface when user explicitly taps Crop!
        quality: 0.9,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        setSelectedImageUri(cropResultOr(result.assets[0].uri));
      }
    } catch {}
  };

  const cropResultOr = (uri: string) => uri;

  const handleAttachImage = () => {
    if (selectedImageUri) {
      setAttachedImageUri(selectedImageUri);
      setImagePreviewModalVisible(false);
      setSelectedImageUri(null);
    }
  };

  const handleToggleReaction = async (emoji: string) => {
    if (!selectedMsg) return;
    setMenuVisible(false);
    try {
      const token = await getToken();
      if (token) {
        await toggleReaction(selectedMsg.id, emoji, token);
        queryClient.invalidateQueries({ queryKey: ['chat-messages', conversation.id] });
      }
    } catch {}
  };

  const handleDeleteMessage = async () => {
    if (!selectedMsg) return;
    setMenuVisible(false);
    try {
      const token = await getToken();
      if (token) {
        await deleteChatMessage(selectedMsg.id, token);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === selectedMsg.id
              ? { ...m, is_deleted: true, content: 'This message was deleted.' }
              : m
          )
        );
      }
    } catch {
      Alert.alert('Error', 'Could not delete message.');
    }
  };

  const handleCopyMessage = () => {
    if (selectedMsg?.content) {
      Clipboard.setString(selectedMsg.content);
      ToastAndroid.show('Message copied', ToastAndroid.SHORT);
    }
    setMenuVisible(false);
  };

  const title =
    conversation.type === 'GROUP'
      ? conversation.group_name || 'Group Chat'
      : conversation.other_member?.name || 'Colleague';
  const isOnline = conversation.type === 'DIRECT' ? partnerOnline : false;

  const getSubtitle = () => {
    if (conversation.type === 'GROUP') {
      const count = conversation.members?.length || 0;
      return `${count} ${count === 1 ? 'member' : 'members'}${isConnected ? ' • Realtime' : ''}`;
    }
    if (isOnline) {
      return `Online${isConnected ? ' • Realtime' : ''}`;
    }
    return formatLastSeen(partnerLastSeen);
  };

  // Inverted FlatList requires array in reverse order (newest first)
  const invertedMessages = [...messages].reverse();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Top Chat Header */}
      <View style={styles.header}>
        <IconButton icon="arrow-left" iconColor="#FFFFFF" size={24} onPress={onBack} />

        <TouchableOpacity
          style={styles.headerInfo}
          onPress={() => setProfileVisible(true)}
        >
          <View style={styles.avatarBox}>
            <Avatar.Text
              size={38}
              label={title.substring(0, 2).toUpperCase()}
              style={styles.headerAvatar}
            />
            {isOnline && <View style={styles.onlineDot} />}
          </View>
          <View style={styles.headerTextCol}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.headerStatus} numberOfLines={1}>
              {getSubtitle()}
            </Text>
          </View>
        </TouchableOpacity>

        <IconButton
          icon="information-outline"
          iconColor="#FFFFFF"
          size={24}
          onPress={() => setProfileVisible(true)}
        />
      </View>

      {/* Typing Indicator Bar */}
      {typingUser && (
        <View style={styles.typingBanner}>
          <ActivityIndicator size={12} color="#6B2FA0" />
          <Text style={styles.typingText}>{typingUser} is typing...</Text>
        </View>
      )}

      {/* Messages Viewport */}
      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#6B2FA0" />
        </View>
      ) : (
        <FlatList
          data={invertedMessages}
          keyExtractor={(item) => String(item.id)}
          inverted
          contentContainerStyle={styles.messagesList}
          renderItem={({ item }) => {
            const isSelf = item.is_self || item.sender_id === currentProfileId;

            return (
              <TouchableOpacity
                activeOpacity={0.8}
                onLongPress={() => {
                  setSelectedMsg(item);
                  setMenuVisible(true);
                }}
                style={[
                  styles.messageRow,
                  isSelf ? styles.selfRow : styles.otherRow,
                ]}
              >
                <View
                  style={[
                    styles.bubble,
                    isSelf ? styles.selfBubble : styles.otherBubble,
                    item.is_deleted && styles.deletedBubble,
                  ]}
                >
                  {/* Attachment image if present */}
                  {item.attachments && item.attachments.length > 0 && !item.is_deleted && (
                    <Image
                      source={{ uri: item.attachments[0].file_url }}
                      style={styles.attachmentImage}
                      contentFit="cover"
                    />
                  )}

                  {/* Message text */}
                  {item.content ? (
                    <Text
                      style={[
                        styles.messageText,
                        isSelf ? styles.selfText : styles.otherText,
                        item.is_deleted && styles.deletedText,
                      ]}
                    >
                      {item.content}
                    </Text>
                  ) : null}

                  {/* Timestamp & Delivery status */}
                  <View style={styles.metaRow}>
                    <Text
                      style={[
                        styles.timeText,
                        isSelf ? styles.selfTimeText : styles.otherTimeText,
                      ]}
                    >
                      {new Date(item.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                    {isSelf && (
                      <Text
                        style={[
                          styles.statusTick,
                          item.status === 'READ' && styles.readTick,
                        ]}
                      >
                        {item.status === 'READ' ? '✓✓' : item.status === 'DELIVERED' ? '✓✓' : '✓'}
                      </Text>
                    )}
                  </View>

                  {/* Reactions Display */}
                  {item.reactions && item.reactions.length > 0 && (
                    <View style={styles.reactionsRow}>
                      {item.reactions.map((r, i) => (
                        <View
                          key={i}
                          style={[
                            styles.reactionBadge,
                            r.reacted_by_self && styles.reactedSelfBadge,
                          ]}
                        >
                          <Text style={styles.reactionEmoji}>
                            {r.emoji} {r.count > 1 ? r.count : ''}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Message Options / Reaction Menu Modal */}
      {selectedMsg && (
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={{ x: 100, y: 300 }}
        >
          <View style={styles.emojiPickerRow}>
            {REACTION_EMOJIS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={styles.emojiBtn}
                onPress={() => handleToggleReaction(emoji)}
              >
                <Text style={styles.emojiPickText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Menu.Item onPress={handleCopyMessage} title="Copy" leadingIcon="content-copy" />
          {(selectedMsg.is_self || selectedMsg.sender_id === currentProfileId) && (
            <Menu.Item
              onPress={handleDeleteMessage}
              title="Delete Message"
              leadingIcon="delete"
              titleStyle={{ color: '#DC2626' }}
            />
          )}
        </Menu>
      )}

      {/* Attached Image Preview in Composer before sending */}
      {attachedImageUri && (
        <View style={styles.attachedPreviewBar}>
          <Image source={{ uri: attachedImageUri }} style={styles.attachedThumbnail} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.attachedTitle} numberOfLines={1}>
              Image attached
            </Text>
            <Text style={styles.attachedSub}>Ready to send with your message</Text>
          </View>
          <TouchableOpacity
            style={styles.removeAttachedBtn}
            onPress={() => setAttachedImageUri(null)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="x" size={18} color="#EF4444" />
          </TouchableOpacity>
        </View>
      )}

      {/* Uploading Progress Indicator */}
      {isUploading && (
        <View style={styles.uploadingBar}>
          <ActivityIndicator size="small" color="#6B2FA0" />
          <Text style={styles.uploadingText}>Uploading image...</Text>
        </View>
      )}

      {/* Responsive Modern Bottom Composer Bar */}
      <View style={styles.composerBar}>
        <TouchableOpacity
          style={styles.attachBtn}
          onPress={handlePickAttachment}
          disabled={isSending || isUploading}
          activeOpacity={0.7}
        >
          <Feather name="paperclip" size={22} color="#6B2FA0" />
        </TouchableOpacity>

        <View style={styles.inputContainer}>
          <RNTextInput
            placeholder="Type a message..."
            placeholderTextColor="#94A3B8"
            value={inputContent}
            onChangeText={handleInputChange}
            multiline
            onContentSizeChange={(e) => {
              const h = e.nativeEvent.contentSize.height;
              setInputHeight(Math.min(120, Math.max(40, h)));
            }}
            style={[styles.modernInput, { height: Math.min(120, Math.max(40, inputHeight)) }]}
          />
        </View>

        <TouchableOpacity
          style={[
            styles.arrowSendBtn,
            (!inputContent.trim() && !attachedImageUri) || isSending || isUploading
              ? styles.sendBtnDisabled
              : styles.sendBtnActive,
          ]}
          onPress={handleSend}
          disabled={(!inputContent.trim() && !attachedImageUri) || isSending || isUploading}
          activeOpacity={0.8}
        >
          {isSending || isUploading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Feather name="send" size={18} color="#FFFFFF" style={{ marginLeft: 2 }} />
          )}
        </TouchableOpacity>
      </View>

      {/* IMAGE ATTACHMENT PREVIEW MODAL */}
      <Modal
        visible={imagePreviewModalVisible && !!selectedImageUri}
        animationType="fade"
        transparent={false}
        onRequestClose={() => {
          setImagePreviewModalVisible(false);
          setSelectedImageUri(null);
        }}
      >
        <View style={styles.imagePreviewContainer}>
          {/* Top Bar: Close on Left, Crop on Right */}
          <View style={styles.imagePreviewHeader}>
            <TouchableOpacity
              onPress={() => {
                setImagePreviewModalVisible(false);
                setSelectedImageUri(null);
              }}
              style={styles.imageHeaderBtn}
            >
              <Feather name="x" size={24} color="#FFFFFF" />
            </TouchableOpacity>

            <Text style={styles.imageHeaderTitle}>Photo Preview</Text>

            <TouchableOpacity onPress={handleOpenCrop} style={styles.cropHeaderBtn}>
              <Feather name="crop" size={18} color="#FFFFFF" />
              <Text style={styles.cropBtnText}>Crop</Text>
            </TouchableOpacity>
          </View>

          {/* Centered Image Preview */}
          <View style={styles.imagePreviewViewport}>
            {selectedImageUri && (
              <Image
                source={{ uri: selectedImageUri }}
                style={styles.previewFullImage}
                contentFit="contain"
              />
            )}
          </View>

          {/* Bottom Bar: Add to message button */}
          <View style={styles.imagePreviewFooter}>
            <TouchableOpacity
              style={styles.addAttachmentBtn}
              onPress={handleAttachImage}
              activeOpacity={0.8}
            >
              <Feather name="check" size={20} color="#FFFFFF" />
              <Text style={styles.addAttachmentBtnText}>Add to Message</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Colleague Information Sheet */}
      <ColleagueProfileSheet
        visible={profileVisible}
        onClose={() => setProfileVisible(false)}
        employee={
          conversation.other_member
            ? {
                ...conversation.other_member,
                is_online: isOnline,
                last_seen_at: partnerLastSeen || conversation.other_member.last_seen_at,
              }
            : null
        }
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    backgroundColor: '#6B2FA0',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 36,
    paddingBottom: 8,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  avatarBox: {
    position: 'relative',
    marginRight: 10,
  },
  headerAvatar: {
    backgroundColor: '#8B5CF6',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22C55E',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  headerTextCol: {
    flex: 1,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerStatus: {
    color: '#E9D5FF',
    fontSize: 11,
    marginTop: 1,
  },
  typingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#FAF5FF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9D5FF',
  },
  typingText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#6B2FA0',
    fontStyle: 'italic',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  messageRow: {
    marginVertical: 4,
    flexDirection: 'row',
  },
  selfRow: {
    justifyContent: 'flex-end',
  },
  otherRow: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  selfBubble: {
    backgroundColor: '#6B2FA0',
    borderBottomRightRadius: 2,
  },
  otherBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  deletedBubble: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  attachmentImage: {
    width: 220,
    height: 160,
    borderRadius: 8,
    marginBottom: 6,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  selfText: {
    color: '#FFFFFF',
  },
  otherText: {
    color: '#1F2937',
  },
  deletedText: {
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
  },
  timeText: {
    fontSize: 10,
  },
  selfTimeText: {
    color: '#E9D5FF',
  },
  otherTimeText: {
    color: '#9CA3AF',
  },
  statusTick: {
    fontSize: 10,
    marginLeft: 4,
    color: '#E9D5FF',
  },
  readTick: {
    color: '#38BDF8',
    fontWeight: 'bold',
  },
  reactionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 4,
  },
  reactionBadge: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  reactedSelfBadge: {
    backgroundColor: 'rgba(107, 47, 160, 0.2)',
  },
  reactionEmoji: {
    fontSize: 12,
  },
  emojiPickerRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  emojiBtn: {
    padding: 6,
  },
  emojiPickText: {
    fontSize: 22,
  },
  composerBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 8,
  },
  attachBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  inputContainer: {
    flex: 1,
  },
  modernInput: {
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15,
    color: '#1E293B',
    lineHeight: 20,
  },
  arrowSendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnActive: {
    backgroundColor: '#6B2FA0',
  },
  sendBtnDisabled: {
    backgroundColor: '#CBD5E1',
  },
  attachedPreviewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  attachedThumbnail: {
    width: 46,
    height: 46,
    borderRadius: 8,
  },
  attachedTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  attachedSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  removeAttachedBtn: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
  },
  uploadingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAF5FF',
    paddingVertical: 6,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#E9D5FF',
  },
  uploadingText: {
    fontSize: 12,
    color: '#6B2FA0',
    fontWeight: '600',
  },
  imagePreviewContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingTop: Platform.OS === 'ios' ? 44 : 10,
  },
  imagePreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  imageHeaderBtn: {
    padding: 6,
  },
  imageHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cropHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  cropBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  imagePreviewViewport: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  previewFullImage: {
    width: '100%',
    height: '100%',
  },
  imagePreviewFooter: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    backgroundColor: '#0F172A',
  },
  addAttachmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6B2FA0',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  addAttachmentBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
