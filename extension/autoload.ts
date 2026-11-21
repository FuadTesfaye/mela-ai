/** Tiny loader on every page: asks the service worker to open MELA when the
 * user has "open on every page" on (remembered after the first click). */
const runtime = (
  globalThis as unknown as {
    chrome?: { runtime?: { sendMessage(m: unknown): Promise<unknown> } };
  }
).chrome?.runtime;
if (window.top === window)
  void runtime?.sendMessage({ type: "mela:autoload" }).catch(() => {});
