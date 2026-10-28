/**
 * safe-share.js — navigator.share wrapper with fallback.
 *
 * Replaces the clipboard-only share with the native share sheet when
 * supported. The clipboard remains the fallback for Safari / Firefox
 * and when the user cancels the native picker.
 *
 * Contract:
 *   shareSession({ title, text, url }) -> Promise<'shared'|'cancelled'|'failed'|'unsupported'>
 *   - 'shared'      : native share completed
 *   - 'cancelled'   : user dismissed the share sheet (AbortError)
 *   - 'failed'      : any other error
 *   - 'unsupported' : navigator.share not available
 *
 * All calls must be from a user gesture handler (click).
 */
(function () {
  'use strict';

  /**
   * @param {Object} opts
   * @param {string} [opts.title]  - defaults to 'Hermes conversation'
   * @param {string} [opts.text]   - transcript markdown
   * @param {string} [opts.url]    - defaults to location.href
   * @returns {Promise<'shared'|'cancelled'|'failed'|'unsupported'>}
   */
  async function shareSession(opts) {
    if (!navigator.share) return 'unsupported';

    const payload = {
      title: opts?.title || 'Hermes conversation',
      text: opts?.text || '',
      url: opts?.url || location.href,
    };

    try {
      await navigator.share(payload);
      return 'shared';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled';
      // Some browsers throw on security/permission issues — treat as failed
      return 'failed';
    }
  }

  // Expose on window for boot.js to use
  window.shareSession = shareSession;
})();