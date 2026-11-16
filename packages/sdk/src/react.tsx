"use client";
import { useEffect, useRef, type CSSProperties } from "react";
import { mount, type MelaHandle, type MelaOptions } from "./index";
export type MelaCompanionProps = Omit<MelaOptions, "container"> & {
  className?: string;
  style?: CSSProperties;
  onReady?: (handle: MelaHandle) => void;
  onError?: (error: Error) => void;
};
export function MelaCompanion({
  api,
  videoUrl,
  lessonId,
  language,
  assistant,
  renderer,
  contextRoot,
  className,
  style,
  onReady,
  onError,
}: MelaCompanionProps) {
  const target = useRef<HTMLDivElement>(null);
  const mounted = useRef<MelaHandle | undefined>(undefined);
  const latestLanguage = useRef(language);
  latestLanguage.current = language;
  const callbacks = useRef({ onReady, onError });
  callbacks.current = { onReady, onError };
  useEffect(() => {
    let active = true;
    let handle: MelaHandle | undefined;
    void mount({
      container: target.current!,
      api,
      videoUrl,
      lessonId,
      language,
      assistant,
      renderer,
      contextRoot,
    })
      .then((result) => {
        if (!active) {
          result.destroy();
          return;
        }
        handle = result;
        mounted.current = result;
        if (latestLanguage.current) result.setLanguage(latestLanguage.current);
        callbacks.current.onReady?.(result);
      })
      .catch((error) => {
        if (active)
          callbacks.current.onError?.(
            error instanceof Error
              ? error
              : new Error("MELA could not be mounted."),
          );
      });
    return () => {
      active = false;
      handle?.destroy();
      mounted.current = undefined;
    };
  }, [api, videoUrl, lessonId, assistant, renderer, contextRoot]);
  useEffect(() => {
    if (language) mounted.current?.setLanguage(language);
  }, [language]);
  return <div ref={target} className={className} style={style} />;
}
