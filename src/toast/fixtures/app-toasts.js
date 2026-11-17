// An app's toast manager, as a plain module: the fixture hands it to ToastProvider, and code that isn't .rx
// (here, the test) adds toasts through it.
import { createToastManager } from "../../internal/toast.js";

export const appToasts = createToastManager();

export function appToastManager() {
  return appToasts;
}
