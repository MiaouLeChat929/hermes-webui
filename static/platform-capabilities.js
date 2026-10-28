/**
 * platform-capabilities.js — PWA platform surfaces that need a lifecycle
 * hook rather than a single click handler.
 *
 * Two surfaces live here:
 *
 *  1. Launch Queue consumer (issue #1, companion of the manifest
 *     `file_handlers` declaration). A manifest that DECLARES file_handlers
 *     without a launchQueue consumer is a hollow promise: the OS opens the
 *     app, the file is dropped on the floor, and the user sees the empty
 *     chat with no error. This module closes that loop.
 *
 *  2. Persistent storage request. `navigator.storage.persist()` asks the
 *     browser to protect the origin's storage from eviction under disk
 *     pressure. Chromium grants it silently based on engagement and install
 *     state; Firefox prompts; Safari 17+ decides by heuristic. A refusal is
 *     normal and must be silent. The request belongs at the FIRST MEANINGFUL
 *     USE (the first session the user creates), NOT on page load: a
 *     persist() call fired at load is a prompt to a user who has not yet
 *     done anything, and browsers answer that request less generously.
 *
 * Both surfaces are feature-detected and never throw.
 */
(function () {
  'use strict';

  // ── Launch Queue ──────────────────────────────────────────────────────────

  /**
   * Register the launch consumer once, at boot.
   *
   * `window.launchQueue` is a PROPERTY, not a method, and a member can
   * exist with the value `undefined` — `"launchQueue" in window` is a false
   * positive. The value is what gets checked.
   *
   * The callback fires for a launch that happened BEFORE the consumer was
   * registered too: the queue is persistent, so a file handed to the app
   * while it was closed is still pending when it boots.
   */
  function registerLaunchHandler(onFile) {
    if (typeof window === 'undefined') return false;
    const lq = window.launchQueue;
    if (!lq || typeof lq.setConsumer !== 'function') return false;
    try {
      lq.setConsumer((params) => {
        const files = (params && params.files) || [];
        if (!files.length) return;
        // Only the FIRST file is handled: the WebUI imports one session
        // export, and silently ignoring the rest is better than opening
        // several imports that would race each other.
        const handle = files[0];
        if (!handle || typeof handle.getFile !== 'function') return;
        handle.getFile().then((file) => {
          if (file) onFile(file);
        }).catch(() => {});
      });
      return true;
    } catch (_) {
      return false;
    }
  }

  // ── Persistent storage ────────────────────────────────────────────────────

  let persistRequested = false;

  /**
   * Ask for persistent storage. Idempotent: the first meaningful use asks,
   * later calls are no-ops. Never throws, never surfaces a refusal.
   * @returns {Promise<boolean>} whether storage is persisted
   */
  async function requestPersistentStorage() {
    if (persistRequested) return false;
    persistRequested = true;
    try {
      if (!navigator.storage || !navigator.storage.persist) return false;
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    } catch (_) {
      return false;
    }
  }

  window.registerLaunchHandler = registerLaunchHandler;
  window.requestPersistentStorage = requestPersistentStorage;
})();