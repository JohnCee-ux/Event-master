const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS = 5;

const requests = new Map<string, number[]>();

export const consumeOtpRequest = (email: string): { allowed: true } | { allowed: false; retryAfterSeconds: number } => {
  const now = Date.now();
  const key = email.trim().toLowerCase();
  const recent = (requests.get(key) || []).filter((timestamp) => now - timestamp < WINDOW_MS);

  if (recent.length >= MAX_REQUESTS) {
    const oldest = recent[0];
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((WINDOW_MS - (now - oldest)) / 1000)),
    };
  }

  recent.push(now);
  requests.set(key, recent);
  return { allowed: true };
};
