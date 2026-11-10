import type { GuildSettings } from "@noxis/shared";
export class SlidingWindow {
  private windows = new Map<string, number[]>();
  constructor(private readonly maxKeys = 10000) {}
  hit(key: string, interval: number, now = Date.now()) {
    if (this.windows.size >= this.maxKeys && !this.windows.has(key)) {
      for (const [k, v] of this.windows)
        if (!v.length || now - v[v.length - 1]! > 120000) this.windows.delete(k);
      if (this.windows.size >= this.maxKeys) this.windows.delete(this.windows.keys().next().value!);
    }
    const list = (this.windows.get(key) ?? []).filter((t) => now - t < interval);
    list.push(now);
    this.windows.set(key, list.slice(-200));
    return list.length;
  }
  clear(key: string) {
    this.windows.delete(key);
  }
  get size() {
    return this.windows.size;
  }
}
export class SecurityEngine {
  private messages = new SlidingWindow();
  private strikes = new SlidingWindow();
  private joins = new SlidingWindow();
  private actions = new SlidingWindow();
  message(guildId: string, userId: string, settings: GuildSettings, now = Date.now()) {
    if (settings.antiSpam?.enabled === false) return null;
    const key = `${guildId}:${userId}`,
      windowMs = settings.antiSpam?.intervalMs ?? 8000,
      count = this.messages.hit(key, windowMs, now);
    if (count < (settings.antiSpam?.maxMessages ?? 6)) return null;
    this.messages.clear(key);
    const strikes = this.strikes.hit(key, 300000, now);
    return {
      count,
      windowMs,
      strikes,
      timeout: settings.antiSpam?.mode === "timeout" && strikes >= (settings.antiSpam.strikes ?? 2),
      seconds: settings.antiSpam?.timeoutSeconds ?? 60,
    };
  }
  join(guildId: string, settings: GuildSettings, now = Date.now()) {
    if (settings.antiRaid?.enabled === false) return null;
    const windowMs = settings.antiRaid?.intervalMs ?? 15000,
      count = this.joins.hit(guildId, windowMs, now);
    return count === (settings.antiRaid?.maxJoins ?? 8) ? { count, windowMs } : null;
  }
  action(guildId: string, actorId: string, settings: GuildSettings, now = Date.now()) {
    if (settings.antiNuke?.enabled === false) return null;
    const interval = settings.antiNuke?.intervalMs ?? 30000,
      count = this.actions.hit(`${guildId}:${actorId}`, interval, now);
    return { count, windowMs: interval, critical: count >= (settings.antiNuke?.maxActions ?? 3) };
  }
}
export function phishingHosts(content: string, blocked: string[]) {
  const hits = new Set<string>();
  for (const match of content.matchAll(/https?:\/\/[^\s<>]+/gi)) {
    try {
      const host = new URL(match[0]).hostname.toLowerCase();
      if (blocked.some((b) => host === b.toLowerCase() || host.endsWith(`.${b.toLowerCase()}`)))
        hits.add(host);
    } catch {}
  }
  return [...hits];
}
