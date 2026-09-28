import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-expo';
import { useAuthStore } from '../../store/authStore';
import {
  searchEmployees,
  getAdminEmployeeConversations,
  getAdminConversationMessages,
} from '../../api/chatApi';
import { EmployeeSearchResult, ConversationItem, ChatMessage } from '../../types/chat';

function formatTimestamp(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  if (isToday) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (isYesterday) {
    return 'Yesterday';
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function AdminEmployeeChatViewer() {
  const { getToken } = useAuth();
  const role = useAuthStore((state) => state.role);
  const profile = useAuthStore((state) => state.profile);
  const isAdmin = role === 'ADMIN' || profile?.employee_id === 'ADMIN';

  // Navigation steps within viewer: 'directory' -> 'conversations' -> 'messages'
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeSearchResult | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<ConversationItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Directory of all employees
  const {
    data: employees = [],
    isLoading: isEmployeesLoading,
    refetch: refetchEmployees,
  } = useQuery<EmployeeSearchResult[]>({
    queryKey: ['admin-emp-directory'],
    queryFn: async () => {
      const token = await getToken();
      if (!token) return [];
      return searchEmployees('', token);
    },
    enabled: isAdmin,
    staleTime: 60000,
  });

  // Filtered employees by search
  const filteredEmployees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (emp) =>
        emp.name?.toLowerCase().includes(q) ||
        emp.employee_id?.toLowerCase().includes(q) ||
        emp.department?.toLowerCase().includes(q) ||
        emp.designation?.toLowerCase().includes(q)
    );
  }, [employees, searchQuery]);

  // 2. Selected employee's conversations
  const {
    data: employeeConvosData,
    isLoading: isConvosLoading,
    refetch: refetchConvos,
  } = useQuery({
    queryKey: ['admin-emp-conversations', selectedEmployee?.id],
    queryFn: async () => {
      if (!selectedEmployee) return null;
      const token = await getToken();
      if (!token) return null;
      return getAdminEmployeeConversations(selectedEmployee.id, token);
    },
    enabled: isAdmin && !!selectedEmployee,
  });

  // 3. Selected conversation's messages (strictly read-only)
  const {
    data: conversationMessagesData,
    isLoading: isMessagesLoading,
  } = useQuery({
    queryKey: ['admin-conv-messages', selectedConversation?.id],
    queryFn: async () => {
      if (!selectedConversation) return null;
      const token = await getToken();
      if (!token) return null;
      return getAdminConversationMessages(selectedConversation.id, token, 150);
    },
    enabled: isAdmin && !!selectedConversation,
  });

  if (!isAdmin) {
    return (
      <View style={styles.centerBox}>
        <Feather name="shield-off" size={48} color="#EF4444" />
        <Text style={styles.errorTitle}>Access Denied</Text>
        <Text style={styles.errorSub}>Administrator privileges are required.</Text>
      </View>
    );
  }

  // LEVEL 3: INSPECT CONVERSATION MESSAGES (READ-ONLY)
  if (selectedConversation && selectedEmployee) {
    const messages: ChatMessage[] = conversationMessagesData?.messages || [];
    const participants = (selectedConversation as any).participants || [];
    const otherParticipant = participants.find((p: any) => p.id !== selectedEmployee.id) || null;

    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => setSelectedConversation(null)}
          >
            <Feather name="arrow-left" size={22} color="#1E293B" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {selectedEmployee.name} & {otherParticipant?.name || 'Colleague'}
            </Text>
            <Text style={styles.headerSub}>
              Read-Only Inspection • Conversation #{selectedConversation.id}
            </Text>
          </View>
          <View style={styles.auditBadge}>
            <Feather name="eye" size={14} color="#6B2FA0" />
            <Text style={styles.auditBadgeText}>Audit</Text>
          </View>
        </View>

        {/* Read-Only Notice Banner */}
        <View style={styles.readOnlyBanner}>
          <Feather name="info" size={14} color="#475569" />
          <Text style={styles.readOnlyBannerText}>
            Monitoring mode. No read receipts or delivery status will be modified.
          </Text>
        </View>

        {/* Message Feed */}
        {isMessagesLoading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#6B2FA0" />
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.centerBox}>
            <Text style={styles.emptySubtitle}>No messages recorded in this conversation.</Text>
          </View>
        ) : (
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.messagesList}
            renderItem={({ item }) => {
              const isTargetEmployee = item.sender_id === selectedEmployee.id;
              return (
                <View
                  style={[
                    styles.msgBubbleWrap,
                    isTargetEmployee ? styles.msgAlignRight : styles.msgAlignLeft,
                  ]}
                >
                  <Text style={styles.msgSenderName}>{item.sender_name}</Text>
                  <View
                    style={[
                      styles.msgBubble,
                      isTargetEmployee ? styles.bubblePrimary : styles.bubbleSecondary,
                    ]}
                  >
                    <Text
                      style={[
                        styles.msgContent,
                        isTargetEmployee ? styles.msgContentPrimary : styles.msgContentSecondary,
                      ]}
                    >
                      {item.content}
                    </Text>

                    {item.attachments && item.attachments.length > 0 && (
                      <View style={styles.attachmentChip}>
                        <Feather name="file" size={12} color="#6B2FA0" />
                        <Text style={styles.attachmentName} numberOfLines={1}>
                          {item.attachments[0].file_name}
                        </Text>
                      </View>
                    )}

                    <View style={styles.msgFooter}>
                      <Text
                        style={[
                          styles.msgTime,
                          isTargetEmployee ? styles.msgTimePrimary : styles.msgTimeSecondary,
                        ]}
                      >
                        {formatTimestamp(item.created_at)}
                      </Text>
                      <Text
                        style={[
                          styles.msgStatus,
                          isTargetEmployee ? styles.msgTimePrimary : styles.msgTimeSecondary,
                        ]}
                      >
                        {item.status === 'READ' ? ' • Read' : item.status === 'DELIVERED' ? ' • Delivered' : ' • Sent'}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            }}
          />
        )}
      </View>
    );
  }

  // LEVEL 2: SELECTED EMPLOYEE'S CONVERSATIONS LIST
  if (selectedEmployee) {
    const convos: ConversationItem[] = employeeConvosData?.conversations || [];

    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => setSelectedEmployee(null)}
          >
            <Feather name="arrow-left" size={22} color="#1E293B" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {selectedEmployee.name}
            </Text>
            <Text style={styles.headerSub}>
              {selectedEmployee.employee_id} • {selectedEmployee.designation || 'Staff'}
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            1-to-1 Conversations ({convos.length})
          </Text>
        </View>

        {isConvosLoading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#6B2FA0" />
          </View>
        ) : convos.length === 0 ? (
          <View style={styles.centerBox}>
            <MaterialCommunityIcons name="chat-remove-outline" size={48} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No Conversations Found</Text>
            <Text style={styles.emptySubtitle}>
              This employee has not initiated or participated in any one-to-one chats.
            </Text>
          </View>
        ) : (
          <FlatList
            data={convos}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const participants = (item as any).participants || [];
              const other = participants.find((p: any) => p.id !== selectedEmployee.id) || null;
              const otherName = other?.name || 'Unknown Colleague';
              const otherId = other?.employee_id || '';

              return (
                <TouchableOpacity
                  style={styles.card}
                  onPress={() => setSelectedConversation(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {otherName.substring(0, 2).toUpperCase()}
                    </Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {otherName}
                      </Text>
                      {item.last_message?.created_at && (
                        <Text style={styles.timeText}>
                          {formatTimestamp(item.last_message.created_at)}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.cardSub}>ID: {otherId}</Text>
                    {item.last_message && (
                      <Text style={styles.cardPreview} numberOfLines={1}>
                        {item.last_message.sender_name}: {item.last_message.content}
                      </Text>
                    )}
                  </View>

                  <Feather name="chevron-right" size={20} color="#CBD5E1" />
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    );
  }

  // LEVEL 1: SEARCHABLE EMPLOYEE DIRECTORY
  return (
    <View style={styles.container}>
      {/* Search Header */}
      <View style={styles.topBar}>
        <View style={styles.searchBox}>
          <Feather name="search" size={18} color="#94A3B8" style={styles.searchIcon} />
          <TextInput
            placeholder="Search employee by name, ID, department..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
            placeholderTextColor="#94A3B8"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Feather name="x" size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          Employees ({filteredEmployees.length})
        </Text>
        <Text style={styles.sectionSub}>Select an employee to inspect chats</Text>
      </View>

      {isEmployeesLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#6B2FA0" />
        </View>
      ) : filteredEmployees.length === 0 ? (
        <View style={styles.centerBox}>
          <Text style={styles.emptySubtitle}>No matching employees found.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredEmployees}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => setSelectedEmployee(item)}
              activeOpacity={0.7}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.name.substring(0, 2).toUpperCase()}</Text>
              </View>

              <View style={{ flex: 1 }}>
                <View style={styles.rowBetween}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  <Text style={styles.badgeId}>{item.employee_id}</Text>
                </View>
                <Text style={styles.cardSub}>
                  {item.designation || 'Staff'} • {item.department || 'Healthcare'}
                </Text>
              </View>

              <Feather name="chevron-right" size={20} color="#CBD5E1" />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1E293B',
    paddingVertical: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 12,
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  headerSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  auditBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(107, 47, 160, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  auditBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B2FA0',
  },
  readOnlyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  readOnlyBannerText: {
    fontSize: 11,
    color: '#475569',
    flex: 1,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  listContent: {
    padding: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#6B2FA0',
    fontSize: 15,
    fontWeight: '700',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  badgeId: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B2FA0',
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cardSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  cardPreview: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  timeText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#EF4444',
    marginTop: 12,
  },
  errorSub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
  messagesList: {
    padding: 16,
  },
  msgBubbleWrap: {
    marginBottom: 12,
    maxWidth: '82%',
  },
  msgAlignRight: {
    alignSelf: 'flex-end',
  },
  msgAlignLeft: {
    alignSelf: 'flex-start',
  },
  msgSenderName: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 3,
    fontWeight: '600',
  },
  msgBubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubblePrimary: {
    backgroundColor: '#6B2FA0',
    borderBottomRightRadius: 2,
  },
  bubbleSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderBottomLeftRadius: 2,
  },
  msgContent: {
    fontSize: 14,
    lineHeight: 20,
  },
  msgContentPrimary: {
    color: '#FFFFFF',
  },
  msgContentSecondary: {
    color: '#1E293B',
  },
  attachmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 6,
  },
  attachmentName: {
    fontSize: 11,
    color: '#6B2FA0',
  },
  msgFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  msgTime: {
    fontSize: 10,
  },
  msgStatus: {
    fontSize: 10,
  },
  msgTimePrimary: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  msgTimeSecondary: {
    color: '#94A3B8',
  },
});
