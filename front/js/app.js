import { GAS_MODE, GAS_BASE_URL } from './config.js';
import { SYNC_PAGE_SHELL_HTML } from './syncPageTemplate.js';
import { applyProductMappingHeaderUrls, initProductMapping } from './productMapping.js';
import { initAnalytics } from './analytics.js';

const MOUNT_ID = 'solpath-root';
const syncAction = 'syncOpenFull';
const SYNC_CONFIRM = '데이터 동기화';

function getMount() {
  return document.getElementById(MOUNT_ID);
}

function ensureShell() {
  const m = getMount();
  if (!m) {
    return null;
  }
  if (m.getAttribute('data-solpath-autofill') === '0') {
    return m;
  }
  if (!m.querySelector('.app-shell--v9')) {
    m.innerHTML = SYNC_PAGE_SHELL_HTML;
  }
  return m;
}

/**
 * 임웹: 표시·검증은 **실제로 로드된** 번들(이 파일 URL)이 정본. 스니펫 `cdnCommit`는 보조.
 * @returns {{ full: string, fromModule: string, fromSnippet: string, mismatch: boolean }}
 */
function resolveCdnBuildMeta_() {
  let fromModule = '';
  try {
    const u = import.meta.url;
    let m = u.match(/solpath-dashboard-front@([0-9a-fA-F]{7,40})\//i);
    if (!m) {
      m = u.match(/solpath-dashboard@([0-9a-fA-F]{7,40})\/front\//i);
    }
    if (m) {
      fromModule = m[1].toLowerCase();
    }
  } catch (e) {
    void e;
  }
  let fromSnippet = '';
  if (typeof window !== 'undefined' && window.__SOLPATH__ && window.__SOLPATH__.cdnCommit) {
    fromSnippet = String(window.__SOLPATH__.cdnCommit).toLowerCase();
  }
  const full = fromModule || fromSnippet;
  const mismatch = Boolean(
    fromModule && fromSnippet && fromModule !== fromSnippet
  );
  return { full, fromModule, fromSnippet, mismatch };
}

function stampCdnBuild_() {
  const { full, fromModule, fromSnippet, mismatch } = resolveCdnBuildMeta_();
  const el = document.getElementById('sp-cdnBuild');
  const m = getMount();
  if (!full) {
    if (el) {
      el.textContent = '버전 —';
      el.setAttribute('title', '로컬에서 열었거나 표시 정보를 읽지 못한 경우 비어 있을 수 있습니다.');
      el.removeAttribute('hidden');
    }
    return;
  }
  const short = full.length >= 7 ? full.slice(0, 7) : full;
  if (el) {
    el.textContent = '버전 ' + short;
    let tip = '이 화면이 어느 배포본인지 확인할 때 쓰는 짧은 표시입니다.';
    if (fromModule) {
      tip = '지금 브라우저가 불러온 파일 기준 표시입니다.';
    } else if (fromSnippet) {
      tip = '임웹에 넣은 스니펫 기준 표시입니다.';
    }
    if (mismatch) {
      tip =
        '붙여 넣은 스니펫과 실제로 불러온 파일이 다를 수 있습니다. 담당자에게 맞춤을 요청하세요.';
    }
    el.setAttribute('title', tip);
    el.removeAttribute('hidden');
  }
  if (m) {
    m.setAttribute('data-cdn-commit', full);
  }
}

const mount = ensureShell();
stampCdnBuild_();
const scope = mount != null ? mount : document;

const statusLine = /** @type {HTMLElement | null} */ (scope.querySelector('#sp-statusLine'));
const hintLine = /** @type {HTMLElement | null} */ (scope.querySelector('#sp-hintLine'));
const envChip = /** @type {HTMLElement | null} */ (scope.querySelector('#sp-envChip'));
const btnSync = /** @type {HTMLButtonElement | null} */ (scope.querySelector('#sp-btnSync'));
const confirmInput = /** @type {HTMLInputElement | null} */ (scope.querySelector('#sp-confirm'));
const actionNote = /** @type {HTMLElement | null} */ (scope.querySelector('#sp-actionNote'));
const loadingOverlay = /** @type {HTMLElement | null} */ (scope.querySelector('#sp-loadingOverlay'));
const btnManualSync = /** @type {HTMLButtonElement | null} */ (scope.querySelector('#sp-btnManualSync'));
const successActions = /** @type {HTMLElement | null} */ (scope.querySelector('#sp-successActions'));
const sheetsLink = /** @type {HTMLAnchorElement | null} */ (scope.querySelector('#sp-sheetsLink'));
const syncHeadAggregate = /** @type {HTMLAnchorElement | null} */ (scope.querySelector('#sp-syncLinkAggregate'));
const feedback = /** @type {HTMLElement | null} */ (scope.querySelector('#sp-feedback'));

let syncBusy = false;

function wireTabs_() {
  if (!mount) {
    return;
  }
  const tHome = mount.querySelector('#sp-tab-home');
  const tSync = mount.querySelector('#sp-tab-sync');
  const tPm = mount.querySelector('#sp-tab-pm');
  const tAn = mount.querySelector('#sp-tab-an');
  const pHome = mount.querySelector('#sp-panel-home');
  const pSync = mount.querySelector('#sp-panel-sync');
  const pPm = mount.querySelector('#sp-panel-pm');
  const pAn = mount.querySelector('#sp-panel-an');
  if (!tHome || !tSync || !tPm || !tAn || !pHome || !pSync || !pPm || !pAn) {
    return;
  }
  const introSync = /** @type {HTMLElement | null} */ (mount.querySelector('#sp-introSync'));
  const introPm = /** @type {HTMLElement | null} */ (mount.querySelector('#sp-introPm'));
  const introAn = /** @type {HTMLElement | null} */ (mount.querySelector('#sp-introAn'));
  function hideIntroAll_() {
    if (introSync) {
      introSync.setAttribute('hidden', '');
      introSync.setAttribute('aria-hidden', 'true');
    }
    if (introPm) {
      introPm.setAttribute('hidden', '');
      introPm.setAttribute('aria-hidden', 'true');
    }
    if (introAn) {
      introAn.setAttribute('hidden', '');
      introAn.setAttribute('aria-hidden', 'true');
    }
  }
  function setIntroTab_(which) {
    hideIntroAll_();
    if (which === 'home') {
      /* 홈: 헤더 안내 카드 없음(메뉴얼은 #sp-homeManualRoot에 추후 작성) */
    } else if (which === 'pm' && introPm) {
      introPm.removeAttribute('hidden');
      introPm.setAttribute('aria-hidden', 'false');
    } else if (which === 'an' && introAn) {
      introAn.removeAttribute('hidden');
      introAn.setAttribute('aria-hidden', 'false');
    } else if (which === 'sync' && introSync) {
      introSync.removeAttribute('hidden');
      introSync.setAttribute('aria-hidden', 'false');
    }
  }
  function deactivateAllTabs_() {
    tHome.classList.remove('is-active');
    tHome.setAttribute('aria-selected', 'false');
    tHome.tabIndex = -1;
    tSync.classList.remove('is-active');
    tSync.setAttribute('aria-selected', 'false');
    tSync.tabIndex = -1;
    tPm.classList.remove('is-active');
    tPm.setAttribute('aria-selected', 'false');
    tPm.tabIndex = -1;
    tAn.classList.remove('is-active');
    tAn.setAttribute('aria-selected', 'false');
    tAn.tabIndex = -1;
    pHome.classList.remove('is-active');
    pHome.setAttribute('hidden', '');
    pSync.classList.remove('is-active');
    pSync.setAttribute('hidden', '');
    pPm.classList.remove('is-active');
    pPm.setAttribute('hidden', '');
    pAn.classList.remove('is-active');
    pAn.setAttribute('hidden', '');
  }
  function activateHome() {
    deactivateAllTabs_();
    tHome.classList.add('is-active');
    tHome.setAttribute('aria-selected', 'true');
    tHome.tabIndex = 0;
    pHome.classList.add('is-active');
    pHome.removeAttribute('hidden');
    setIntroTab_('home');
  }
  function activateSync() {
    deactivateAllTabs_();
    tSync.classList.add('is-active');
    tSync.setAttribute('aria-selected', 'true');
    tSync.tabIndex = 0;
    pSync.classList.add('is-active');
    pSync.removeAttribute('hidden');
    setIntroTab_('sync');
  }
  function activatePm() {
    deactivateAllTabs_();
    tPm.classList.add('is-active');
    tPm.setAttribute('aria-selected', 'true');
    tPm.tabIndex = 0;
    pPm.classList.add('is-active');
    pPm.removeAttribute('hidden');
    setIntroTab_('pm');
  }
  function activateAn() {
    deactivateAllTabs_();
    tAn.classList.add('is-active');
    tAn.setAttribute('aria-selected', 'true');
    tAn.tabIndex = 0;
    pAn.classList.add('is-active');
    pAn.removeAttribute('hidden');
    setIntroTab_('an');
  }
  tHome.addEventListener('click', activateHome);
  tSync.addEventListener('click', activateSync);
  tPm.addEventListener('click', activatePm);
  tAn.addEventListener('click', activateAn);
  activateHome();
}

function setChip(text, kind) {
  if (!envChip) {
    return;
  }
  envChip.textContent = text;
  envChip.classList.remove('chip--ok', 'chip--err', 'chip--soft');
  if (kind === 'ok') {
    envChip.classList.add('chip--ok');
  } else if (kind === 'err') {
    envChip.classList.add('chip--err');
  } else {
    envChip.classList.add('chip--soft');
  }
}

function syncFeedbackBlock_() {
  if (!feedback) {
    return;
  }
  const tMain = statusLine && statusLine.textContent.trim();
  const tSub = hintLine && hintLine.textContent.trim();
  const hasLink = Boolean(
    successActions && !successActions.hasAttribute('hidden') && sheetsLink && !sheetsLink.hasAttribute('hidden')
  );
  if (tMain || tSub || hasLink) {
    feedback.removeAttribute('hidden');
  } else {
    feedback.setAttribute('hidden', '');
  }
}

function setStatus(text) {
  if (statusLine) {
    statusLine.textContent = text;
  }
  syncFeedbackBlock_();
}

function setHint(text) {
  if (hintLine) {
    hintLine.textContent = text;
  }
  syncFeedbackBlock_();
}

/**
 * @param {boolean} on
 */
function setLoading(on) {
  if (loadingOverlay) {
    if (on) {
      loadingOverlay.removeAttribute('hidden');
      loadingOverlay.setAttribute('aria-hidden', 'false');
      loadingOverlay.setAttribute('aria-busy', 'true');
    } else {
      loadingOverlay.setAttribute('hidden', '');
      loadingOverlay.setAttribute('aria-hidden', 'true');
      loadingOverlay.removeAttribute('aria-busy');
    }
  }
  if (btnSync) {
    if (on) {
      btnSync.setAttribute('aria-busy', 'true');
    } else {
      btnSync.removeAttribute('aria-busy');
    }
  }
  if (btnManualSync) {
    btnManualSync.disabled = on;
    if (on) {
      btnManualSync.setAttribute('aria-busy', 'true');
    } else {
      btnManualSync.removeAttribute('aria-busy');
    }
  }
}

function confirmOk() {
  return Boolean(confirmInput && confirmInput.value.trim() === SYNC_CONFIRM);
}

function refreshSyncButtonState() {
  if (!btnSync) {
    return;
  }
  if (!GAS_MODE.canSync) {
    btnSync.disabled = true;
    if (confirmInput) {
      confirmInput.disabled = true;
    }
    return;
  }
  if (confirmInput) {
    confirmInput.disabled = false;
  }
  btnSync.disabled = syncBusy || !confirmOk();
}

/**
 * 데이터 동기화 탭 상단 — 동기화 대상 스프레드시트만. 실행 완료 후 피드백의 링크와 별개.
 * @param {string|undefined} url
 */
function setSyncAggregateHeadLink(url) {
  if (!syncHeadAggregate) {
    return;
  }
  const u = String(url != null ? url : '').trim();
  if (u.length > 0 && (u.indexOf('http://') === 0 || u.indexOf('https://') === 0)) {
    syncHeadAggregate.href = u;
    syncHeadAggregate.removeAttribute('hidden');
  } else {
    syncHeadAggregate.setAttribute('hidden', '');
    syncHeadAggregate.removeAttribute('href');
    syncHeadAggregate.setAttribute('href', '#');
  }
}

/**
 * 동기화 완료 메시지 블록 — 드라이브에서 보기 (같은 URL)
 * @param {string|undefined} url
 */
function showSheetsButton(url) {
  if (!sheetsLink || !successActions) {
    return;
  }
  const u = String(url != null ? url : '').trim();
  if (u.length > 0 && (u.indexOf('http://') === 0 || u.indexOf('https://') === 0)) {
    sheetsLink.href = u;
    sheetsLink.removeAttribute('hidden');
    successActions.removeAttribute('hidden');
  } else {
    sheetsLink.setAttribute('hidden', '');
    sheetsLink.href = '#';
    successActions.setAttribute('hidden', '');
  }
  syncFeedbackBlock_();
}

function hideSheetsButton() {
  if (sheetsLink) {
    sheetsLink.setAttribute('hidden', '');
    sheetsLink.removeAttribute('href');
    sheetsLink.setAttribute('href', '#');
  }
  if (successActions) {
    successActions.setAttribute('hidden', '');
  }
  syncFeedbackBlock_();
}

/**
 * GAS `TextOutput`에는 CORS(setHeader)가 없고, `fetch`는 응답 CORS를 요구 → JSONP로 동일 출처·크로스 오리진 모두 JS만 실행
 * @param {string} baseUrl
 * @param {string} action
 * @param {number} timeoutMs
 * @returns {Promise<Object>}
 */
function gasJsonp_(baseUrl, action, timeoutMs) {
  return new Promise(function (resolve, reject) {
    const cb =
      '_solpath_jp_' + String(Date.now()) + '_' + String(Math.floor(Math.random() * 1e9));
    const lim = timeoutMs != null ? timeoutMs : 360000;
    const t = window.setTimeout(function () {
      cleanup();
      reject(new Error('timeout'));
    }, lim);
    const s = document.createElement('script');
    const g = globalThis;
    function cleanup() {
      window.clearTimeout(t);
      try {
        delete g[cb];
      } catch (_e) {
        g[cb] = undefined;
      }
      if (s.parentNode) {
        s.parentNode.removeChild(s);
      }
    }
    g[cb] = function (/** @type {object} */ data) {
      cleanup();
      resolve(data);
    };
    let u;
    try {
      u = new URL(baseUrl);
    } catch (_e) {
      cleanup();
      reject(new Error('bad url'));
      return;
    }
    u.searchParams.set('format', 'jsonp');
    u.searchParams.set('callback', cb);
    u.searchParams.set('action', action);
    s.async = true;
    s.src = u.toString();
    s.onerror = function () {
      cleanup();
      reject(new Error('script error'));
    };
    document.head.appendChild(s);
  });
}

async function postSyncOpenFull() {
  const url = String(GAS_BASE_URL).trim();
  if (!url || !btnSync || !confirmOk()) {
    return;
  }
  syncBusy = true;
  refreshSyncButtonState();
  hideSheetsButton();
  setLoading(true);
  setStatus('솔루션편입(아임웹) 연동 데이터를 읽어 팀 구글 드라이브에 반영하는 중입니다. 완료까지 수 분 걸릴 수 있습니다.');
  setHint('');
  setChip('처리', 'soft');

  try {
    const j = await gasJsonp_(url, syncAction, 360000);
    if (!j.ok) {
      setChip('실패', 'err');
      const err = j.error != null ? String(j.error) : 'ERROR';
      const msg = j.message != null ? String(j.message) : '';
      if (err === 'SYNC_FAILED') {
        setStatus('처리가 끝나지 않았습니다. ' + (msg || '드라이브에 남은 내용을 확인한 뒤 담당자에게 알려 주세요.'));
      } else {
        setStatus('처리를 마치지 못했습니다. ' + (msg || '같은 증상이면 담당자에게 문의해 주세요.'));
      }
      setHint('');
      return;
    }

    setChip('완료', 'ok');
    const d = j.data || {};
    const m = d.members;
    const p = d.products;
    const o = d.orders;
    setStatus(
      '처리가 완료되었습니다. 반영 건수 — 회원 ' +
        (m && m.rows != null ? m.rows : '—') +
        ' · 상품 ' +
        (p && p.rows != null ? p.rows : '—') +
        ' · 주문 ' +
        (o && o.orderRows != null ? o.orderRows : '—') +
        ' · 주문 품목 ' +
        (o && o.itemRows != null ? o.itemRows : '—') +
        '. 아래 「드라이브에서 보기」로 파일을 열어 확인하세요.'
    );
    const sheetUrl = d.spreadsheetUrl != null ? String(d.spreadsheetUrl).trim() : '';
    if (sheetUrl) {
      setSyncAggregateHeadLink(sheetUrl);
      showSheetsButton(sheetUrl);
      setHint('');
    } else {
      hideSheetsButton();
      setHint('구글 드라이브 주소를 받지 못했습니다. 담당자에게 문의해 주세요.');
    }
  } catch (e) {
    setChip('오류', 'err');
    setStatus('요청이 완료되지 않았습니다. 인터넷 연결을 확인한 뒤 「실행」을 다시 눌러 주세요.');
    setHint('');
  } finally {
    syncBusy = false;
    setLoading(false);
    refreshSyncButtonState();
  }
}

async function postManualSync_() {
  const url = String(GAS_BASE_URL).trim();
  if (!url || !btnManualSync || !GAS_MODE.canSync) {
    return;
  }
  const ok = window.confirm(
    '원천 DB → 운영 DB(누락만 추가) → 집계 DB(02 재구축) 순서로 최신화합니다.\n\n' +
      '없으면 새로 만들지 않으며, 중간에 실패하면 그 단계에서 멈춥니다.\n진행할까요?'
  );
  if (!ok) {
    return;
  }
  setLoading(true);
  setChip('처리', 'soft');
  setStatus('수동 동기화 시작…');
  setHint('');
  try {
    console.log('[manualSync] start');
    setStatus('원천 DB 동기화 중…');
    const r1 = await gasJsonp_(url, 'syncMasterNow', 360000);
    console.log('[manualSync] syncMasterNow response:', r1);
    if (!r1 || !r1.ok) {
      console.error('[manualSync] syncMasterNow failed:', r1);
      setChip('실패', 'err');
      setStatus('원천 DB 동기화를 완료하지 못했습니다.');
      setHint(r1 && (r1.message || (r1.error && r1.error.message) || r1.error) ? String(r1.message || (r1.error && r1.error.message) || r1.error) : '');
      return;
    }
    setStatus('운영 DB 갱신 중…(누락 상품만 추가)');
    const r2 = await gasJsonp_(url, 'operationsMappingUpsertMissing', 180000);
    console.log('[manualSync] operationsMappingUpsertMissing response:', r2);
    if (!r2 || !r2.ok) {
      console.error('[manualSync] operationsMappingUpsertMissing failed:', r2);
      setChip('실패', 'err');
      setStatus('운영 DB 갱신을 완료하지 못했습니다.');
      setHint(r2 && (r2.message || (r2.error && r2.error.message) || r2.error) ? String(r2.message || (r2.error && r2.error.message) || r2.error) : '');
      return;
    }
    setStatus('집계 DB 갱신 중…(02 재구축)');
    const r3 = await gasJsonp_(url, 'analyticsRebuild02', 360000);
    console.log('[manualSync] analyticsRebuild02 response:', r3);
    if (!r3 || !r3.ok) {
      console.error('[manualSync] analyticsRebuild02 failed:', r3);
      setChip('실패', 'err');
      setStatus('집계 DB 갱신을 완료하지 못했습니다.');
      setHint(r3 && (r3.message || (r3.error && r3.error.message) || r3.error) ? String(r3.message || (r3.error && r3.error.message) || r3.error) : '');
      return;
    }
    setChip('완료', 'ok');
    const c1 = r1 && r1.data ? r1.data : {};
    const c2 = r2 && r2.data ? r2.data : {};
    const c3 = r3 && r3.data ? r3.data : {};
    setStatus(
      '수동 동기화를 완료했습니다. (원천: 회원 ' +
        (c1.membersRows != null ? c1.membersRows : '—') +
        ' · 상품 ' +
        (c1.productsRows != null ? c1.productsRows : '—') +
        ' · 주문 ' +
        (c1.ordersRows != null ? c1.ordersRows : '—') +
        ' · 품목 ' +
        (c1.itemsRows != null ? c1.itemsRows : '—') +
        ') (운영: 추가 ' +
        (c2.inserted != null ? c2.inserted : '—') +
        ') (집계02: 기록 ' +
        (c3.written != null ? c3.written : '—') +
        ')'
    );
    setHint('');
    console.log('[manualSync] done');
  } catch (e) {
    console.error('[manualSync] exception:', e);
    setChip('오류', 'err');
    setStatus('수동 동기화 요청이 완료되지 않았습니다.');
    setHint(e && e.message != null ? String(e.message) : '');
  } finally {
    setLoading(false);
  }
}

function wireSync() {
  if (!btnSync) {
    return;
  }
  if (confirmInput) {
    const onIn = function () {
      refreshSyncButtonState();
    };
    confirmInput.addEventListener('input', onIn);
    confirmInput.addEventListener('paste', onIn);
  }
  if (!GAS_MODE.canSync) {
    btnSync.disabled = true;
    if (confirmInput) {
      confirmInput.disabled = true;
    }
    if (actionNote) {
      actionNote.textContent =
        '상단이 「연결됨」이 아니면 이 화면을 쓸 수 없습니다. 담당자에게 문의해 주세요.';
    }
    return;
  }
  refreshSyncButtonState();
  if (actionNote) {
    actionNote.textContent =
      '「실행」을 누를 때마다, 지금 시점의 솔루션편입(아임웹) 데이터로 이 탭에서 쓰는 구글 드라이브 파일을 통째로 다시 맞춥니다. 수 분 걸릴 수 있습니다.';
  }
  btnSync.addEventListener('click', function onSync() {
    postSyncOpenFull();
  });
}

function wireManualSync_() {
  if (!btnManualSync) {
    return;
  }
  if (!GAS_MODE.canSync || GAS_MODE.useMock) {
    btnManualSync.disabled = true;
    return;
  }
  btnManualSync.disabled = false;
  btnManualSync.addEventListener('click', function () {
    postManualSync_();
  });
}

async function main() {
  if (!mount) {
    setChip('오류', 'err');
    return;
  }
  wireTabs_();
  initProductMapping(mount);
  const anApi = initAnalytics(mount);
  hideSheetsButton();
  setSyncAggregateHeadLink('');
  if (GAS_MODE.useMock) {
    setChip('연결 안 됨', 'soft');
    setStatus('연결 프로그램과 연결되지 않았습니다. 담당자에게 문의해 주세요.');
    setHint('');
    wireSync();
    return;
  }
  setChip('연결됨', 'ok');
  setStatus('');
  setHint('');
  wireSync();
  wireManualSync_();
  try {
    const url = String(GAS_BASE_URL).trim();
    const st = await gasJsonp_(url, 'productMappingState', 60000);
    if (st && st.ok && st.data) {
      const d = st.data;
      const mu = d.masterSpreadsheetUrl != null ? String(d.masterSpreadsheetUrl).trim() : '';
      setSyncAggregateHeadLink(mu);
      if (mount) {
        applyProductMappingHeaderUrls(mount, d);
        if (anApi && typeof anApi.applyStateFromData === 'function') {
          anApi.applyStateFromData(d);
        }
      }
    }
  } catch (_e) {
    /* 링크 없이 동기화 탭만 사용 */
  }
}

main().catch((e) => {
  setChip('오류', 'err');
  setStatus('화면을 불러오지 못했습니다. 페이지를 새로 고침한 뒤 다시 시도해 주세요.');
});
