/**
 * Formats a last-seen ISO timestamp into a human-readable relative string.
 * Examples:
 * - "Last seen just now" (< 1 min)
 * - "Last seen 5 minutes ago" (< 60 min)
 * - "Last seen 2 hours ago" (< 24 hr)
 * - "Last seen yesterday" (previous calendar day / 24-48 hr)
 * - "Last seen 3 days ago" (within 7 days)
 * - "Last seen on 12 Sep" (> 7 days)
 * - "Last seen unavailable" (null / invalid)
 */
export function formatLastSeen(lastSeenAt?: string | null): string {
  if (!lastSeenAt) {
    return 'Last seen unavailable';
  }

  try {
    const date = new Date(lastSeenAt);
    if (isNaN(date.getTime())) {
      return 'Last seen unavailable';
    }

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    // Safeguard against client clock drift
    if (diffMs < 0) {
      return 'Last seen just now';
    }

    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) {
      return 'Last seen just now';
    }

    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) {
      return `Last seen ${diffMin} ${diffMin === 1 ? 'minute' : 'minutes'} ago`;
    }

    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) {
      return `Last seen ${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    }

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) {
      return 'Last seen yesterday';
    }

    if (diffDays < 7) {
      return `Last seen ${diffDays} days ago`;
    }

    return `Last seen on ${date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    })}`;
  } catch {
    return 'Last seen unavailable';
  }
}
