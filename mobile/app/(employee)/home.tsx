import React, { useState, useEffect, memo, useMemo } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  RefreshControl,
  Image,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-expo';
import { Feather } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/authStore';
import { getTodayAssignment } from '../../src/api/employeeApi';
import { getNotifications } from '../../src/api/notificationApi';
import { loginToBackend } from '../../src/lib/auth';
import { autoDetectServer } from '../../src/lib/api';
import CheckInModal from '../../src/components/CheckInModal';
import NotificationSheet from '../../src/components/NotificationSheet';
import { useLocationTracker } from '../../src/hooks/useLocationTracker';
import * as Location from 'expo-location';
import GradientAvatar from '../../src/components/common/GradientAvatar';

const DigitalClockCard = memo(function DigitalClockCard() {
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <View style={styles.clockCard}>
      <Text style={styles.clockDateText}>
        {time.toLocaleDateString('en-IN', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
      </Text>
      <Text style={styles.clockTimeText}>
        {time.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })}
      </Text>
    </View>
  );
});

const ActiveDutyTimer = memo(function ActiveDutyTimer({
  checkInTimeStr,
}: {
  checkInTimeStr: string | null | undefined;
}) {
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const durationText = useMemo(() => {
    if (!checkInTimeStr) return null;
    try {
      const checkInDate = new Date(checkInTimeStr);
      const diffMs = Math.max(0, time.getTime() - checkInDate.getTime());
      const totalSec = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSec / 3600);
      const minutes = Math.floor((totalSec % 3600) / 60);
      const seconds = totalSec % 60;
      if (hours > 0) {
        return `${hours}h ${minutes}m ${seconds}s`;
      }
      return `${minutes}m ${seconds}s`;
    } catch {
      return null;
    }
  }, [checkInTimeStr, time]);

  if (!durationText) return null;

  return (
    <View style={styles.timerWrapper}>
      <Text style={styles.timerLabel}>Active Time</Text>
      <Text style={styles.timerValue}>{durationText}</Text>
    </View>
  );
});

export default function HomeScreen() {
  const { getToken, signOut } = useAuth();
  const queryClient = useQueryClient();

  const cachedProfile = useAuthStore((state) => state.profile);
  const setAuth = useAuthStore((state) => state.setAuth);

  // Background GPS tracker when session is active
  useLocationTracker();

  const [modalVisible, setModalVisible] = useState(false);
  const [notificationVisible, setNotificationVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [locationPermGranted, setLocationPermGranted] = useState<boolean | null>(null);

  useEffect(() => {
    checkLocationPermission();
  }, []);

  const checkLocationPermission = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      setLocationPermGranted(status === 'granted');
    } catch {
      setLocationPermGranted(false);
    }
  };

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermGranted(status === 'granted');
    } catch {
      setLocationPermGranted(false);
    }
  };

  // 1. Primary Profile & Session Query - replicates working Vite EmployeePortal profileQuery
  const {
    data: authData,
    isLoading: isProfileLoading,
    isError: isProfileError,
    error: profileError,
    refetch: refetchProfile,
  } = useQuery({
    queryKey: ['employee-portal-profile'],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error('Missing authentication session');
      const response = await loginToBackend(token);
      if (response?.employee) {
        setAuth(response);
      }
      return response;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
    retry: 2,
    retryDelay: (idx) => Math.min(1000 * 2 ** idx, 4000),
  });

  const profile = authData?.employee || cachedProfile;
  const isSessionActive = Boolean(
    authData?.session_summary?.active_session ??
    useAuthStore.getState().isSessionActive
  );
  const activeSession = authData?.session_summary || useAuthStore.getState().activeSession;
  const sessionStatus: string = typeof authData?.session_summary?.status === 'string'
    ? authData.session_summary.status
    : isSessionActive
    ? 'Present'
    : 'Not Marked';

  // 2. Today's patient assignment query - only fired once profile is known
  const {
    data: assignment,
    refetch: refetchAssignment,
    isLoading: assignmentLoading,
    isError: assignmentError,
  } = useQuery({
    queryKey: ['today-assignment', profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const token = await getToken();
      if (!token) return null;
      return getTodayAssignment(token);
    },
    staleTime: 1000 * 60,
    retry: 1,
  });

  // 3. Notification query
  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const token = await getToken();
      if (!token) return { results: [], unread_count: 0 };
      return getNotifications(token);
    },
    refetchInterval: 30000,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refetchProfile(),
      refetchAssignment(),
      queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      checkLocationPermission(),
    ]);
    setRefreshing(false);
  };

  const displayName = profile?.name || (isProfileLoading ? 'Loading profile...' : 'Employee');
  const unreadCount = notifData?.unread_count || 0;
  const avatarUrl =
    profile?.profile_photo ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=6B2FA0&color=fff&size=200`;

  const checkInTimeStr = (activeSession?.check_in_time as string | undefined) || undefined;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Header matching EmployeePortal.tsx */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <Image
            source={require('../../assets/skandan_logo.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.headerActions}>
          {/* Notification Bell */}
          <TouchableOpacity
            style={styles.bellButton}
            onPress={() => setNotificationVisible(true)}
            activeOpacity={0.7}
          >
            <Feather name="bell" size={20} color="#1f2937" />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Log Out Button */}
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={() => signOut()}
            activeOpacity={0.7}
          >
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6B2FA0']} />}
      >
        {/* Server Connection Error Banner */}
        {isProfileError && (
          <View style={styles.errorBanner}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              <Feather name="wifi-off" size={18} color="#DC2626" />
              <Text style={styles.errorBannerText} numberOfLines={2}>
                {(profileError as any)?.message || 'Unable to sync with Skandan server.'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={async () => {
                try {
                  await autoDetectServer();
                } catch {}
                refetchProfile();
                refetchAssignment();
              }}
            >
              <Feather name="rotate-ccw" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.retryButtonText}>Auto-Connect</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Employee Profile Card matching .employee-card in global.css */}
        <View style={styles.employeeCard}>
          <GradientAvatar
            uri={avatarUrl}
            name={displayName}
            size={112}
            strokeWidth={3.8}
            innerSpacing={3}
            style={{ marginBottom: 14 }}
          />
          <Text style={styles.employeeName}>{displayName}</Text>
          <Text style={styles.employeeDesignation}>{profile?.designation || 'Healthcare Professional'}</Text>
          <Text style={styles.employeeDepartment}>{profile?.department || 'General'} Department</Text>
          {profile?.email && <Text style={styles.employeeEmail}>{profile.email}</Text>}
          {profile?.phone && <Text style={styles.employeePhone}>{profile.phone}</Text>}
        </View>

        {/* Attendance & Duty Card */}
        <View style={styles.glassCard}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardEyebrow}>ATTENDANCE & DUTY</Text>
            <View style={[styles.statusBadge, isSessionActive ? styles.statusBadgePresent : styles.statusBadgeDefault]}>
              <View style={[styles.statusDot, isSessionActive ? styles.statusDotPresent : styles.statusDotDefault]} />
              <Text style={[styles.statusBadgeText, isSessionActive ? styles.statusBadgeTextPresent : styles.statusBadgeTextDefault]}>
                {sessionStatus}
              </Text>
            </View>
          </View>

          {assignmentLoading ? (
            <ActivityIndicator size="small" color="#6B2FA0" style={{ marginVertical: 12 }} />
          ) : assignment ? (
            <View style={styles.assignmentBox}>
              <Text style={styles.patientTitle}>Patient: {assignment.patient_name}</Text>
              <View style={styles.locationRow}>
                <Feather name="map-pin" size={15} color="#6B2FA0" style={{ marginTop: 2, marginRight: 6 }} />
                <Text style={styles.patientAddress}>{assignment.patient_address}</Text>
              </View>
            </View>
          ) : null}

          {/* Location Permission Warning if not granted */}
          {locationPermGranted === false && (
            <View style={styles.locationWarning}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                <Feather name="alert-circle" size={18} color="#DC2626" />
                <Text style={styles.warningText}>
                  GPS location access is required to verify duty attendance.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.retryPermButton}
                onPress={requestLocationPermission}
              >
                <Feather name="rotate-ccw" size={13} color="#ffffff" style={{ marginRight: 4 }} />
                <Text style={styles.retryPermText}>Allow GPS</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Active Duty Banner */}
          {isSessionActive && (
            <View style={styles.activeDutyBanner}>
              <View style={{ flex: 1 }}>
                <View style={styles.activeHeaderRow}>
                  <View style={styles.greenPulseDot} />
                  <Text style={styles.activeDutyTitle}>ACTIVE DUTY SESSION</Text>
                </View>
                {checkInTimeStr && (
                  <Text style={styles.checkInTimeText}>
                    Check-in Time: {new Date(checkInTimeStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                  </Text>
                )}
              </View>
              <ActiveDutyTimer checkInTimeStr={checkInTimeStr} />
            </View>
          )}

          {/* Punch Button */}
          <TouchableOpacity
            style={[
              styles.punchButton,
              isSessionActive ? styles.punchButtonActive : styles.punchButtonInactive,
            ]}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.85}
          >
            <Feather
              name={isSessionActive ? 'log-out' : 'camera'}
              size={18}
              color="#ffffff"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.punchButtonText}>
              {isSessionActive
                ? 'Attendance Logout (Check Out)'
                : 'Mark Attendance (Check In)'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Digital Clock Card matching .clock-card */}
        <DigitalClockCard />
      </ScrollView>

      {/* Check In / Out Modal */}
      <CheckInModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        mode={isSessionActive ? 'CHECK_OUT' : 'CHECK_IN'}
        todayAssignment={assignment}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['today-assignment'] });
          queryClient.invalidateQueries({ queryKey: ['employee-portal-profile'] });
        }}
      />

      {/* Notifications Modal */}
      <NotificationSheet
        visible={notificationVisible}
        onClose={() => setNotificationVisible(false)}
      />
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
    paddingVertical: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLogo: {
    width: 155,
    height: 46,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bellButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
  },
  logoutText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 28,
    gap: 16,
  },
  employeeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e8e0f0',
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    shadowColor: '#6B2FA0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },
  avatarWrapper: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 3,
    borderColor: 'rgba(107, 47, 160, 0.25)',
    padding: 3,
    marginBottom: 12,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
  },
  employeeName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1f2937',
    textAlign: 'center',
  },
  employeeDesignation: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B2FA0',
    marginTop: 3,
    textAlign: 'center',
  },
  employeeDepartment: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
    textAlign: 'center',
  },
  employeeEmail: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 6,
    textAlign: 'center',
  },
  employeePhone: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
    textAlign: 'center',
  },
  glassCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e8e0f0',
    padding: 20,
    shadowColor: '#6B2FA0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },
  cardEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0B2C8C',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  assignmentBox: {
    marginBottom: 16,
  },
  patientTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  patientAddress: {
    flex: 1,
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  noAssignmentText: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  locationWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    gap: 8,
  },
  warningText: {
    fontSize: 12,
    color: '#DC2626',
    flex: 1,
    lineHeight: 16,
  },
  retryPermButton: {
    backgroundColor: '#0B2C8C',
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  retryPermText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  activeDutyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  activeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  greenPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  activeDutyTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065F46',
    letterSpacing: 0.5,
  },
  checkInTimeText: {
    fontSize: 12,
    color: '#1f2937',
    fontWeight: '600',
  },
  timerWrapper: {
    alignItems: 'flex-end',
  },
  timerLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6b7280',
  },
  timerValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#10B981',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  punchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 14,
    elevation: 3,
  },
  punchButtonInactive: {
    backgroundColor: '#6B2FA0',
    shadowColor: '#6B2FA0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  punchButtonActive: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  punchButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  clockCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e8e0f0',
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6B2FA0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },
  clockDateText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 4,
  },
  clockTimeText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#6B2FA0',
    textAlign: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    gap: 8,
  },
  errorBannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#991B1B',
    flex: 1,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  statusBadgePresent: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  statusBadgeDefault: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotPresent: {
    backgroundColor: '#10B981',
  },
  statusDotDefault: {
    backgroundColor: '#9CA3AF',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusBadgeTextPresent: {
    color: '#065F46',
  },
  statusBadgeTextDefault: {
    color: '#4B5563',
  },
});
