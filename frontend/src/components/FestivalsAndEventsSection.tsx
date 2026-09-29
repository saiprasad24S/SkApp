import React, { useMemo, memo } from 'react';
import { Calendar } from 'lucide-react';
import { getFestivalsForMonth, formatEventDate } from '../data/festivalsAndEvents';

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
    <div className="glass-card card-soft stack" style={{ padding: '1.75rem', marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: '#f3e8ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6B2FA0',
            }}
          >
            <Calendar size={18} />
          </div>
          <div>
            <h4 style={{ margin: 0, color: 'var(--text)', fontSize: '1.15rem', fontWeight: 800 }}>
              Festivals & Events
            </h4>
            <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>
              {monthName} {year}
            </span>
          </div>
        </div>

        <span
          style={{
            padding: '0.25rem 0.65rem',
            borderRadius: '12px',
            backgroundColor: 'rgba(107, 47, 160, 0.08)',
            color: '#6B2FA0',
            fontSize: '0.8rem',
            fontWeight: 700,
          }}
        >
          {events.length} {events.length === 1 ? 'Event' : 'Events'}
        </span>
      </div>

      {events.length === 0 ? (
        <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--muted)' }}>
          <p style={{ fontWeight: 600, margin: 0 }}>No festivals or events this month.</p>
          <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Cultural and regional observances will appear here as scheduled.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
          {events.map((event) => {
            const dateStr = formatEventDate(event.year, event.month, event.dayOfMonth);

            return (
              <div
                key={event.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '1rem',
                  padding: '0.85rem 1rem',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(107, 47, 160, 0.03)',
                  border: '1px solid rgba(107, 47, 160, 0.08)',
                }}
              >
                <div
                  style={{
                    minWidth: '48px',
                    padding: '0.35rem 0.25rem',
                    textAlign: 'center',
                    borderRadius: '8px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #e9d5ff',
                    boxShadow: '0 2px 4px rgba(107, 47, 160, 0.05)',
                  }}
                >
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#6B2FA0', lineHeight: 1.1 }}>
                    {event.dayOfMonth}
                  </div>
                  <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#7C3AED', textTransform: 'uppercase' }}>
                    {monthName.slice(0, 3)}
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.95rem' }}>
                    {event.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem', fontSize: '0.8rem' }}>
                    <span style={{ color: 'var(--muted)', fontWeight: 600 }}>{dateStr}</span>
                    <span style={{ color: 'var(--border)' }}>•</span>
                    <span
                      style={{
                        padding: '0.1rem 0.45rem',
                        borderRadius: '4px',
                        backgroundColor: '#f3e8ff',
                        color: '#7C3AED',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                      }}
                    >
                      {event.category}
                    </span>
                  </div>
                  {event.description && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.3rem' }}>
                      {event.description}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

export default FestivalsAndEventsSection;
