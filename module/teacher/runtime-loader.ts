import type { TeacherFactory } from "./types";
const pending = new Map<string, Promise<TeacherFactory>>();
export function loadTeacherRuntime(url: string): Promise<TeacherFactory> {
  const existing = pending.get(url);
  if (existing) return existing;
  const request = new Promise<TeacherFactory>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.dataset.melaTeacher = "";
    const timer = setTimeout(() => {
      script.remove();
      pending.delete(url);
      reject(new Error("The 3D teacher took too long to load."));
    }, 20000);
    script.onload = () => {
      clearTimeout(timer);
      const factory = (window as unknown as { MelaTeacher3D?: TeacherFactory })
        .MelaTeacher3D;
      if (factory?.mount) resolve(factory);
      else {
        pending.delete(url);
        reject(new Error("The 3D teacher could not be initialized."));
      }
    };
    script.onerror = () => {
      clearTimeout(timer);
      script.remove();
      pending.delete(url);
      reject(new Error("The 3D teacher could not be downloaded."));
    };
    document.head.append(script);
  });
  pending.set(url, request);
  return request;
}
