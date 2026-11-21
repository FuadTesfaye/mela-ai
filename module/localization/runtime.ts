/** Classic-script features stay outside the framework-independent first load. */
const pending = ((
  globalThis as unknown as { __melaFeatures?: Map<string, Promise<unknown>> }
).__melaFeatures ??= new Map<string, Promise<unknown>>());
export function loadFeature<T>(url: string, name: string): Promise<T> {
  // The browser extension preloads feature globals into its isolated world.
  const ready = (window as unknown as Record<string, T>)[name];
  if (ready) return Promise.resolve(ready);
  let request = pending.get(url);
  if (!request) {
    request = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = url;
      script.async = true;
      script.crossOrigin = "anonymous";
      const fail = () => {
        clearTimeout(timer);
        script.remove();
        pending.delete(url);
        reject(new Error("Optional feature is unavailable. Please retry."));
      };
      const timer = setTimeout(fail, 20000);
      script.onload = () => {
        clearTimeout(timer);
        const feature = (window as unknown as Record<string, unknown>)[name];
        if (
          feature &&
          (typeof feature === "object" || typeof feature === "function")
        )
          resolve(feature);
        else fail();
      };
      script.onerror = fail;
      document.head.append(script);
    });
    pending.set(url, request);
  }
  return request as Promise<T>;
}
