/**
 * 상품 항목 분류 — GAS JSONP (productMappingState|List|init|Apply)
 */
import { GAS_BASE_URL, GAS_MODE } from './config.js';

const CAT_ORDER = ['unmapped', 'solpass', 'solutine', 'challenge', 'textbook', 'jasoseo'];
/** 미분류(unmapped) 제외 — 솔패스~자소서(한 행 래핑) */
const CAT_ROW4 = CAT_ORDER.filter(function (c) {
  return c !== 'unmapped';
});
const CAT_LABEL = {
  unmapped: '미분류',
  solpass: '솔패스',
  solutine: '솔루틴',
  challenge: '챌린지',
  textbook: '교재',
  jasoseo: '자소서'
};
const LIFE_LABEL = { active: '진행', archived: '만료', test: '테스트', legacy: '(구)상품' };
/** @type {Record<string, true>} */
const _PM_LIFE_SET = (function () {
  const o = Object.create(null);
  Object.keys(LIFE_LABEL).forEach(function (k) {
    o[k] = true;
  });
  return o;
})();
/** @type {Record<string, true>} */
const _PM_CAT_SET = (function () {
  const o = Object.create(null);
  for (let i = 0; i < CAT_ORDER.length; i++) {
    o[CAT_ORDER[i]] = true;
  }
  return o;
})();

/**
 * 시트·API에 허용 밖의 값(오타·옛날 키)이 오면, `<select>`에 `selected`가 없어
 * 브라우저는 맨 앞(진행)만 보여 주는데 `localRows`는 그대로라 저장이 실패할 수 있음.
 * 목록·DOM·전송을 모두 이 값으로 맞춤.
 * @param {unknown} x
 * @return {string}
 */
function normalizePmCategory_(x) {
  const s = String(x != null ? x : '').trim() || 'unmapped';
  return _PM_CAT_SET[s] ? s : 'unmapped';
}

/**
 * @param {unknown} x
 * @return {string}
 */
function normalizePmLifecycle_(x) {
  const s = String(x != null ? x : '').trim() || 'active';
  return _PM_LIFE_SET[s] ? s : 'active';
}

const NAME_MAX = 20;

/**
 * @param {string|undefined} s
 */
function displayNameShort(s) {
  const t = s != null ? String(s) : '';
  if (t.length <= NAME_MAX) {
    return t;
  }
  return t.slice(0, NAME_MAX) + '…';
}

/**
 * @param {string|undefined} s
 */
function escAttr(s) {
  return String(s != null ? s : '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

/**
 * GAS JSONP
 * @param {string} baseUrl
 * @param {string} action
 * @param {Record<string, string> | null} extraParams
 * @param {number} timeoutMs
 * @returns {Promise<Object>}
 */
function gasJsonpWithParams(baseUrl, action, extraParams, timeoutMs) {
  return new Promise(function (resolve, reject) {
    const cb = '_sp_pm_' + String(Date.now()) + '_' + String(Math.floor(Math.random() * 1e9));
    const lim = timeoutMs != null ? timeoutMs : 120000;
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
    if (extraParams) {
      Object.keys(extraParams).forEach(function (k) {
        u.searchParams.set(k, extraParams[k]);
      });
    }
    s.async = true;
    s.src = u.toString();
    s.onerror = function () {
      cleanup();
      reject(new Error('script error'));
    };
    document.head.appendChild(s);
  });
}

/**
 * URL 길이 제한(브라우저/프록시) — 안전을 위해 5000자 이하씩.
 * @param {string} baseUrl
 * @param {Object[]} allRows
 * @param {number} maxEncLen
 */
async function productMappingApplyBatched_(baseUrl, allRows, maxEncLen) {
  let i = 0;
  while (i < allRows.length) {
    let n;
    for (n = 1; n <= allRows.length - i; n++) {
      if (encodeURIComponent(JSON.stringify({ rows: allRows.slice(i, i + n) })).length > maxEncLen) {
        break;
      }
    }
    n -= 1;
    if (n < 1) {
      n = 1;
    }
    const chunk = allRows.slice(i, i + n);
    const r = await gasJsonpWithParams(
      baseUrl,
      'productMappingApply',
      { payload: JSON.stringify({ rows: chunk }) },
      120000
    );
    if (!r || !r.ok) {
      return r;
    }
    i += n;
  }
  return { ok: true, data: { upserted: allRows.length } };
}

/**
 * @param {unknown} n
 * @return {string}
 */
function pmRowKey_(n) {
  return String(n != null ? n : '').trim();
}

/**
 * @param {object} r
 */
function rowSig(r) {
  return [
    pmRowKey_(r.prod_no),
    String(r.internal_category != null ? r.internal_category : '').trim(),
    String(r.lifecycle != null ? r.lifecycle : '').trim(),
    r.product_name,
    r.notes != null ? String(r.notes) : ''
  ].join('\t');
}

/**
 * 상품 항목 분류 탭 전용 — 분류용 스프레드시트 URL만 반영. 동기화(원본) 링크는 넣지 않음.
 * @param {HTMLElement} mount
 * @param {Record<string, unknown>} d
 */
export function applyProductMappingHeaderUrls(mount, d) {
  const ext = mount.querySelector('#sp-pm-external');
  const lo = /** @type {HTMLAnchorElement | null} */ (mount.querySelector('#sp-pm-linkOps'));
  if (!ext || !lo) {
    return;
  }
  const ops = d && d.operationsSpreadsheetUrl ? String(d.operationsSpreadsheetUrl).trim() : '';
  if (ops && /^https?:\/\//i.test(ops)) {
    lo.href = ops;
    lo.removeAttribute('hidden');
    ext.removeAttribute('hidden');
  } else {
    lo.setAttribute('hidden', '');
    lo.removeAttribute('href');
    ext.setAttribute('hidden', '');
  }
}

/**
 * @param {HTMLElement} mount
 */
export function initProductMapping(mount) {
  const el = {
    init: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-pm-init')),
    btnInit: /** @type {HTMLButtonElement | null} */ (mount.querySelector('#sp-pm-btnInit')),
    filters: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-pm-filters')),
    sections: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-pm-sections')),
    apply: /** @type {HTMLButtonElement | null} */ (mount.querySelector('#sp-pm-apply')),
    listLoading: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-pm-listLoading')),
    hint: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-pm-hint')),
    search: /** @type {HTMLInputElement | null} */ (mount.querySelector('#sp-pm-search')),
    onlyUnmapped: /** @type {HTMLInputElement | null} */ (mount.querySelector('#sp-pm-onlyUnmapped')),
    footerNote: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-pm-footerNote')),
    instruct: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-pm-instruct')),
    external: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-pm-external')),
    linkOps: /** @type {HTMLAnchorElement | null} */ (mount.querySelector('#sp-pm-linkOps')),
    btnReset: /** @type {HTMLButtonElement | null} */ (mount.querySelector('#sp-pm-reset')),
    resetNote: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-pm-resetNote'))
  };
  if (!el.init || !el.sections) {
    return;
  }

  let localRows = [];
  let baselineSig = new Map();
  let ready = false;
  let loadStateInflight = false;
  const url = String(GAS_BASE_URL).trim();

  function setHint(t, show) {
    if (!el.hint) {
      return;
    }
    el.hint.textContent = t || '';
    if (show) {
      el.hint.removeAttribute('hidden');
    } else {
      el.hint.setAttribute('hidden', '');
    }
  }

  function updateExternalLinks(d) {
    applyProductMappingHeaderUrls(mount, d);
  }

  function recomputeDirty() {
    let dirty = false;
    for (let i = 0; i < localRows.length; i++) {
      const r = localRows[i];
      const k = pmRowKey_(r.prod_no);
      if (rowSig(r) !== baselineSig.get(k)) {
        dirty = true;
        break;
      }
    }
    if (el.apply) {
      el.apply.disabled = !dirty || !ready;
      if (!ready) {
        el.apply.title = '목록을 불러온 뒤 사용할 수 있습니다.';
      } else if (!dirty) {
        el.apply.title = '대분류·상태를 바꾼 뒤 누르면 구글 쪽에 반영됩니다.';
      } else {
        el.apply.removeAttribute('title');
      }
    }
  }

  function snapshotBaseline() {
    baselineSig = new Map();
    for (let i = 0; i < localRows.length; i++) {
      const r = localRows[i];
      baselineSig.set(pmRowKey_(r.prod_no), rowSig(r));
    }
    recomputeDirty();
  }

  function getFilteredRows() {
    let r = localRows.slice();
    const q = el.search && el.search.value ? el.search.value.trim().toLowerCase() : '';
    if (q) {
      r = r.filter(function (x) {
        return (
          String(x.prod_no).indexOf(q) >= 0 ||
          String(x.product_name || '')
            .toLowerCase()
            .indexOf(q) >= 0
        );
      });
    }
    if (el.onlyUnmapped && el.onlyUnmapped.checked) {
      r = r.filter(function (x) {
        return x.internal_category === 'unmapped';
      });
    }
    return r;
  }

  function render() {
    if (!el.sections) {
      return;
    }
    if (!ready) {
      return;
    }
    const byCat = {};
    CAT_ORDER.forEach(function (c) {
      byCat[c] = [];
    });
    const list = getFilteredRows();
    const testRows = [];
    for (let i = 0; i < list.length; i++) {
      const row = list[i];
      if (String(row.lifecycle != null ? row.lifecycle : '').trim() === 'test') {
        testRows.push(row);
        continue;
      }
      const c = CAT_ORDER.indexOf(row.internal_category) >= 0 ? row.internal_category : 'unmapped';
      byCat[c].push(row);
    }
    const counts = {};
    let nTestAll = 0;
    for (let c = 0; c < localRows.length; c++) {
      const lr = localRows[c];
      if (String(lr.lifecycle != null ? lr.lifecycle : '').trim() === 'test') {
        nTestAll++;
        continue;
      }
      const k = lr.internal_category;
      const key = CAT_ORDER.indexOf(k) >= 0 ? k : 'unmapped';
      counts[key] = (counts[key] || 0) + 1;
    }
    const parts = [];

    function pushOneRowHtml(row2) {
      const nameShort = displayNameShort(row2.product_name);
      const full = row2.product_name != null ? String(row2.product_name) : '';
      const rowPk = pmRowKey_(row2.prod_no);
      const dataIdx = localRows.findIndex(function (x) {
        return pmRowKey_(x.prod_no) === rowPk;
      });
      const selCat = buildSelectCat(dataIdx, row2.internal_category);
      const selLife = buildSelectLife(dataIdx, row2.lifecycle);
      const catN = normalizePmCategory_(row2.internal_category);
      const lifeN = normalizePmLifecycle_(row2.lifecycle);
      let rowLifeClass = '';
      if (catN !== 'unmapped') {
        if (lifeN === 'archived') {
          rowLifeClass = ' sp-pm-row--life-archived';
        } else if (lifeN === 'legacy') {
          rowLifeClass = ' sp-pm-row--life-legacy';
        }
      }
      parts.push(
        '<div class="sp-pm-row' +
          rowLifeClass +
          '" data-prod-no="' +
          String(row2.prod_no) +
          '"><span class="sp-pm-row__no">' +
          escAttr(String(row2.prod_no)) +
          '</span><span class="sp-pm-row__name" title="' +
          escAttr(full) +
          '">' +
          escAttr(nameShort) +
          '</span>' +
          selCat +
          selLife +
          '</div>'
      );
    }

    function pushOneCategory(cat) {
      const label = CAT_LABEL[cat] || cat;
      const n = byCat[cat] ? byCat[cat].length : 0;
      const openAttr = cat === 'unmapped' ? ' open' : '';
      const badge = (counts[cat] != null ? counts[cat] : 0) + '개';
      parts.push(
        '<details class="sp-pm-cat sp-pm-cat--' +
          escAttr(cat) +
          '"' +
          openAttr +
          ' data-cat="' +
          escAttr(cat) +
          '"><summary class="sp-pm-cat__sum"><span class="sp-pm-cat__title">' +
          escAttr(label) +
          '</span><span class="sp-pm-cat__badge">' +
          escAttr(badge) +
          '</span> <span class="sp-pm-cat__n">' +
          n +
          '개 표시</span></summary><div class="sp-pm-cat__body">'
      );
      const rows2 = byCat[cat] || [];
      for (let r = 0; r < rows2.length; r++) {
        pushOneRowHtml(rows2[r]);
      }
      if (!rows2.length) {
        parts.push('<p class="sp-pm-empty">조건에 맞는 항목이 없습니다.</p>');
      }
      parts.push('</div></details>');
    }

    parts.push('<div class="sp-pm-cat-block sp-pm-cat-block--unmapped">');
    pushOneCategory('unmapped');
    parts.push('</div><div class="sp-pm-cat-row" role="presentation">');
    for (let f = 0; f < CAT_ROW4.length; f++) {
      pushOneCategory(CAT_ROW4[f]);
    }
    parts.push('</div>');

    if (nTestAll > 0) {
      const nT = testRows.length;
      const openTest = nT > 0 ? ' open' : '';
      parts.push('<div class="sp-pm-cat-block sp-pm-cat-block--lifecycle-test">');
      parts.push(
        '<details class="sp-pm-cat sp-pm-cat--lifecycle-test"' +
          openTest +
          ' data-cat="lifecycle-test"><summary class="sp-pm-cat__sum"><span class="sp-pm-cat__title">상태·테스트' +
          '</span><span class="sp-pm-cat__badge">' +
          escAttr(String(nTestAll) + '개') +
          '</span> <span class="sp-pm-cat__n">' +
          nT +
          '개 표시</span></summary><div class="sp-pm-cat__body">'
      );
      for (let tr = 0; tr < testRows.length; tr++) {
        pushOneRowHtml(testRows[tr]);
      }
      if (!testRows.length) {
        parts.push('<p class="sp-pm-empty">조건에 맞는 항목이 없습니다.</p>');
      }
      parts.push('</div></details></div>');
    }

    el.sections.innerHTML = parts.join('');
    el.sections.querySelectorAll('select.sp-pm-sel--cat').forEach(function (se) {
      se.addEventListener('change', onSelectChange);
    });
    el.sections.querySelectorAll('select.sp-pm-sel--life').forEach(function (se) {
      se.addEventListener('change', onSelectChange);
    });
    syncPmSelectsFromDom_();
  }

  /**
   * 렌더 직후: 실제 select 값을 모델에 다시 씀(선택·표시 불일치 방지)
   */
  function syncPmSelectsFromDom_() {
    if (!el.sections) {
      return;
    }
    el.sections.querySelectorAll('select.sp-pm-sel--cat').forEach(function (se) {
      const idx = parseInt(String(se.getAttribute('data-idx') != null ? se.getAttribute('data-idx') : ''), 10);
      if (isNaN(idx) || idx < 0 || !localRows[idx]) {
        return;
      }
      localRows[idx].internal_category = normalizePmCategory_(se.value);
    });
    el.sections.querySelectorAll('select.sp-pm-sel--life').forEach(function (se) {
      const idx = parseInt(String(se.getAttribute('data-idx') != null ? se.getAttribute('data-idx') : ''), 10);
      if (isNaN(idx) || idx < 0 || !localRows[idx]) {
        return;
      }
      localRows[idx].lifecycle = normalizePmLifecycle_(se.value);
    });
  }

  function buildSelectCat(dataIdx, val) {
    const v = val != null ? String(val).trim() : '';
    const opts = [];
    for (let i = 0; i < CAT_ORDER.length; i++) {
      const c = CAT_ORDER[i];
      const selected = c === v ? ' selected' : '';
      opts.push(
        '<option value="' + escAttr(c) + '"' + selected + '>' + escAttr(CAT_LABEL[c] || c) + '</option>'
      );
    }
    return (
      '<label class="sp-pm-sel__wrap"><span class="visually-hidden">대분류</span><select class="sp-pm-sel sp-pm-sel--cat" data-idx="' +
      dataIdx +
      '">' +
      opts.join('') +
      '</select></label>'
    );
  }

  function buildSelectLife(dataIdx, val) {
    const v = val != null ? String(val).trim() : '';
    const lifeKeys = Object.keys(LIFE_LABEL);
    const opts = [];
    for (let i = 0; i < lifeKeys.length; i++) {
      const l = lifeKeys[i];
      const selected = l === v ? ' selected' : '';
      opts.push(
        '<option value="' + escAttr(l) + '"' + selected + '>' + escAttr(LIFE_LABEL[l]) + '</option>'
      );
    }
    return (
      '<label class="sp-pm-sel__wrap"><span class="visually-hidden">상태</span><select class="sp-pm-sel sp-pm-sel--life" data-idx="' +
      dataIdx +
      '">' +
      opts.join('') +
      '</select></label>'
    );
  }

  /**
   * @param {Event} ev
   */
  function onSelectChange(ev) {
    const t = ev.target;
    if (!(t instanceof HTMLSelectElement)) {
      return;
    }
    const idx = t.getAttribute('data-idx');
    if (idx == null) {
      return;
    }
    const i = parseInt(idx, 10);
    if (isNaN(i) || i < 0 || !localRows[i]) {
      return;
    }
    if (t.classList.contains('sp-pm-sel--cat')) {
      localRows[i].internal_category = normalizePmCategory_(t.value);
    } else {
      localRows[i].lifecycle = normalizePmLifecycle_(t.value);
    }
    recomputeDirty();
  }

  /**
   * @param {string} emsg
   */
  function syncFooterAndInstruct() {
    if (el.footerNote) {
      if (ready && el.filters && !el.filters.hasAttribute('hidden')) {
        el.footerNote.removeAttribute('hidden');
      } else {
        el.footerNote.setAttribute('hidden', '');
      }
    }
    if (el.instruct) {
      if (ready) {
        el.instruct.setAttribute('hidden', '');
      } else {
        el.instruct.removeAttribute('hidden');
      }
    }
    if (el.btnReset) {
      if (ready) {
        el.btnReset.removeAttribute('hidden');
      } else {
        el.btnReset.setAttribute('hidden', '');
      }
    }
    if (el.resetNote) {
      if (ready) {
        el.resetNote.removeAttribute('hidden');
      } else {
        el.resetNote.setAttribute('hidden', '');
      }
    }
  }

  function errMsg(emsg) {
    if (!emsg) {
      return '요청이 실패했습니다.';
    }
    if (emsg.error && typeof emsg.error === 'object' && emsg.error.code) {
      const c = String(emsg.error.code);
      if (c === 'PM_BAD_LIFECYCLE') {
        return emsg.error.message != null && String(emsg.error.message).length
          ? String(emsg.error.message)
          : '상태를 저장할 수 없습니다. 해당 줄에서 상태(진행·만료·테스트·(구)상품)를 다시 고른 뒤 저장하세요.';
      }
      if (c === 'PM_BAD_INTERNAL') {
        return emsg.error.message != null && String(emsg.error.message).length
          ? String(emsg.error.message)
          : '내부 대분류를 저장할 수 없습니다. 해당 줄에서 대분류를 다시 고른 뒤 저장하세요.';
      }
    }
    if (typeof emsg.error === 'string' && emsg.error.length) {
      return errMsgMapLegacyString_((emsg.message != null && String(emsg.message)) || emsg.error);
    }
    if (emsg.error && emsg.error.message) {
      return errMsgMapLegacyString_(String(emsg.error.message));
    }
    if (emsg.error && emsg.error.code) {
      return errMsgMapLegacyString_(String(emsg.error.code));
    }
    if (emsg.message) {
      return errMsgMapLegacyString_(String(emsg.message));
    }
    return '요청이 실패했습니다.';
  }

  /**
   * @param {string} t
   * @return {string}
   */
  function errMsgMapLegacyString_(t) {
    if (!t) {
      return t;
    }
    if (t.indexOf('lifecycle') >= 0 && t.indexOf('허용') >= 0) {
      return '상태를 저장할 수 없습니다. 해당 줄에서 상태를 다시 고른 뒤 저장하세요.';
    }
    if (t.indexOf('internal_category') >= 0 && t.indexOf('허용') >= 0) {
      return '내부 대분류를 저장할 수 없습니다. 해당 줄에서 대분류를 다시 고른 뒤 저장하세요.';
    }
    return t;
  }

  async function loadState() {
    if (!GAS_MODE.canSync) {
      setHint('상단 배지가 미연결이면 서버와 연결되지 않은 상태입니다. 내부 담당자에게 문의하세요.', true);
      updateExternalLinks({});
      return;
    }
    if (loadStateInflight) {
      return;
    }
    loadStateInflight = true;
    if (el.listLoading) {
      el.listLoading.removeAttribute('hidden');
    }
    setHint('', false);
    try {
      const st = await gasJsonpWithParams(url, 'productMappingState', null, 60000);
      if (!st || !st.ok) {
        setHint(errMsg(st), true);
        updateExternalLinks({});
        return;
      }
      const d = st.data || {};
      updateExternalLinks(d);
      ready = Boolean(d.ready);
      if (el.init) {
        if (!ready) {
          el.init.removeAttribute('hidden');
        } else {
          el.init.setAttribute('hidden', '');
        }
      }
      if (el.filters) {
        if (ready) {
          el.filters.removeAttribute('hidden');
        } else {
          el.filters.setAttribute('hidden', '');
        }
      }
      if (el.sections) {
        if (ready) {
          el.sections.removeAttribute('hidden');
        } else {
          el.sections.setAttribute('hidden', '');
        }
      }
      if (ready) {
        await loadList();
      }
      syncFooterAndInstruct();
    } catch (_e) {
      setHint('상태를 불러오지 못했습니다.', true);
      updateExternalLinks({});
    } finally {
      loadStateInflight = false;
      if (el.listLoading) {
        el.listLoading.setAttribute('hidden', '');
      }
    }
  }

  /**
   * @param {{ fromApply?: boolean }|undefined} opts
   */
  async function loadList(opts) {
    if (!GAS_MODE.canSync) {
      return;
    }
    const fromApply = opts && opts.fromApply;
    if (el.listLoading && !fromApply) {
      el.listLoading.removeAttribute('hidden');
    }
    setHint('', false);
    try {
      const res = await gasJsonpWithParams(url, 'productMappingList', null, 120000);
      if (!res || !res.ok) {
        if (res && res.error && (res.error.code === 'NO_OPERATIONS_SHEET' || res.error === 'NO_OPERATIONS_SHEET')) {
          ready = false;
          if (el.init) {
            el.init.removeAttribute('hidden');
          }
          if (el.filters) {
            el.filters.setAttribute('hidden', '');
          }
          if (el.sections) {
            el.sections.setAttribute('hidden', '');
            el.sections.innerHTML = '';
          }
          try {
            const stR = await gasJsonpWithParams(url, 'productMappingState', null, 30000);
            if (stR && stR.ok && stR.data) {
              updateExternalLinks(stR.data);
            }
          } catch (_s) {}
        }
        setHint(errMsg(res), true);
        syncFooterAndInstruct();
        return;
      }
      const rows = (res.data && res.data.rows) || [];
      localRows = JSON.parse(JSON.stringify(rows));
      for (let j = 0; j < localRows.length; j++) {
        const lr = localRows[j];
        lr.internal_category = normalizePmCategory_(lr.internal_category);
        lr.lifecycle = normalizePmLifecycle_(lr.lifecycle);
      }
      snapshotBaseline();
      try {
        render();
      } catch (re) {
        const em = re && re.message != null ? String(re.message) : String(re);
        setHint('목록 화면을 그리지 못했습니다. ' + em, true);
        syncFooterAndInstruct();
        return;
      }
      syncFooterAndInstruct();
    } catch (_e) {
      const em = _e && _e.message != null ? String(_e.message) : String(_e);
      setHint('목록을 불러오지 못했습니다. ' + (em.length > 120 ? em.slice(0, 120) + '…' : em), true);
      syncFooterAndInstruct();
    } finally {
      if (el.listLoading && !fromApply) {
        el.listLoading.setAttribute('hidden', '');
      }
    }
  }

  function pmDelay_(ms) {
    return new Promise(function (res) {
      window.setTimeout(res, ms);
    });
  }

  async function onInit() {
    if (!GAS_MODE.canSync) {
      return;
    }
    if (el.btnInit) {
      el.btnInit.disabled = true;
    }
    if (el.listLoading) {
      el.listLoading.removeAttribute('hidden');
    }
    setHint('', false);
    try {
      const r = await gasJsonpWithParams(url, 'initOperationsSheets', null, 120000);
      if (!r || !r.ok) {
        setHint(errMsg(r), true);
        syncFooterAndInstruct();
        return;
      }
      ready = true;
      if (el.init) {
        el.init.setAttribute('hidden', '');
      }
      if (el.filters) {
        el.filters.removeAttribute('hidden');
      }
      if (el.sections) {
        el.sections.removeAttribute('hidden');
      }
      try {
        const stNew = await gasJsonpWithParams(url, 'productMappingState', null, 30000);
        if (stNew && stNew.ok && stNew.data) {
          updateExternalLinks(stNew.data);
        }
      } catch (_s) {}
      await loadList();
      const dInit = r.data || {};
      const nSeeded = dInit.seededRowCount != null ? Number(dInit.seededRowCount) : 0;
      if (nSeeded > 0) {
        setHint(
          '동기화 쪽 상품 목록을 기준으로, 상품 분류용 드라이브에 상품 ' +
            nSeeded +
            '건을 넣었습니다. 구글 드라이브에서도 확인하세요.',
          true
        );
        syncFooterAndInstruct();
      }
    } catch (_e) {
      setHint('구글 쪽 파일을 만들지 못했습니다.', true);
      syncFooterAndInstruct();
    } finally {
      if (el.btnInit) {
        el.btnInit.disabled = false;
      }
      if (el.listLoading) {
        el.listLoading.setAttribute('hidden', '');
      }
    }
  }

  async function onApply() {
    if (!el.apply || el.apply.disabled) {
      return;
    }
    syncPmSelectsFromDom_();
    const dirty = [];
    for (let i = 0; i < localRows.length; i++) {
      const r = localRows[i];
      if (rowSig(r) !== baselineSig.get(pmRowKey_(r.prod_no))) {
        const pn = r.prod_no;
        const pnum = typeof pn === 'number' && !isNaN(pn) ? pn : parseInt(String(pn), 10);
        const ic0 = normalizePmCategory_(r.internal_category);
        const lf0 = normalizePmLifecycle_(r.lifecycle);
        dirty.push({
          prod_no: isNaN(pnum) ? pn : pnum,
          product_name: r.product_name,
          internal_category: ic0,
          lifecycle: lf0,
          notes: r.notes != null ? String(r.notes) : ''
        });
      }
    }
    if (!dirty.length) {
      return;
    }
    el.apply.disabled = true;
    if (el.listLoading) {
      el.listLoading.removeAttribute('hidden');
    }
    if (el.sections) {
      el.sections.classList.add('sp-pm-sections--saving');
    }
    setHint('', false);
    const tSaveStart = Date.now();
    const minSavingMs = 500;
    try {
      const r = await productMappingApplyBatched_(url, dirty, 5000);
      if (!r || !r.ok) {
        setHint(errMsg(r) || '저장 실패', true);
        return;
      }
      await loadList({ fromApply: true });
      const rem = minSavingMs - (Date.now() - tSaveStart);
      if (rem > 0) {
        await pmDelay_(rem);
      }
      setHint('저장했습니다.', true);
    } catch (_e) {
      setHint('저장 중 오류가 났습니다.', true);
    } finally {
      if (el.sections) {
        el.sections.classList.remove('sp-pm-sections--saving');
      }
      if (el.listLoading) {
        el.listLoading.setAttribute('hidden', '');
      }
      recomputeDirty();
    }
  }

  async function onReset() {
    if (!GAS_MODE.canSync || !ready) {
      return;
    }
    const ok = window.confirm(
      '「상품 매핑(분류)」에 적어 둔 내용을 비우고, 데이터 동기화에 올라와 있는 상품 목록만 보고 다시 채웁니다.\n\n' +
        '지금까지 바꾼 분류·상태는 복구할 수 없습니다. 정말 진행할까요?'
    );
    if (!ok) {
      return;
    }
    if (el.btnReset) {
      el.btnReset.disabled = true;
    }
    if (el.listLoading) {
      el.listLoading.removeAttribute('hidden');
    }
    setHint('', false);
    try {
      const r = await gasJsonpWithParams(url, 'productMappingReset', null, 120000);
      if (!r || !r.ok) {
        setHint(errMsg(r), true);
        syncFooterAndInstruct();
        return;
      }
      const n = r.data && r.data.seededRowCount != null ? Number(r.data.seededRowCount) : 0;
      await loadList();
      setHint(
        '초기화했습니다. 동기화 목록 기준 ' + n + '건 · 기본값은 미분류·진행으로 맞춤.',
        true
      );
      syncFooterAndInstruct();
    } catch (e) {
      const m = e && e.message != null ? String(e.message) : '';
      let t = '초기화 요청에 실패했습니다. ';
      if (m === 'timeout') {
        t += '응답이 너무 오래 걸렸습니다. 잠시 뒤 다시 시도합니다.';
      } else if (m === 'script error') {
        t += '서버 응답이 비정상입니다. 잠시 후 다시 시도하거나 내부 담당자에게 문의하세요.';
      } else {
        t += m ? '(' + m + ')' : '네트워크 또는 스크립트 로딩을 확인합니다.';
      }
      setHint(t, true);
      syncFooterAndInstruct();
    } finally {
      if (el.btnReset) {
        el.btnReset.disabled = false;
      }
      if (el.listLoading) {
        el.listLoading.setAttribute('hidden', '');
      }
    }
  }

  if (el.btnInit) {
    el.btnInit.addEventListener('click', function () {
      onInit();
    });
  }
  if (el.apply) {
    el.apply.addEventListener('click', onApply);
  }
  if (el.btnReset) {
    el.btnReset.addEventListener('click', function () {
      onReset();
    });
  }
  if (el.search) {
    el.search.addEventListener('input', function () {
      render();
    });
  }
  if (el.onlyUnmapped) {
    el.onlyUnmapped.addEventListener('change', function () {
      render();
    });
  }

  const tPm = mount.querySelector('#sp-tab-pm');
  if (tPm) {
    tPm.addEventListener('click', function () {
      window.setTimeout(function () {
        if (tPm.classList.contains('is-active')) {
          loadState();
        }
      }, 0);
    });
  }
}
