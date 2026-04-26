/**
 * 매출·구매 인원(품목 줄) 지표 — GAS JSONP
 */
import { GAS_BASE_URL, GAS_MODE } from './config.js';
import { aggregateFactRows, daysInMonth, lineCountsByMonthCategoryYear, startOfBlockWeekInMonth } from './analyticsVizModule.js';

const SCOPE_LABEL = { category: '대분류', product: '상품' };

/** 시트·API용 영문 키 → 표에만 한글 (저장 값은 그대로) */
const AN_CATEGORY_KEY_LABEL = {
  unmapped: '미분류',
  solpass: '솔패스',
  solutine: '솔루틴',
  challenge: '챌린지',
  textbook: '교재',
  jasoseo: '자소서'
};

/**
 * @param {string} scope
 * @param {string} key
 */
function displayScopeValueForTable_(scope, key) {
  const k = String(key != null ? key : '').trim();
  if (!k.length) {
    return '—';
  }
  if (String(scope) === 'product') {
    return '상품 번호 ' + k;
  }
  return AN_CATEGORY_KEY_LABEL[k] != null ? AN_CATEGORY_KEY_LABEL[k] : k;
}

/**
 * GAS JSONP (쿼리 파라미터)
 * @param {string} baseUrl
 * @param {string} action
 * @param {Record<string, string> | null} extraParams
 * @param {number} timeoutMs
 * @returns {Promise<Object>}
 */
function gasJsonpWithParams(baseUrl, action, extraParams, timeoutMs) {
  return new Promise(function (resolve, reject) {
    const cb = '_sp_an_' + String(Date.now()) + '_' + String(Math.floor(Math.random() * 1e9));
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
 * @param {string} baseUrl
 * @param {Object[]} rows
 * @param {number} maxEncLen
 */
async function analyticsTargetsApplyBatched_(baseUrl, rows, maxEncLen) {
  const all = rows || [];
  let i = 0;
  while (i < all.length) {
    let n;
    for (n = 1; n <= all.length - i; n++) {
      if (encodeURIComponent(JSON.stringify({ rows: all.slice(i, i + n) })).length > maxEncLen) {
        break;
      }
    }
    n -= 1;
    if (n < 1) {
      n = 1;
    }
    const chunk = all.slice(i, i + n);
    const r = await gasJsonpWithParams(
      baseUrl,
      'analyticsTargetsApply',
      { payload: JSON.stringify({ rows: chunk }) },
      120000
    );
    if (!r || !r.ok) {
      return r;
    }
    i += n;
  }
  return { ok: true, data: { written: all.length } };
}

/**
 * @param {unknown} r
 */
function errMsg_(r) {
  if (!r) {
    return '응답이 없습니다.';
  }
  if (typeof r.error === 'string' && r.error.length) {
    if (r.error === 'UNKNOWN_ACTION') {
      return '서버(웹앱)가 아직 이 요청을 모릅니다. Apps Script를 최신 코드로 다시 배포했는지 확인해 주세요.';
    }
    return r.error;
  }
  var msg = '';
  if (r.error && typeof r.error === 'object') {
    if (r.error.code === 'UNKNOWN_ACTION' || r.error.message === 'UNKNOWN_ACTION') {
      return '서버(웹앱)가 아직 이 요청을 모릅니다. Apps Script를 최신 코드로 다시 배포했는지 확인해 주세요.';
    }
    if (r.error.message) {
      msg = String(r.error.message);
    }
  } else if (r.message) {
    msg = String(r.message);
  }
  if (!msg) {
    return '';
  }
  if (msg.indexOf('원천 DB') >= 0 || msg.indexOf('SHEETS_MASTER') >= 0 || (msg.indexOf('Drive') >= 0 && msg.indexOf('부모') >= 0)) {
    return '먼저 「데이터 동기화」에서 한 번 실행한 뒤, 다시 눌러 주세요.';
  }
  return msg;
}

/**
 * @param {string} action
 * @param {object|null} result
 * @param {Error|unknown} [caught]
 */
function logSolpathApi_(action, result, caught) {
  const payload = { action: action, ok: result && result.ok === true };
  if (result && !result.ok) {
    payload.error = result.error;
    payload.message = result.message;
    payload.body = result;
  }
  if (caught != null) {
    const e = /** @type {Error} */ (caught);
    payload.caught = e && e.message != null ? e.message : String(caught);
  }
  if (typeof console !== 'undefined' && console.error) {
    console.error('[솔루션편입·API]', payload);
  }
}

/**
 * @param {object|null|undefined} r
 */
function formatHintWithErrorCode_(r) {
  var m = errMsg_(r) || '요청이 완료되지 않았습니다.';
  if (r && r.error && typeof r.error === 'object' && r.error.code) {
    m += ' [코드: ' + String(r.error.code) + ']';
  }
  return m;
}

/**
 * @param {{ filterY: HTMLSelectElement | null, filterM: HTMLSelectElement | null }} elP
 * @return {{ y: number, m: number }}
 */
function getAnFilterYm_(elP) {
  const yNow = new Date().getFullYear();
  const mNow = new Date().getMonth() + 1;
  if (!elP.filterY || !elP.filterM) {
    return { y: yNow, m: mNow };
  }
  const y = parseInt(String(elP.filterY.value), 10);
  const m = parseInt(String(elP.filterM.value), 10);
  return {
    y: isFinite(y) ? y : yNow,
    m: isFinite(m) && m >= 0 && m <= 12 ? m : mNow
  };
}

/**
 * @param {number} n
 * @return {string}
 */
function fmtKrw_(n) {
  if (!isFinite(n)) {
    return '—';
  }
  return n.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
}

/**
 * @param {number} n
 * @return {string}
 */
function fmtInt_(n) {
  if (!isFinite(n)) {
    return '—';
  }
  return n.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
}

/**
 * @param {HTMLElement} mount
 * @param {Record<string, unknown>} d
 */
export function applyAnalyticsHeaderUrls(mount, d) {
  const ext = mount.querySelector('#sp-an-external');
  const lo = /** @type {HTMLAnchorElement | null} */ (mount.querySelector('#sp-an-linkSheet'));
  const btnR = /** @type {HTMLButtonElement | null} */ (mount.querySelector('#sp-an-btnRepair'));
  if (!ext) {
    return;
  }
  const u =
    d && d.analyticsSpreadsheetUrl != null ? String(d.analyticsSpreadsheetUrl).trim() : '';
  const hasUrl = Boolean(d && d.analyticsReady === true && u && /^https?:\/\//i.test(u));
  if (lo) {
    if (hasUrl) {
      lo.href = u;
      lo.removeAttribute('hidden');
    } else {
      lo.setAttribute('hidden', '');
      lo.removeAttribute('href');
    }
  }
  if (btnR) {
    if (d && d.analyticsReady === true) {
      btnR.removeAttribute('hidden');
    } else {
      btnR.setAttribute('hidden', '');
    }
  }
  if (d && d.analyticsReady === true) {
    ext.removeAttribute('hidden');
  } else {
    ext.setAttribute('hidden', '');
  }
}

/**
 * @param {Record<string, unknown>} r
 * @return {object}
 */
function rowToPayload_(r) {
  const y = Math.floor(Number(r.year));
  const mo = Math.floor(Number(r.month));
  const sc = String(r.scope != null ? r.scope : '').trim();
  const sk = String(r.scopeKey != null ? r.scopeKey : r.scope_key != null ? r.scope_key : '').trim();
  const gt0 = String(r.goal_target != null ? r.goal_target : '').trim();
  const goalTarget = gt0 || sk;
  return {
    year: y,
    month: mo,
    goal_target: goalTarget,
    scope: sc === 'product' ? 'product' : 'category',
    scopeKey: sk,
    targetAmount: Math.max(0, Number(r.targetAmount != null ? r.targetAmount : r.target_amount != null ? r.target_amount : 0)),
    targetCount: Math.max(0, Number(r.targetCount != null ? r.targetCount : r.target_count != null ? r.target_count : 0)),
    notes: r.notes != null ? String(r.notes) : '',
    updatedAt: new Date().toISOString()
  };
}

/**
 * @param {HTMLElement} mount
 */
export function initAnalytics(mount) {
  const el = {
    init: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-an-init')),
    body: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-an-body')),
    actuals: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-an-actuals')),
    valSales: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-an-valSales')),
    valOrders: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-an-valOrders')),
    pctSales: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-an-pctSales')),
    pctOrders: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-an-pctOrders')),
    meterSales: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-an-meterSales')),
    meterOrders: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-an-meterOrders')),
    actRow2Title: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-an-actRow2Title')),
    actRow2Sub: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-an-actRow2Sub')),
    actRow2LblA: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-an-actRow2LblA')),
    actRow2LblB: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-an-actRow2LblB')),
    actRow2ValA: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-an-actRow2ValA')),
    actRow2ValB: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-an-actRow2ValB')),
    actualsWarn: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-an-actualsWarn')),
    btnInit: /** @type {HTMLButtonElement | null} */ (mount.querySelector('#sp-an-btnInit')),
    hint: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-an-hint')),
    loading: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-an-loading')),
    tbody: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-an-tbody')),
    subSales: /** @type {HTMLButtonElement | null} */ (mount.querySelector('#sp-an-subSales')),
    subCount: /** @type {HTMLButtonElement | null} */ (mount.querySelector('#sp-an-subCount')),
    subLede: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-an-subLede')),
    table: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-an-table')),
    tableWrap: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-an-tableWrap')),
    filterY: /** @type {HTMLSelectElement | null} */ (mount.querySelector('#sp-an-filterY')),
    filterM: /** @type {HTMLSelectElement | null} */ (mount.querySelector('#sp-an-filterM')),
    inY: /** @type {HTMLInputElement | null} */ (mount.querySelector('#sp-an-inY')),
    inM: /** @type {HTMLSelectElement | null} */ (mount.querySelector('#sp-an-inM')),
    inScope: /** @type {HTMLSelectElement | null} */ (mount.querySelector('#sp-an-inScope')),
    inKey: /** @type {HTMLInputElement | null} */ (mount.querySelector('#sp-an-inKey')),
    inAmt: /** @type {HTMLInputElement | null} */ (mount.querySelector('#sp-an-inAmt')),
    inCnt: /** @type {HTMLInputElement | null} */ (mount.querySelector('#sp-an-inCnt')),
    inNotes: /** @type {HTMLInputElement | null} */ (mount.querySelector('#sp-an-inNotes')),
    btnAdd: /** @type {HTMLButtonElement | null} */ (mount.querySelector('#sp-an-btnAdd')),
    btnSave: /** @type {HTMLButtonElement | null} */ (mount.querySelector('#sp-an-btnSave')),
    btnReset: /** @type {HTMLButtonElement | null} */ (mount.querySelector('#sp-an-btnReset')),
    btnRepair: /** @type {HTMLButtonElement | null} */ (mount.querySelector('#sp-an-btnRepair')),
    viz: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-an-viz')),
    vizPeriodMeta: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-an-vizPeriodMeta')),
    vizScope: /** @type {HTMLSelectElement | null} */ (mount.querySelector('#sp-an-vizScope')),
    vizScopeStrip: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-an-vizScopeStrip')),
    vizScroll: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-an-vizScroll')),
    vizLede: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-an-vizLede')),
    vizWarn: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-an-vizWarn')),
    people: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-an-people')),
    peopleY: /** @type {HTMLInputElement | null} */ (mount.querySelector('#sp-an-peopleY')),
    peopleM: /** @type {HTMLSelectElement | null} */ (mount.querySelector('#sp-an-peopleM')),
    peopleLede: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-an-peopleLede')),
    peopleWarn: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-an-peopleWarn')),
    peopleGrid: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-an-peopleGrid')),
    peopleMatrix: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-an-peopleMatrix')),
    peopleYearDetails: /** @type {HTMLDetailsElement | null} */ (
      mount.querySelector('#sp-an-peopleYearDetails')
    ),
    ol: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-an-ol')),
    olScroll: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-an-olScroll')),
    olWarn: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-an-olWarn'))
  };
  if (!el.init || !el.body) {
    return;
  }

  const url = String(GAS_BASE_URL).trim();
  let localRows = /** @type {object[]} */ ([]);
  let subMode = 'sales';
  let ready = false;
  /** @type {number|undefined} */
  let persistTimer = undefined;
  let _vizReport = /** @type {Record<string, unknown>|null} */ (null);
  let _vizRows = /** @type {Object[]|null} */ (null);
  let _vizY = 0;
  let _vizM = 0;
  let _peopleYearRows = /** @type {Object[]|null} */ (null);
  let _peopleY = 0;
  /** @type {{ y: number, m: number, d: Record<string, unknown> } | null} */
  let _lastMasterActuals = null;
  /** @type {number|null} 마스터 주문 기준(서버 productMappingState) */
  let _boundsMinYear = null;
  /** @type {number|null} */
  let _boundsMaxYear = null;

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

  function buildMonthOptions_(sel) {
    if (!sel) {
      return;
    }
    sel.innerHTML = '';
    const o0 = document.createElement('option');
    o0.value = '';
    o0.textContent = '전체';
    sel.appendChild(o0);
    const z = document.createElement('option');
    z.value = '0';
    z.textContent = '0(연간)';
    sel.appendChild(z);
    for (let m = 1; m <= 12; m++) {
      const o = document.createElement('option');
      o.value = String(m);
      o.textContent = String(m) + '월';
      sel.appendChild(o);
    }
  }

  function buildInMonth_(sel) {
    if (!sel) {
      return;
    }
    sel.innerHTML = '';
    const z = document.createElement('option');
    z.value = '0';
    z.textContent = '0(연간)';
    sel.appendChild(z);
    for (let m = 1; m <= 12; m++) {
      const o = document.createElement('option');
      o.value = String(m);
      o.textContent = String(m) + '월';
      sel.appendChild(o);
    }
  }

  buildInMonth_(el.inM);

  const yNow = new Date().getFullYear();
  if (el.inY) {
    el.inY.value = String(yNow);
  }
  if (el.inM) {
    const mo = new Date().getMonth() + 1;
    el.inM.value = String(mo);
  }
  if (el.inAmt) {
    el.inAmt.value = '0';
  }
  if (el.inCnt) {
    el.inCnt.value = '0';
  }

  function setSubMode(mode) {
    subMode = mode;
    if (el.subSales && el.subCount) {
      if (mode === 'count') {
        el.subSales.classList.remove('is-active');
        el.subSales.setAttribute('aria-selected', 'false');
        el.subSales.tabIndex = -1;
        el.subCount.classList.add('is-active');
        el.subCount.setAttribute('aria-selected', 'true');
        el.subCount.tabIndex = 0;
        if (el.subLede) {
          el.subLede.textContent = '같은 표에서 건수 칸이 더 잘 보이게 켠 상태입니다.';
        }
        if (el.table) {
          el.table.classList.remove('sp-an-table--mode-sales');
          el.table.classList.add('sp-an-table--mode-count');
        }
      } else {
        el.subCount.classList.remove('is-active');
        el.subCount.setAttribute('aria-selected', 'false');
        el.subCount.tabIndex = -1;
        el.subSales.classList.add('is-active');
        el.subSales.setAttribute('aria-selected', 'true');
        el.subSales.tabIndex = 0;
        if (el.subLede) {
          el.subLede.textContent = '같은 표에서 매출(원) 칸이 더 잘 보이게 켠 상태입니다.';
        }
        if (el.table) {
          el.table.classList.remove('sp-an-table--mode-count');
          el.table.classList.add('sp-an-table--mode-sales');
        }
      }
    }
  }

  if (el.subSales) {
    el.subSales.addEventListener('click', function () {
      setSubMode('sales');
    });
  }
  if (el.subCount) {
    el.subCount.addEventListener('click', function () {
      setSubMode('count');
    });
  }
  setSubMode('sales');

  function goalKeyEntire_(row) {
    return String(row.goal_target != null ? row.goal_target : row.scopeKey != null ? row.scopeKey : '')
      .trim()
      .toLowerCase();
  }

  /**
   * @param {number} y
   * @param {number} m
   * @return {object|null}
   */
  function findEntireTargetRowForYm_(y, m) {
    for (let i = 0; i < localRows.length; i++) {
      const row = localRows[i];
      if (Math.floor(Number(row.year)) !== y || Math.floor(Number(row.month)) !== m) {
        continue;
      }
      if (goalKeyEntire_(row) === 'entire') {
        return row;
      }
    }
    return null;
  }

  function fmtKrwDash0_(n) {
    if (!isFinite(n) || n === 0) {
      return '—';
    }
    return fmtKrw_(n);
  }

  function fmtIntDash0_(n) {
    if (!isFinite(n) || n === 0) {
      return '—';
    }
    return fmtInt_(n);
  }

  /**
   * @param {unknown} v
   * @return {number|null}
   */
  function parseTargetNum_(v) {
    if (v == null || v === '') {
      return null;
    }
    const n = Number(v);
    return isFinite(n) ? n : null;
  }

  /**
   * @param {HTMLElement | null} elP
   * @param {HTMLElement | null} elFill
   * @param {number} actual
   * @param {number} baseline
   */
  function applyMeterPct_(elP, elFill, actual, baseline) {
    if (!elFill) {
      return;
    }
    if (!elP) {
      elFill.style.width = '0%';
      return;
    }
    elP.textContent = '';
    elP.classList.remove('sp-an-card__pct--up', 'sp-an-card__pct--down');
    if (!isFinite(actual) || !isFinite(baseline) || baseline <= 0) {
      elFill.style.width = '0%';
      return;
    }
    const ratio = Math.min(1, actual / baseline);
    elFill.style.width = ratio * 70 + '%';
    const delta = ((actual - baseline) / baseline) * 100;
    elP.textContent = (delta >= 0 ? '(+' : '(-') + Math.abs(delta).toFixed(1) + '%)';
    elP.classList.add(delta >= 0 ? 'sp-an-card__pct--up' : 'sp-an-card__pct--down');
  }

  function paintActualsCompareUi_() {
    if (
      !el.valSales ||
      !el.valOrders ||
      !el.pctSales ||
      !el.pctOrders ||
      !el.meterSales ||
      !el.meterOrders ||
      !el.actRow2Title ||
      !el.actRow2Sub ||
      !el.actRow2LblA ||
      !el.actRow2LblB ||
      !el.actRow2ValA ||
      !el.actRow2ValB
    ) {
      return;
    }
    if (!_lastMasterActuals) {
      el.valSales.textContent = '—';
      el.valOrders.textContent = '—';
      el.pctSales.textContent = '';
      el.pctOrders.textContent = '';
      el.pctSales.classList.remove('sp-an-card__pct--up', 'sp-an-card__pct--down');
      el.pctOrders.classList.remove('sp-an-card__pct--up', 'sp-an-card__pct--down');
      el.meterSales.style.width = '0%';
      el.meterOrders.style.width = '0%';
      el.actRow2Title.textContent = '이번 기간 목표';
      el.actRow2Sub.textContent = '';
      el.actRow2Sub.setAttribute('hidden', '');
      el.actRow2LblA.textContent = '매출 목표(원)';
      el.actRow2LblB.textContent = '주문 목표(건)';
      el.actRow2ValA.textContent = '—';
      el.actRow2ValB.textContent = '—';
      return;
    }
    const yv = _lastMasterActuals.y;
    const mv = _lastMasterActuals.m;
    const d = _lastMasterActuals.d;
    const pv =
      d.prevYear && typeof d.prevYear === 'object' ? /** @type {Record<string, unknown>} */ (d.prevYear) : {};
    const actS = Number(d.actualSales);
    const actO = Number(d.orderCount);
    const tgtRow = findEntireTargetRowForYm_(yv, mv);
    let baseS = NaN;
    let baseO = NaN;
    if (tgtRow) {
      const ts0 = parseTargetNum_(tgtRow.targetAmount);
      const to0 = parseTargetNum_(tgtRow.targetCount);
      baseS = ts0 != null ? ts0 : NaN;
      baseO = to0 != null ? to0 : NaN;
    } else {
      baseS = Number(pv.actualSales);
      baseO = Number(pv.orderCount);
    }
    el.valSales.textContent = isFinite(actS) ? fmtKrw_(actS) : '—';
    el.valOrders.textContent = isFinite(actO) ? fmtInt_(actO) : '—';

    const showBarS = isFinite(actS) && isFinite(baseS) && baseS > 0;
    const showBarO = isFinite(actO) && isFinite(baseO) && baseO > 0;
    if (!showBarS) {
      el.pctSales.textContent = '';
      el.pctSales.classList.remove('sp-an-card__pct--up', 'sp-an-card__pct--down');
      el.meterSales.style.width = '0%';
    } else {
      applyMeterPct_(el.pctSales, el.meterSales, actS, baseS);
    }
    if (!showBarO) {
      el.pctOrders.textContent = '';
      el.pctOrders.classList.remove('sp-an-card__pct--up', 'sp-an-card__pct--down');
      el.meterOrders.style.width = '0%';
    } else {
      applyMeterPct_(el.pctOrders, el.meterOrders, actO, baseO);
    }

    if (tgtRow) {
      el.actRow2Title.textContent = '이번 기간 목표';
      el.actRow2Sub.textContent = '';
      el.actRow2Sub.setAttribute('hidden', '');
      el.actRow2LblA.textContent = '매출 목표(원)';
      el.actRow2LblB.textContent = '주문 목표(건)';
      const ts = parseTargetNum_(tgtRow.targetAmount);
      const to = parseTargetNum_(tgtRow.targetCount);
      el.actRow2ValA.textContent = ts != null && ts > 0 ? fmtKrw_(ts) : '—';
      el.actRow2ValB.textContent = to != null && to > 0 ? fmtInt_(to) : '—';
    } else {
      el.actRow2Title.textContent = '전년 동월 실적';
      const py = pv.year != null ? Number(pv.year) : yv - 1;
      const pm = pv.month != null ? Number(pv.month) : mv;
      let sub = '';
      if (pm === 0) {
        sub = py + '년(연간)';
      } else {
        sub = py + '년 ' + pm + '월';
      }
      el.actRow2Sub.textContent = sub;
      el.actRow2Sub.removeAttribute('hidden');
      el.actRow2LblA.textContent = '실제 매출(원)';
      el.actRow2LblB.textContent = '주문 건수';
      el.actRow2ValA.textContent = fmtKrwDash0_(Number(pv.actualSales));
      el.actRow2ValB.textContent = fmtIntDash0_(Number(pv.orderCount));
    }
  }

  /**
   * @return {Promise<Object|null>}
   */
  async function persistToDrive_() {
    if (!GAS_MODE.canSync || !ready) {
      return null;
    }
    const out = localRows.map(function (x) {
      return rowToPayload_(x);
    });
    return await analyticsTargetsApplyBatched_(url, out, 5000);
  }

  function schedulePersist_() {
    if (persistTimer != null) {
      window.clearTimeout(/** @type {number} */ (persistTimer));
    }
    persistTimer = window.setTimeout(function () {
      persistTimer = undefined;
      persistToDrive_()
        .then(function (r) {
          if (!r || !r.ok) {
            setHint('드라이브에 반영하지 못했습니다.「지금 드라이브에 다시 저장」을 누르세요.', true);
            return;
          }
          setHint('드라이브에 반영했습니다.', true);
          return loadTargets();
        })
        .catch(function () {
          setHint('드라이브에 반영하지 못했습니다.「지금 드라이브에 다시 저장」을 누르세요.', true);
        });
    }, 450);
  }

  function rebuildFilterYearMonth_() {
    const yNow0 = new Date().getFullYear();
    const mNow0 = new Date().getMonth() + 1;
    if (!el.filterY || !el.filterM) {
      if (GAS_MODE.canSync && !GAS_MODE.useMock) {
        void loadMasterActuals_();
      }
      void loadFactViz_();
      return;
    }
    const curYStr = el.filterY.value;
    const curMStr = el.filterM.value;
    const years = new Set();
    let yLo = yNow0;
    let yHi = yNow0;
    if (_boundsMinYear != null) {
      yLo = Math.min(yLo, _boundsMinYear);
    }
    if (_boundsMaxYear != null) {
      yHi = Math.max(yHi, _boundsMaxYear);
    }
    let yi0;
    for (yi0 = yLo; yi0 <= yHi; yi0++) {
      years.add(yi0);
    }
    years.add(yNow0);
    years.add(yNow0 - 1);
    for (let i = 0; i < localRows.length; i++) {
      const n = Math.floor(Number(localRows[i].year));
      if (isFinite(n)) {
        years.add(n);
      }
    }
    const yArr = Array.from(years)
      .filter(function (y) {
        return y >= 1990 && y <= yNow0 + 1;
      })
      .sort(function (a, b) {
        return a - b;
      });
    el.filterY.innerHTML = '';
    for (let yi = 0; yi < yArr.length; yi++) {
      const op = document.createElement('option');
      op.value = String(yArr[yi]);
      op.textContent = yArr[yi] + '년';
      el.filterY.appendChild(op);
    }
    let ySel = parseInt(curYStr, 10);
    if (!isFinite(ySel) || yArr.indexOf(ySel) < 0) {
      ySel = yNow0;
      if (yArr.indexOf(ySel) < 0 && yArr.length) {
        ySel = yArr[yArr.length - 1];
      }
    }
    el.filterY.value = String(ySel);
    const mSel = parseInt(curMStr, 10);
    if (!isFinite(mSel) || mSel < 0 || mSel > 12) {
      el.filterM.value = String(mNow0);
    } else {
      el.filterM.value = String(mSel);
    }
    if (GAS_MODE.canSync && !GAS_MODE.useMock) {
      void loadMasterActuals_();
    }
    void loadFactViz_();
  }

  function rowPassesFilter(r) {
    if (!el.filterY || !el.filterM) {
      return true;
    }
    const yf = parseInt(String(el.filterY.value), 10);
    const mf = parseInt(String(el.filterM.value), 10);
    if (!isFinite(yf) || !isFinite(mf)) {
      return true;
    }
    const yr = Math.floor(Number(r.year));
    const mr = Math.floor(Number(r.month));
    return yr === yf && mr === mf;
  }

  function esc(s) {
    return String(s != null ? s : '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function buildVizScopeOptions_(order) {
    if (!el.vizScope) {
      return;
    }
    const prev = el.vizScope.value;
    el.vizScope.innerHTML = '';
    const o0 = document.createElement('option');
    o0.value = 'entire';
    o0.textContent = '전체(사이트) — 대분류 행';
    el.vizScope.appendChild(o0);
    for (let si = 0; si < order.length; si++) {
      const ck = String(order[si]);
      const op = document.createElement('option');
      op.value = ck;
      const lab0 = AN_CATEGORY_KEY_LABEL[ck] != null ? AN_CATEGORY_KEY_LABEL[ck] : ck;
      op.textContent = ck === 'textbook' || ck === 'jasoseo' ? lab0 + ' (대분류만)' : lab0 + ' (상품 행·단 교재/자소서는 대분류만)';
      el.vizScope.appendChild(op);
    }
    if (Array.prototype.some.call(el.vizScope.options, function (o) { return o.value === prev; })) {
      el.vizScope.value = prev;
    } else {
      el.vizScope.value = 'entire';
    }
  }

  /**
   * 보기 범위(대분류/상품) 기준 — 표 상단에만 짧게 (상단 카드와 겹치지 않게 요약).
   * @param {Record<string, unknown>|null|undefined} report
   * @param {number} y
   * @param {number} m
   */
  function paintVizScopeStrip_(report, y, m) {
    if (!el.vizScopeStrip) {
      return;
    }
    if (!report || m < 1 || m > 12) {
      el.vizScopeStrip.innerHTML = '';
      return;
    }
    const sc = el.vizScope && el.vizScope.value && el.vizScope.value.length ? el.vizScope.value : 'entire';
    const goalKey = sc === 'entire' ? 'entire' : sc;
    let tgt = null;
    let ti;
    for (ti = 0; ti < localRows.length; ti++) {
      const row = localRows[ti] || {};
      if (Math.floor(Number(row.month)) !== m || Math.floor(Number(row.year)) !== y) {
        continue;
      }
      const g = String(row.goal_target != null ? row.goal_target : row.scopeKey != null ? row.scopeKey : '').trim();
      if (g === goalKey) {
        tgt = row;
        break;
      }
    }
    const cur0 = (report && report.current) || {};
    const mt = (cur0 && cur0.monthTotals) || {};
    const order0 = (report && report.categoryOrder) || [];
    let actualNet = 0;
    if (sc === 'entire') {
      for (let ci = 0; ci < order0.length; ci++) {
        const c = String(order0[ci]);
        const t0 = mt[c];
        if (t0) {
          actualNet += (t0.sales != null ? Number(t0.sales) : 0) - (t0.refund != null ? Number(t0.refund) : 0);
        }
      }
    } else {
      const t1 = mt[sc];
      if (t1) {
        actualNet = (t1.sales != null ? Number(t1.sales) : 0) - (t1.refund != null ? Number(t1.refund) : 0);
      }
    }
    const gSales = tgt != null && tgt.targetAmount != null && String(tgt.targetAmount).length ? Number(tgt.targetAmount) : null;
    const gCnt = tgt != null && tgt.targetCount != null && String(tgt.targetCount).length ? Number(tgt.targetCount) : null;
    const pyRoll = report && report.previousYear && report.previousYear.roll;
    const ptot = (pyRoll && pyRoll.monthTotals) || {};
    let prevNet = 0;
    if (sc === 'entire') {
      for (let pi = 0; pi < order0.length; pi++) {
        const c2 = String(order0[pi]);
        const t2 = ptot[c2];
        if (t2) {
          prevNet += (t2.sales != null ? Number(t2.sales) : 0) - (t2.refund != null ? Number(t2.refund) : 0);
        }
      }
    } else {
      const t3 = ptot[sc];
      if (t3) {
        prevNet = (t3.sales != null ? Number(t3.sales) : 0) - (t3.refund != null ? Number(t3.refund) : 0);
      }
    }
    const pAvail = report && report.previousYearDataAvailable === true;
    const pctG =
      gSales != null && isFinite(gSales) && gSales > 0
        ? ' · 달성률(순/목표) ' + ((actualNet / gSales) * 100).toFixed(1) + '%'
        : '';
    const tgtLine =
      '<strong>이 범위 목표</strong> 매출 ' +
      (gSales != null && isFinite(gSales) ? fmtKrw_(gSales) : '—') +
      (gCnt != null && isFinite(gCnt) ? ' · 건수 ' + fmtInt_(gCnt) : '') +
      pctG;
    const actLine = ' · <strong>이번 달 실제(순)</strong> ' + fmtKrw_(actualNet);
    let prevPart = '';
    if (pAvail && isFinite(prevNet)) {
      prevPart = ' · <strong>전년 동월(순)</strong> ' + fmtKrw_(prevNet);
      if (prevNet !== 0 && isFinite(actualNet)) {
        prevPart += ' (전년比 ' + (((actualNet - prevNet) / Math.abs(prevNet)) * 100).toFixed(1) + '%)';
      }
    } else {
      prevPart = ' · 전년 동월 데이터 없음';
    }
    el.vizScopeStrip.innerHTML = '<p class="sp-an-viz__scopeStrip-inner">' + tgtLine + actLine + prevPart + '.</p>';
  }

  /**
   * @param {Record<string, unknown>|null|undefined} report
   * @param {Object[]|null} factRows
   * @param {number} y
   * @param {number} m
   */
  function renderVizAll_(report, factRows, y, m) {
    if (!el.vizScroll) {
      return;
    }
    if (el.vizPeriodMeta) {
      el.vizPeriodMeta.textContent = m >= 1 && m <= 12 ? '· ' + y + '년 ' + m + '월' : '';
    }
    const cur = report && report.current;
    const byDay = (cur && cur.byDay) || {};
    const order = (report && report.categoryOrder) || [];
    if (!order.length) {
      el.vizScroll.innerHTML =
        '<p class="sp-an-viz__empty">대분류 데이터가 없어 표를 만들지 못했습니다. 집계가 비었거나 아직 만들어지지 않았을 수 있습니다.</p>';
      paintVizScopeStrip_(report, y, m);
      return;
    }
    const scp0 = (el.vizScope && el.vizScope.value) || 'entire';
    const daysN = daysInMonth(y, m);
    const names = (report && report.prodNameByNo) || {};
    const fr = factRows != null && factRows.length ? factRows : [];
    const aggP = fr.length ? aggregateFactRows(fr, y, m) : { byDayCat: {}, byDayProd: {} };
    const bdp = aggP.byDayProd != null ? aggP.byDayProd : {};
    let theadWeek = '<tr><th class="sp-an-viz__row-h sp-an-viz__whead" scope="col">주</th>';
    let theadDay = '<tr><th class="sp-an-viz__row-h sp-an-viz__dhead" scope="col">일</th>';
    let d;
    for (d = 1; d <= daysN; d++) {
      const wk = Math.ceil(d / 7);
      theadWeek += '<th class="sp-an-viz__whead" scope="col" title="' + m + '월 ' + wk + '주">' + wk + '주</th>';
      theadDay += '<th class="sp-an-viz__dhead" scope="col">' + d + '일</th>';
    }
    theadWeek += '<th class="sp-an-viz__sum-col" scope="col">월 합(순)</th></tr>';
    theadDay += '<th class="sp-an-viz__sum-col" scope="col">(순)</th></tr>';

    let tbody = '';
    function oneCatRow_(cat) {
      const c = String(cat);
      const label = AN_CATEGORY_KEY_LABEL[c] != null ? AN_CATEGORY_KEY_LABEL[c] : c;
      let rowSum = 0;
      let tds = '';
      for (d = 1; d <= daysN; d++) {
        const mm = m < 10 ? '0' + m : String(m);
        const dd = d < 10 ? '0' + d : String(d);
        const ymd = y + '-' + mm + '-' + dd;
        const slice = byDay[ymd] && byDay[ymd][c] ? byDay[ymd][c] : null;
        const sales0 = slice && slice.sales != null ? Number(slice.sales) : 0;
        const ref0 = slice && slice.refund != null ? Number(slice.refund) : 0;
        const net0 = sales0 - ref0;
        rowSum += net0;
        tds += '<td>' + (net0 !== 0 ? fmtKrw_(net0) : '0') + '</td>';
      }
      tds += '<td class="sp-an-viz__sum-col">' + fmtKrw_(rowSum) + '</td>';
      tbody += '<tr><th scope="row" class="sp-an-viz__row-lbl">' + esc(label) + '</th>' + tds + '</tr>';
    }
    if (scp0 === 'entire') {
      for (let ci = 0; ci < order.length; ci++) {
        oneCatRow_(order[ci]);
      }
    } else if (scp0 === 'textbook' || scp0 === 'jasoseo') {
      oneCatRow_(scp0);
    } else {
      const pset = /** @type {Record<string, boolean>} */ ({});
      for (d = 1; d <= daysN; d++) {
        const mm0 = m < 10 ? '0' + m : String(m);
        const dd0 = d < 10 ? '0' + d : String(d);
        const ymdX = y + '-' + mm0 + '-' + dd0;
        const bmap = bdp[ymdX] || {};
        var kyx;
        for (kyx in bmap) {
          if (Object.prototype.hasOwnProperty.call(bmap, kyx) && String(kyx).indexOf(scp0 + '\t') === 0) {
            pset[kyx] = true;
          }
        }
      }
      const pList = Object.keys(pset).sort();
      let pi2;
      for (pi2 = 0; pi2 < pList.length; pi2++) {
        const kpk = pList[pi2];
        const pno0 = kpk.indexOf('\t') >= 0 ? kpk.split('\t').slice(1).join('\t') : '';
        const labP = pno0 && names[pno0] != null && String(names[pno0]).length ? String(names[pno0]) : '상품 ' + pno0;
        let rowSumP = 0;
        let tdsP = '';
        for (d = 1; d <= daysN; d++) {
          const mm1 = m < 10 ? '0' + m : String(m);
          const dd1 = d < 10 ? '0' + d : String(d);
          const ymdP = y + '-' + mm1 + '-' + dd1;
          const slP = bdp[ymdP] && bdp[ymdP][kpk] ? bdp[ymdP][kpk] : null;
          const sP = slP && slP.sales != null ? Number(slP.sales) : 0;
          const rP = slP && slP.refund != null ? Number(slP.refund) : 0;
          const nP = sP - rP;
          rowSumP += nP;
          tdsP += '<td>' + (nP !== 0 ? fmtKrw_(nP) : '0') + '</td>';
        }
        tdsP += '<td class="sp-an-viz__sum-col">' + fmtKrw_(rowSumP) + '</td>';
        tbody += '<tr><th scope="row" class="sp-an-viz__row-lbl sp-an-viz__row-lbl--prod">↳ ' + esc(labP) + '</th>' + tdsP + '</tr>';
      }
      if (!pList.length) {
        tbody +=
          '<tr><th colspan="' +
          (daysN + 2) +
          '" class="sp-an-viz__empty">이 대분류에 잡힌 품목 줄이 이 달에 없습니다.</th></tr>';
      }
    }

    let rfd = '';
    let totalCol = 0;
    for (d = 1; d <= daysN; d++) {
      const mm2 = m < 10 ? '0' + m : String(m);
      const dd2 = d < 10 ? '0' + d : String(d);
      const ymd2 = y + '-' + mm2 + '-' + dd2;
      let dr = 0;
      if (scp0 === 'entire') {
        const cats0 = byDay[ymd2] || {};
        var ckey;
        for (ckey in cats0) {
          if (!Object.prototype.hasOwnProperty.call(cats0, ckey)) {
            continue;
          }
          const sl = cats0[ckey];
          dr += sl && sl.refund != null ? Number(sl.refund) : 0;
        }
      } else {
        const sl0 = (byDay[ymd2] && byDay[ymd2][scp0]) || {};
        dr = sl0 && sl0.refund != null ? Number(sl0.refund) : 0;
      }
      rfd += '<td>–' + fmtKrw_(dr) + '</td>';
      totalCol += dr;
    }
    rfd += '<td class="sp-an-viz__sum-col">–' + fmtKrw_(totalCol) + '</td>';
    tbody += '<tr class="sp-an-viz__row-refund"><th scope="row" class="sp-an-viz__row-lbl">환불(일 합)</th>' + rfd + '</tr>';

    const dailyNet = [];
    for (d = 1; d <= daysN; d++) {
      const mm3 = m < 10 ? '0' + m : String(m);
      const dd3 = d < 10 ? '0' + d : String(d);
      const ymd3 = y + '-' + mm3 + '-' + dd3;
      const cats1 = byDay[ymd3] || {};
      let sumNet = 0;
      if (scp0 === 'entire') {
        var ck2;
        for (ck2 in cats1) {
          if (!Object.prototype.hasOwnProperty.call(cats1, ck2)) {
            continue;
          }
          const s2 = cats1[ck2];
          const s2a = s2 && s2.sales != null ? Number(s2.sales) : 0;
          const s2b = s2 && s2.refund != null ? Number(s2.refund) : 0;
          sumNet += s2a - s2b;
        }
      } else {
        const s2a = (cats1[scp0] && cats1[scp0].sales != null) ? Number(cats1[scp0].sales) : 0;
        const s2b = (cats1[scp0] && cats1[scp0].refund != null) ? Number(cats1[scp0].refund) : 0;
        sumNet = s2a - s2b;
      }
      dailyNet.push(sumNet);
    }
    const mt = (cur && cur.monthTotals) || {};
    let monthGrand = 0;
    if (scp0 === 'entire') {
      for (let cj = 0; cj < order.length; cj++) {
        const catj = String(order[cj]);
        const t0 = mt[catj];
        if (t0) {
          const s3 = t0.sales != null ? Number(t0.sales) : 0;
          const r3 = t0.refund != null ? Number(t0.refund) : 0;
          monthGrand += s3 - r3;
        }
      }
    } else {
      const t4 = mt[scp0];
      if (t4) {
        monthGrand = (t4.sales != null ? Number(t4.sales) : 0) - (t4.refund != null ? Number(t4.refund) : 0);
      }
    }
    let totD = '';
    for (let di0 = 0; di0 < dailyNet.length; di0++) {
      totD += '<td>' + (dailyNet[di0] !== 0 ? fmtKrw_(dailyNet[di0]) : '0') + '</td>';
    }
    totD += '<td class="sp-an-viz__sum-col">' + fmtKrw_(monthGrand) + '</td>';
    tbody += '<tr class="sp-an-viz__row-total"><th scope="row" class="sp-an-viz__row-lbl">일 합(순)</th>' + totD + '</tr>';

    let wkCum = '<tr class="sp-an-viz__row-mrun"><th scope="row" class="sp-an-viz__row-lbl">주 누적(순)</th>';
    for (d = 1; d <= daysN; d++) {
      const sW = startOfBlockWeekInMonth(d);
      let cW = 0;
      for (let d0w = sW; d0w <= d; d0w++) {
        cW += dailyNet[d0w - 1] != null ? dailyNet[d0w - 1] : 0;
      }
      wkCum += '<td>' + fmtKrw_(cW) + '</td>';
    }
    wkCum += '<td class="sp-an-viz__sum-col">' + fmtKrw_(monthGrand) + '</td></tr>';
    tbody += wkCum;
    let mtdC = '<tr class="sp-an-viz__row-mrun sp-an-viz__row-mrun2"><th scope="row" class="sp-an-viz__row-lbl">월 누적(순, MTD)</th>';
    let runM = 0;
    for (d = 1; d <= daysN; d++) {
      runM += dailyNet[d - 1] != null ? dailyNet[d - 1] : 0;
      mtdC += '<td>' + fmtKrw_(runM) + '</td>';
    }
    mtdC += '<td class="sp-an-viz__sum-col">' + fmtKrw_(monthGrand) + '</td></tr>';
    tbody += mtdC;

    const py = report && report.previousYear && report.previousYear.roll;
    let foot = '';
    if (py && py.monthTotals) {
      const ptot = py.monthTotals;
      const bits = [];
      for (let pi = 0; pi < order.length; pi++) {
        const catp = String(order[pi]);
        const t1 = ptot[catp];
        if (!t1) {
          continue;
        }
        const s4 = t1.sales != null ? Number(t1.sales) : 0;
        const r4 = t1.refund != null ? Number(t1.refund) : 0;
        const n4 = s4 - r4;
        const lb =
          AN_CATEGORY_KEY_LABEL[catp] != null ? AN_CATEGORY_KEY_LABEL[catp] : catp;
        bits.push(esc(lb) + ' ' + fmtKrw_(n4));
      }
      if (bits.length) {
        foot = '<p class="sp-an-viz__meta">전년 동월(순, 요약) · ' + bits.join(' · ') + '</p>';
      }
    }

    paintVizScopeStrip_(report, y, m);
    el.vizScroll.innerHTML =
      '<table class="sp-an-viz-table"><thead>' +
      theadWeek +
      theadDay +
      '</thead><tbody>' +
      tbody +
      '</tbody></table>' +
      foot;
  }

  function syncPeopleYMDefaults_(y, m) {
    if (el.peopleY) {
      el.peopleY.value = String(y);
    }
    if (el.peopleM) {
      el.peopleM.value = String(m);
    }
  }

  if (el.peopleM) {
    el.peopleM.innerHTML = '';
    for (let pm0 = 1; pm0 <= 12; pm0++) {
      const op = document.createElement('option');
      op.value = String(pm0);
      op.textContent = String(pm0) + '월';
      el.peopleM.appendChild(op);
    }
  }
  if (el.peopleY) {
    el.peopleY.value = String(new Date().getFullYear());
  }
  if (el.peopleM) {
    el.peopleM.value = String(new Date().getMonth() + 1);
  }

  /**
   * 연도별 월×상품군 표 — `details`를 펼쳤을 때만 호출 (year 전체 fact 요청).
   * @param {string} base
   * @param {number} useY
   * @return {Promise<void>}
   */
  async function loadPeopleYearMatrix_(base, useY) {
    if (!el.peopleMatrix) {
      return;
    }
    el.peopleMatrix.innerHTML = '<p class="sp-an-viz__empty">불러오는 중…</p>';
    try {
      if (!_peopleYearRows || _peopleY !== useY) {
        const rY0 = await gasJsonpWithParams(
          base,
          'analyticsFactRowsGet',
          { year: String(useY), month: '0' },
          120000
        );
        _peopleYearRows = rY0 && rY0.ok && rY0.data && rY0.data.rows ? rY0.data.rows : [];
        _peopleY = useY;
      }
      const byMC =
        _peopleYearRows && _peopleYearRows.length
          ? lineCountsByMonthCategoryYear(_peopleYearRows, useY)
          : {};
      const co0 = _vizReport && _vizReport.categoryOrder ? _vizReport.categoryOrder : [];
      const ordC = co0 && co0.length ? co0 : Object.keys(AN_CATEGORY_KEY_LABEL);
      let tHH = '<tr><th class="sp-an-viz__row-h" scope="col">상품군</th>';
      let mc;
      for (mc = 1; mc <= 12; mc++) {
        tHH += '<th scope="col">' + mc + '월</th>';
      }
      tHH += '<th class="sp-an-viz__sum-col" scope="col">연 합(품목 줄)</th></tr>';
      const nowL = new Date();
      const yNow0 = nowL.getFullYear();
      const mNow0 = nowL.getMonth() + 1;
      let tBB = '';
      for (let oi0 = 0; oi0 < ordC.length; oi0++) {
        const cname = String(ordC[oi0]);
        const labC = AN_CATEGORY_KEY_LABEL[cname] != null ? AN_CATEGORY_KEY_LABEL[cname] : cname;
        tBB += '<tr><th scope="row" class="sp-an-viz__row-lbl">' + esc(labC) + '</th>';
        let rTot = 0;
        for (mc = 1; mc <= 12; mc++) {
          if (useY > yNow0 || (useY === yNow0 && mc > mNow0)) {
            tBB += '<td class="sp-an-people__dash">–</td>';
            continue;
          }
          const cell0 = (byMC[mc] && byMC[mc][cname]) != null ? Number(byMC[mc][cname]) : 0;
          rTot += cell0;
          tBB += '<td>' + (cell0 ? fmtInt_(cell0) : '0') + '</td>';
        }
        tBB += '<td class="sp-an-viz__sum-col">' + fmtInt_(rTot) + '</td></tr>';
      }
      el.peopleMatrix.innerHTML =
        '<p class="sp-an-viz__empty sp-an-people-matrix__caption">' +
        esc(String(useY)) +
        '년 1~12월 품목 줄 수(같은 해·상품군·월별 합). 아직 지나지 않은 달은 비웁니다.</p>' +
        '<table class="sp-an-viz-table sp-an-people__matrix"><thead>' +
        tHH +
        '</thead><tbody>' +
        tBB +
        '</tbody></table>';
    } catch (_e) {
      el.peopleMatrix.innerHTML =
        '<p class="sp-an-viz__empty">연도 표를 불러오지 못했습니다. 위에서 연도를 확인한 뒤 다시 펼쳐 보세요.</p>';
    }
  }

  /**
   * @param {string} base
   * @param {number} y fact 필터 연도(또는 최근에 불러온 격자 기준)
   * @param {number} m fact 필터 월(1~12) — `alignFromFilter`가 참이면 인원 Y/M이 여기에 맞춤
   * @param {Object[]|null} monthRows `analyticsFactRowsGet(y, m)`와 같은 기간 캐시(있으면 재요청 생략)
   * @param {boolean} [alignFromFilter] 위 기간[기간]과 인원 Y/M을 맞출지(초기·매출 다시불러오기)
   * @return {Promise<void>}
   */
  async function loadPeopleViz_(base, y, m, monthRows, alignFromFilter) {
    if (!el.people) {
      return;
    }
    if (!GAS_MODE.canSync || GAS_MODE.useMock || !ready) {
      el.people.setAttribute('hidden', '');
      return;
    }
    if (m < 1 || m > 12) {
      el.people.setAttribute('hidden', '');
      return;
    }
    el.people.removeAttribute('hidden');
    if (el.peopleWarn) {
      el.peopleWarn.setAttribute('hidden', '');
    }
    if (alignFromFilter) {
      syncPeopleYMDefaults_(y, m);
    }
    const py0 = el.peopleY != null && el.peopleY.value ? parseInt(el.peopleY.value, 10) : y;
    const pm0 = el.peopleM != null && el.peopleM.value ? parseInt(el.peopleM.value, 10) : m;
    const useY = isFinite(py0) ? py0 : y;
    const useM = isFinite(pm0) && pm0 >= 1 && pm0 <= 12 ? pm0 : m;
    if (el.peopleLede) {
      el.peopleLede.textContent =
        useY +
        '년 ' +
        useM +
        '월 — 품목 줄 수(한 주문 안의 품목 줄)입니다. 연도·월 합계 표는 아래를 펼쳐야 불러옵니다.';
    }
    if (el.peopleGrid) {
      el.peopleGrid.innerHTML = '<p class="sp-an-viz__empty">불러오는 중…</p>';
    }
    if (el.peopleMatrix && (!el.peopleYearDetails || !el.peopleYearDetails.open)) {
      el.peopleMatrix.innerHTML =
        '<p class="sp-an-viz__empty">연도·월·상품군 합계 표는 위 항목을 펼치면 이 자리에서 불러옵니다.</p>';
    }
    try {
      var rUse = /** @type {Object[]} */ ([]);
      if (useY === y && useM === m && monthRows != null && monthRows.length) {
        for (var riR = 0; riR < monthRows.length; riR++) {
          rUse.push(monthRows[riR]);
        }
      } else {
        const rFr = await gasJsonpWithParams(
          base,
          'analyticsFactRowsGet',
          { year: String(useY), month: String(useM) },
          120000
        );
        if (rFr && rFr.ok && rFr.data && rFr.data.rows) {
          for (var ri0 = 0; ri0 < rFr.data.rows.length; ri0++) {
            rUse.push(rFr.data.rows[ri0]);
          }
        }
      }
      const aggL = rUse.length ? aggregateFactRows(rUse, useY, useM) : { byDayProd: {} };
      const bdpG = aggL.byDayProd || {};
      const pKeys = /** @type {Record<string, boolean>} */ ({});
      for (const ymdG in bdpG) {
        if (!Object.prototype.hasOwnProperty.call(bdpG, ymdG)) {
          continue;
        }
        const kmap = bdpG[ymdG];
        var kz;
        for (kz in kmap) {
          if (Object.prototype.hasOwnProperty.call(kmap, kz)) {
            pKeys[kz] = true;
          }
        }
      }
      const namesP = (_vizReport && _vizReport.prodNameByNo) || {};
      const pSorted = Object.keys(pKeys).sort();
      const daysN2 = daysInMonth(useY, useM);
      const catSeen = /** @type {Record<string, boolean>} */ ({});
      for (let cs = 0; cs < pSorted.length; cs++) {
        const ks = pSorted[cs];
        const cks = ks.indexOf('\t') >= 0 ? String(ks.split('\t')[0] || '').trim() : '';
        if (cks) {
          catSeen[cks] = true;
        }
      }
      const coBase = _vizReport && _vizReport.categoryOrder && _vizReport.categoryOrder.length
        ? _vizReport.categoryOrder
        : Object.keys(AN_CATEGORY_KEY_LABEL);
      const uniqueCats = [];
      let uci;
      for (uci = 0; uci < coBase.length; uci++) {
        const c0 = String(coBase[uci]);
        if (catSeen[c0]) {
          uniqueCats.push(c0);
        }
      }
      const rest = Object.keys(catSeen).sort();
      for (uci = 0; uci < rest.length; uci++) {
        const c1 = rest[uci];
        if (uniqueCats.indexOf(c1) < 0) {
          uniqueCats.push(c1);
        }
      }
      let theg = '<tr><th class="sp-an-viz__row-h" scope="col">상품(과정)</th>';
      for (let d2 = 1; d2 <= daysN2; d2++) {
        theg += '<th class="sp-an-people__d" scope="col">' + d2 + '일</th>';
      }
      for (let ci0 = 0; ci0 < uniqueCats.length; ci0++) {
        const cH = String(uniqueCats[ci0]);
        const labH = AN_CATEGORY_KEY_LABEL[cH] != null ? AN_CATEGORY_KEY_LABEL[cH] : cH;
        const cmod = ci0 % 3;
        theg +=
          '<th class="sp-an-viz__sum-col sp-an-people__col--cat sp-an-people__col--c' +
          cmod +
          '" scope="col">' +
          esc(labH) +
          '</th>';
      }
      theg += '<th class="sp-an-viz__sum-col sp-an-people__col--tot" scope="col">품목 줄 합(건)</th></tr>';
      const sumByCat = /** @type {Record<string, number>} */ ({});
      for (let si = 0; si < uniqueCats.length; si++) {
        sumByCat[String(uniqueCats[si])] = 0;
      }
      let tbG = '';
      for (let pi0 = 0; pi0 < pSorted.length; pi0++) {
        const kk = pSorted[pi0];
        const catRow = kk.indexOf('\t') >= 0 ? String(kk.split('\t')[0] || '').trim() : '';
        const pno1 = kk.indexOf('\t') >= 0 ? kk.split('\t').slice(1).join('\t') : '';
        const lab1 = pno1 && namesP[pno1] != null && String(namesP[pno1]).length ? String(namesP[pno1]) : kk;
        let rs = 0;
        let tdG = '';
        for (let d2 = 1; d2 <= daysN2; d2++) {
          const mma = useM < 10 ? '0' + useM : String(useM);
          const dda = d2 < 10 ? '0' + d2 : String(d2);
          const ymdA = useY + '-' + mma + '-' + dda;
          const h = bdpG[ymdA] && bdpG[ymdA][kk] ? bdpG[ymdA][kk] : null;
          const nL = h && h.lines != null ? Number(h.lines) : 0;
          rs += nL;
          tdG += '<td>' + (nL ? fmtInt_(nL) : '0') + '</td>';
        }
        if (catRow && Object.prototype.hasOwnProperty.call(sumByCat, catRow)) {
          sumByCat[catRow] += rs;
        }
        for (let cj0 = 0; cj0 < uniqueCats.length; cj0++) {
          const ccol = String(uniqueCats[cj0]);
          const cmod2 = cj0 % 3;
          const cell0 = ccol === catRow ? rs : 0;
          tdG +=
            '<td class="sp-an-viz__sum-col sp-an-people__col--cat sp-an-people__col--c' +
            cmod2 +
            '">' +
            (cell0 ? fmtInt_(cell0) : '0') +
            '</td>';
        }
        tdG += '<td class="sp-an-viz__sum-col sp-an-people__col--tot">' + fmtInt_(rs) + '</td>';
        tbG += '<tr><th scope="row" class="sp-an-viz__row-lbl">' + esc(lab1) + '</th>' + tdG + '</tr>';
      }
      if (!pSorted.length) {
        const nc = 2 + daysN2 + (uniqueCats.length > 0 ? uniqueCats.length : 0) + 1;
        tbG = '<tr><td colspan="' + nc + '" class="sp-an-viz__empty">이 달 품목 줄이 없습니다.</td></tr>';
      }
      let sumB = '<tr class="sp-an-people__sumrow"><th scope="row">일 합(건)</th>';
      let ssum = 0;
      for (let d2 = 1; d2 <= daysN2; d2++) {
        const mma2 = useM < 10 ? '0' + useM : String(useM);
        const ddb = d2 < 10 ? '0' + d2 : String(d2);
        const ymdB = useY + '-' + mma2 + '-' + ddb;
        const blk = bdpG[ymdB] || {};
        let dsum = 0;
        for (const q in blk) {
          if (Object.prototype.hasOwnProperty.call(blk, q)) {
            dsum += blk[q] && blk[q].lines != null ? Number(blk[q].lines) : 0;
          }
        }
        ssum += dsum;
        sumB += '<td>' + (dsum ? fmtInt_(dsum) : '0') + '</td>';
      }
      for (let ck0 = 0; ck0 < uniqueCats.length; ck0++) {
        const cK = String(uniqueCats[ck0]);
        const cmod3 = ck0 % 3;
        const tK = sumByCat[cK] != null ? sumByCat[cK] : 0;
        sumB +=
          '<td class="sp-an-viz__sum-col sp-an-people__col--cat sp-an-people__col--c' +
          cmod3 +
          '">' +
          (tK ? fmtInt_(tK) : '0') +
          '</td>';
      }
      sumB += '<td class="sp-an-viz__sum-col sp-an-people__col--tot">' + fmtInt_(ssum) + '</td></tr>';
      if (el.peopleGrid) {
        el.peopleGrid.innerHTML = '<table class="sp-an-viz-table sp-an-people__grid">' + theg + tbG + sumB + '</table>';
      }

      if (el.peopleYearDetails && el.peopleYearDetails.open) {
        await loadPeopleYearMatrix_(base, useY);
      }
    } catch (e) {
      if (el.peopleWarn) {
        el.peopleWarn.textContent = '품목 줄 표를 그리지 못했습니다.';
        el.peopleWarn.removeAttribute('hidden');
      }
    }
  }

  if (el.peopleM && el.peopleY) {
    function onPeopleCh_() {
      if (!ready) {
        return;
      }
      const base0 = String(GAS_BASE_URL).trim();
      void loadPeopleViz_(
        base0,
        _vizY,
        _vizM,
        _vizRows,
        false
      );
    }
    el.peopleM.addEventListener('change', onPeopleCh_);
    el.peopleY.addEventListener('change', onPeopleCh_);
  }

  if (el.peopleYearDetails) {
    el.peopleYearDetails.addEventListener('toggle', function () {
      if (!el.peopleYearDetails.open) {
        if (el.peopleMatrix) {
          el.peopleMatrix.innerHTML =
            '<p class="sp-an-viz__empty">연도·월·상품군 합계 표는 위 항목을 펼치면 이 자리에서 불러옵니다.</p>';
        }
        return;
      }
      if (!ready || GAS_MODE.useMock || !GAS_MODE.canSync) {
        return;
      }
      const base0 = String(GAS_BASE_URL).trim();
      const py =
        el.peopleY != null && el.peopleY.value ? parseInt(el.peopleY.value, 10) : _vizY;
      const useYy = isFinite(py) ? py : _vizY;
      void loadPeopleYearMatrix_(base0, useYy);
    });
  }

  if (el.vizScope) {
    el.vizScope.addEventListener('change', function () {
      if (_vizReport) {
        renderVizAll_(
          _vizReport,
          _vizRows,
          _vizY,
          _vizM
        );
      }
    });
  }

  /**
   * @param {string} base
   * @param {number} y
   * @param {number} m
   * @return {Promise<void>}
   */
  async function loadOrderLinesPanel_(base, y, m) {
    if (!el.ol || !el.olScroll) {
      return;
    }
    if (GAS_MODE.useMock || !GAS_MODE.canSync || !ready) {
      el.ol.setAttribute('hidden', '');
      return;
    }
    if (m < 1 || m > 12) {
      el.ol.setAttribute('hidden', '');
      return;
    }
    el.ol.removeAttribute('hidden');
    if (el.olWarn) {
      el.olWarn.setAttribute('hidden', '');
      el.olWarn.textContent = '';
    }
    el.olScroll.innerHTML = '<p class="sp-an-viz__empty">품목 줄을 불러오는 중…</p>';
    try {
      const r = await gasJsonpWithParams(
        base,
        'analyticsOrderLinesRawGet',
        { year: String(y), month: String(m) },
        120000
      );
      if (!r || !r.ok) {
        if (el.olWarn) {
          el.olWarn.textContent = formatHintWithErrorCode_(r) || '품목 줄을 불러오지 못했습니다.';
          el.olWarn.removeAttribute('hidden');
        }
        el.olScroll.innerHTML = '';
        logSolpathApi_('analyticsOrderLinesRawGet', r, null);
        return;
      }
      const d0 = (r && r.data) || {};
      const rows = d0.rows != null && Array.isArray(d0.rows) ? d0.rows : [];
      const truncated = d0.truncated === true;
      if (truncated && el.olWarn) {
        el.olWarn.textContent =
          '응답이 길어 이 표는 처음 ' +
          rows.length +
          '건만 담겼습니다. 나머지는 드라이브 집계 시트에서 직접 보세요.';
        el.olWarn.removeAttribute('hidden');
      }
      if (!rows.length) {
        el.olScroll.innerHTML =
          '<p class="sp-an-viz__empty">이 달 주문일이 있는 품목 줄이 없습니다.</p>';
        return;
      }
      let h =
        '<table class="sp-an-viz-table sp-an-ol-table"><thead><tr>' +
        '<th class="sp-an-viz__row-h" scope="col">주문일</th>' +
        '<th class="sp-an-viz__row-h" scope="col">주문번호</th>' +
        '<th class="sp-an-viz__row-h" scope="col">상품</th>' +
        '<th class="sp-an-viz__row-h" scope="col">대분류</th>' +
        '<th class="sp-an-viz__row-h" scope="col">집계 기준 상품</th>' +
        '<th class="sp-an-viz__row-h" scope="col">마지막 인정일</th>' +
        '<th class="sp-an-viz__row-h" scope="col">집계 제외 확정</th>' +
        '<th class="sp-an-viz__row-h" scope="col"></th></tr></thead><tbody>';
      for (let io = 0; io < rows.length; io++) {
        const row = rows[io] || {};
        const osi0 = row.order_section_item_no;
        const ono0 = row.order_no;
        const oymd0 = String(row.order_time_ymd != null ? row.order_time_ymd : '');
        let lrd0 = String(row.last_recognition_date != null ? row.last_recognition_date : '');
        if (lrd0.length > 10) {
          lrd0 = lrd0.slice(0, 10);
        }
        const xset0 = row.x_set === true;
        const catL0 = String(row.internal_category != null ? row.internal_category : '');
        const pnm0 = String(row.prod_name != null ? row.prod_name : '');
        const rap0 = String(row.report_as_prod_no != null ? row.report_as_prod_no : '');
        const osiA = String(osi0 != null ? osi0 : '');
        const onoA = String(ono0 != null ? ono0 : '');
        const catDisp = AN_CATEGORY_KEY_LABEL[catL0] != null ? AN_CATEGORY_KEY_LABEL[catL0] : catL0;
        h += '<tr data-ol-osi="' + esc(osiA) + '" data-ol-ono="' + esc(onoA) + '">' +
          '<td>' + esc(oymd0) + '</td>' +
          '<td>' + esc(onoA) + '</td>' +
          '<td class="sp-an-ol__cell-name">' + esc(pnm0) + '</td>' +
          '<td>' + esc(catDisp) + '</td>' +
          '<td>' + esc(rap0) + '</td>' +
          '<td><input type="date" class="sp-confirm sp-an-ol-date" value="' + esc(lrd0) + '"/></td>' +
          '<td class="sp-an-ol__cell-x"><input type="checkbox" class="sp-an-ol-x" aria-label="집계에서 이 줄 제외 확정"' +
          (xset0 ? ' checked' : '') +
          ' /></td>' +
          '<td><button type="button" class="btn btn--secondary sp-an-ol-save">저장</button></td></tr>';
      }
      h += '</tbody></table>';
      el.olScroll.innerHTML = h;
    } catch (e) {
      if (el.olWarn) {
        el.olWarn.textContent = '품목 줄을 불러오지 못했습니다.';
        el.olWarn.removeAttribute('hidden');
      }
      el.olScroll.innerHTML = '';
      logSolpathApi_('analyticsOrderLinesRawGet', null, e);
    }
  }

  if (el.ol) {
    el.ol.addEventListener('click', function (ev) {
      const t0 = ev.target;
      if (!t0 || !t0.classList || !t0.classList.contains('sp-an-ol-save')) {
        return;
      }
      const tr0 = t0.closest('tr');
      if (!tr0 || !ready) {
        return;
      }
      const osi1 = tr0.getAttribute('data-ol-osi');
      const ono1 = tr0.getAttribute('data-ol-ono');
      const dInp = tr0.querySelector('.sp-an-ol-date');
      const xInp2 = tr0.querySelector('.sp-an-ol-x');
      if (dInp == null || xInp2 == null) {
        return;
      }
      const base0 = String(GAS_BASE_URL).trim();
      const btn = /** @type {HTMLButtonElement} */ (t0);
      btn.disabled = true;
      void (async function () {
        const r0 = await gasJsonpWithParams(
          base0,
          'analyticsOrderLineMetaApply',
          {
            payload: JSON.stringify({
              updates: [
                {
                  order_section_item_no: osi1,
                  order_no: ono1,
                  last_recognition_date: dInp.value,
                  x_set: xInp2.checked
                }
              ]
            })
          },
          120000
        );
        btn.disabled = false;
        if (r0 && r0.ok) {
          if (el.olWarn) {
            el.olWarn.textContent =
          '저장했습니다. 집계 숫자는 시트·화면을 갱신한 뒤에 맞춰집니다.';
            el.olWarn.removeAttribute('hidden');
          }
        } else {
          if (el.olWarn) {
            el.olWarn.textContent = formatHintWithErrorCode_(r0) || '저장하지 못했습니다.';
            el.olWarn.removeAttribute('hidden');
          }
        }
        logSolpathApi_('analyticsOrderLineMetaApply', r0, null);
      })();
    });
  }

  /**
   * @return {Promise<void>}
   */
  async function loadFactViz_() {
    if (!el.viz) {
      return;
    }
    if (GAS_MODE.useMock || !GAS_MODE.canSync) {
      el.viz.setAttribute('hidden', '');
      if (el.ol) {
        el.ol.setAttribute('hidden', '');
      }
      return;
    }
    if (!ready) {
      el.viz.setAttribute('hidden', '');
      return;
    }
    const ym = getAnFilterYm_(el);
    if (ym.m < 1 || ym.m > 12) {
      if (el.people) {
        el.people.setAttribute('hidden', '');
      }
      if (el.ol) {
        el.ol.setAttribute('hidden', '');
      }
      if (el.vizScopeStrip) {
        el.vizScopeStrip.innerHTML = '';
      }
      if (el.vizLede) {
        el.vizLede.textContent =
          '일별 격자는 <strong>월 1–12</strong>일 때만 채워집니다. <strong>0(연간)</strong>은 위 실적·목표 표용이며 날짜 열은 없습니다.';
      }
      if (el.vizScroll) {
        el.vizScroll.innerHTML = '';
      }
      if (el.vizWarn) {
        el.vizWarn.setAttribute('hidden', '');
        el.vizWarn.textContent = '';
      }
      if (el.vizPeriodMeta) {
        el.vizPeriodMeta.textContent = '';
      }
      el.viz.removeAttribute('hidden');
      return;
    }
    if (el.vizLede) {
      el.vizLede.textContent =
        ym.y +
        '년 ' +
        ym.m +
        '월 · 순매출(매출−환불). 행은 대분류 또는 상품, 열은 일자입니다. 환불은 일별로 − 합산.';
    }
    if (el.vizWarn) {
      el.vizWarn.setAttribute('hidden', '');
    }
    if (el.vizScroll) {
      el.vizScroll.innerHTML = '<p class="sp-an-viz__empty">불러오는 중…</p>';
    }
    el.viz.removeAttribute('hidden');
    const base = String(GAS_BASE_URL).trim();
    try {
      const r = await gasJsonpWithParams(
        base,
        'analyticsFactReport',
        { year: String(ym.y), month: String(ym.m) },
        120000
      );
      if (!r || !r.ok) {
        if (el.vizScroll) {
          el.vizScroll.innerHTML = '';
        }
        if (el.vizScopeStrip) {
          el.vizScopeStrip.innerHTML = '';
        }
        if (el.vizPeriodMeta) {
          el.vizPeriodMeta.textContent = '';
        }
        if (el.vizWarn) {
          const msg = formatHintWithErrorCode_(r) || '리포트를 가져오지 못했습니다.';
          el.vizWarn.textContent = msg;
          el.vizWarn.removeAttribute('hidden');
        }
        logSolpathApi_('analyticsFactReport', r, null);
        return;
      }
      const d0 = (r && r.data) || {};
      const rRows = await gasJsonpWithParams(
        base,
        'analyticsFactRowsGet',
        { year: String(ym.y), month: String(ym.m) },
        120000
      );
      const rowList = rRows && rRows.ok && rRows.data && rRows.data.rows ? rRows.data.rows : [];
      _vizReport = d0;
      _vizRows = rowList;
      _vizY = ym.y;
      _vizM = ym.m;
      const ord = (d0 && d0.categoryOrder) || [];
      buildVizScopeOptions_(ord);
      renderVizAll_(d0, rowList, ym.y, ym.m);
      void loadPeopleViz_(base, ym.y, ym.m, rowList, true);
      void loadOrderLinesPanel_(base, ym.y, ym.m);
    } catch (e) {
      if (el.vizScroll) {
        el.vizScroll.innerHTML = '';
      }
      if (el.vizScopeStrip) {
        el.vizScopeStrip.innerHTML = '';
      }
      if (el.vizPeriodMeta) {
        el.vizPeriodMeta.textContent = '';
      }
      if (el.vizWarn) {
        el.vizWarn.textContent = '리포트 요청이 끝나지 않았습니다.';
        el.vizWarn.removeAttribute('hidden');
      }
      logSolpathApi_('analyticsFactReport', null, e);
    }
  }

  function render() {
    if (!el.tbody) {
      return;
    }
    el.tbody.innerHTML = '';
    var appended = 0;
    for (let i = 0; i < localRows.length; i++) {
      if (!rowPassesFilter(localRows[i])) {
        continue;
      }
      appended += 1;
      const r = localRows[i];
      const tr = document.createElement('tr');
      const sc = String(r.scope);
      const sk = String(r.scopeKey);
      tr.innerHTML =
        '<td>' +
        esc(r.year) +
        '</td><td>' +
        esc(r.month) +
        '</td><td>' +
        esc(SCOPE_LABEL[sc] || sc) +
        '</td><td>' +
        esc(displayScopeValueForTable_(sc, sk)) +
        '</td><td class="sp-an-table__em-sales">' +
        esc(r.targetAmount) +
        '</td><td class="sp-an-table__em-count">' +
        esc(r.targetCount) +
        '</td><td>' +
        esc(r.notes) +
        '</td><td><button type="button" class="btn btn--secondary sp-an-row-del" data-idx="' +
        i +
        '">삭제</button></td>';
      el.tbody.appendChild(tr);
    }
    if (appended === 0) {
      const trE = document.createElement('tr');
      trE.className = 'sp-an-table__empty-row';
      const tdE = document.createElement('td');
      tdE.colSpan = 8;
      tdE.className = 'sp-an-table__empty';
      if (localRows.length === 0) {
        tdE.textContent =
          '이 표는 목표만 보입니다. 위「실적 요약」이 동기화 주문 기준이고, 목표는 아래에서 한 줄씩 넣은 뒤「이 줄을 표에 넣기」를 누릅니다.';
      } else {
        tdE.textContent =
          '지금 고른 연·월에 맞는 목표 행이 없습니다. 연도나 월을 바꿔 보세요.';
      }
      trE.appendChild(tdE);
      el.tbody.appendChild(trE);
    }
    if (el.tbody) {
      el.tbody.querySelectorAll('.sp-an-row-del').forEach(function (b) {
        b.addEventListener('click', function ev() {
          const ix = parseInt(
            String((/** @type {HTMLElement} */ (b)).getAttribute('data-idx') || '-1'),
            10
          );
          if (ix < 0 || ix >= localRows.length) {
            return;
          }
          localRows.splice(ix, 1);
          rebuildFilterYearMonth_();
          render();
          schedulePersist_();
        });
      });
    }
    paintActualsCompareUi_();
  }

  function syncAnUi_() {
    if (GAS_MODE.useMock) {
      if (el.actuals) {
        el.actuals.setAttribute('hidden', '');
      }
      if (el.init) {
        el.init.setAttribute('hidden', '');
      }
      if (el.body) {
        el.body.setAttribute('hidden', '');
      }
      return;
    }
    if (GAS_MODE.canSync) {
      if (el.actuals) {
        el.actuals.removeAttribute('hidden');
      }
    } else if (el.actuals) {
      el.actuals.setAttribute('hidden', '');
    }
    if (ready) {
      if (el.init) {
        el.init.setAttribute('hidden', '');
      }
      if (el.body) {
        el.body.removeAttribute('hidden');
      }
    } else {
      if (el.init) {
        el.init.removeAttribute('hidden');
      }
      if (el.body) {
        el.body.setAttribute('hidden', '');
      }
    }
  }

  /**
   * 마스터 orders에서 집계 (KPI 시트와 무관)
   */
  async function loadMasterActuals_() {
    if (!GAS_MODE.canSync || GAS_MODE.useMock) {
      return;
    }
    if (!el.filterY || !el.filterM || !el.valSales || !el.valOrders) {
      return;
    }
    if (el.actualsWarn) {
      el.actualsWarn.setAttribute('hidden', '');
      el.actualsWarn.textContent = '';
    }
    const ym = getAnFilterYm_(el);
    const url = String(GAS_BASE_URL).trim();
    _lastMasterActuals = null;
    paintActualsCompareUi_();
    try {
      const r = await gasJsonpWithParams(
        url,
        'analyticsMasterActualsGet',
        { year: String(ym.y), month: String(ym.m) },
        90000
      );
      if (!r || !r.ok) {
        _lastMasterActuals = null;
        paintActualsCompareUi_();
        const msg =
          r && r.error && typeof r.error === 'object' && r.error.message
            ? String(r.error.message)
            : errMsg_(r);
        if (el.actualsWarn) {
          el.actualsWarn.textContent = msg || '집계를 가져오지 못했습니다.';
          el.actualsWarn.removeAttribute('hidden');
        }
        logSolpathApi_('analyticsMasterActualsGet', r, null);
        return;
      }
      const d = (r.data && r.data) || {};
      _lastMasterActuals = { y: ym.y, m: ym.m, d: d };
      paintActualsCompareUi_();
    } catch (e) {
      _lastMasterActuals = null;
      paintActualsCompareUi_();
      logSolpathApi_('analyticsMasterActualsGet', null, e);
      if (el.actualsWarn) {
        el.actualsWarn.textContent = '집계 요청이 끝나지 않았습니다.';
        el.actualsWarn.removeAttribute('hidden');
      }
    }
  }

  async function loadTargets() {
    if (!GAS_MODE.canSync || !ready) {
      return;
    }
    if (el.loading) {
      el.loading.removeAttribute('hidden');
    }
    setHint('', false);
    try {
      const r = await gasJsonpWithParams(url, 'analyticsTargetsGet', null, 60000);
      if (!r || !r.ok) {
        setHint(errMsg_(r) || '목록을 가져오지 못했습니다.', true);
        return;
      }
      const dr = (r.data && r.data.rows) || [];
      localRows = dr.map(function (x) {
        const gTarget = String(
          x.goal_target != null
            ? x.goal_target
            : x.goalTarget != null
              ? x.goalTarget
              : x.scopeKey != null
                ? x.scopeKey
                : ''
        ).trim();
        const sk = gTarget || String(x.scopeKey != null ? x.scopeKey : x.scope_key != null ? x.scope_key : '').trim();
        return {
          year: x.year,
          month: x.month,
          goal_target: gTarget,
          scope: String(x.scope).trim() || 'category',
          scopeKey: sk,
          targetAmount: x.targetAmount != null ? x.targetAmount : x.target_amount,
          targetCount: x.targetCount != null ? x.targetCount : x.target_count,
          notes: x.notes != null ? String(x.notes) : ''
        };
      });
      rebuildFilterYearMonth_();
      render();
    } catch (e) {
      const m = e && e.message != null ? String(e.message) : '';
      setHint('불러오지 못했습니다. ' + (m === 'timeout' ? '응답이 지연되었습니다.' : ''), true);
    } finally {
      if (el.loading) {
        el.loading.setAttribute('hidden', '');
      }
    }
  }

  function applyStateFromData(d) {
    const mn = d && d.analyticsOrderMinYear != null ? Number(d.analyticsOrderMinYear) : NaN;
    const mx = d && d.analyticsOrderMaxYear != null ? Number(d.analyticsOrderMaxYear) : NaN;
    _boundsMinYear = isFinite(mn) ? Math.floor(mn) : null;
    _boundsMaxYear = isFinite(mx) ? Math.floor(mx) : null;
    ready = Boolean(d && d.analyticsReady === true);
    applyAnalyticsHeaderUrls(mount, d);
    syncAnUi_();
    if (ready) {
      void loadTargets();
      void loadFactViz_();
    } else {
      rebuildFilterYearMonth_();
    }
  }

  if (el.btnInit) {
    el.btnInit.disabled = !GAS_MODE.canSync;
  }
  if (el.btnSave) {
    el.btnSave.disabled = !GAS_MODE.canSync;
  }
  if (el.btnReset) {
    el.btnReset.disabled = !GAS_MODE.canSync;
  }
  if (el.btnRepair) {
    el.btnRepair.disabled = !GAS_MODE.canSync;
  }

  function validateRowInForm() {
    if (!el.inY || !el.inM || !el.inScope || !el.inKey || !el.inAmt || !el.inCnt) {
      return { ok: false, msg: '입력란을 확인합니다.' };
    }
    const y = Math.floor(Number(el.inY.value));
    const mo = Math.floor(Number(el.inM.value));
    const sc = el.inScope.value;
    const sk = el.inKey.value.trim();
    const ta = Number(el.inAmt.value);
    const tc = Number(el.inCnt.value);
    if (y < 2000 || y > 2100 || isNaN(y)) {
      return { ok: false, msg: '연도는 2000–2100 사이입니다.' };
    }
    if (mo < 0 || mo > 12) {
      return { ok: false, msg: '월은 0(연간)–12입니다.' };
    }
    if (sc !== 'category' && sc !== 'product') {
      return { ok: false, msg: '범위를 고릅니다.' };
    }
    if (!sk.length) {
      return { ok: false, msg: '키(대분류 키 또는 상품 번호)를 넣습니다.' };
    }
    if (!isFinite(ta) || ta < 0) {
      return { ok: false, msg: '매출(원)은 0 이상의 숫자입니다.' };
    }
    if (!isFinite(tc) || tc < 0) {
      return { ok: false, msg: '건수는 0 이상의 숫자입니다.' };
    }
    return {
      ok: true,
      row: {
        year: y,
        month: mo,
        scope: sc,
        scopeKey: sc === 'product' ? String(parseInt(sk, 10) || sk) : sk,
        targetAmount: ta,
        targetCount: tc,
        notes: el.inNotes && el.inNotes.value ? el.inNotes.value.trim() : ''
      }
    };
  }

  if (el.btnAdd) {
    el.btnAdd.addEventListener('click', function () {
      const v = validateRowInForm();
      if (!v.ok) {
        setHint(v.msg || '입력 오류', true);
        return;
      }
      if (v.row) {
        localRows.push(v.row);
      }
      rebuildFilterYearMonth_();
      render();
      setHint('목록에 넣었습니다. 잠시 뒤 드라이브에도 반영되며, 안 되면「지금 드라이브에 다시 저장」을 누릅니다.', true);
    });
  }

  function onAnPeriodChange_() {
    void loadMasterActuals_();
    void loadFactViz_();
    render();
  }
  if (el.filterY) {
    el.filterY.addEventListener('change', onAnPeriodChange_);
  }
  if (el.filterM) {
    el.filterM.addEventListener('change', onAnPeriodChange_);
  }

  if (el.btnInit) {
    el.btnInit.addEventListener('click', async function () {
      if (!GAS_MODE.canSync) {
        return;
      }
      el.btnInit.disabled = true;
      setHint('만드는 중…', true);
      try {
        const r = await gasJsonpWithParams(url, 'initAnalyticsSheets', null, 120000);
        if (!r || !r.ok) {
          logSolpathApi_('initAnalyticsSheets', r, null);
          setHint(formatHintWithErrorCode_(r) || '데이터 생성에 실패했습니다.', true);
          return;
        }
        const d0 = (r && r.data) || {};
        applyAnalyticsHeaderUrls(mount, {
          analyticsReady: true,
          analyticsSpreadsheetUrl: d0.analyticsSpreadsheetUrl
        });
        ready = true;
        syncAnUi_();
        await loadTargets();
        setHint('드라이브에 목표 표가 준비됐습니다. 위 실적은 항상 마스터·동기화 기준이고, 아래는 선택 목표만 적습니다.', true);
        window.requestAnimationFrame(function () {
          if (el.actuals) {
            el.actuals.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
      } catch (e) {
        logSolpathApi_('initAnalyticsSheets', null, e);
        const m = e && e.message != null ? String(e.message) : '';
        setHint(
          m === 'timeout'
            ? '응답이 지연되었습니다. [네트워크/timeout]'
            : '요청이 끝나지 않았습니다. [콘솔에 상세]',
          true
        );
      } finally {
        if (el.btnInit) {
          el.btnInit.disabled = false;
        }
      }
    });
  }

  if (el.btnRepair) {
    el.btnRepair.addEventListener('click', async function () {
      if (!GAS_MODE.canSync) {
        return;
      }
      if (!ready) {
        setHint('먼저 집계용 드라이브 시트를 연 뒤 다시 누릅니다.', true);
        return;
      }
      el.btnRepair.disabled = true;
      if (el.loading) {
        el.loading.removeAttribute('hidden');
      }
      setHint('탭 이행·주문라인을 마스터에서 다시 채우는 중…', true);
      try {
        const r = await gasJsonpWithParams(url, 'analyticsSheetsRepair', null, 120000);
        if (!r || !r.ok) {
          logSolpathApi_('analyticsSheetsRepair', r, null);
          setHint(formatHintWithErrorCode_(r) || '갱신에 실패했습니다.', true);
          return;
        }
        const d1 = (r && r.data) || {};
        const wn = d1.written != null && isFinite(Number(d1.written)) ? Number(d1.written) : null;
        setHint(
          wn != null
            ? '집계 시트를 맞추고 품목 줄 ' + wn + '행을 갱신했습니다.'
            : '집계 시트를 맞추고 마스터에서 품목 줄을 다시 채웠습니다.',
          true
        );
        await loadTargets();
        void loadFactViz_();
      } catch (e) {
        logSolpathApi_('analyticsSheetsRepair', null, e);
        const m = e && e.message != null ? String(e.message) : '';
        setHint(
          m === 'timeout'
            ? '응답이 지연되었습니다. [네트워크/timeout]'
            : '요청이 끝나지 않았습니다. [콘솔에 상세]',
          true
        );
      } finally {
        if (el.loading) {
          el.loading.setAttribute('hidden', '');
        }
        if (el.btnRepair) {
          el.btnRepair.disabled = !GAS_MODE.canSync;
        }
      }
    });
  }

  if (el.btnSave) {
    el.btnSave.addEventListener('click', async function () {
      if (!GAS_MODE.canSync || !ready) {
        return;
      }
      const out = localRows.map(function (x) {
        return rowToPayload_(x);
      });
      if (el.btnSave) {
        el.btnSave.disabled = true;
      }
      if (el.loading) {
        el.loading.removeAttribute('hidden');
      }
      setHint('저장 중…', true);
      try {
        const r = await analyticsTargetsApplyBatched_(url, out, 5000);
        if (!r || !r.ok) {
          setHint(errMsg_(r) || '저장하지 못했습니다.', true);
          return;
        }
        setHint('드라이브에 저장했습니다.', true);
        await loadTargets();
      } catch (e) {
        const m = e && e.message != null ? String(e.message) : '';
        setHint(m === 'timeout' ? '응답이 지연되었습니다.' : '저장에 실패했습니다.', true);
      } finally {
        if (el.loading) {
          el.loading.setAttribute('hidden', '');
        }
        if (el.btnSave) {
          el.btnSave.disabled = false;
        }
      }
    });
  }

  if (el.btnReset) {
    el.btnReset.addEventListener('click', async function () {
      if (!GAS_MODE.canSync || !ready) {
        return;
      }
      const ok = window.confirm(
        '여기에 적어 둔 목표·일 단위 캐시를 모두 비웁니다. 되돌릴 수 없습니다. 정말 진행할까요?'
      );
      if (!ok) {
        return;
      }
      if (el.btnReset) {
        el.btnReset.disabled = true;
      }
      if (el.loading) {
        el.loading.removeAttribute('hidden');
      }
      setHint('초기화 중…', true);
      try {
        const r = await gasJsonpWithParams(url, 'analyticsResetAll', null, 120000);
        if (!r || !r.ok) {
          setHint(errMsg_(r) || '초기화에 실패했습니다.', true);
          return;
        }
        localRows = [];
        rebuildFilterYearMonth_();
        render();
        setHint('초기화했습니다.', true);
      } catch (e) {
        const m = e && e.message != null ? String(e.message) : '';
        setHint(m === 'timeout' ? '응답이 지연되었습니다.' : '초기화에 실패했습니다.', true);
      } finally {
        if (el.loading) {
          el.loading.setAttribute('hidden', '');
        }
        if (el.btnReset) {
          el.btnReset.disabled = false;
        }
      }
    });
  }

  const tAn = mount.querySelector('#sp-tab-an');
  if (tAn) {
    tAn.addEventListener('click', function () {
      window.setTimeout(function () {
        if (tAn.classList.contains('is-active')) {
          if (GAS_MODE.canSync && !GAS_MODE.useMock) {
            void loadMasterActuals_();
          }
          if (ready) {
            void loadTargets();
            void loadFactViz_();
          }
        }
      }, 0);
    });
  }

  if (GAS_MODE.useMock) {
    setHint('이 화면은 GAS Web App URL이 있을 때만 씁니다.', true);
  }

  syncAnUi_();
  rebuildFilterYearMonth_();

  return {
    applyStateFromData: applyStateFromData,
    refresh: function () {
      if (GAS_MODE.canSync && !GAS_MODE.useMock) {
        void loadMasterActuals_();
      }
      if (ready) {
        void loadFactViz_();
        return loadTargets();
      }
      return Promise.resolve();
    }
  };
}
