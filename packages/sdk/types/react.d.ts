import type { CSSProperties, ReactElement } from "react";
import type { MelaOptions, MelaHandle } from "./index.js";
export type MelaCompanionProps = Omit<MelaOptions, "container"> & {
  className?: string;
  style?: CSSProperties;
  onReady?: (handle: MelaHandle) => void;
  onError?: (error: Error) => void;
};
export declare function MelaCompanion(props: MelaCompanionProps): ReactElement;
