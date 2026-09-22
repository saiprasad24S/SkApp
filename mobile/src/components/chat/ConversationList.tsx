import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-expo';
import { useAuthStore } from '../../store/authStore';
import { useChatStore } from '../../store/chatStore';
import {
  getConversations,
  searchEmployees,
  startConversation,
  sendPresencePing,
} from '../../api/chatApi';
import { ConversationItem, EmployeeSearchResult } from '../../types/chat';

interface ConversationListProps {
  onSelectConversation: (convo: ConversationItem) => void;
}

function getInitials(name?: string): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

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

export default function ConversationList({ onSelectConversation }: ConversationListProps) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const currentProfile = useAuthStore((state) => state.profile);
  const setUnreadCountStore = useChatStore((state) => state.setUnreadCount);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'online'>('all');
  const [isStartingConv, setIsStartingConv] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // 1. Presence heartbeat every 45s
  useEffect(() => {
    let timer: any;
    const ping = async () => {
      try {
        const token = await getToken();
        if (token) await sendPresencePing(token);
      } catch {}
    };
    ping();
    timer = setInterval(ping, 45000);
    return () => clearInterval(timer);
  }, [getToken]);

  // 2. Pre-fetch & cache directory employees with 60s staleTime for instant 0ms search
  const {
    data: allDirectoryEmployees = [],
    isLoading: isDirectoryLoading,
    refetch: refetchDirectory,
  } = useQuery<EmployeeSearchResult[]>({
    queryKey: ['chat-directory-all-employees'],
    queryFn: async () => {
      const token = await getToken();
      if (!token) return [];
      return searchEmployees('', token);
    },
    staleTime: 60000,
    refetchInterval: 30000,
  });

  // 3. Load conversations
  const {
    data: conversations = [],
    isLoading: isConversationsLoading,
    refetch: refetchConversations,
  } = useQuery<ConversationItem[]>({
    queryKey: ['chat-conversations'],
    queryFn: async () => {
      const token = await getToken();
      if (!token) return [];
      return getConversations(token);
    },
    refetchInterval: 5000,
  });

  // Update total unread count for bottom navigation badge
  const totalUnreadCount = useMemo(() => {
    return conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0);
  }, [conversations]);

  useEffect(() => {
    setUnreadCountStore(totalUnreadCount);
  }, [totalUnreadCount, setUnreadCountStore]);

  // 4. Instant in-memory search filtering across all directory employees
  const directoryResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return allDirectoryEmployees;
    }
    return allDirectoryEmployees.filter(
      (emp) =>
        emp.name?.toLowerCase().includes(q) ||
        emp.employee_id?.toLowerCase().includes(q) ||
        emp.department?.toLowerCase().includes(q) ||
        emp.designation?.toLowerCase().includes(q)
    );
  }, [allDirectoryEmployees, searchQuery]);

  // 5. Filter existing conversations based on filter tabs and search query
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      if (activeFilter === 'unread' && (!c.unread_count || c.unread_count <= 0)) {
        return false;
      }
      if (activeFilter === 'online' && !c.other_member?.is_online) {
        return false;
      }

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const name = c.other_member?.name?.toLowerCase() || '';
      const empId = c.other_member?.employee_id?.toLowerCase() || '';
      const lastMsg = c.last_message?.content?.toLowerCase() || '';
      const dept = c.other_member?.department?.toLowerCase() || '';
      return name.includes(q) || empId.includes(q) || lastMsg.includes(q) || dept.includes(q);
    });
  }, [conversations, activeFilter, searchQuery]);

  const isSearchActive = searchQuery.trim().length > 0 || isSearchFocused;

  // 6. Handle selecting an employee from directory
  const handleSelectEmployee = useCallback(
    async (emp: EmployeeSearchResult) => {
      // Check if conversation already exists
      const existing = conversations.find(
        (c) =>
          c.other_member?.id === emp.id ||
          c.other_member?.employee_id?.toUpperCase() === emp.employee_id.toUpperCase()
      );

      if (existing) {
        setSearchQuery('');
        setIsSearchFocused(false);
        onSelectConversation(existing);
        return;
      }

      // Start new direct conversation
      try {
        setIsStartingConv(true);
        const token = await getToken();
        if (!token) throw new Error('Authentication required');
        const newConv = await startConversation(emp.employee_id, token);
        queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
        setSearchQuery('');
        setIsSearchFocused(false);
        onSelectConversation(newConv);
      } catch (err: any) {
        Alert.alert('Error', err?.message || 'Failed to start conversation');
      } finally {
        setIsStartingConv(false);
      }
    },
    [conversations, getToken, onSelectConversation, queryClient]
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchConversations(), refetchDirectory()]);
    setRefreshing(false);
  };

  const renderEmployeeRow = (emp: EmployeeSearchResult) => {
    const isAdmin =
      emp.employee_id?.toUpperCase() === 'ADMIN' || emp.name?.toLowerCase() === 'admin';
    const isOnline = emp.is_online;

    return (
      <TouchableOpacity
        key={emp.id}
        style={styles.personRow}
        activeOpacity={0.7}
        onPress={() => handleSelectEmployee(emp)}
      >
        <View style={styles.avatarCell}>
          {emp.profile_photo ? (
            <Image source={{ uri: emp.profile_photo }} style={styles.avatarImg} />
          ) : (
            <View style={[styles.avatarPlaceholder, isAdmin && styles.avatarAdmin]}>
              <Text style={styles.avatarInitials}>{getInitials(emp.name)}</Text>
            </View>
          )}
          {isOnline && <View style={styles.onlineDot} />}
        </View>

        <View style={styles.personContent}>
          <View style={styles.personTopRow}>
            <View style={styles.nameContainer}>
              <Text style={styles.personName} numberOfLines={1}>
                {emp.name}
              </Text>
              {isAdmin && (
                <View style={styles.adminBadge}>
                  <Text style={styles.adminBadgeText}>ADMIN</Text>
                </View>
              )}
            </View>
            <Text style={styles.personEmpId}>{emp.employee_id}</Text>
          </View>

          <Text style={styles.personSub} numberOfLines={1}>
            {emp.designation || 'Staff'} {emp.department ? `\u2022 ${emp.department}` : ''}
          </Text>
        </View>

        <Feather name="message-square" size={18} color="#6B2FA0" style={styles.chatIcon} />
      </TouchableOpacity>
    );
  };

  const renderConversationRow = (conv: ConversationItem) => {
    const isGroup = conv.type === 'GROUP';
    const partner = conv.other_member;
    const hasUnread = (conv.unread_count || 0) > 0;
    const isOnline = partner?.is_online || false;
    const timestamp = formatTimestamp(conv.last_message?.created_at || conv.updated_at);
    const isAdmin =
      !isGroup &&
      (partner?.employee_id?.toUpperCase() === 'ADMIN' || partner?.name?.toLowerCase() === 'admin');
    const displayName = isGroup ? conv.group_name || 'Group Chat' : partner?.name || 'Colleague';

    return (
      <TouchableOpacity
        key={conv.id}
        style={[styles.convoRow, hasUnread && styles.unreadConvoRow]}
        activeOpacity={0.7}
        onPress={() => {
          setSearchQuery('');
          setIsSearchFocused(false);
          onSelectConversation(conv);
        }}
      >
        <View style={styles.avatarCell}>
          {isGroup ? (
            <View style={styles.groupAvatar}>
              <Feather name="users" size={20} color="#FFFFFF" />
            </View>
          ) : partner?.profile_photo ? (
            <Image source={{ uri: partner.profile_photo }} style={styles.avatarImg} />
          ) : (
            <View style={[styles.avatarPlaceholder, isAdmin && styles.avatarAdmin]}>
              <Text style={styles.avatarInitials}>{getInitials(displayName)}</Text>
            </View>
          )}
          {!isGroup && isOnline && <View style={styles.onlineDot} />}
        </View>

        <View style={styles.convoContent}>
          <View style={styles.convoTopRow}>
            <View style={styles.nameContainer}>
              <Text style={[styles.convoName, hasUnread && styles.boldText]} numberOfLines={1}>
                {displayName}
              </Text>
              {isAdmin && (
                <View style={styles.adminBadge}>
                  <Text style={styles.adminBadgeText}>ADMIN</Text>
                </View>
              )}
            </View>
            <Text style={[styles.convoTime, hasUnread && styles.unreadTime]}>{timestamp}</Text>
          </View>

          <View style={styles.convoBottomRow}>
            <Text
              style={[styles.convoSnippet, hasUnread && styles.boldSnippet]}
              numberOfLines={1}
            >
              {conv.last_message ? conv.last_message.content : 'Started a conversation'}
            </Text>
            {hasUnread && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {conv.unread_count! > 99 ? '99+' : conv.unread_count}
                </Text>
              </View>
            )}
          </View>

          {!isGroup && partner && (
            <View style={styles.metaRow}>
              <Text style={styles.metaId}>{partner.employee_id}</Text>
              {partner.department ? (
                <Text style={styles.metaDept}> \u2022 {partner.department}</Text>
              ) : null}
              {isOnline ? (
                <Text style={styles.metaOnline}> \u2022 Available</Text>
              ) : null}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Bar matching Teams Mobile Bar */}
      <View style={styles.topBar}>
        <View style={styles.userPresenceSlot}>
          {currentProfile?.profile_photo ? (
            <Image source={{ uri: currentProfile.profile_photo }} style={styles.topAvatarImg} />
          ) : (
            <View style={styles.topAvatarPlaceholder}>
              <Text style={styles.topAvatarInitials}>{getInitials(currentProfile?.name || 'You')}</Text>
            </View>
          )}
          <View style={styles.selfOnlineDot} />
        </View>

        <Text style={styles.pageTitle}>Chat</Text>

        <TouchableOpacity
          style={[styles.filterToggleBtn, activeFilter === 'unread' && styles.filterToggleActive]}
          onPress={() => setActiveFilter((prev) => (prev === 'unread' ? 'all' : 'unread'))}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="filter-variant"
            size={22}
            color={activeFilter === 'unread' ? '#6B2FA0' : '#475569'}
          />
        </TouchableOpacity>
      </View>

      {/* Direct Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchPill}>
          {isDirectoryLoading && allDirectoryEmployees.length === 0 ? (
            <ActivityIndicator size="small" color="#6B2FA0" style={styles.searchIcon} />
          ) : (
            <Feather name="search" size={18} color="#64748B" style={styles.searchIcon} />
          )}

          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or Employee ID..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onFocus={() => setIsSearchFocused(true)}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />

          {(searchQuery.length > 0 || isSearchFocused) && (
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => {
                setSearchQuery('');
                setIsSearchFocused(false);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Feather name="x" size={16} color="#64748B" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Chips Bar (Visible when not actively searching) */}
      {!isSearchActive && (
        <View style={styles.filterChipsBar}>
          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'all' && styles.activeFilterChip]}
            onPress={() => setActiveFilter('all')}
            activeOpacity={0.7}
          >
            <Text
              style={[styles.filterChipText, activeFilter === 'all' && styles.activeFilterChipText]}
            >
              All
            </Text>
            <View style={styles.chipCountPill}>
              <Text style={styles.chipCountText}>{conversations.length}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'unread' && styles.activeFilterChip]}
            onPress={() => setActiveFilter('unread')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterChipText,
                activeFilter === 'unread' && styles.activeFilterChipText,
              ]}
            >
              Unread
            </Text>
            {totalUnreadCount > 0 && (
              <View style={styles.unreadChipBadge}>
                <Text style={styles.unreadChipBadgeText}>
                  {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'online' && styles.activeFilterChip]}
            onPress={() => setActiveFilter('online')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterChipText,
                activeFilter === 'online' && styles.activeFilterChipText,
              ]}
            >
              Available
            </Text>
            <View style={styles.onlineDotChip} />
          </TouchableOpacity>
        </View>
      )}

      {/* Starting conversation loader banner */}
      {isStartingConv && (
        <View style={styles.startingBanner}>
          <ActivityIndicator size="small" color="#6B2FA0" />
          <Text style={styles.startingText}>Opening conversation...</Text>
        </View>
      )}

      {/* MAIN LIST AREA */}
      <FlatList
        data={[]}
        renderItem={null}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scrollContent}
        ListHeaderComponent={
          <>
            {/* === SEARCH RESULTS / DIRECTORY VIEW === */}
            {isSearchActive ? (
              <View>
                {/* Colleagues Section */}
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionHeaderText}>
                    {searchQuery.trim()
                      ? `People (${directoryResults.length})`
                      : `Suggested Contacts (${directoryResults.length})`}
                  </Text>
                </View>

                {directoryResults.length === 0 ? (
                  <View style={styles.emptySearchBox}>
                    <Text style={styles.emptySearchText}>
                      No employees matching "{searchQuery}"
                    </Text>
                  </View>
                ) : (
                  directoryResults.map((emp) => renderEmployeeRow(emp))
                )}

                {/* Matching Existing Chats */}
                {filteredConversations.length > 0 && (
                  <>
                    <View style={[styles.sectionHeader, { marginTop: 16 }]}>
                      <Text style={styles.sectionHeaderText}>
                        Chats ({filteredConversations.length})
                      </Text>
                    </View>
                    {filteredConversations.map((conv) => renderConversationRow(conv))}
                  </>
                )}
              </View>
            ) : (
              /* === RECENT / NORMAL VIEW === */
              <View>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionHeaderText}>Recent</Text>
                </View>

                {isConversationsLoading && conversations.length === 0 ? (
                  <View style={styles.loaderBox}>
                    <ActivityIndicator size="large" color="#6B2FA0" />
                  </View>
                ) : filteredConversations.length === 0 ? (
                  <View>
                    {/* Empty Conversation State with Immediate Suggested Contacts */}
                    <View style={styles.emptyBox}>
                      <View style={styles.emptyIconCircle}>
                        <Feather name="message-circle" size={32} color="#6B2FA0" />
                      </View>
                      <Text style={styles.emptyTitle}>
                        {activeFilter === 'unread'
                          ? 'No unread messages'
                          : activeFilter === 'online'
                          ? 'No contacts online'
                          : 'No conversations yet'}
                      </Text>
                      <Text style={styles.emptySub}>
                        {activeFilter === 'all'
                          ? 'Select any colleague below to start chatting immediately.'
                          : 'Check back later or view all conversations.'}
                      </Text>
                    </View>

                    {/* Always show Colleagues Directory when inbox is empty so user never hits a dead end */}
                    {activeFilter === 'all' && (
                      <View style={{ marginTop: 8 }}>
                        <View style={styles.sectionHeader}>
                          <Text style={styles.sectionHeaderText}>
                            Colleagues Directory ({allDirectoryEmployees.length})
                          </Text>
                        </View>
                        {allDirectoryEmployees.map((emp) => renderEmployeeRow(emp))}
                      </View>
                    )}
                  </View>
                ) : (
                  filteredConversations.map((conv) => renderConversationRow(conv))
                )}
              </View>
            )}
          </>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 8 : 4,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  userPresenceSlot: {
    position: 'relative',
    width: 36,
    height: 36,
  },
  topAvatarImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  topAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#6B2FA0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topAvatarInitials: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  selfOnlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  filterToggleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  filterToggleActive: {
    backgroundColor: '#EDE9FE',
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 22,
    paddingHorizontal: 12,
    height: 42,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
  },
  filterChipsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  activeFilterChip: {
    backgroundColor: '#EDE9FE',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  activeFilterChipText: {
    color: '#6B2FA0',
  },
  chipCountPill: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
  },
  chipCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  unreadChipBadge: {
    marginLeft: 6,
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  unreadChipBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  onlineDotChip: {
    marginLeft: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  startingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(107, 47, 160, 0.08)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  startingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B2FA0',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  convoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  unreadConvoRow: {
    backgroundColor: 'rgba(107, 47, 160, 0.03)',
  },
  avatarCell: {
    position: 'relative',
    marginRight: 12,
  },
  avatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarAdmin: {
    backgroundColor: '#6B2FA0',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  groupAvatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#6B2FA0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#22C55E',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
  personContent: {
    flex: 1,
  },
  personTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  personName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  adminBadge: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  adminBadgeText: {
    color: '#6B2FA0',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  personEmpId: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  personSub: {
    fontSize: 13,
    color: '#64748B',
  },
  chatIcon: {
    marginLeft: 10,
  },
  convoContent: {
    flex: 1,
  },
  convoTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  convoName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  boldText: {
    fontWeight: '800',
    color: '#0F172A',
  },
  convoTime: {
    fontSize: 11,
    color: '#94A3B8',
  },
  unreadTime: {
    color: '#6B2FA0',
    fontWeight: '700',
  },
  convoBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  convoSnippet: {
    flex: 1,
    fontSize: 13,
    color: '#64748B',
  },
  boldSnippet: {
    color: '#0F172A',
    fontWeight: '600',
  },
  unreadBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  metaId: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  metaDept: {
    fontSize: 11,
    color: '#94A3B8',
  },
  metaOnline: {
    fontSize: 11,
    color: '#22C55E',
    fontWeight: '600',
  },
  loaderBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  emptySearchBox: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  emptySearchText: {
    fontSize: 14,
    color: '#64748B',
  },
});
