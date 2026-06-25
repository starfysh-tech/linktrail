import { defineManifest } from "@crxjs/vite-plugin";

// `key` pins a stable extension ID across unpacked reloads (so chrome.storage.sync
// keys and the OAuth-style read token stay associated with one identity in dev).
// Icons are intentionally omitted in Slice 1 to avoid missing-asset build errors.
export default defineManifest({
  manifest_version: 3,
  name: "Linktrail",
  version: "0.5.0",
  description: "Capture the current tab into a personal RSS reading history.",
  key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA5Ex6zAltKTol+cXU4uKlLsrkbibKKgFm6lAQTCxNzfSlnedYeUMvZM7nzEvcyn4LEXVUlC5PGRbWKKfgMLNPhx6+yh8l9E7dHHhIDRv/neVRJS3jBtcFHz/Q5eis09z2zIDN//LnXSvaa9HaOQG9ZFkPAoSa8qmQWW4GYdVeGxOzrWlQm7QgzdGIOg2Loi5nCODTer+CwnB6zU73GSSk1jGazExyoXEeDH8WOMnb3eSA0xqCnRQCcRaDoXKM9Iiaq6hLNzpdd7UricAjlkSQbCm2414EtXV7GKN06RdCWvujCtxSCPP131RZl8jaxsX1XyfexZrrIqLm4tXGyTzjowIDAQAB",
  permissions: ["activeTab", "storage", "notifications"],
  background: { service_worker: "src/sw.ts", type: "module" },
  action: { default_title: "Save to Linktrail", default_popup: "popup.html" },
  options_ui: { page: "options.html", open_in_tab: true },
  commands: {
    "capture-current-tab": {
      suggested_key: { default: "Ctrl+Shift+L", mac: "Command+Shift+L" },
      description: "Save the current tab to Linktrail",
    },
  },
});
