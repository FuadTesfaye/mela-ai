import type { MemoryMessage, MemorySender } from "./memory/service";
export interface ExtensionChrome {
  runtime: {
    id: string;
    getURL: (path: string) => string;
    openOptionsPage: () => Promise<void>;
    sendMessage: (
      message: MemoryMessage,
    ) => Promise<{ ok: boolean; value?: unknown; error?: string }>;
    onMessage: {
      addListener: (
        fn: (
          message: MemoryMessage,
          sender: MemorySender,
          reply: (response: unknown) => void,
        ) => boolean | undefined,
      ) => void;
    };
  };
  storage: {
    local: {
      get: (key: string) => Promise<Record<string, unknown>>;
      set: (data: Record<string, unknown>) => Promise<void>;
      setAccessLevel: (options: {
        accessLevel: "TRUSTED_CONTEXTS";
      }) => Promise<void>;
    };
  };
  action: {
    onClicked: {
      addListener: (
        fn: (tab: { id?: number; url?: string }) => Promise<void>,
      ) => void;
    };
    setBadgeText: (options: { tabId: number; text: string }) => Promise<void>;
    setTitle: (options: { tabId: number; title: string }) => Promise<void>;
  };
  scripting: {
    executeScript: (options: {
      target: { tabId: number };
      files: string[];
    }) => Promise<unknown>;
  };
}
export const chromeApi = () =>
  (globalThis as unknown as { chrome: ExtensionChrome }).chrome;
