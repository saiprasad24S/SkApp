import React, { useMemo, memo } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { getFestivalsForMonth, formatEventDate, FestivalEvent } from '../../data/festivalsAndEvents';

interface FestivalsAndEventsSectionProps {
  year: number;
  month: number; // 0-indexed
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const FestivalsAndEventsSection = memo(function FestivalsAndEventsSection({
  year,
  month,
}: FestivalsAndEventsSectionProps) {
  const events = useMemo(() => {
    return getFestivalsForMonth(year, month);
  }, [year, month]);

  const monthName = MONTH_NAMES[month] || '';

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleWithIcon}>
          <View style={styles.iconCircle}>
            <Feather name="calendar" size={17} color="#6B2FA0" />
          </View>
          <View>
            <Text style={styles.sectionTitle}>Festivals & Events</Text>
            <Text style={styles.sectionSubtitle}>{monthName} {year}</Text>
          </View>
        </View>

        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>
            {events.length} {events.length === 1 ? 'Event' : 'Events'}
          </Text>
        </View>
      </View>

      {/* Events List or Empty State */}
      {events.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Feather name="calendar" size={26} color="#9CA3AF" />
          </View>
          <Text style={styles.emptyText}>No festivals or events this month.</Text>
          <Text style={styles.emptySubtext}>
            Cultural and regional observances will appear here as scheduled.
          </Text>
        </View>
      ) : (
        <View style={styles.eventsList}>
          {events.map((event) => {
            const dateStr = formatEventDate(event.year, event.month, event.dayOfMonth);

            return (
              <View key={event.id} style={styles.eventCard}>
                {/* Left Date Block */}
                <View style={styles.dateBlock}>
                  <Text style={styles.dateDayText}>{event.dayOfMonth}</Text>
                  <Text style={styles.dateMonthText}>
                    {monthName.slice(0, 3).toUpperCase()}
                  </Text>
                </View>

                {/* Event Details */}
                <View style={styles.eventInfo}>
                  <Text style={styles.eventName}>{event.name}</Text>
                  
                  <View style={styles.metaRow}>
                    <Text style={styles.eventDateString}>{dateStr}</Text>
                    <View style={styles.metaDot} />
                    <View style={styles.categoryPill}>
                      <Text style={styles.categoryPillText}>{event.category}</Text>
                    </View>
                  </View>

                  {event.description ? (
                    <Text style={styles.eventDesc} numberOfLines={2}>
                      {event.description}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e8e0f0',
    padding: 16,
    marginTop: 16,
    shadowColor: '#6B2FA0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1edf7',
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3e8ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1f2937',
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#6B2FA0',
    fontWeight: '600',
    marginTop: 1,
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#f6f3fb',
    borderWidth: 1,
    borderColor: '#e9d5ff',
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B2FA0',
  },
  emptyContainer: {
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4b5563',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 240,
  },
  eventsList: {
    marginTop: 12,
    gap: 10,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#faf8fc',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#eee6f5',
    padding: 12,
    gap: 12,
  },
  dateBlock: {
    width: 48,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e9d5ff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6B2FA0',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  dateDayText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#6B2FA0',
    lineHeight: 22,
  },
  dateMonthText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#7C3AED',
    letterSpacing: 0.5,
  },
  eventInfo: {
    flex: 1,
  },
  eventName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
    lineHeight: 19,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 6,
  },
  eventDateString: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#d1d5db',
  },
  categoryPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    backgroundColor: '#f3e8ff',
  },
  categoryPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7C3AED',
  },
  eventDesc: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
    lineHeight: 15,
  },
});

export default FestivalsAndEventsSection;
