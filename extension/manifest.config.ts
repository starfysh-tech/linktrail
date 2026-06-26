import { defineManifest } from "@crxjs/vite-plugin";

// `key` pins a stable extension ID across unpacked reloads (so chrome.storage.sync
// keys and the OAuth-style read token stay associated with one identity in dev).
const icons = {
  "16": "icons/16.png",
  "32": "icons/32.png",
  "48": "icons/48.png",
  "128": "icons/128.png",
};

export default defineManifest({
  manifest_version: 3,
  name: "Linktrail",
  version: "0.13.0",
  description: "Capture the current tab into a personal RSS reading history.",
  homepage_url: "https://starfysh-tech.github.io/linktrail/",
  key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA5Ex6zAltKTol+cXU4uKlLsrkbibKKgFm6lAQTCxNzfSlnedYeUMvZM7nzEvcyn4LEXVUlC5PGRbWKKfgMLNPhx6+yh8l9E7dHHhIDRv/neVRJS3jBtcFHz/Q5eis09z2zIDN//LnXSvaa9HaOQG9ZFkPAoSa8qmQWW4GYdVeGxOzrWlQm7QgzdGIOg2Loi5nCODTer+CwnB6zU73GSSk1jGazExyoXEeDH8WOMnb3eSA0xqCnRQCcRaDoXKM9Iiaq6hLNzpdd7UricAjlkSQbCm2414EtXV7GKN06RdCWvujCtxSCPP131RZl8jaxsX1XyfexZrrIqLm4tXGyTzjowIDAQAB",
  icons,
  permissions: ["activeTab", "storage", "notifications", "alarms"],
  // Requested at runtime (from the options page) for the user's specific backend
  // origin, so the extension can reach a self-hosted backend that doesn't send
  // permissive CORS. The default Vercel backend already sends CORS, so this is
  // additive — denial falls back to the CORS path. Declared broad because the
  // backend origin is user-supplied and unknown at build time; the actual grant
  // is narrowed to the one origin the user enters.
  optional_host_permissions: ["https://*/*", "http://localhost/*"],
  background: { service_worker: "src/sw.ts", type: "module" },
  action: { default_title: "Save to Linktrail", default_popup: "popup.html", default_icon: icons },
  options_ui: { page: "options.html", open_in_tab: true },
  commands: {
    "capture-current-tab": {
      suggested_key: { default: "Ctrl+Shift+L", mac: "Command+Shift+L" },
      description: "Save the current tab to Linktrail",
    },
  },
});
