import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Modal,
  RefreshControl,
  TouchableOpacity,
  Text,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-expo';
import { Feather } from '@expo/vector-icons';
import { getMyLeaves, getLeaveSummary, applyLeave, ApplyLeavePayload } from '../../src/api/leaveApi';
import { LeaveRequest } from '../../src/types/employee';

const LEAVE_TYPES = [
  { label: 'Casual Leave', value: 'CASUAL' as const },
  { label: 'Sick Leave', value: 'SICK' as const },
  { label: 'Maternity / Paternity', value: 'MATERNITY_PATERNITY' as const },
  { label: 'Bereavement', value: 'BEREAVEMENT' as const },
  { label: 'Unpaid Leave', value: 'UNPAID' as const },
];

const LEAVE_TYPE_LABELS: Record<string, string> = {
  CASUAL: 'Casual Leave',
  SICK: 'Sick Leave',
  MATERNITY_PATERNITY: 'Maternity / Paternity Leave',
  BEREAVEMENT: 'Bereavement Leave',
  UNPAID: 'Unpaid Leave',
};

export default function LeavesScreen() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const [modalVisible, setModalVisible] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Form state
  const [leaveType, setLeaveType] = useState<ApplyLeavePayload['leave_type']>('CASUAL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Queries
  const { data: leaves = [], isLoading, refetch } = useQuery({
    queryKey: ['my-leaves'],
    queryFn: async () => {
      const token = await getToken();
      if (!token) return [];
      return getMyLeaves(token);
    },
  });

  const { data: summary, refetch: refetchSummary } = useQuery({
    queryKey: ['leave-summary'],
    queryFn: async () => {
      const token = await getToken();
      if (!token) return null;
      return getLeaveSummary(token);
    },
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetch(), refetchSummary()]);
    setRefreshing(false);
  };

  const calculatedDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;
      const diffMs = end.getTime() - start.getTime();
      return Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
    } catch {
      return 0;
    }
  }, [startDate, endDate]);

  const applyMutation = useMutation({
    mutationFn: async (payload: ApplyLeavePayload) => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return applyLeave(payload, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-leaves'] });
      queryClient.invalidateQueries({ queryKey: ['leave-summary'] });
      setModalVisible(false);
      setShowConfirm(false);
      setStartDate('');
      setEndDate('');
      setReason('');
      setFormError(null);
      Alert.alert('Leave Application Submitted', 'Your leave request has been submitted for admin review.');
    },
    onError: (err: any) => {
      setFormError(err?.message || 'Failed to submit leave application. Please check details.');
    },
  });

  const handleOpenModal = () => {
    setFormError(null);
    setShowConfirm(false);
    setModalVisible(true);
  };

  const handleReviewStep = () => {
    if (!startDate || !endDate) {
      setFormError('Please enter both start and end dates (YYYY-MM-DD).');
      return;
    }
    const todayStr = new Date().toISOString().split('T')[0];
    if (startDate < todayStr) {
      setFormError('Leave start date cannot be in the past.');
      return;
    }
    if (endDate < startDate) {
      setFormError('End date cannot be earlier than start date.');
      return;
    }
    if (!reason.trim()) {
      setFormError('Please provide a reason for the leave.');
      return;
    }
    setFormError(null);
    setShowConfirm(true);
  };

  const handleFinalSubmit = () => {
    applyMutation.mutate({
      leave_type: leaveType,
      start_date: startDate,
      end_date: endDate,
      reason: reason.trim(),
    });
  };

  const selectedTypeLabel = LEAVE_TYPES.find((t) => t.value === leaveType)?.label || leaveType;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header matching EmployeePortal.tsx */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Feather name="calendar" size={20} color="#6B2FA0" />
          <Text style={styles.pageTitle}>My Leave Requests</Text>
        </View>
        <TouchableOpacity
          style={styles.applyButton}
          onPress={handleOpenModal}
          activeOpacity={0.8}
        >
          <Feather name="plus" size={16} color="#ffffff" style={{ marginRight: 4 }} />
          <Text style={styles.applyButtonText}>Apply for Leave</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6B2FA0']} />}
      >
        {/* Leave Status Summary Cards */}
        {summary && (
          <View style={styles.balanceGrid}>
            <View style={styles.balanceCard}>
              <Text style={styles.balanceTitle}>PENDING</Text>
              <Text style={[styles.balanceCount, { color: '#F59E0B' }]}>{summary.pending ?? 0}</Text>
              <Text style={styles.balanceSub}>requests</Text>
            </View>
            <View style={styles.balanceCard}>
              <Text style={styles.balanceTitle}>APPROVED</Text>
              <Text style={[styles.balanceCount, { color: '#10B981' }]}>{summary.approved ?? 0}</Text>
              <Text style={styles.balanceSub}>requests</Text>
            </View>
            <View style={styles.balanceCard}>
              <Text style={styles.balanceTitle}>TOTAL</Text>
              <Text style={[styles.balanceCount, { color: '#6B2FA0' }]}>{summary.total ?? 0}</Text>
              <Text style={styles.balanceSub}>applied</Text>
            </View>
          </View>
        )}

        {/* Leave History List */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Leave History</Text>

          {isLoading ? (
            <ActivityIndicator size="small" color="#6B2FA0" style={{ marginVertical: 32 }} />
          ) : leaves.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="calendar" size={40} color="#cbd5e1" style={{ marginBottom: 10 }} />
              <Text style={styles.emptyText}>No leave requests submitted yet.</Text>
              <TouchableOpacity
                style={styles.emptyApplyBtn}
                onPress={handleOpenModal}
              >
                <Feather name="plus" size={14} color="#6B2FA0" style={{ marginRight: 4 }} />
                <Text style={styles.emptyApplyBtnText}>Apply for Leave</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.leaveList}>
              {leaves.map((leave: LeaveRequest) => {
                const isPending = leave.status === 'PENDING';
                const isApproved = leave.status === 'APPROVED';
                const isRejected = leave.status === 'REJECTED';

                const badgeConfig = isPending
                  ? { bg: 'rgba(245, 158, 11, 0.12)', text: '#B45309', border: 'rgba(245, 158, 11, 0.3)', label: 'Pending', icon: 'clock' as const }
                  : isApproved
                  ? { bg: 'rgba(16, 185, 129, 0.12)', text: '#047857', border: 'rgba(16, 185, 129, 0.3)', label: 'Approved', icon: 'check-circle' as const }
                  : { bg: 'rgba(239, 68, 68, 0.12)', text: '#B91C1C', border: 'rgba(239, 68, 68, 0.3)', label: 'Rejected', icon: 'x-circle' as const };

                const typeDisplay = LEAVE_TYPE_LABELS[leave.leave_type] || leave.leave_type;

                return (
                  <View key={leave.id} style={styles.leaveItem}>
                    <View style={styles.itemHeader}>
                      <View style={styles.itemTypeRow}>
                        <Text style={styles.itemTypeName}>
                          {typeDisplay}
                        </Text>
                        <View
                          style={[
                            styles.statusPill,
                            { backgroundColor: badgeConfig.bg, borderColor: badgeConfig.border },
                          ]}
                        >
                          <Feather name={badgeConfig.icon} size={11} color={badgeConfig.text} style={{ marginRight: 4 }} />
                          <Text style={[styles.statusPillText, { color: badgeConfig.text }]}>
                            {badgeConfig.label}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.appliedDate}>
                        Applied: {new Date(leave.applied_at || Date.now()).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                      </Text>
                    </View>

                    {/* Date Range & Total Days */}
                    <View style={styles.dateRangeRow}>
                      <View style={styles.dateRange}>
                        <Feather name="calendar" size={14} color="#6B2FA0" style={{ marginRight: 5 }} />
                        <Text style={styles.dateText}>
                          {new Date(leave.start_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                          {' → '}
                          {new Date(leave.end_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </Text>
                      </View>
                      <View style={styles.durationBadge}>
                        <Text style={styles.durationText}>
                          {leave.total_days} {leave.total_days === 1 ? 'Day' : 'Days'}
                        </Text>
                      </View>
                    </View>

                    {/* Reason */}
                    <View style={styles.reasonRow}>
                      <Text style={styles.reasonLabel}>Reason: </Text>
                      <Text style={styles.reasonText}>{leave.reason}</Text>
                    </View>

                    {/* Rejection Note */}
                    {isRejected && leave.rejection_reason && (
                      <View style={styles.rejectionBox}>
                        <Feather name="alert-circle" size={15} color="#DC2626" style={{ marginTop: 1, marginRight: 6 }} />
                        <Text style={styles.rejectionText}>
                          <Text style={{ fontWeight: '700' }}>Rejection Reason: </Text>
                          {leave.rejection_reason}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Apply For Leave Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Apply for Leave</Text>
                <Text style={styles.modalSub}>Submit a leave request for administrative review</Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="x" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {formError && (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={16} color="#DC2626" style={{ marginRight: 6 }} />
                <Text style={styles.errorBoxText}>{formError}</Text>
              </View>
            )}

            {!showConfirm ? (
              /* Step 1: Form */
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formScroll}>
                {/* Leave Type Selector */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>LEAVE TYPE *</Text>
                  <View style={styles.typeChips}>
                    {LEAVE_TYPES.map((t) => {
                      const isSelected = leaveType === t.value;
                      return (
                        <TouchableOpacity
                          key={t.value}
                          style={[styles.typeChip, isSelected && styles.typeChipSelected]}
                          onPress={() => setLeaveType(t.value)}
                        >
                          <Text style={[styles.typeChipText, isSelected && styles.typeChipTextSelected]}>
                            {t.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Date Inputs */}
                <View style={styles.datesRow}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.formLabel}>START DATE (YYYY-MM-DD) *</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="2026-09-23"
                      placeholderTextColor="#9ca3af"
                      value={startDate}
                      onChangeText={(val) => {
                        setStartDate(val);
                        if (formError) setFormError(null);
                      }}
                      autoCapitalize="none"
                    />
                  </View>

                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.formLabel}>END DATE (YYYY-MM-DD) *</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="2026-09-25"
                      placeholderTextColor="#9ca3af"
                      value={endDate}
                      onChangeText={(val) => {
                        setEndDate(val);
                        if (formError) setFormError(null);
                      }}
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                {/* Duration Pill */}
                {calculatedDays > 0 && (
                  <View style={styles.durationPill}>
                    <Text style={styles.durationPillLabel}>Calculated Duration:</Text>
                    <Text style={styles.durationPillValue}>
                      {calculatedDays} {calculatedDays === 1 ? 'Day' : 'Days'}
                    </Text>
                  </View>
                )}

                {/* Reason */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>REASON *</Text>
                  <TextInput
                    style={[styles.formInput, styles.textArea]}
                    placeholder="Provide details about your leave..."
                    placeholderTextColor="#9ca3af"
                    value={reason}
                    onChangeText={(val) => {
                      setReason(val);
                      if (formError) setFormError(null);
                    }}
                    multiline
                    numberOfLines={3}
                  />
                </View>

                {/* Buttons */}
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => setModalVisible(false)}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.submitBtn}
                    onPress={handleReviewStep}
                  >
                    <Text style={styles.submitBtnText}>Continue to Review</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            ) : (
              /* Step 2: Confirmation */
              <View style={styles.confirmView}>
                <Text style={styles.confirmHeading}>Confirm Leave Request</Text>
                <View style={styles.confirmDetailsBox}>
                  <View style={styles.confirmRow}>
                    <Text style={styles.confirmLabel}>Leave Type:</Text>
                    <Text style={styles.confirmValue}>{selectedTypeLabel}</Text>
                  </View>
                  <View style={styles.confirmRow}>
                    <Text style={styles.confirmLabel}>Dates:</Text>
                    <Text style={styles.confirmValue}>
                      {startDate} → {endDate}
                    </Text>
                  </View>
                  <View style={styles.confirmRow}>
                    <Text style={styles.confirmLabel}>Total Duration:</Text>
                    <Text style={[styles.confirmValue, { color: '#6B2FA0', fontWeight: '800' }]}>
                      {calculatedDays} Days
                    </Text>
                  </View>
                  <View style={styles.confirmRow}>
                    <Text style={styles.confirmLabel}>Reason:</Text>
                    <Text style={styles.confirmValue}>{reason}</Text>
                  </View>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => setShowConfirm(false)}
                    disabled={applyMutation.isPending}
                  >
                    <Text style={styles.cancelBtnText}>Back to Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.submitBtn, applyMutation.isPending && { opacity: 0.7 }]}
                    onPress={handleFinalSubmit}
                    disabled={applyMutation.isPending}
                  >
                    {applyMutation.isPending ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.submitBtnText}>Confirm & Submit</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f6f3fb',
  },
  header: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e8e0f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pageTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#6B2FA0',
  },
  applyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6B2FA0',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    shadowColor: '#6B2FA0',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  applyButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 28,
    gap: 16,
  },
  balanceGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  balanceCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e8e0f0',
    padding: 14,
    alignItems: 'center',
    shadowColor: '#6B2FA0',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  balanceTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6b7280',
    letterSpacing: 0.5,
  },
  balanceCount: {
    fontSize: 22,
    fontWeight: '800',
    color: '#6B2FA0',
    marginVertical: 2,
  },
  balanceSub: {
    fontSize: 11,
    color: '#9ca3af',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e8e0f0',
    padding: 18,
    shadowColor: '#6B2FA0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 14,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  emptyText: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 12,
  },
  emptyApplyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#6B2FA0',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  emptyApplyBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B2FA0',
  },
  leaveList: {
    gap: 12,
  },
  leaveItem: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  itemTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemTypeName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 9999,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  appliedDate: {
    fontSize: 11,
    color: '#6b7280',
  },
  dateRangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateRange: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  durationBadge: {
    backgroundColor: 'rgba(107, 47, 160, 0.08)',
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  durationText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B2FA0',
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  reasonLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1f2937',
  },
  reasonText: {
    flex: 1,
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 16,
  },
  rejectionBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderRadius: 8,
    padding: 8,
  },
  rejectionText: {
    fontSize: 12,
    color: '#DC2626',
    flex: 1,
    lineHeight: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1f2937',
  },
  modalSub: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  errorBoxText: {
    fontSize: 12,
    color: '#DC2626',
    flex: 1,
  },
  formScroll: {
    gap: 14,
    paddingBottom: 16,
  },
  formGroup: {
    gap: 6,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1f2937',
    letterSpacing: 0.4,
  },
  typeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  typeChip: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#f8fafc',
  },
  typeChipSelected: {
    backgroundColor: '#6B2FA0',
    borderColor: '#6B2FA0',
  },
  typeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  typeChipTextSelected: {
    color: '#ffffff',
  },
  datesRow: {
    flexDirection: 'row',
    gap: 10,
  },
  formInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#1f2937',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  durationPill: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(107, 47, 160, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(107, 47, 160, 0.2)',
    borderRadius: 10,
    padding: 10,
  },
  durationPillLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1f2937',
  },
  durationPillValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6B2FA0',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  cancelBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  submitBtn: {
    flex: 1.5,
    borderRadius: 10,
    backgroundColor: '#6B2FA0',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  confirmView: {
    gap: 14,
    paddingBottom: 16,
  },
  confirmHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
  },
  confirmDetailsBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    gap: 8,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  confirmLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },
  confirmValue: {
    fontSize: 12,
    color: '#1f2937',
    fontWeight: '600',
  },
});
