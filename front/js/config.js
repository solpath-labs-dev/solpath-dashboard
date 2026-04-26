/**
 * 위젯: `app.js` 전에 `window.__SOLPATH__ = { gasBaseUrl: "…/exec" }`
 * 로컬: `FALLBACK_GAS_BASE_URL` (커밋 금지)
 */
function spReadInjected_() {
  if (typeof globalThis === 'undefined') {
    return { url: '' };
  }
  const o = globalThis.__SOLPATH__;
  if (!o || typeof o !== 'object') {
    return { url: '' };
  }
  return {
    url: String(
      o.gasBaseUrl != null
        ? o.gasBaseUrl
        : o.GAS_BASE_URL != null
          ? o.GAS_BASE_URL
          : o.execUrl != null
            ? o.execUrl
            : ''
    ).trim()
  };
}

const _inj = spReadInjected_();
const FALLBACK_GAS_BASE_URL = '';

export const GAS_BASE_URL = _inj.url || FALLBACK_GAS_BASE_URL;

export const GAS_MODE = {
  get useMock() {
    return !String(GAS_BASE_URL).trim();
  },
  get canSync() {
    return Boolean(String(GAS_BASE_URL).trim());
  }
};
