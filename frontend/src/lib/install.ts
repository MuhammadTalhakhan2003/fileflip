/**
 * Runs in <head>, before React: the browser fires "beforeinstallprompt" once,
 * often before hydration, so it has to be caught early. Also registers the
 * service worker that makes the site installable.
 */
export const INSTALL_SCRIPT = `
window.addEventListener("beforeinstallprompt", function (e) {
  e.preventDefault();
  window.__installPrompt = e;
  window.dispatchEvent(new Event("install-available"));
});
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () { navigator.serviceWorker.register("/sw.js").catch(function () {}); });
}`;
