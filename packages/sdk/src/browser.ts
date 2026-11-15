export * from "./index";
import { register } from "./index";
if (typeof window !== "undefined") void register();
