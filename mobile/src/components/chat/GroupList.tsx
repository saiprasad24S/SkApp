import React, { useState, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-expo';
import { useAuthStore } from '../../store/authStore';
import {
  getGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  searchEmployees,
} from '../../api/chatApi';
import { ConversationItem, EmployeeSearchResult } from '../../types/chat';

interface GroupListProps {
  onSelectConversation: (convo: ConversationItem) => void;
}

function getGroupInitials(name?: string): string {
  if (!name) return 'GP';
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

export default function GroupList({ onSelectConversation }: GroupListProps) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const role = useAuthStore((state) => state.role);
  const currentProfile = useAuthStore((state) => state.profile);
  const isAdmin = role === 'ADMIN' || currentProfile?.employee_id === 'ADMIN';

  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Admin Modals
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Group Details / Management Modal (Admin)
  const [manageModalVisible, setManageModalVisible] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<ConversationItem | null>(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupDesc, setEditGroupDesc] = useState('');
  const [addMembersModalVisible, setAddMembersModalVisible] = useState(false);
  const [addMemberIds, setAddMemberIds] = useState<number[]>([]);

  // Fetch groups
  const {
    data: groups = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<ConversationItem[]>({
    queryKey: ['chat-groups'],
    queryFn: async () => {
      const token = await getToken();
      if (!token) return [];
      return getGroups(token);
    },
    staleTime: 10000,
    refetchInterval: 15000,
  });

  // Fetch all directory employees for membership assignment
  const { data: allEmployees = [] } = useQuery<EmployeeSearchResult[]>({
    queryKey: ['chat-directory-all-employees'],
    queryFn: async () => {
      const token = await getToken();
      if (!token) return [];
      return searchEmployees('', token);
    },
    staleTime: 60000,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Filtered groups by search query
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const q = searchQuery.toLowerCase();
    return groups.filter(
      (g) =>
        g.group_name?.toLowerCase().includes(q) ||
        g.group_description?.toLowerCase().includes(q) ||
        g.last_message?.content?.toLowerCase().includes(q)
    );
  }, [groups, searchQuery]);

  // Filter directory employees for adding
  const filteredEmployeesForAdd = useMemo(() => {
    const q = memberSearchQuery.trim().toLowerCase();
    const existingMemberIds = new Set(
      selectedGroup?.members?.map((m: any) => (typeof m === 'object' ? m.id : m)) || []
    );

    return allEmployees.filter((emp) => {
      if (existingMemberIds.has(emp.id)) return false;
      if (!q) return true;
      return (
        emp.name?.toLowerCase().includes(q) ||
        emp.employee_id?.toLowerCase().includes(q) ||
        emp.department?.toLowerCase().includes(q)
      );
    });
  }, [allEmployees, memberSearchQuery, selectedGroup]);

  // Handle Group Creation (Admin)
  const handleCreateGroup = async () => {
    const name = newGroupName.trim();
    if (!name) {
      Alert.alert('Validation Error', 'Group name is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      const token = await getToken();
      if (!token) throw new Error('Authentication required');

      const created = await createGroup(
        name,
        selectedMemberIds,
        token,
        newGroupDesc.trim()
      );
      queryClient.invalidateQueries({ queryKey: ['chat-groups'] });
      setCreateModalVisible(false);
      setNewGroupName('');
      setNewGroupDesc('');
      setSelectedMemberIds([]);
      setMemberSearchQuery('');
      onSelectConversation(created);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not create group.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Manage Modal
  const openManageModal = (group: ConversationItem) => {
    setSelectedGroup(group);
    setEditGroupName(group.group_name || '');
    setEditGroupDesc(group.group_description || '');
    setManageModalVisible(true);
  };

  // Handle Update Group Details
  const handleUpdateGroupDetails = async () => {
    if (!selectedGroup) return;
    const name = editGroupName.trim();
    if (!name) {
      Alert.alert('Validation Error', 'Group name cannot be empty.');
      return;
    }

    try {
      setIsSubmitting(true);
      const token = await getToken();
      if (!token) throw new Error('Authentication required');

      const updated = await updateGroup(
        selectedGroup.id,
        {
          group_name: name,
          group_description: editGroupDesc.trim(),
        },
        token
      );
      queryClient.invalidateQueries({ queryKey: ['chat-groups'] });
      setSelectedGroup(updated);
      Alert.alert('Success', 'Group updated successfully.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update group.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Remove Member from Group
  const handleRemoveMember = async (memberId: number, memberName: string) => {
    if (!selectedGroup) return;

    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${memberName} from this group?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getToken();
              if (!token) return;
              const updated = await updateGroup(
                selectedGroup.id,
                { remove_member_ids: [memberId] },
                token
              );
              queryClient.invalidateQueries({ queryKey: ['chat-groups'] });
              setSelectedGroup(updated);
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Could not remove member.');
            }
          },
        },
      ]
    );
  };

  // Handle Add Selected Members
  const handleAddMembers = async () => {
    if (!selectedGroup || addMemberIds.length === 0) return;

    try {
      setIsSubmitting(true);
      const token = await getToken();
      if (!token) throw new Error('Authentication required');

      const updated = await updateGroup(
        selectedGroup.id,
        { add_member_ids: addMemberIds },
        token
      );
      queryClient.invalidateQueries({ queryKey: ['chat-groups'] });
      setSelectedGroup(updated);
      setAddMemberIds([]);
      setAddMembersModalVisible(false);
      Alert.alert('Success', 'Members added to group.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not add members.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Archive / Delete Group
  const handleDeleteGroup = (permanent: boolean = false) => {
    if (!selectedGroup) return;

    const actionText = permanent ? 'delete permanently' : 'archive';
    Alert.alert(
      `Confirm ${permanent ? 'Delete' : 'Archive'}`,
      `Are you sure you want to ${actionText} "${selectedGroup.group_name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: permanent ? 'Delete' : 'Archive',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getToken();
              if (!token) return;
              await deleteGroup(selectedGroup.id, token, permanent);
              queryClient.invalidateQueries({ queryKey: ['chat-groups'] });
              setManageModalVisible(false);
              setSelectedGroup(null);
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Could not complete action.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Search & Header */}
      <View style={styles.topBar}>
        <View style={styles.searchBox}>
          <Feather name="search" size={18} color="#94A3B8" style={styles.searchIcon} />
          <TextInput
            placeholder="Search groups..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
            placeholderTextColor="#94A3B8"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {isAdmin && (
          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => setCreateModalVisible(true)}
            activeOpacity={0.8}
          >
            <Feather name="plus" size={18} color="#FFFFFF" />
            <Text style={styles.createBtnText}>New Group</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Group List Viewport */}
      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#6B2FA0" />
          <Text style={styles.loadingText}>Loading groups...</Text>
        </View>
      ) : isError ? (
        <View style={styles.centerBox}>
          <Feather name="alert-circle" size={40} color="#EF4444" />
          <Text style={styles.errorText}>Could not load groups.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filteredGroups.length === 0 ? (
        <View style={styles.centerBox}>
          <MaterialCommunityIcons name="account-group-outline" size={54} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>
            {searchQuery ? 'No matching groups found' : 'No Groups Yet'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {isAdmin
              ? 'Tap "New Group" above to create an employee team group.'
              : 'You will see group conversations here when an administrator adds you.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredGroups}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6B2FA0']} />
          }
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const memberCount = Array.isArray(item.members) ? item.members.length : 0;
            return (
              <TouchableOpacity
                style={styles.groupCard}
                onPress={() => onSelectConversation(item)}
                activeOpacity={0.7}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{getGroupInitials(item.group_name)}</Text>
                </View>

                <View style={styles.groupInfo}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.groupTitle} numberOfLines={1}>
                      {item.group_name || 'Group Chat'}
                    </Text>
                    {item.last_message?.created_at && (
                      <Text style={styles.timeText}>
                        {formatTimestamp(item.last_message.created_at)}
                      </Text>
                    )}
                  </View>

                  <View style={styles.rowBetween}>
                    <Text style={styles.previewText} numberOfLines={1}>
                      {item.last_message?.content
                        ? `${item.last_message.sender_name}: ${item.last_message.content}`
                        : item.group_description || `${memberCount} members`}
                    </Text>

                    {item.unread_count > 0 && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>
                          {item.unread_count > 99 ? '99+' : item.unread_count}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {isAdmin && (
                  <TouchableOpacity
                    style={styles.settingsIconBtn}
                    onPress={() => openManageModal(item)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Feather name="settings" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* CREATE GROUP MODAL (Admin Only) */}
      <Modal
        visible={createModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
              <Feather name="x" size={24} color="#1E293B" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Create New Group</Text>
            <TouchableOpacity
              onPress={handleCreateGroup}
              disabled={isSubmitting || !newGroupName.trim()}
              style={[
                styles.saveHeaderBtn,
                (!newGroupName.trim() || isSubmitting) && styles.btnDisabled,
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#6B2FA0" />
              ) : (
                <Text style={styles.saveHeaderBtnText}>Create</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>Group Name *</Text>
            <TextInput
              placeholder="e.g. Clinical Nursing Team"
              value={newGroupName}
              onChangeText={setNewGroupName}
              style={styles.modalInput}
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.fieldLabel}>Description (Optional)</Text>
            <TextInput
              placeholder="e.g. Daily shift handover & patient coordination"
              value={newGroupDesc}
              onChangeText={setNewGroupDesc}
              style={[styles.modalInput, styles.textArea]}
              multiline
              numberOfLines={3}
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.fieldLabel}>
              Select Members ({selectedMemberIds.length} selected)
            </Text>
            <TextInput
              placeholder="Filter colleagues to add..."
              value={memberSearchQuery}
              onChangeText={setMemberSearchQuery}
              style={styles.modalInput}
              placeholderTextColor="#94A3B8"
            />

            <View style={styles.memberSelectList}>
              {allEmployees
                .filter((emp) => {
                  if (emp.id === currentProfile?.id) return false;
                  if (!memberSearchQuery) return true;
                  const q = memberSearchQuery.toLowerCase();
                  return (
                    emp.name?.toLowerCase().includes(q) ||
                    emp.employee_id?.toLowerCase().includes(q) ||
                    emp.department?.toLowerCase().includes(q)
                  );
                })
                .map((emp) => {
                  const isSelected = selectedMemberIds.includes(emp.id);
                  return (
                    <TouchableOpacity
                      key={emp.id}
                      style={[styles.memberRow, isSelected && styles.memberRowSelected]}
                      onPress={() => {
                        setSelectedMemberIds((prev) =>
                          isSelected ? prev.filter((id) => id !== emp.id) : [...prev, emp.id]
                        );
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.avatarSmall}>
                        <Text style={styles.avatarSmallText}>
                          {emp.name.substring(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.memberName}>{emp.name}</Text>
                        <Text style={styles.memberRole}>
                          {emp.employee_id} • {emp.designation || emp.department || 'Staff'}
                        </Text>
                      </View>
                      <Feather
                        name={isSelected ? 'check-circle' : 'circle'}
                        size={20}
                        color={isSelected ? '#6B2FA0' : '#CBD5E1'}
                      />
                    </TouchableOpacity>
                  );
                })}
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* MANAGE GROUP MODAL (Admin Only) */}
      {selectedGroup && (
        <Modal
          visible={manageModalVisible}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setManageModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setManageModalVisible(false)}>
                <Feather name="arrow-left" size={24} color="#1E293B" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Manage Group</Text>
              <TouchableOpacity
                onPress={handleUpdateGroupDetails}
                disabled={isSubmitting}
                style={styles.saveHeaderBtn}
              >
                <Text style={styles.saveHeaderBtnText}>Save</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.fieldLabel}>Group Name</Text>
              <TextInput
                value={editGroupName}
                onChangeText={setEditGroupName}
                style={styles.modalInput}
              />

              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                value={editGroupDesc}
                onChangeText={setEditGroupDesc}
                style={[styles.modalInput, styles.textArea]}
                multiline
                numberOfLines={3}
              />

              <View style={styles.rowBetween}>
                <Text style={styles.fieldLabel}>Members</Text>
                <TouchableOpacity
                  style={styles.addMemberBtn}
                  onPress={() => setAddMembersModalVisible(true)}
                >
                  <Feather name="user-plus" size={15} color="#6B2FA0" />
                  <Text style={styles.addMemberBtnText}>Add Members</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.memberSelectList}>
                {Array.isArray(selectedGroup.members) &&
                  selectedGroup.members.map((m: any) => {
                    const emp = typeof m === 'object' ? m : { id: m, name: `Member #${m}` };
                    return (
                      <View key={emp.id} style={styles.memberRow}>
                        <View style={styles.avatarSmall}>
                          <Text style={styles.avatarSmallText}>
                            {(emp.name || 'M').substring(0, 2).toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.memberName}>{emp.name}</Text>
                          <Text style={styles.memberRole}>
                            {emp.employee_id || ''} {emp.designation ? `• ${emp.designation}` : ''}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => handleRemoveMember(emp.id, emp.name)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Feather name="trash-2" size={18} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
              </View>

              <View style={styles.dangerZone}>
                <TouchableOpacity
                  style={styles.archiveBtn}
                  onPress={() => handleDeleteGroup(false)}
                >
                  <Feather name="archive" size={16} color="#D97706" />
                  <Text style={styles.archiveBtnText}>Archive Group</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDeleteGroup(true)}
                >
                  <Feather name="trash" size={16} color="#EF4444" />
                  <Text style={styles.deleteBtnText}>Delete Group Permanently</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </Modal>
      )}

      {/* ADD MEMBERS SUB-MODAL */}
      <Modal
        visible={addMembersModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setAddMembersModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setAddMembersModalVisible(false)}>
              <Feather name="x" size={24} color="#1E293B" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Members</Text>
            <TouchableOpacity
              onPress={handleAddMembers}
              disabled={isSubmitting || addMemberIds.length === 0}
              style={[
                styles.saveHeaderBtn,
                (addMemberIds.length === 0 || isSubmitting) && styles.btnDisabled,
              ]}
            >
              <Text style={styles.saveHeaderBtnText}>Add ({addMemberIds.length})</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            <TextInput
              placeholder="Search colleagues to add..."
              value={memberSearchQuery}
              onChangeText={setMemberSearchQuery}
              style={styles.modalInput}
              placeholderTextColor="#94A3B8"
            />

            <View style={styles.memberSelectList}>
              {filteredEmployeesForAdd.map((emp) => {
                const isSelected = addMemberIds.includes(emp.id);
                return (
                  <TouchableOpacity
                    key={emp.id}
                    style={[styles.memberRow, isSelected && styles.memberRowSelected]}
                    onPress={() => {
                      setAddMemberIds((prev) =>
                        isSelected ? prev.filter((id) => id !== emp.id) : [...prev, emp.id]
                      );
                    }}
                  >
                    <View style={styles.avatarSmall}>
                      <Text style={styles.avatarSmallText}>
                        {emp.name.substring(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName}>{emp.name}</Text>
                      <Text style={styles.memberRole}>
                        {emp.employee_id} • {emp.designation || emp.department || 'Staff'}
                      </Text>
                    </View>
                    <Feather
                      name={isSelected ? 'check-circle' : 'circle'}
                      size={20}
                      color={isSelected ? '#6B2FA0' : '#CBD5E1'}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 10,
  },
  searchBox: {
    flex: 1,
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
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6B2FA0',
    paddingHorizontal: 14,
    height: 42,
    borderRadius: 12,
    gap: 6,
  },
  createBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  errorText: {
    marginTop: 8,
    fontSize: 14,
    color: '#EF4444',
  },
  retryBtn: {
    marginTop: 14,
    backgroundColor: '#6B2FA0',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
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
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 280,
  },
  listContent: {
    padding: 12,
  },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(107, 47, 160, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#6B2FA0',
    fontSize: 16,
    fontWeight: '800',
  },
  groupInfo: {
    flex: 1,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  groupTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
  },
  timeText: {
    fontSize: 11,
    color: '#94A3B8',
    marginLeft: 8,
  },
  previewText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 3,
    flex: 1,
  },
  badge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 6,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  settingsIconBtn: {
    padding: 8,
    marginLeft: 6,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'ios' ? 44 : 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
  },
  saveHeaderBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(107, 47, 160, 0.1)',
    borderRadius: 8,
  },
  saveHeaderBtnText: {
    color: '#6B2FA0',
    fontWeight: '700',
    fontSize: 14,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  modalBody: {
    flex: 1,
    padding: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    marginTop: 12,
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1E293B',
  },
  textArea: {
    height: 72,
    textAlignVertical: 'top',
  },
  memberSelectList: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  memberRowSelected: {
    backgroundColor: 'rgba(107, 47, 160, 0.05)',
  },
  avatarSmall: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarSmallText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B2FA0',
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  memberRole: {
    fontSize: 11,
    color: '#64748B',
  },
  addMemberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addMemberBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B2FA0',
  },
  dangerZone: {
    marginTop: 28,
    marginBottom: 40,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 16,
    gap: 12,
  },
  archiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
  },
  archiveBtnText: {
    color: '#D97706',
    fontWeight: '600',
    fontSize: 13,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
  },
  deleteBtnText: {
    color: '#EF4444',
    fontWeight: '600',
    fontSize: 13,
  },
});
