const DAY = 86_400_000;

/** "Just now", "2 hours ago", "Yesterday", "3 days ago", "Last week", then a date. */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const diff = now.getTime() - then.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return mins === 1 ? "1 minute ago" : `${mins} minutes ago`;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const hours = Math.floor(mins / 60);
  if (then.getTime() >= startOfToday) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = Math.ceil((startOfToday - then.getTime()) / DAY);
  if (days <= 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "Last week";
  if (days < 35) return `${Math.floor(days / 7)} weeks ago`;
  return then.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
