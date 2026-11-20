import { mountActions } from "../module/actions/panel";
import { createSiteMemoryClient } from "./memory/client";
import { memoryControls } from "./memory/panel";
const state = globalThis as unknown as {
  __melaActions?: { destroy(): void; open(): void };
};
state.__melaActions?.destroy();
const client = createSiteMemoryClient();
const controls = memoryControls(client);
const actions = mountActions({
  api: "https://mela-ai-wheat.vercel.app/api/v1",
  shadowMode: "closed",
  extraControls: controls.element,
  question: (question) => client.answer(question),
});
state.__melaActions = {
  open: () => actions.open(),
  destroy() {
    controls.destroy();
    actions.destroy();
  },
};
actions.open();
