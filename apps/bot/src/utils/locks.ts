const locks = new Map<string, Promise<void>>();
export async function withGuildLock<T>(guildId: string, run: () => Promise<T>) {
  const before = locks.get(guildId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
      release = resolve;
    }),
    tail = before.then(() => current);
  locks.set(guildId, tail);
  await before;
  try {
    return await run();
  } finally {
    release();
    if (locks.get(guildId) === tail) locks.delete(guildId);
  }
}
