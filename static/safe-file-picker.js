/**
 * safe-file-picker.js — File System Access API wrappers with fallback.
 *
 * Replaces <a download> and <input type="file"> with native pickers
 * when supported. The fallbacks are IDENTICAL to the current behaviour
 * so Safari / Firefox users see zero change.
 *
 * ── The user-gesture rule that shapes this module ───────────────────────────
 * `showSaveFilePicker` and `showOpenFilePicker` require a TRANSIENT USER
 * ACTIVATION. An `await` between the click and the picker call loses the
 * activation, and Safari refuses to open the picker at all (Chromium is
 * lenient, which is why a Chrome-only test passes while Safari breaks).
 *
 * So the save path is deliberately TWO-PHASE:
 *
 *   1. openSaveHandle(...)  — called SYNCHRONOUSLY from the click handler.
 *                              Opens the picker and returns a handle.
 *   2. writeToHandle(...)   — called AFTER any slow await (e.g. a fetch of
 *                              the content). Writing does not need a gesture.
 *
 * A one-phase `saveTextFile(content)` that fetches first would break Safari.
 *
 * Contracts:
 *   openSaveHandle({ suggestedName, types })
 *     -> Promise<{handle}|'cancelled'|'unsupported'>
 *   writeToHandle(handle, content)
 *     -> Promise<'saved'|'failed'>
 *   saveTextFile({ content, suggestedName, types })
 *     -> Promise<'saved'|'cancelled'|'failed'|'downloaded'|'unsupported'>
 *       (convenience one-phase form for content already in memory)
 *   openTextFile({ types })
 *     -> Promise<File|null|'unsupported'>
 */
(function () {
  'use strict';

  /**
   * Phase 1 of the save flow. MUST be called synchronously from a click
   * handler so the transient activation is still live.
   * @returns {Promise<{handle:FileSystemFileHandle}|'cancelled'|'unsupported'>}
   */
  async function openSaveHandle(opts) {
    const w = window;
    if (typeof w.showSaveFilePicker !== 'function') return 'unsupported';

    const suggestedName = opts?.suggestedName || 'hermes-export.txt';
    const types = opts?.types || [
      { description: 'Text file', accept: { 'text/plain': ['.txt'] } },
    ];

    try {
      // Called before any await inside this function: the gesture is live.
      const handle = await w.showSaveFilePicker({ suggestedName, types });
      return { handle };
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled';
      return 'failed';
    }
  }

  /**
   * Phase 2 of the save flow. No gesture needed.
   * @returns {Promise<'saved'|'failed'>}
   */
  async function writeToHandle(handle, content) {
    try {
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      return 'saved';
    } catch (_) {
      return 'failed';
    }
  }

  /**
   * One-phase convenience form for content already in memory.
   * @returns {Promise<'saved'|'cancelled'|'failed'|'downloaded'|'unsupported'>}
   */
  async function saveTextFile(opts) {
    const mime = opts?.mime || 'text/plain;charset=utf-8';
    const opened = await openSaveHandle(opts);
    if (opened === 'cancelled') return 'cancelled';
    // NO PICKER (Safari, Firefox) — this is the branch that must still SAVE.
    // Returning 'unsupported' here without downloading would silently break
    // the feature on every non-Chromium browser: the caller has content in
    // memory and no second chance to write it.
    if (opened === 'unsupported') {
      return fallbackDownload(opts.content, opts?.suggestedName, mime)
        ? 'downloaded'
        : 'unsupported';
    }
    if (opened === 'failed') {
      return fallbackDownload(opts.content, opts?.suggestedName, mime) ? 'downloaded' : 'failed';
    }
    const res = await writeToHandle(opened.handle, opts.content);
    if (res === 'saved') return 'saved';
    // Write failed (quota, permission revoked): fall back to a download.
    return fallbackDownload(opts.content, opts?.suggestedName, mime) ? 'downloaded' : 'failed';
  }

  /**
   * Open a text file via showOpenFilePicker.
   * MUST be called synchronously from a click handler.
   * @returns {Promise<File|null|'unsupported'>}
   *   null       = user cancelled
   *   'unsupported' = no showOpenFilePicker (caller falls back to <input>)
   */
  async function openTextFile(opts) {
    const w = window;
    if (typeof w.showOpenFilePicker !== 'function') return 'unsupported';

    const types = opts?.types || [
      { description: 'JSON file', accept: { 'application/json': ['.json'] } },
      { description: 'Text file', accept: { 'text/plain': ['.txt', '.md'] } },
    ];

    try {
      const [handle] = await w.showOpenFilePicker({ multiple: false, types });
      if (!handle) return null;
      return await handle.getFile();
    } catch (e) {
      if (e && e.name === 'AbortError') return null;
      return 'unsupported';
    }
  }

  /**
   * Fallback: the classic <a download> approach (unchanged behaviour).
   * @returns {boolean} true if the click was dispatched
   */
  function fallbackDownload(content, filename, mime) {
    try {
      const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'hermes-export.txt';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      // Revoke after a tick so the download starts
      setTimeout(() => {
        URL.revokeObjectURL(url);
        a.remove();
      }, 100);
      return true;
    } catch (_) {
      return false;
    }
  }

  window.saveTextFile = saveTextFile;
  window.openSaveHandle = openSaveHandle;
  window.writeToHandle = writeToHandle;
  window.openTextFile = openTextFile;
})();