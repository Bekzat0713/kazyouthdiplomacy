(function () {
  var STORAGE_KEY = "kyd_backend_base_url";

  function normalizeUrl(value) {
    return String(value || "").trim().replace(/\/+$/, "");
  }

  function getAppConfig() {
    if (!window.__APP_CONFIG__ || typeof window.__APP_CONFIG__ !== "object") {
      return {};
    }

    return window.__APP_CONFIG__;
  }

  function readStoredBackendBase() {
    try {
      return normalizeUrl(window.localStorage.getItem(STORAGE_KEY));
    } catch (_error) {
      return "";
    }
  }

  function persistBackendBase(value) {
    if (!value) {
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch (_error) {
      // Ignore storage failures in restricted contexts.
    }
  }

  function getBackendBaseUrl() {
    var params = new URLSearchParams(window.location.search);
    var queryValue = normalizeUrl(params.get("backendBase"));
    var configValue = normalizeUrl(getAppConfig().appBaseUrl);
    var storedValue = readStoredBackendBase();
    var resolved = queryValue || configValue || storedValue;

    persistBackendBase(resolved);
    return resolved;
  }

  function getKaspiQrUrl() {
    return normalizeUrl(getAppConfig().kaspiQrUrl);
  }

  window.KYD_RUNTIME = Object.freeze({
    getBackendBaseUrl: getBackendBaseUrl,
    getKaspiQrUrl: getKaspiQrUrl,
  });
})();
