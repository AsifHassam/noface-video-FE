const pad = (value: number, length = 2) => value.toString().padStart(length, "0");

export const msToTimestamp = (ms: number): string => {
  const totalMs = Math.max(0, Math.round(ms));
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const seconds = Math.floor((totalMs % 60_000) / 1_000);
  const milliseconds = totalMs % 1_000;

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(milliseconds, 3)}`;
};

export const timestampToMs = (timestamp: string): number => {
  const match =
    timestamp?.match(
      /^(?<hours>\d{1,2}):(?<minutes>\d{2}):(?<seconds>\d{2})\.(?<ms>\d{1,3})$/,
    ) ?? null;

  if (!match?.groups) return 0;

  const hours = Number(match.groups.hours ?? 0);
  const minutes = Number(match.groups.minutes ?? 0);
  const seconds = Number(match.groups.seconds ?? 0);
  const milliseconds = Number(match.groups.ms ?? 0);

  return hours * 3_600_000 + minutes * 60_000 + seconds * 1_000 + milliseconds;
};

export const formatRelativeTime = (isoDate: string): string => {
  const now = new Date();
  const date = new Date(isoDate);
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.round(diffMs / 60_000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes === 1) return "1 minute ago";
  if (diffMinutes < 60) return `${diffMinutes} minutes ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours === 1) return "1 hour ago";
  if (diffHours < 24) return `${diffHours} hours ago`;

  const diffDays = Math.round(diffHours / 24);
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString();
};
