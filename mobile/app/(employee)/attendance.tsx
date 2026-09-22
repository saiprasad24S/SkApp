import React, { useState, useMemo, memo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-expo';
import Svg, { Circle } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/authStore';
import { getAttendanceHistory } from '../../src/api/attendanceApi';

const AttendanceMiniPieChart = memo(function AttendanceMiniPieChart({
  present,
  absent,
  size = 64,
}: {
  present: number;
  absent: number;
  size?: number;
}) {
  const total = present + absent;
  const radius = 14;
  const circumference = 2 * Math.PI * radius; // ~87.96

  if (total === 0) {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} viewBox="0 0 36 36">
          <Circle cx="18" cy="18" r={radius} fill="none" stroke="#E2E8F0" strokeWidth="5" />
        </Svg>
        <Text style={{ position: 'absolute', fontSize: 10, fontWeight: '700', color: '#9ca3af' }}>0%</Text>
      </View>
    );
  }

  const presentRatio = present / total;
  const presentStroke = presentRatio * circumference;
  const presentPercent = Math.round(presentRatio * 100);

  return (
    <View
      style={{
        position: 'relative',
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Svg
        width={size}
        height={size}
        viewBox="0 0 36 36"
        style={{ transform: [{ rotate: '-90deg' }] }}
      >
        <Circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          stroke="#EF4444"
          strokeWidth="5"
        />
        {present > 0 && (
          <Circle
            cx="18"
            cy="18"
            r={radius}
            fill="none"
            stroke="#10B981"
            strokeWidth="5"
            strokeDasharray={`${presentStroke} ${circumference}`}
            strokeDashoffset="0"
          />
        )}
      </Svg>
      <Text
        style={{
          position: 'absolute',
          fontSize: 11,
          fontWeight: '800',
          color: '#1f2937',
          textAlign: 'center',
        }}
      >
        {presentPercent}%
      </Text>
    </View>
  );
});

export default function AttendanceScreen() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const profile = useAuthStore((state) => state.profile);
  const isSessionActive = useAuthStore((state) => state.isSessionActive);
  const activeSession = useAuthStore((state) => state.activeSession);

  // Month navigation state
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth());
  const [refreshing, setRefreshing] = useState(false);

  const handlePrevMonth = useCallback(() => {
    setCalendarMonth((prev) => {
      if (prev === 0) {
        setCalendarYear((y) => y - 1);
        return 11;
      }
      return prev - 1;
    });
  }, []);

  const handleNextMonth = useCallback(() => {
    setCalendarMonth((prev) => {
      if (prev === 11) {
        setCalendarYear((y) => y + 1);
        return 0;
      }
      return prev + 1;
    });
  }, []);

  // Fetch employee attendance history
  const { data: attendanceHistory, isLoading, refetch } = useQuery({
    queryKey: ['employee-attendance-history', profile?.employee_id],
    queryFn: async () => {
      const token = await getToken();
      if (!token) return [];
      return getAttendanceHistory(token);
    },
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const calendarData = useMemo(() => {
    const now = new Date();
    const year = calendarYear;
    const month = calendarMonth;

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startingDayOfWeek = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const records = attendanceHistory ?? [];
    const presentDates = new Set(
      records.map((r: any) => {
        const dtStr = r.session_login_time || r.timestamp || r.created_at || r.login_time;
        return new Date(dtStr).toDateString();
      })
    );

    const viewDate = new Date(year, month, 1);
    const monthName = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

    const days: ({
      dayNumber: number;
      dateStr: string;
      isToday: boolean;
      isPast: boolean;
      isPresent: boolean;
    } | null)[] = [];

    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    for (let day = 1; day <= totalDays; day++) {
      const d = new Date(year, month, day);
      const dateStr = d.toDateString();
      const isToday = dateStr === now.toDateString();
      const isPast = d < new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const isCheckedInToday = isCurrentMonth && isToday && Boolean(isSessionActive);
      const isPresent = presentDates.has(dateStr) || (isToday && (isCheckedInToday || presentDates.has(dateStr)));

      days.push({
        dayNumber: day,
        dateStr,
        isToday,
        isPast,
        isPresent,
      });
    }

    return { monthName, days, year, month, isCurrentMonth };
  }, [calendarYear, calendarMonth, attendanceHistory, isSessionActive]);

  const attendanceMonthStats = useMemo(() => {
    const pastAndToday = calendarData.days.filter((d) => d && (d.isPast || d.isToday));
    const present = pastAndToday.filter((d) => d?.isPresent).length;
    const absent = pastAndToday.filter((d) => !d?.isPresent).length;
    return { present, absent, total: pastAndToday.length };
  }, [calendarData]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Page Header matching EmployeePortal.tsx */}
      <View style={styles.pageHeader}>
        <View style={styles.titleRow}>
          <Feather name="clock" size={20} color="#6B2FA0" />
          <Text style={styles.pageTitle}>Attendance Calendar</Text>
        </View>

        {/* Month Selector */}
        <View style={styles.monthNav}>
          <TouchableOpacity
            onPress={handlePrevMonth}
            style={styles.navArrow}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="chevron-left" size={18} color="#6B2FA0" />
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{calendarData.monthName}</Text>
          <TouchableOpacity
            onPress={handleNextMonth}
            style={styles.navArrow}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="chevron-right" size={18} color="#6B2FA0" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6B2FA0']} />}
      >
        <View style={styles.calendarCard}>
          {/* Attendance Summary Banner: Left = Counts, Right = Mini Pie */}
          <View style={styles.summaryBanner}>
            <View style={styles.summaryLeft}>
              <Text style={styles.summaryHeader}>MONTHLY ATTENDANCE</Text>
              <View style={styles.metricsRow}>
                <View style={styles.metricItem}>
                  <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
                  <Text style={styles.metricText}>
                    Present: <Text style={styles.presentCount}>{attendanceMonthStats.present}</Text>{' '}
                    {attendanceMonthStats.present === 1 ? 'day' : 'days'}
                  </Text>
                </View>

                <View style={styles.metricItem}>
                  <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
                  <Text style={styles.metricText}>
                    Absent: <Text style={styles.absentCount}>{attendanceMonthStats.absent}</Text>{' '}
                    {attendanceMonthStats.absent === 1 ? 'day' : 'days'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.summaryRight}>
              <AttendanceMiniPieChart
                present={attendanceMonthStats.present}
                absent={attendanceMonthStats.absent}
                size={64}
              />
            </View>
          </View>

          {/* Days of week header */}
          <View style={styles.weekHeader}>
            {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d) => (
              <Text key={d} style={styles.weekHeaderText}>
                {d}
              </Text>
            ))}
          </View>

          {/* Calendar Grid 7 columns */}
          {isLoading ? (
            <ActivityIndicator size="small" color="#6B2FA0" style={{ marginVertical: 32 }} />
          ) : (
            <View style={styles.gridContainer}>
              {calendarData.days.map((item, idx) => {
                if (!item) {
                  return <View key={`empty-${idx}`} style={styles.emptyDayCell} />;
                }

                const isPresent = item.isPresent;
                const isPastOrToday = item.isPast || item.isToday;

                return (
                  <View
                    key={item.dayNumber}
                    style={[
                      styles.dayCell,
                      item.isToday && styles.dayCellToday,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayNumberText,
                        item.isToday && styles.dayNumberToday,
                      ]}
                    >
                      {item.dayNumber}
                    </Text>

                    {isPastOrToday ? (
                      <View
                        style={[
                          styles.statusBadge,
                          isPresent ? styles.presentBadge : styles.absentBadge,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            isPresent ? styles.presentBadgeText : styles.absentBadgeText,
                          ]}
                        >
                          {isPresent ? 'P' : 'A'}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.futureText}>—</Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f6f3fb',
  },
  pageHeader: {
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
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  navArrow: {
    padding: 3,
  },
  monthLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1f2937',
    paddingHorizontal: 8,
    minWidth: 105,
    textAlign: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 28,
  },
  calendarCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e8e0f0',
    padding: 16,
    shadowColor: '#6B2FA0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },
  summaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    marginBottom: 16,
  },
  summaryLeft: {
    flex: 1,
    gap: 6,
  },
  summaryHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6b7280',
    letterSpacing: 0.5,
  },
  metricsRow: {
    gap: 4,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  metricText: {
    fontSize: 13,
    color: '#1f2937',
  },
  presentCount: {
    color: '#10B981',
    fontWeight: '800',
  },
  absentCount: {
    color: '#EF4444',
    fontWeight: '800',
  },
  summaryRight: {
    paddingLeft: 8,
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  weekHeaderText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '800',
    color: '#6b7280',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  emptyDayCell: {
    width: '14.28%',
    aspectRatio: 1,
    padding: 2,
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 0.9,
    padding: 4,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  dayCellToday: {
    borderColor: '#6B2FA0',
    borderWidth: 2,
  },
  dayNumberText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1f2937',
  },
  dayNumberToday: {
    fontWeight: '800',
    color: '#6B2FA0',
  },
  statusBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presentBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  absentBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  presentBadgeText: {
    color: '#10B981',
  },
  absentBadgeText: {
    color: '#EF4444',
  },
  futureText: {
    fontSize: 11,
    color: '#cbd5e1',
  },
});
