/** Optional HTML enhancements never wait indefinitely for a provider read. */
export async function optionalRead<T>(read: () => Promise<T>, deadlineMs = 250): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(read).catch(() => null),
      new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), deadlineMs); }),
    ]);
  } finally { clearTimeout(timer); }
}
