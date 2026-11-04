/** Serial, retryable autosaves. A flush also waits for a write already in flight. */
export function createSaveQueue(write: (key: string, value: string) => Promise<void>, delay = 400) {
  const dirty = new Map<string, string>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let chain = Promise.resolve();
  function flush(): Promise<void> {
    clearTimeout(timer); timer = undefined;
    chain = chain.catch(() => {}).then(async () => {
      while (dirty.size) {
        const [key, value] = dirty.entries().next().value!;
        await write(key, value);
        // An edit made during the write must still be saved afterwards.
        if (dirty.get(key) === value) dirty.delete(key);
      }
    });
    return chain;
  }
  return {
    put(key: string, value: string) {
      dirty.set(key, value);
      clearTimeout(timer);
      timer = setTimeout(() => { void flush().catch(() => {}); }, delay);
    },
    flush,
  };
}
