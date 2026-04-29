/**
 * 매출·구매 건수 지표 — GAS JSONP
 */
import { GAS_BASE_URL, GAS_MODE } from './config.js';
import {
  aggregateFactRows,
  calendarWeekOrdinalsByDom,
  daysInMonth,
  firstDomCalendarWeekInMonth,
  lastDomCalendarWeekInMonth,
  lineCountsByMonthCategoryYear,
  refundLineCountsByMonthYear
} from './analyticsVizModule.js';

/** 실적 목표 표·시트 `goal_target` — 일별 매출 보기 범위와 동일한 네 가지 + 전체 */
const KPI_GOAL_TARGET_OPTIONS = [
  { value: 'entire', label: '전체' },
  { value: 'solpass', label: '솔패스' },
  { value: 'challenge', label: '챌린지' },
  { value: 'solutine', label: '솔루틴' }
];
/** @type {Record<string, boolean>} */
const KPI_GOAL_TARGET_SET = { entire: true, solpass: true, challenge: true, solutine: true };

/** 시트·API용 영문 키 → 표에만 한글 (저장 값은 그대로) */
const AN_CATEGORY_KEY_LABEL = {
  unmapped: '상품군 미정',
  solpass: '솔패스',
  solutine: '솔루틴',
  challenge: '챌린지',
  textbook: '교재',
  jasoseo: '자소서'
};

/** 보기 범위 셀렉트에 넣는 대분류(전체 제외) — 상품군 미정·교재·자소서 제외 */
const VIZ_SCOPE_DROPDOWN_KEYS = { solpass: true, solutine: true, challenge: true };

/** 상단 실적·전년·목표 비교 축 — 주문 실적 집계 기준, 상품군 미정만 제외 */
const AN_ACTUAL_EXCL_NOTE = ' (상품군 미정 제외)';

/**
 * `monthTotals` 전 카테고리 순매출 합(사이트 전체 합계용).
 * @param {Record<string, {sales?: unknown, refund?: unknown}>|null|undefined} mt
 * @return {number}
 */
function sumNetAllMonthTotals_(mt) {
  let s = 0;
  if (!mt || typeof mt !== 'object') {
    return 0;
  }
  let k;
  for (k in mt) {
    if (!Object.prototype.hasOwnProperty.call(mt, k)) {
      continue;
    }
    const t = mt[k];
    if (!t || typeof t !== 'object') {
      continue;
    }
    const sales = t.sales != null ? Number(t.sales) : 0;
    const ref = t.refund != null ? Number(t.refund) : 0;
    s += sales - ref;
  }
  return s;
}

/** 서울 기준 오늘 날짜 `yyyy-MM-dd` */
function seoulYmdToday_() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const y = parts.find(function (p) {
    return p.type === 'year';
  });
  const mo = parts.find(function (p) {
    return p.type === 'month';
  });
  const da = parts.find(function (p) {
    return p.type === 'day';
  });
  return (y && y.value) + '-' + (mo && mo.value) + '-' + (da && da.value);
}

/**
 * @param {number} y
 * @param {number} m
 * @return {{ start: string, end: string }}
 */
function monthBoundsYmd_(y, m) {
  const mm = m < 10 ? '0' + m : String(m);
  const lastD = daysInMonth(y, m);
  const dd = lastD < 10 ? '0' + lastD : String(lastD);
  return { start: y + '-' + mm + '-01', end: y + '-' + mm + '-' + dd };
}

/**
 * 원천 상품 등록일~판매 종료일(종료일 당일 포함, 종료일 비면 계속) 구간이 집계 연·월과 겹치는지.
 * @param {string} [addYmd]
 * @param {string} [salesEndYmd]
 * @param {number} y
 * @param {number} m
 * @return {boolean}
 */
function productSaleWindowOverlapsMonth_(addYmd, salesEndYmd, y, m) {
  const b = monthBoundsYmd_(y, m);
  const lo =
    addYmd != null && String(addYmd).trim().length >= 10
      ? String(addYmd).trim().slice(0, 10)
      : '1970-01-01';
  const hi =
    salesEndYmd != null && String(salesEndYmd).trim().length >= 10
      ? String(salesEndYmd).trim().slice(0, 10)
      : '9999-12-31';
  /* 등록일이 판매 종료보다 늦으면 구간 무효 — 빈 종료일은 상한 9999로만 유효 */
  if (lo > hi) {
    return false;
  }
  return lo <= b.end && b.start <= hi;
}

/**
 * 연간 일별 격자에서 합산 제외·셀 `—` 처리할 날짜(서울 ymd 문자열 비교).
 * @param {string} ymd
 * @param {string} todayYmd
 * @param {string|null|undefined} minDataYmd 마스터 첫 주문일 — 없으면 과거 구간은 마스킹 안 함
 * @return {boolean}
 */
function vizYmdExcludedFromYearGrid_(ymd, todayYmd, minDataYmd) {
  if (!ymd || ymd.length < 10) {
    return true;
  }
  if (ymd > todayYmd) {
    return true;
  }
  const lo = minDataYmd != null ? String(minDataYmd).trim() : '';
  if (lo.length >= 10 && ymd < lo) {
    return true;
  }
  return false;
}

/**
 * @param {unknown} gt goal_target (entire|solpass|…)
 */
function kpiGoalTargetLabel_(gt) {
  const g = String(gt != null ? gt : '')
    .trim()
    .toLowerCase();
  if (g === 'entire') {
    return '전체';
  }
  if (g === 'solpass') {
    return '솔패스';
  }
  if (g === 'challenge') {
    return '챌린지';
  }
  if (g === 'solutine') {
    return '솔루틴';
  }
  return AN_CATEGORY_KEY_LABEL[g] != null ? AN_CATEGORY_KEY_LABEL[g] : g || '—';
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
      return '아직 이 기능이 연결 프로그램에 반영되지 않았을 수 있습니다. 담당자에게 문의해 주세요.';
    }
    if (r.error === 'SYNC_FAILED') {
      const hm = r.message != null ? String(r.message) : '';
      return hm.length ? hm : '동기화 중 문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요.';
    }
    if (/^[A-Z][A-Z0-9_]+$/.test(r.error)) {
      return '요청이 처리되지 않았습니다. 잠시 뒤 다시 시도하거나 담당자에게 알려 주세요.';
    }
    return r.error;
  }
  var msg = '';
  if (r.error && typeof r.error === 'object') {
    if (r.error.code === 'UNKNOWN_ACTION' || r.error.message === 'UNKNOWN_ACTION') {
      return '아직 이 기능이 연결 프로그램에 반영되지 않았을 수 있습니다. 담당자에게 문의해 주세요.';
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
 * 표(thead/tbody) DOM을 시트용 2차원 값·병합 정보로 변환.
 * @param {HTMLElement | null} host
 * @return {{ rows: string[][], merges: Array<{row:number,col:number,rowspan:number,colspan:number}> } | null}
 */
function captureTableGridForExport_(host) {
  if (!host) {
    return null;
  }
  const table = host.tagName === 'TABLE' ? /** @type {HTMLTableElement} */ (host) : host.querySelector('table');
  if (!table) {
    return null;
  }
  const trList = Array.from(table.querySelectorAll('tr'));
  if (!trList.length) {
    return null;
  }
  /** @type {string[][]} */
  const rows = [];
  /** @type {Array<{row:number,col:number,rowspan:number,colspan:number}>} */
  const merges = [];
  /** @type {Record<string, boolean>} */
  const occupied = {};
  let maxCol = 0;
  for (let r = 0; r < trList.length; r++) {
    const tr = trList[r];
    const outRow = [];
    let c = 0;
    const cells = Array.from(tr.children).filter(function (n) {
      return n.tagName === 'TH' || n.tagName === 'TD';
    });
    for (let ci = 0; ci < cells.length; ci++) {
      while (occupied[r + ':' + c]) {
        c += 1;
      }
      const td = /** @type {HTMLTableCellElement} */ (cells[ci]);
      const rs = Math.max(1, Number(td.rowSpan || 1));
      const cs = Math.max(1, Number(td.colSpan || 1));
      const txt = String(td.textContent != null ? td.textContent : '')
        .replace(/\s+/g, ' ')
        .trim();
      outRow[c] = txt;
      if (rs > 1 || cs > 1) {
        merges.push({ row: r + 1, col: c + 1, rowspan: rs, colspan: cs });
      }
      for (let rr = 0; rr < rs; rr++) {
        for (let cc = 0; cc < cs; cc++) {
          if (rr === 0 && cc === 0) {
            continue;
          }
          occupied[r + rr + ':' + (c + cc)] = true;
        }
      }
      c += cs;
    }
    if (c > maxCol) {
      maxCol = c;
    }
    rows.push(outRow);
  }
  for (let r = 0; r < rows.length; r++) {
    if (rows[r].length < maxCol) {
      rows[r].length = maxCol;
    }
    for (let c = 0; c < maxCol; c++) {
      if (rows[r][c] == null) {
        rows[r][c] = '';
      }
    }
  }
  return { rows: rows, merges: merges };
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
  return errMsg_(r) || '요청이 완료되지 않았습니다. 잠시 뒤 다시 시도하거나 담당자에게 알려 주세요.';
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
 * 필터 월 → 화면에만 쓰는 이름(「전체」= 연도 단위 일별 표)
 * @param {number} m
 * @return {string}
 */
function anFilterMonthLabel_(m) {
  if (m === 0) {
    return '전체';
  }
  if (m >= 1 && m <= 12) {
    return String(m) + '월';
  }
  return String(m);
}

/**
 * 목표(KPI) 표 월 칸 — 저장값 그대로 두고 표시만(연간 한 줄은 숫자 노출 안 함)
 * @param {unknown} monthRaw
 * @return {string}
 */
function anKpiMonthCellLabel_(monthRaw) {
  const n = Math.floor(Number(monthRaw));
  if (n === 0) {
    return '연간';
  }
  if (n >= 1 && n <= 12) {
    return String(n) + '월';
  }
  return String(monthRaw != null ? monthRaw : '');
}

/**
 * 일별이 연도 전체일 때 상단 카드·목표 매칭에 쓸 대표 월(1–12)
 * @param {number} y
 * @param {number} filterM
 * @return {number}
 */
function monthForActualsCard_(y, filterM) {
  if (filterM >= 1 && filterM <= 12) {
    return filterM;
  }
  const yNow = new Date().getFullYear();
  const mNow = new Date().getMonth() + 1;
  if (y < yNow) {
    return 12;
  }
  if (y > yNow) {
    return 1;
  }
  return mNow;
}

/**
 * @param {number} y
 * @param {number} mo
 * @param {number} dom
 * @return {string}
 */
function ymdPadParts_(y, mo, dom) {
  const mm = mo < 10 ? '0' + mo : String(mo);
  const dd = dom < 10 ? '0' + dom : String(dom);
  return y + '-' + mm + '-' + dd;
}

/**
 * 일별 순매출 표 가로축 — 단월 또는 연도 전체(필터에서 전체)
 * @param {number} y
 * @param {number} m
 * @return {string[]}
 */
function buildYmdSequenceForViz_(y, m) {
  const seq = [];
  if (m >= 1 && m <= 12) {
    const n = daysInMonth(y, m);
    let d;
    for (d = 1; d <= n; d++) {
      seq.push(ymdPadParts_(y, m, d));
    }
  } else if (m === 0) {
    let mo;
    for (mo = 1; mo <= 12; mo++) {
      const n = daysInMonth(y, mo);
      let d2;
      for (d2 = 1; d2 <= n; d2++) {
        seq.push(ymdPadParts_(y, mo, d2));
      }
    }
  }
  return seq;
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
  /* 헤더 버튼(지표 DB 초기화)은 항상 노출, 드라이브 링크만 ready일 때만 노출 */
}

/**
 * @param {Record<string, unknown>} r
 * @return {object}
 */
/**
 * 목표 행 year/month — 시트 Date·문자가 섞여도 저장 검증 실패 방지
 * @param {unknown} raw
 * @return {number}
 */
function coercePayloadGoalYear_(raw) {
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    return raw.getFullYear();
  }
  const n = Math.floor(Number(raw));
  return isFinite(n) ? n : NaN;
}

/**
 * @param {unknown} raw
 * @return {number}
 */
function coercePayloadGoalMonth_(raw) {
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    return raw.getMonth() + 1;
  }
  const n = Math.floor(Number(raw));
  if (n === 0) {
    return 0;
  }
  if (n >= 1 && n <= 12) {
    return n;
  }
  const s = String(raw != null ? raw : '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return d.getMonth() + 1;
    }
  }
  return NaN;
}

/** 한글·표기 → 서버 허용 키 (저장 페이로드용) */
function normalizePayloadGoalTargetKey_(raw) {
  const t = String(raw != null ? raw : '')
    .trim()
    .toLowerCase();
  if (!t.length) {
    return '';
  }
  if (KPI_GOAL_TARGET_SET[t]) {
    return t;
  }
  const aliases = /** @type {Record<string, string>} */ ({
    전체: 'entire',
    솔패스: 'solpass',
    챌린지: 'challenge',
    솔루틴: 'solutine'
  });
  return aliases[t] != null ? aliases[t] : t;
}

/**
 * 목표 금액·건수 — 쉼표·공백 포함 문자열도 저장 검증 통과용으로 정리
 * @param {unknown} v
 * @return {number}
 */
function parseGoalAmountForPayload_(v) {
  if (v == null || v === '') {
    return 0;
  }
  if (typeof v === 'number' && isFinite(v)) {
    return Math.max(0, v);
  }
  const n = Number(String(v).replace(/[, \s\u00a0]/g, '').trim());
  return isFinite(n) && n >= 0 ? n : 0;
}

function rowToPayload_(r) {
  const y = coercePayloadGoalYear_(r.year);
  const mo = coercePayloadGoalMonth_(r.month);
  const gt0 = normalizePayloadGoalTargetKey_(
    String(
      r.goal_target != null
        ? r.goal_target
        : r.goalTarget != null
          ? r.goalTarget
          : ''
    ).trim()
  );
  const sk = normalizePayloadGoalTargetKey_(
    String(r.scopeKey != null ? r.scopeKey : r.scope_key != null ? r.scope_key : '').trim()
  );
  const goalTarget = gt0 || sk;
  const ta = parseGoalAmountForPayload_(
    r.targetAmount != null ? r.targetAmount : r.target_amount != null ? r.target_amount : 0
  );
  const tc = parseGoalAmountForPayload_(
    r.targetCount != null ? r.targetCount : r.target_count != null ? r.target_count : 0
  );
  return {
    year: y,
    month: mo,
    goal_target: goalTarget,
    sales_target: ta,
    people_target: tc,
    targetAmount: ta,
    targetCount: tc,
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
    btnRebuildAnalytics: /** @type {HTMLButtonElement | null} */ (mount.querySelector('#sp-an-btnRebuildAnalytics')),
    tbody: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-an-tbody')),
    subSales: /** @type {HTMLButtonElement | null} */ (mount.querySelector('#sp-an-subSales')),
    subCount: /** @type {HTMLButtonElement | null} */ (mount.querySelector('#sp-an-subCount')),
    subLede: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-an-subLede')),
    table: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-an-table')),
    tableWrap: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-an-tableWrap')),
    kpiBlock: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-an-kpi')),
    filterY: /** @type {HTMLSelectElement | null} */ (mount.querySelector('#sp-an-filterY')),
    filterM: /** @type {HTMLSelectElement | null} */ (mount.querySelector('#sp-an-filterM')),
    btnKpiAnnual: /** @type {HTMLButtonElement | null} */ (mount.querySelector('#sp-an-btnKpiAnnual')),
    inY: /** @type {HTMLInputElement | null} */ (mount.querySelector('#sp-an-inY')),
    inM: /** @type {HTMLSelectElement | null} */ (mount.querySelector('#sp-an-inM')),
    inGoalTarget: /** @type {HTMLSelectElement | null} */ (mount.querySelector('#sp-an-inGoalTarget')),
    inAmt: /** @type {HTMLInputElement | null} */ (mount.querySelector('#sp-an-inAmt')),
    inCnt: /** @type {HTMLInputElement | null} */ (mount.querySelector('#sp-an-inCnt')),
    inNotes: /** @type {HTMLInputElement | null} */ (mount.querySelector('#sp-an-inNotes')),
    btnAdd: /** @type {HTMLButtonElement | null} */ (mount.querySelector('#sp-an-btnAdd')),
    btnSave: /** @type {HTMLButtonElement | null} */ (mount.querySelector('#sp-an-btnSave')),
    btnReset: /** @type {HTMLButtonElement | null} */ (mount.querySelector('#sp-an-btnReset')),
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
    btnExportBundleTop: /** @type {HTMLButtonElement | null} */ (mount.querySelector('#sp-an-btnExportBundleTop')),
    anBusyOverlay: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-an-loadingOverlay')),
    anBusyTitle: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-an-loadingOverlay-title')),
    anBusyDesc: /** @type {HTMLElement | null} */ (mount.querySelector('#sp-an-loadingOverlay-desc'))
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
  /** @type {string|null} 마스터 첫 주문일(서울 yyyy-MM-dd) — 연간 표에서 개시 전 칸 마스킹 */
  let _boundsMinYmd = null;
  /** 목표(KPI) 표만 연간 한 줄 행 필터 */
  let _kpiAnnualRows = false;
  /** 연간 토글 ON 전에 보던 월(OFF 시 복귀용) */
  let _kpiPrevMonthForToggle = null;
  /** 연·월 필터: 첫 `rebuildFilterYearMonth_`에서만 HTML 기본(1월) 대신 당월로 맞춤 */
  let _anPeriodFilterBootstrapped = false;
  /**
   * @param {string} [title]
   * @param {string} [desc]
   */
  function showAnBusyOverlay_(title, desc) {
    if (!el.anBusyOverlay) {
      return;
    }
    if (el.anBusyTitle && title) {
      el.anBusyTitle.textContent = title;
    }
    if (el.anBusyDesc && desc) {
      el.anBusyDesc.textContent = desc;
    }
    el.anBusyOverlay.removeAttribute('hidden');
    el.anBusyOverlay.setAttribute('aria-hidden', 'false');
    el.anBusyOverlay.setAttribute('aria-busy', 'true');
  }

  function hideAnBusyOverlay_() {
    if (!el.anBusyOverlay) {
      return;
    }
    el.anBusyOverlay.setAttribute('hidden', '');
    el.anBusyOverlay.setAttribute('aria-hidden', 'true');
    el.anBusyOverlay.removeAttribute('aria-busy');
  }

  function syncKpiAnnualBtn_() {
    if (!el.btnKpiAnnual) {
      return;
    }
    if (_kpiAnnualRows) {
      el.btnKpiAnnual.classList.add('is-active');
      el.btnKpiAnnual.setAttribute('aria-pressed', 'true');
    } else {
      el.btnKpiAnnual.classList.remove('is-active');
      el.btnKpiAnnual.setAttribute('aria-pressed', 'false');
    }
  }

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

  async function exportTableToDriveSheet_(tableType, title, host) {
    const cap = captureTableGridForExport_(host);
    if (!cap || !cap.rows.length) {
      setHint('내보낼 표가 아직 없습니다. 먼저 표를 불러와 주세요.', true);
      return;
    }
    const payload = { tableType: tableType, title: title, rows: cap.rows, merges: cap.merges };
    const encLen = encodeURIComponent(JSON.stringify(payload)).length;
    if (encLen > 120000) {
      setHint('표가 너무 커서 한 번에 내보낼 수 없습니다. 기간/범위를 좁혀 다시 시도해 주세요.', true);
      return;
    }
    showAnBusyOverlay_('시트 저장 중', '표 데이터를 구글 시트로 저장합니다. 잠시만 기다려 주세요.');
    try {
      const r = await gasJsonpWithParams(
        url,
        'analyticsTableExport',
        { payload: JSON.stringify(payload) },
        120000
      );
      if (!r || !r.ok) {
        setHint(errMsg_(r) || '시트 저장에 실패했습니다.', true);
        return;
      }
      const d = (r.data && r.data) || {};
      const sheetUrl = d.spreadsheetUrl != null ? String(d.spreadsheetUrl) : '';
      const folderUrl = d.folderUrl != null ? String(d.folderUrl) : '';
      setHint(
        sheetUrl
          ? '시트를 만들었습니다. 파일: ' + sheetUrl + (folderUrl ? ' · 폴더: ' + folderUrl : '')
          : '시트를 만들었습니다.',
        true
      );
    } catch (e) {
      setHint('시트 저장 요청이 끝나지 않았습니다. 잠시 뒤 다시 시도해 주세요.', true);
    } finally {
      hideAnBusyOverlay_();
    }
  }

  /**
   * 화면 요약+핵심 표를 한 파일(여러 시트)로 저장
   */
  async function exportAnalyticsBundleSheet_() {
    const capViz = captureTableGridForExport_(el.vizScroll);
    const capPeopleDaily = captureTableGridForExport_(el.peopleGrid);
    const capPeopleYear = captureTableGridForExport_(el.peopleMatrix);
    if (!capViz || !capViz.rows.length) {
      setHint('일별 순매출 표가 아직 없습니다. 먼저 데이터를 불러와 주세요.', true);
      return;
    }
    if (!capPeopleDaily || !capPeopleDaily.rows.length) {
      setHint('구매 건수 표가 아직 없습니다. 먼저 데이터를 불러와 주세요.', true);
      return;
    }
    const ym = getAnFilterYm_(el);
    const scopeLabel =
      el.vizScope && el.vizScope.options && el.vizScope.selectedIndex >= 0
        ? String(el.vizScope.options[el.vizScope.selectedIndex].textContent || '').trim()
        : 'entire';
    const summaryRows = [
      ['항목', '값'],
      ['기준 연도', String(ym.y)],
      ['기준 월', anFilterMonthLabel_(ym.m)],
      ['보기 범위', scopeLabel],
      ['실제 매출(원)', el.valSales ? String(el.valSales.textContent || '') : ''],
      ['주문 건수', el.valOrders ? String(el.valOrders.textContent || '') : ''],
      [el.actRow2LblA ? String(el.actRow2LblA.textContent || '') : '매출 목표(원)', el.actRow2ValA ? String(el.actRow2ValA.textContent || '') : ''],
      [el.actRow2LblB ? String(el.actRow2LblB.textContent || '') : '주문 목표(건)', el.actRow2ValB ? String(el.actRow2ValB.textContent || '') : '']
    ];
    const payload = {
      tableType: 'analytics_bundle',
      title: '매출구매건수_' + ym.y + '년_' + anFilterMonthLabel_(ym.m),
      summaryRows: summaryRows,
      tables: [
        { name: '일별순매출', rows: capViz.rows, merges: capViz.merges },
        { name: '구매건수_일별', rows: capPeopleDaily.rows, merges: capPeopleDaily.merges },
        {
          name: '구매건수_연도월합계',
          rows: capPeopleYear && capPeopleYear.rows ? capPeopleYear.rows : [],
          merges: capPeopleYear && capPeopleYear.merges ? capPeopleYear.merges : []
        }
      ]
    };
    const encLen = encodeURIComponent(JSON.stringify(payload)).length;
    if (encLen > 240000) {
      setHint('표가 너무 커서 통합 저장이 어렵습니다. 월 범위를 좁혀 다시 시도해 주세요.', true);
      return;
    }
    showAnBusyOverlay_('시트 저장 중', '요약·일별 순매출·구매 건수 표를 한 파일로 저장합니다.');
    try {
      const r = await gasJsonpWithParams(url, 'analyticsTableExport', { payload: JSON.stringify(payload) }, 120000);
      if (!r || !r.ok) {
        setHint(errMsg_(r) || '통합 시트 저장에 실패했습니다.', true);
        return;
      }
      const d = (r.data && r.data) || {};
      const sheetUrl = d.spreadsheetUrl != null ? String(d.spreadsheetUrl) : '';
      const folderUrl = d.folderUrl != null ? String(d.folderUrl) : '';
      setHint(
        sheetUrl
          ? '통합 시트를 만들었습니다. 파일: ' + sheetUrl + (folderUrl ? ' · 폴더: ' + folderUrl : '')
          : '통합 시트를 만들었습니다.',
        true
      );
    } catch (e) {
      setHint('통합 시트 저장 요청이 끝나지 않았습니다. 잠시 뒤 다시 시도해 주세요.', true);
    } finally {
      hideAnBusyOverlay_();
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
    z.textContent = '연간';
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
    z.textContent = '연간';
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

  function normalizeLoadedGoalRow_(x) {
    const gTarget = normalizePayloadGoalTargetKey_(
      String(
        x.goal_target != null
          ? x.goal_target
          : x.goalTarget != null
            ? x.goalTarget
            : x.scopeKey != null
              ? x.scopeKey
              : ''
      ).trim()
    );
    const sk =
      gTarget ||
      normalizePayloadGoalTargetKey_(
        String(x.scopeKey != null ? x.scopeKey : x.scope_key != null ? x.scope_key : '').trim()
      );
    const yL = coercePayloadGoalYear_(x.year);
    const mL = coercePayloadGoalMonth_(x.month);
    return {
      year: isFinite(yL) ? yL : x.year,
      month: isFinite(mL) ? mL : x.month,
      goal_target: gTarget || sk,
      scope: 'category',
      scopeKey: sk,
      targetAmount:
        x.targetAmount != null
          ? x.targetAmount
          : x.target_amount != null
            ? x.target_amount
            : x.sales_target != null
              ? x.sales_target
              : x.salesTarget,
      targetCount:
        x.targetCount != null
          ? x.targetCount
          : x.target_count != null
            ? x.target_count
            : x.people_target != null
              ? x.people_target
              : x.peopleTarget,
      notes: x.notes != null ? String(x.notes) : ''
    };
  }

  /**
   * 상단 카드 목표 기준 — 일별 순매출 「보기 범위」와 같은 키.
   * - entire: `전체` 목표 한 줄 우선, 없으면 솔패스·챌린지·솔루틴 목표 합
   * - solpass 등: 해당 목표 구분 한 줄만
   * @param {number} y
   * @param {number} m
   * @param {string} [vizScopeRaw] el.vizScope.value
   * @return {{ kind: 'entire'|'sum'|'single'|'none', row?: object, sumSales: number|null, sumOrders: number|null }}
   */
  function resolveCardTargetBaseline_(y, m, vizScopeRaw) {
    const sc =
      String(vizScopeRaw != null && vizScopeRaw !== '' ? vizScopeRaw : 'entire')
        .trim()
        .toLowerCase() || 'entire';
    /** @type {object[]} */
    const rows = [];
    let i;
    for (i = 0; i < localRows.length; i++) {
      const row = localRows[i];
      if (Math.floor(Number(row.year)) !== y || Math.floor(Number(row.month)) !== m) {
        continue;
      }
      rows.push(row);
    }
    if (sc !== 'entire' && VIZ_SCOPE_DROPDOWN_KEYS[sc]) {
      let j;
      for (j = 0; j < rows.length; j++) {
        if (goalKeyEntire_(rows[j]) === sc) {
          const one = rows[j];
          return {
            kind: 'single',
            row: one,
            sumSales: parseTargetNum_(one.targetAmount),
            sumOrders: parseTargetNum_(one.targetCount)
          };
        }
      }
      return { kind: 'none', sumSales: null, sumOrders: null };
    }
    let entireRow = null;
    let j;
    for (j = 0; j < rows.length; j++) {
      if (goalKeyEntire_(rows[j]) === 'entire') {
        entireRow = rows[j];
        break;
      }
    }
    if (entireRow) {
      return {
        kind: 'entire',
        row: entireRow,
        sumSales: parseTargetNum_(entireRow.targetAmount),
        sumOrders: parseTargetNum_(entireRow.targetCount)
      };
    }
    let sSum = 0;
    let oSum = 0;
    let hasS = false;
    let hasO = false;
    for (j = 0; j < rows.length; j++) {
      const g = goalKeyEntire_(rows[j]);
      if (!KPI_GOAL_TARGET_SET[g] || g === 'entire') {
        continue;
      }
      const ts = parseTargetNum_(rows[j].targetAmount);
      const to = parseTargetNum_(rows[j].targetCount);
      if (ts != null && ts > 0) {
        sSum += ts;
        hasS = true;
      }
      if (to != null && to > 0) {
        oSum += to;
        hasO = true;
      }
    }
    if (!hasS && !hasO) {
      return { kind: 'none', sumSales: null, sumOrders: null };
    }
    return {
      kind: 'sum',
      sumSales: hasS ? sSum : null,
      sumOrders: hasO ? oSum : null
    };
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
      el.actRow2LblA.textContent = '매출 목표(원)' + AN_ACTUAL_EXCL_NOTE;
      el.actRow2LblB.textContent = '주문 목표(건)' + AN_ACTUAL_EXCL_NOTE;
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
    const cardScope = el.vizScope && el.vizScope.value ? String(el.vizScope.value).trim().toLowerCase() : 'entire';
    const bl = resolveCardTargetBaseline_(yv, mv, cardScope);
    let baseS = NaN;
    let baseO = NaN;
    if (bl.kind !== 'none') {
      baseS = bl.sumSales != null ? bl.sumSales : NaN;
      baseO = bl.sumOrders != null ? bl.sumOrders : NaN;
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

    if (bl.kind !== 'none') {
      el.actRow2Title.textContent = mv === 0 ? '연간 목표' : '이번 기간 목표';
      let sub2 = '';
      if (bl.kind === 'sum') {
        sub2 =
          '「전체」목표 한 줄이 없을 때 — 솔패스·챌린지·솔루틴에 넣은 목표를 합산해 비교합니다.';
      } else if (bl.kind === 'single') {
        const labS = AN_CATEGORY_KEY_LABEL[cardScope] != null ? AN_CATEGORY_KEY_LABEL[cardScope] : cardScope;
        sub2 = '위 일별 순매출 「보기 범위」(' + labS + ')와 같은 목표 구분 한 줄입니다.';
      }
      if (mv === 0) {
        el.actRow2Sub.textContent =
          '표의 월 0(연간) 목표 행과, 이 연도 누적 실적을 맞춥니다.' + (sub2 ? ' ' + sub2 : '');
        el.actRow2Sub.removeAttribute('hidden');
      } else if (sub2) {
        el.actRow2Sub.textContent = sub2;
        el.actRow2Sub.removeAttribute('hidden');
      } else {
        el.actRow2Sub.textContent = '';
        el.actRow2Sub.setAttribute('hidden', '');
      }
      el.actRow2LblA.textContent = '매출 목표(원)' + AN_ACTUAL_EXCL_NOTE;
      el.actRow2LblB.textContent = '주문 목표(건)' + AN_ACTUAL_EXCL_NOTE;
      const ts = bl.sumSales;
      const to = bl.sumOrders;
      el.actRow2ValA.textContent = ts != null && ts > 0 ? fmtKrw_(ts) : '—';
      el.actRow2ValB.textContent = to != null && to > 0 ? fmtInt_(to) : '—';
    } else {
      el.actRow2Title.textContent = mv === 0 ? '전년도 실적(연간 합계)' : '전년 동월 실적';
      const py = pv.year != null ? Number(pv.year) : yv - 1;
      const pm = pv.month != null ? Number(pv.month) : mv;
      let sub = '';
      if (pm === 0) {
        sub = py + '년 1–12월 합계';
      } else {
        sub = py + '년 ' + pm + '월';
      }
      el.actRow2Sub.textContent = sub;
      el.actRow2Sub.removeAttribute('hidden');
      el.actRow2LblA.textContent = '실제 매출(원)' + AN_ACTUAL_EXCL_NOTE;
      el.actRow2LblB.textContent = '주문 건수' + AN_ACTUAL_EXCL_NOTE;
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
    let mPick = parseInt(curMStr, 10);
    if (!_anPeriodFilterBootstrapped) {
      _anPeriodFilterBootstrapped = true;
      if (ySel === yNow0) {
        mPick = mNow0;
      } else if (!isFinite(mPick) || mPick < 0 || mPick > 12) {
        mPick = 1;
      }
    } else if (!isFinite(mPick) || mPick < 0 || mPick > 12) {
      mPick = ySel === yNow0 ? mNow0 : 1;
    }
    el.filterM.value = String(mPick);
    if (GAS_MODE.canSync && !GAS_MODE.useMock) {
      void loadMasterActuals_();
    }
    void loadFactViz_();
  }

  function rowPassesFilter(r) {
    if (!el.filterY) {
      return true;
    }
    const yf = parseInt(String(el.filterY.value), 10);
    if (!isFinite(yf)) {
      return true;
    }
    const yr = Math.floor(Number(r.year));
    const mr = Math.floor(Number(r.month));
    if (yr !== yf) {
      return false;
    }
    if (_kpiAnnualRows) {
      return mr === 0;
    }
    /* 월·일별 보기 범위와 무관 — 선택 연도에 넣은 목표는 표에 모두 둠 */
    return true;
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
    o0.textContent = '전체(사이트) — 상품군별';
    el.vizScope.appendChild(o0);
    for (let si = 0; si < order.length; si++) {
      const ck = String(order[si]);
      if (!VIZ_SCOPE_DROPDOWN_KEYS[ck]) {
        continue;
      }
      const op = document.createElement('option');
      op.value = ck;
      const lab0 = AN_CATEGORY_KEY_LABEL[ck] != null ? AN_CATEGORY_KEY_LABEL[ck] : ck;
      op.textContent = lab0 + ' (상품별)';
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
      const g = goalKeyEntire_(row);
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
      actualNet = sumNetAllMonthTotals_(mt);
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
      prevNet = sumNetAllMonthTotals_(ptot);
    } else {
      const t3 = ptot[sc];
      if (t3) {
        prevNet = (t3.sales != null ? Number(t3.sales) : 0) - (t3.refund != null ? Number(t3.refund) : 0);
      }
    }
    const pAvail = report && report.previousYearDataAvailable === true;
    const pctG =
      gSales != null && isFinite(gSales) && gSales > 0
        ? ' · 목표 대비 달성률 ' + ((actualNet / gSales) * 100).toFixed(1) + '%'
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
        prevPart += ' (작년 같은 달 대비 ' + (((actualNet - prevNet) / Math.abs(prevNet)) * 100).toFixed(1) + '%)';
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
    const mIsYear = m === 0;
    if (el.vizPeriodMeta) {
      if (m >= 1 && m <= 12) {
        el.vizPeriodMeta.textContent = '· ' + y + '년 ' + anFilterMonthLabel_(m);
      } else if (mIsYear) {
        el.vizPeriodMeta.textContent = '· ' + y + '년 ' + anFilterMonthLabel_(0);
      } else {
        el.vizPeriodMeta.textContent = '';
      }
    }
    const cur = report && report.current;
    const byDay = (cur && cur.byDay) || {};
    const order = (report && report.categoryOrder) || [];
    if (!order.length) {
      el.vizScroll.innerHTML =
        '<p class="sp-an-viz__empty">상품군별 데이터가 없어 표를 만들지 못했습니다. 아직 동기화·집계가 안 됐을 수 있습니다.</p>';
      paintVizScopeStrip_(report, y, m);
      return;
    }
    const ymdSeq = buildYmdSequenceForViz_(y, m);
    if (!ymdSeq.length) {
      el.vizScroll.innerHTML = '<p class="sp-an-viz__empty">표 기간을 만들지 못했습니다.</p>';
      paintVizScopeStrip_(report, y, m);
      return;
    }
    const colN = ymdSeq.length;
    const todayYmdViz = seoulYmdToday_();
    const colExcluded = ymdSeq.map(function (ymd0) {
      if (!mIsYear) {
        return false;
      }
      return vizYmdExcludedFromYearGrid_(ymd0, todayYmdViz, _boundsMinYmd);
    });
    const sumHead = mIsYear ? '연 합(순)' : '월 합(순)';
    const mtdLabel = mIsYear ? '연 누적(순)' : '이달 누적(순)';
    const mtdTitle = mIsYear
      ? '이 해 순매출 누적 합계(말일 기준과 같음)'
      : '이 달 순매출 누적 합계(말일 기준과 같음)';

    const scp0 = (el.vizScope && el.vizScope.value) || 'entire';
    const names = (report && report.prodNameByNo) || {};
    const fr = factRows != null && factRows.length ? factRows : [];
    const aggP = fr.length ? aggregateFactRows(fr, y, m) : { byDayCat: {}, byDayProd: {} };
    const bdp = aggP.byDayProd != null ? aggP.byDayProd : {};
    let theadWeek = '<tr><th class="sp-an-viz__row-h sp-an-viz__whead" scope="col">주</th>';
    let theadDay = '<tr><th class="sp-an-viz__row-h sp-an-viz__dhead" scope="col">일</th>';
    let ci;
    for (ci = 0; ci < colN; ci++) {
      const ymdH = ymdSeq[ci];
      const prH = ymdH.split('-');
      const yH = parseInt(prH[0], 10);
      const moH = parseInt(prH[1], 10);
      const domH = parseInt(prH[2], 10);
      const dnH = daysInMonth(yH, moH);
      const wkOrd = calendarWeekOrdinalsByDom(yH, moH, dnH)[domH];
      theadWeek +=
        '<th class="sp-an-viz__whead" scope="col" title="' +
        yH +
        '년 ' +
        moH +
        '월 · 달력 ' +
        wkOrd +
        '주차(월~일, 이 달 구간)">' +
        wkOrd +
        '주</th>';
      theadDay +=
        '<th class="sp-an-viz__dhead" scope="col" title="' +
        ymdH +
        '">' +
        (mIsYear ? moH + '/' + domH : String(domH) + '일') +
        '</th>';
    }
    theadWeek += '<th class="sp-an-viz__sum-col" scope="col">' + sumHead + '</th></tr>';
    theadDay += '<th class="sp-an-viz__sum-col" scope="col">(순)</th></tr>';

    let tbody = '';
    function oneCatRow_(cat) {
      const c = String(cat);
      const label = AN_CATEGORY_KEY_LABEL[c] != null ? AN_CATEGORY_KEY_LABEL[c] : c;
      let rowSum = 0;
      let tds = '';
      let cx;
      for (cx = 0; cx < colN; cx++) {
        const ymd = ymdSeq[cx];
        const slice = byDay[ymd] && byDay[ymd][c] ? byDay[ymd][c] : null;
        const sales0 = slice && slice.sales != null ? Number(slice.sales) : 0;
        const ref0 = slice && slice.refund != null ? Number(slice.refund) : 0;
        const net0 = sales0 - ref0;
        if (colExcluded[cx]) {
          tds += '<td class="sp-an-viz__cell-na">—</td>';
        } else {
          rowSum += net0;
          tds += '<td>' + (net0 !== 0 ? fmtKrw_(net0) : '0') + '</td>';
        }
      }
      tds += '<td class="sp-an-viz__sum-col">' + fmtKrw_(rowSum) + '</td>';
      tbody += '<tr><th scope="row" class="sp-an-viz__row-lbl">' + esc(label) + '</th>' + tds + '</tr>';
    }
    if (scp0 === 'entire') {
      for (let ci2 = 0; ci2 < order.length; ci2++) {
        if (String(order[ci2]) === 'unmapped') {
          continue;
        }
        oneCatRow_(order[ci2]);
      }
    } else if (scp0 === 'textbook' || scp0 === 'jasoseo') {
      oneCatRow_(scp0);
    } else {
      const pset = /** @type {Record<string, boolean>} */ ({});
      for (ci = 0; ci < colN; ci++) {
        const ymdX = ymdSeq[ci];
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
        for (ci = 0; ci < colN; ci++) {
          const ymdP = ymdSeq[ci];
          const slP = bdp[ymdP] && bdp[ymdP][kpk] ? bdp[ymdP][kpk] : null;
          const sP = slP && slP.sales != null ? Number(slP.sales) : 0;
          const rP = slP && slP.refund != null ? Number(slP.refund) : 0;
          const nP = sP - rP;
          if (colExcluded[ci]) {
            tdsP += '<td class="sp-an-viz__cell-na">—</td>';
          } else {
            rowSumP += nP;
            tdsP += '<td>' + (nP !== 0 ? fmtKrw_(nP) : '0') + '</td>';
          }
        }
        tdsP += '<td class="sp-an-viz__sum-col">' + fmtKrw_(rowSumP) + '</td>';
        tbody += '<tr><th scope="row" class="sp-an-viz__row-lbl sp-an-viz__row-lbl--prod">↳ ' + esc(labP) + '</th>' + tdsP + '</tr>';
      }
      if (!pList.length) {
        tbody +=
          '<tr><th colspan="' +
          (colN + 2) +
          '" class="sp-an-viz__empty">이 상품군에 해당하는 품목이 이 기간에 없습니다.</th></tr>';
      }
    }

    let rfd = '';
    let totalCol = 0;
    for (ci = 0; ci < colN; ci++) {
      const ymd2 = ymdSeq[ci];
      if (colExcluded[ci]) {
        rfd += '<td class="sp-an-viz__cell-na">—</td>';
      } else {
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
    }
    rfd += '<td class="sp-an-viz__sum-col">–' + fmtKrw_(totalCol) + '</td>';
    tbody += '<tr class="sp-an-viz__row-refund"><th scope="row" class="sp-an-viz__row-lbl">환불(일 합)</th>' + rfd + '</tr>';

    const dailyNet = [];
    for (ci = 0; ci < colN; ci++) {
      const ymd3 = ymdSeq[ci];
      let sumNet = 0;
      if (!colExcluded[ci]) {
        const cats1 = byDay[ymd3] || {};
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
      }
      dailyNet.push(sumNet);
    }
    const mt = (cur && cur.monthTotals) || {};
    let monthGrand = 0;
    if (mIsYear) {
      let gi;
      for (gi = 0; gi < dailyNet.length; gi++) {
        monthGrand += dailyNet[gi] != null ? dailyNet[gi] : 0;
      }
    } else if (scp0 === 'entire') {
      monthGrand = sumNetAllMonthTotals_(mt);
    } else {
      const t4 = mt[scp0];
      if (t4) {
        monthGrand = (t4.sales != null ? Number(t4.sales) : 0) - (t4.refund != null ? Number(t4.refund) : 0);
      }
    }
    let totD = '';
    for (let di0 = 0; di0 < dailyNet.length; di0++) {
      if (colExcluded[di0]) {
        totD += '<td class="sp-an-viz__cell-na">—</td>';
      } else {
        totD += '<td>' + (dailyNet[di0] !== 0 ? fmtKrw_(dailyNet[di0]) : '0') + '</td>';
      }
    }
    totD += '<td class="sp-an-viz__sum-col">' + fmtKrw_(monthGrand) + '</td>';
    tbody += '<tr class="sp-an-viz__row-total"><th scope="row" class="sp-an-viz__row-lbl">일 합(순)</th>' + totD + '</tr>';

    let wkCum = '<tr class="sp-an-viz__row-mrun"><th scope="row" class="sp-an-viz__row-lbl">주 누적(순)</th>';
    for (ci = 0; ci < colN; ci++) {
      if (colExcluded[ci]) {
        wkCum += '<td class="sp-an-viz__cell-na">—</td>';
      } else {
        const ymdW = ymdSeq[ci];
        const prW = ymdW.split('-');
        const y1 = parseInt(prW[0], 10);
        const mo1 = parseInt(prW[1], 10);
        const dom1 = parseInt(prW[2], 10);
        const sW = firstDomCalendarWeekInMonth(y1, mo1, dom1);
        const ymdStart = ymdPadParts_(y1, mo1, sW);
        let iStart = ymdSeq.indexOf(ymdStart);
        if (iStart < 0) {
          iStart = ci;
        }
        let cW = 0;
        let ii;
        for (ii = iStart; ii <= ci; ii++) {
          if (!colExcluded[ii]) {
            cW += dailyNet[ii] != null ? dailyNet[ii] : 0;
          }
        }
        const weekEndDay = lastDomCalendarWeekInMonth(y1, mo1, dom1);
        const isWeekClose = dom1 === weekEndDay;
        wkCum +=
          '<td' +
          (isWeekClose ? ' class="sp-an-viz__wk-total" title="이 달 기준 달력 주(월~일) 구간 누적 — 이 달에서의 구간 마지막일"' : '') +
          '>' +
          fmtKrw_(cW) +
          '</td>';
      }
    }
    wkCum += '<td class="sp-an-viz__sum-col">' + fmtKrw_(monthGrand) + '</td></tr>';
    tbody += wkCum;
    let mtdC =
      '<tr class="sp-an-viz__row-mrun sp-an-viz__row-mrun2"><th scope="row" class="sp-an-viz__row-lbl">' + mtdLabel + '</th>';
    let runM = 0;
    for (ci = 0; ci < colN; ci++) {
      if (colExcluded[ci]) {
        mtdC += '<td class="sp-an-viz__cell-na">—</td>';
      } else {
        runM += dailyNet[ci] != null ? dailyNet[ci] : 0;
        mtdC += '<td>' + fmtKrw_(runM) + '</td>';
      }
    }
    mtdC +=
      '<td class="sp-an-viz__sum-col sp-an-viz__mtd-total" title="' +
      mtdTitle +
      '">' +
      fmtKrw_(monthGrand) +
      '</td></tr>';
    tbody += mtdC;

    paintVizScopeStrip_(report, y, m);
    el.vizScroll.innerHTML =
      '<table class="sp-an-viz-table"><thead>' +
      theadWeek +
      theadDay +
      '</thead><tbody>' +
      tbody +
      '</tbody></table>';
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
   * 연도별 월×상품군 표 — 선택 연도 전체 fact(`month:0`) 요청.
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
      const refundByM =
        _peopleYearRows && _peopleYearRows.length
          ? refundLineCountsByMonthYear(_peopleYearRows, useY)
          : {};
      const co0 = _vizReport && _vizReport.categoryOrder ? _vizReport.categoryOrder : [];
      const ordC = co0 && co0.length ? co0 : Object.keys(AN_CATEGORY_KEY_LABEL);
      let tHH = '<tr><th class="sp-an-viz__row-h" scope="col">상품군</th>';
      let mc;
      for (mc = 1; mc <= 12; mc++) {
        tHH += '<th scope="col">' + mc + '월</th>';
      }
      tHH += '<th class="sp-an-viz__sum-col" scope="col">연 합(구매)</th></tr>';
      const nowL = new Date();
      const yNow0 = nowL.getFullYear();
      const mNow0 = nowL.getMonth() + 1;
      let tBB = '';
      for (let oi0 = 0; oi0 < ordC.length; oi0++) {
        const cname = String(ordC[oi0]);
        if (cname === 'unmapped') {
          continue;
        }
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
          const v0 = Number(cell0);
          const neg0 = isFinite(v0) && v0 < 0;
          const t0 = !isFinite(v0) || v0 === 0 ? '0' : fmtInt_(v0);
          tBB += '<td' + (neg0 ? ' class="sp-an-viz__cell-num-neg"' : '') + '>' + t0 + '</td>';
        }
        tBB +=
          '<td class="sp-an-viz__sum-col' +
          (rTot < 0 ? ' sp-an-viz__cell-num-neg' : '') +
          '">' +
          fmtInt_(rTot) +
          '</td></tr>';
      }
      let refundYearTotal = 0;
      tBB += '<tr class="sp-an-people__sumrow"><th scope="row">환불 건수 총합</th>';
      for (mc = 1; mc <= 12; mc++) {
        if (useY > yNow0 || (useY === yNow0 && mc > mNow0)) {
          tBB += '<td class="sp-an-people__dash">–</td>';
          continue;
        }
        const rv = (refundByM[mc] != null ? Number(refundByM[mc]) : 0);
        refundYearTotal += rv;
        tBB += '<td>' + fmtInt_(rv) + '</td>';
      }
      tBB += '<td class="sp-an-viz__sum-col">' + fmtInt_(refundYearTotal) + '</td></tr>';
      el.peopleMatrix.innerHTML =
        '<p class="sp-an-viz__empty sp-an-people-matrix__caption">' +
        esc(String(useY)) +
        '년 1~12월 구매 건수(상품군·월별 합, 상품군 미정은 제외)와 환불 건수 총합입니다. 아직 지나지 않은 달은 비웁니다.</p>' +
        '<table class="sp-an-viz-table sp-an-people__matrix"><thead>' +
        tHH +
        '</thead><tbody>' +
        tBB +
        '</tbody></table>';
    } catch (_e) {
      el.peopleMatrix.innerHTML =
        '<p class="sp-an-viz__empty">연도 표를 불러오지 못했습니다. 위에서 연도를 확인한 뒤 다시 시도해 주세요.</p>';
    }
  }

  /**
   * @param {string} base
   * @param {number} y fact 필터 연도(또는 최근에 불러온 격자 기준)
   * @param {number} m fact 필터 월(1~12) — `alignFromFilter`가 참이면 인원 Y/M이 여기에 맞춤
   * @param {Object[]|null} monthRows `analyticsFactRowsGet(y, m)`와 같은 기간 캐시(있으면 재요청 생략)
   * @param {boolean} [alignFromFilter] 위 기간[기간]과 인원 Y/M을 맞출지(초기·매출 다시불러오기)
   * @param {boolean} [skipBusyOverlay] 참이면 전체 화면 로딩 모달을 켜지 않음(`loadFactViz_`가 이미 띄운 경우)
   * @return {Promise<void>}
   */
  async function loadPeopleViz_(base, y, m, monthRows, alignFromFilter, skipBusyOverlay) {
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
    const skipBusy = skipBusyOverlay === true;
    if (!skipBusy) {
      showAnBusyOverlay_(
        '표 준비 중',
        '구매 건수 표와 연도별 합계를 불러옵니다. 잠시만 기다려 주세요.'
      );
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
    /**
     * 구매 건수 칸(일별). 0은 "0", 음수는 붉은 배경(환불 등 순감).
     * @param {number} n
     * @return {string}
     */
    function peopleCountTdHtml_(n) {
      const v = Number(n);
      const isNeg = isFinite(v) && v < 0;
      const text = !isFinite(v) || v === 0 ? '0' : fmtInt_(v);
      return '<td' + (isNeg ? ' class="sp-an-viz__cell-num-neg"' : '') + '>' + text + '</td>';
    }
    if (el.peopleLede) {
      el.peopleLede.innerHTML =
        useY +
        '년 ' +
        useM +
        '월 — 날짜별 구매 건수입니다. <strong>품목 분류</strong>에서 <strong>지금 판매 중(진행)</strong>으로 두었고, 이 달과 판매 기간이 겹치는 품목만 보입니다(상품군 미정·판매 종료·시험용·옛 상품 제외). 교재는 「교재」 한 줄로 합칩니다. 맨아래에 날짜별 <strong>환불 건수 총합</strong>을 같이 보여 줍니다.';
    }
    if (el.peopleGrid) {
      el.peopleGrid.innerHTML = '<p class="sp-an-viz__empty">불러오는 중…</p>';
    }
    if (el.peopleMatrix) {
      el.peopleMatrix.innerHTML = '<p class="sp-an-viz__empty">불러오는 중…</p>';
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
      /** 교재 행 1줄 집계 — 팩트 키는 `textbook\tprod_no`, 표시 행만 가상 키 */
      const PEOPLE_TB_AGG_PNO = '__sp_tb_agg__';
      /** @type {string[]} */
      let peopleTextbookPnos = [];
      const peopleTbPnoSeen = /** @type {Record<string, boolean>} */ ({});
      let namesP = /** @type {Record<string, string>} */ ({});
      const repNames = (_vizReport && _vizReport.prodNameByNo) || {};
      let nk;
      for (nk in repNames) {
        if (Object.prototype.hasOwnProperty.call(repNames, nk)) {
          namesP[nk] = String(repNames[nk] != null ? repNames[nk] : '');
        }
      }
      try {
        const rPm = await gasJsonpWithParams(base, 'productMappingList', {}, 120000);
        if (rPm && rPm.ok && rPm.data && rPm.data.rows && Array.isArray(rPm.data.rows)) {
          let ir;
          for (ir = 0; ir < rPm.data.rows.length; ir++) {
            const pr = rPm.data.rows[ir] || {};
            const pnoS = pr.prod_no != null ? String(pr.prod_no).trim() : '';
            if (!pnoS.length) {
              continue;
            }
            const lifeM = String(pr.lifecycle != null ? pr.lifecycle : '').trim().toLowerCase();
            /* 구매 건수 표: 진행(active)만 — 만료·시험용·옛 상품 제외 */
            if (lifeM !== 'active') {
              continue;
            }
            if (
              !productSaleWindowOverlapsMonth_(
                pr.add_time_ymd != null ? String(pr.add_time_ymd) : '',
                pr.sales_end != null ? String(pr.sales_end) : '',
                useY,
                useM
              )
            ) {
              continue;
            }
            let catM = pr.internal_category != null ? String(pr.internal_category).trim() : 'unmapped';
            if (!catM.length) {
              catM = 'unmapped';
            }
            if (catM === 'unmapped') {
              continue;
            }
            const pn0 = pr.product_name != null ? String(pr.product_name).trim() : '';
            if (pn0.length && !namesP[pnoS]) {
              namesP[pnoS] = pn0;
            }
            if (catM === 'textbook') {
              if (!peopleTbPnoSeen[pnoS]) {
                peopleTbPnoSeen[pnoS] = true;
                peopleTextbookPnos.push(pnoS);
              }
            } else {
              pKeys[catM + '\t' + pnoS] = true;
            }
          }
          if (peopleTextbookPnos.length) {
            pKeys['textbook\t' + PEOPLE_TB_AGG_PNO] = true;
          }
        }
      } catch (_pmE) {
        /* 품목 분류 목록 없으면 표시 행 없음(집계는 위 fact만 사용) */
      }
      if (!Object.keys(pKeys).length) {
        /* 운영 분류 목록 상태와 무관하게, 실제 fact(line_count)에 있는 상품 키로 표 행을 복원 */
        const tbSeenFact = /** @type {Record<string, boolean>} */ ({});
        let ymdK;
        for (ymdK in bdpG) {
          if (!Object.prototype.hasOwnProperty.call(bdpG, ymdK)) {
            continue;
          }
          const dayMap = bdpG[ymdK] || {};
          let kFact;
          for (kFact in dayMap) {
            if (!Object.prototype.hasOwnProperty.call(dayMap, kFact)) {
              continue;
            }
            if (String(kFact).indexOf('\t') < 0) {
              continue;
            }
            const seg = String(kFact).split('\t');
            const catF = String(seg[0] || '').trim();
            const pnoF = String(seg.slice(1).join('\t') || '').trim();
            if (!catF.length || !pnoF.length || catF === 'unmapped') {
              continue;
            }
            if (catF === 'textbook') {
              if (!tbSeenFact[pnoF]) {
                tbSeenFact[pnoF] = true;
                peopleTextbookPnos.push(pnoF);
              }
            } else {
              pKeys[catF + '\t' + pnoF] = true;
            }
          }
        }
        if (peopleTextbookPnos.length) {
          pKeys['textbook\t' + PEOPLE_TB_AGG_PNO] = true;
        }
      }
      const daysN2 = daysInMonth(useY, useM);
      const pKeysAll = Object.keys(pKeys);
      const catSeen = /** @type {Record<string, boolean>} */ ({});
      for (let cs = 0; cs < pKeysAll.length; cs++) {
        const ks = pKeysAll[cs];
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
      /** 표·rowspan용: 열 순서(uniqueCats)와 동일하게 카테고리 묶음 정렬, 같은 카테고리 안에서는 상품 키 문자열 */
      const catRankPeople_ = /** @type {Record<string, number>} */ ({});
      for (let cr = 0; cr < uniqueCats.length; cr++) {
        catRankPeople_[String(uniqueCats[cr])] = cr;
      }
      const pSorted = pKeysAll.slice().sort(function (a, b) {
        const pa = a.indexOf('\t') >= 0 ? String(a.split('\t')[0] || '').trim() : '';
        const pb = b.indexOf('\t') >= 0 ? String(b.split('\t')[0] || '').trim() : '';
        const ra = Object.prototype.hasOwnProperty.call(catRankPeople_, pa) ? catRankPeople_[pa] : 9999;
        const rb = Object.prototype.hasOwnProperty.call(catRankPeople_, pb) ? catRankPeople_[pb] : 9999;
        if (ra !== rb) {
          return ra - rb;
        }
        return a < b ? -1 : a > b ? 1 : 0;
      });
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
      theg += '<th class="sp-an-viz__sum-col sp-an-people__col--tot" scope="col">구매 합(건)</th></tr>';
      /** @type {{ catRow: string, lab1: string, rs: number, tdDays: string }[]} */
      const rowItems = [];
      for (let pi0 = 0; pi0 < pSorted.length; pi0++) {
        const kk = pSorted[pi0];
        const catRow = kk.indexOf('\t') >= 0 ? String(kk.split('\t')[0] || '').trim() : '';
        const pno1 = kk.indexOf('\t') >= 0 ? kk.split('\t').slice(1).join('\t') : '';
        const isTbAgg = catRow === 'textbook' && pno1 === PEOPLE_TB_AGG_PNO;
        const lab1 = isTbAgg
          ? String(AN_CATEGORY_KEY_LABEL.textbook != null ? AN_CATEGORY_KEY_LABEL.textbook : '교재')
          : pno1 && namesP[pno1] != null && String(namesP[pno1]).length
            ? String(namesP[pno1])
            : kk;
        let rs = 0;
        let tdDays = '';
        for (let d2 = 1; d2 <= daysN2; d2++) {
          const mma = useM < 10 ? '0' + useM : String(useM);
          const dda = d2 < 10 ? '0' + d2 : String(d2);
          const ymdA = useY + '-' + mma + '-' + dda;
          let nL = 0;
          if (isTbAgg) {
            let tbi;
            for (tbi = 0; tbi < peopleTextbookPnos.length; tbi++) {
              const subK = 'textbook\t' + peopleTextbookPnos[tbi];
              const h0 = bdpG[ymdA] && bdpG[ymdA][subK] ? bdpG[ymdA][subK] : null;
              nL += h0 && h0.lines != null ? Number(h0.lines) : 0;
            }
          } else {
            const h = bdpG[ymdA] && bdpG[ymdA][kk] ? bdpG[ymdA][kk] : null;
            nL = h && h.lines != null ? Number(h.lines) : 0;
          }
          rs += nL;
          tdDays += peopleCountTdHtml_(nL);
        }
        rowItems.push({ catRow: catRow, lab1: lab1, rs: rs, tdDays: tdDays });
      }
      let tbG = '';
      for (let ri = 0; ri < rowItems.length; ri++) {
        const R = rowItems[ri];
        let tdG = R.tdDays;
        const catR = String(R.catRow || '').trim();
        for (let cj0 = 0; cj0 < uniqueCats.length; cj0++) {
          const ccol = String(uniqueCats[cj0]);
          const cmod2 = cj0 % 3;
          const baseCls = 'sp-an-viz__sum-col sp-an-people__col--cat sp-an-people__col--c' + cmod2;
          if (!catR.length || ccol !== catR) {
            tdG +=
              '<td class="' + baseCls + ' sp-an-people__row-cat-na" title="이 칸은 다른 상품군용입니다">—</td>';
          } else if (ri > 0 && String(rowItems[ri - 1].catRow || '').trim() === ccol) {
            /* 앞 행과 같은 카테고리 연속 → rowspan으로 이미 출력됨 */
          } else {
            let runLen = 1;
            let runSum = R.rs;
            for (let t = ri + 1; t < rowItems.length && String(rowItems[t].catRow || '').trim() === ccol; t++) {
              runLen++;
              runSum += rowItems[t].rs;
            }
            tdG +=
              '<td class="' +
              baseCls +
              ' sp-an-people__cat-merge' +
              (runSum < 0 ? ' sp-an-viz__cell-num-neg' : '') +
              '" rowspan="' +
              runLen +
              '" title="같은 상품군(연속 행) 이 달 구매 합(건)">' +
              fmtInt_(runSum) +
              '</td>';
          }
        }
        tdG +=
          '<td class="sp-an-viz__sum-col sp-an-people__col--tot' +
          (R.rs < 0 ? ' sp-an-viz__cell-num-neg' : '') +
          '">' +
          fmtInt_(R.rs) +
          '</td>';
        tbG += '<tr><th scope="row" class="sp-an-viz__row-lbl">' + esc(R.lab1) + '</th>' + tdG + '</tr>';
      }
      if (!pSorted.length) {
        const nc = 2 + daysN2 + (uniqueCats.length > 0 ? uniqueCats.length : 0) + 1;
        tbG =
          '<tr><td colspan="' +
          nc +
          '" class="sp-an-viz__empty">이 달에 표시할 상품이 없습니다. (품목 분류·판매 기간이 맞는 품목이 없거나 목록을 불러오지 못했습니다.)</td></tr>';
      }
      let sumB =
        '<tr class="sp-an-people__sumrow"><th scope="row" title="날짜별 열은 그날 전체 구매 합(건)">이 달 합계</th>';
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
        sumB += peopleCountTdHtml_(dsum);
      }
      for (let ck0 = 0; ck0 < uniqueCats.length; ck0++) {
        const cmod3 = ck0 % 3;
        sumB +=
          '<td class="sp-an-viz__sum-col sp-an-people__col--cat sp-an-people__col--c' +
          cmod3 +
          ' sp-an-people__row-cat-na" title="상품군 합계는 위 표의 같은 상품군 합쳐진 칸을 보세요">' +
          '—' +
          '</td>';
      }
      sumB +=
        '<td class="sp-an-viz__sum-col sp-an-people__col--tot' +
        (ssum < 0 ? ' sp-an-viz__cell-num-neg' : '') +
        '">' +
        fmtInt_(ssum) +
        '</td></tr>';
      let refundSumB =
        '<tr class="sp-an-people__sumrow"><th scope="row" title="상품 구분 없이 그날 발생한 환불 건수 합계">환불 건수 총합</th>';
      let refundMonthTotal = 0;
      for (let d2 = 1; d2 <= daysN2; d2++) {
        const mma3 = useM < 10 ? '0' + useM : String(useM);
        const ddc = d2 < 10 ? '0' + d2 : String(d2);
        const ymdC = useY + '-' + mma3 + '-' + ddc;
        const blkR = bdpG[ymdC] || {};
        let rsum = 0;
        for (const q in blkR) {
          if (Object.prototype.hasOwnProperty.call(blkR, q)) {
            rsum += blkR[q] && blkR[q].refundLines != null ? Number(blkR[q].refundLines) : 0;
          }
        }
        refundMonthTotal += rsum;
        refundSumB += '<td>' + fmtInt_(rsum) + '</td>';
      }
      for (let ck0 = 0; ck0 < uniqueCats.length; ck0++) {
        const cmod4 = ck0 % 3;
        refundSumB +=
          '<td class="sp-an-viz__sum-col sp-an-people__col--cat sp-an-people__col--c' +
          cmod4 +
          ' sp-an-people__row-cat-na" title="환불 건수 총합은 상품 구분 없이 집계">' +
          '—' +
          '</td>';
      }
      refundSumB += '<td class="sp-an-viz__sum-col sp-an-people__col--tot">' + fmtInt_(refundMonthTotal) + '</td></tr>';
      if (el.peopleGrid) {
        el.peopleGrid.innerHTML = '<table class="sp-an-viz-table sp-an-people__grid">' + theg + tbG + sumB + refundSumB + '</table>';
      }

      await loadPeopleYearMatrix_(base, useY);
    } catch (e) {
      if (el.peopleWarn) {
        el.peopleWarn.textContent = '구매 건수 표를 불러오지 못했습니다.';
        el.peopleWarn.removeAttribute('hidden');
      }
    } finally {
      if (!skipBusy) {
        hideAnBusyOverlay_();
      }
    }
  }

  if (el.peopleM && el.peopleY) {
    function onPeopleCh_() {
      if (!ready) {
        return;
      }
      const base0 = String(GAS_BASE_URL).trim();
      void loadPeopleViz_(base0, _vizY, _vizM, _vizRows, false, false);
    }
    el.peopleM.addEventListener('change', onPeopleCh_);
    el.peopleY.addEventListener('change', onPeopleCh_);
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
      void loadMasterActuals_();
    });
  }

  /**
   * 일별 순매출 격자(`#sp-an-viz` 있을 때) + 구매 건수 표를 같은 fact 묶음으로 갱신합니다.
   * @return {Promise<void>}
   */
  async function loadFactViz_() {
    if (GAS_MODE.useMock || !GAS_MODE.canSync) {
      if (el.viz) {
        el.viz.setAttribute('hidden', '');
      }
      return;
    }
    if (!ready) {
      if (el.viz) {
        el.viz.setAttribute('hidden', '');
      }
      return;
    }
    const ym = getAnFilterYm_(el);
    if (el.viz) {
      if (el.vizLede) {
        el.vizLede.textContent =
          ym.m === 0
            ? ym.y +
              '년 ' +
              anFilterMonthLabel_(0) +
              ' · 실제 매출에서 환불을 뺀 순매출입니다. 가로는 그 해 날짜, 세로는 상품군 또는 개별 상품입니다. 환불은 날짜별로 빼서 합칩니다.'
            : ym.y +
              '년 ' +
              anFilterMonthLabel_(ym.m) +
              ' · 실제 매출에서 환불을 뺀 순매출입니다. 세로는 상품군 또는 개별 상품, 가로는 날짜입니다. 환불은 날짜별로 빼서 합칩니다.';
      }
      if (el.vizWarn) {
        el.vizWarn.setAttribute('hidden', '');
      }
      if (el.vizScroll) {
        el.vizScroll.innerHTML = '<p class="sp-an-viz__empty">불러오는 중…</p>';
      }
      el.viz.removeAttribute('hidden');
    }
    const base = String(GAS_BASE_URL).trim();
    showAnBusyOverlay_(
      '불러오는 중',
      '매출과 구매 건수를 가져옵니다. 잠시만 기다려 주세요.'
    );
    try {
      const r = await gasJsonpWithParams(
        base,
        'analyticsFactReport',
        { year: String(ym.y), month: String(ym.m) },
        120000
      );
      if (!r || !r.ok) {
        if (el.viz) {
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
            const msg = formatHintWithErrorCode_(r) || '매출 표를 불러오지 못했습니다.';
            el.vizWarn.textContent = msg;
            el.vizWarn.removeAttribute('hidden');
          }
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
      if (el.viz) {
        const ord = (d0 && d0.categoryOrder) || [];
        buildVizScopeOptions_(ord);
        renderVizAll_(d0, rowList, ym.y, ym.m);
      }
      await loadPeopleViz_(base, ym.y, ym.m, rowList, true, true);
    } catch (e) {
      if (el.viz) {
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
          el.vizWarn.textContent = '매출 표 요청이 끝나지 않았습니다. 잠시 뒤 다시 시도해 주세요.';
          el.vizWarn.removeAttribute('hidden');
        }
      }
      logSolpathApi_('analyticsFactReport', null, e);
    } finally {
      hideAnBusyOverlay_();
    }
  }

  function render() {
    if (!el.tbody) {
      return;
    }
    el.tbody.innerHTML = '';
    var appended = 0;
    const rowsOrdered = localRows
      .map(function (row, idx) {
        return { row: row, idx: idx };
      })
      .filter(function (x) {
        return rowPassesFilter(x.row);
      })
      .sort(function (a, b) {
        const ma = Math.floor(Number(a.row.month));
        const mb = Math.floor(Number(b.row.month));
        const ka = ma === 0 ? -1 : ma;
        const kb = mb === 0 ? -1 : mb;
        if (ka !== kb) {
          return ka - kb;
        }
        return goalKeyEntire_(a.row).localeCompare(goalKeyEntire_(b.row), 'en');
      });
    let ri;
    for (ri = 0; ri < rowsOrdered.length; ri++) {
      const i = rowsOrdered[ri].idx;
      appended += 1;
      const r = localRows[i];
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' +
        esc(r.year) +
        '</td><td>' +
        esc(anKpiMonthCellLabel_(r.month)) +
        '</td><td>' +
        esc(kpiGoalTargetLabel_(goalKeyEntire_(r))) +
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
      tdE.colSpan = 7;
      tdE.className = 'sp-an-table__empty';
      if (localRows.length === 0) {
        tdE.textContent =
          '이 표는 목표만 보입니다. 위「실적 요약」이 동기화 주문 기준이고, 목표는 아래에서 한 줄씩 넣은 뒤「이 줄을 표에 넣기」를 누릅니다.';
      } else if (_kpiAnnualRows) {
        tdE.textContent =
          '선택 연도에 연간 목표 행이 없습니다. 연간 목표를 넣었는지, 연도를 바꿔 보세요.';
      } else {
        tdE.textContent =
          '선택 연도에 표시할 목표 행이 없습니다. 연도를 바꾸거나 목표를 추가해 보세요.';
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
    syncKpiAnnualBtn_();
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
    let mCard;
    if (_kpiAnnualRows) {
      mCard = 0;
    } else if (ym.m === 0) {
      mCard = 0;
    } else {
      mCard = monthForActualsCard_(ym.y, ym.m);
    }
    const url = String(GAS_BASE_URL).trim();
    _lastMasterActuals = null;
    paintActualsCompareUi_();
    try {
      const scopeReq =
        el.vizScope && el.vizScope.value && String(el.vizScope.value).trim().toLowerCase() !== 'entire'
          ? String(el.vizScope.value).trim().toLowerCase()
          : 'entire';
      const r = await gasJsonpWithParams(
        url,
        'analyticsMasterActualsGet',
        { year: String(ym.y), month: String(mCard), scope: scopeReq },
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
          el.actualsWarn.textContent = msg || '실적 숫자를 가져오지 못했습니다.';
          el.actualsWarn.removeAttribute('hidden');
        }
        logSolpathApi_('analyticsMasterActualsGet', r, null);
        return;
      }
      const d = (r.data && r.data) || {};
      _lastMasterActuals = { y: ym.y, m: mCard, d: d };
      paintActualsCompareUi_();
      if (el.actualsWarn && ym.m === 0) {
        el.actualsWarn.setAttribute('hidden', '');
        el.actualsWarn.textContent = '';
      }
    } catch (e) {
      _lastMasterActuals = null;
      paintActualsCompareUi_();
      logSolpathApi_('analyticsMasterActualsGet', null, e);
      if (el.actualsWarn) {
        el.actualsWarn.textContent = '실적 요청이 끝나지 않았습니다.';
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
        return normalizeLoadedGoalRow_(x);
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
    const ymd0 = d && d.analyticsOrderMinYmd != null ? String(d.analyticsOrderMinYmd).trim() : '';
    _boundsMinYmd = /^\d{4}-\d{2}-\d{2}$/.test(ymd0) ? ymd0 : null;
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
  if (el.btnRebuildAnalytics) {
    el.btnRebuildAnalytics.disabled = !GAS_MODE.canSync;
  }

  function validateRowInForm() {
    if (!el.inY || !el.inM || !el.inGoalTarget || !el.inAmt || !el.inCnt) {
      return { ok: false, msg: '입력란을 확인합니다.' };
    }
    const y = Math.floor(Number(el.inY.value));
    const mo = Math.floor(Number(el.inM.value));
    const gt = String(el.inGoalTarget.value || '')
      .trim()
      .toLowerCase();
    const ta = Number(el.inAmt.value);
    const tc = Number(el.inCnt.value);
    if (y < 2000 || y > 2100 || isNaN(y)) {
      return { ok: false, msg: '연도는 2000–2100 사이입니다.' };
    }
    if (mo < 0 || mo > 12) {
      return { ok: false, msg: '월은 연간 또는 1–12월입니다.' };
    }
    if (!KPI_GOAL_TARGET_SET[gt]) {
      return { ok: false, msg: '목표 구분(전체·솔패스·챌린지·솔루틴)을 고릅니다.' };
    }
    if (!isFinite(ta) || ta < 0) {
      return { ok: false, msg: '매출(원)은 0 이상의 숫자입니다.' };
    }
    if (!isFinite(tc) || tc < 0) {
      return { ok: false, msg: '건수는 0 이상의 숫자입니다.' };
    }
    for (let j = 0; j < localRows.length; j++) {
      const ex = localRows[j];
      if (Math.floor(Number(ex.year)) !== y || Math.floor(Number(ex.month)) !== mo) {
        continue;
      }
      if (goalKeyEntire_(ex) === gt) {
        return {
          ok: false,
          msg: '같은 연·월·목표 구분이 이미 있습니다. 표에서 삭제한 뒤 다시 넣어 주세요.'
        };
      }
    }
    return {
      ok: true,
      row: {
        year: y,
        month: mo,
        goal_target: gt,
        scope: 'category',
        scopeKey: gt,
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
  if (el.btnExportBundleTop) {
    el.btnExportBundleTop.addEventListener('click', function () {
      void exportAnalyticsBundleSheet_();
    });
  }
  if (el.btnKpiAnnual) {
    el.btnKpiAnnual.addEventListener('click', function () {
      const next = !_kpiAnnualRows;
      if (el.filterM) {
        if (next) {
          const curM = parseInt(String(el.filterM.value || ''), 10);
          if (isFinite(curM) && curM >= 1 && curM <= 12) {
            _kpiPrevMonthForToggle = curM;
          }
          el.filterM.value = '0';
        } else {
          const restoreM = _kpiPrevMonthForToggle != null ? _kpiPrevMonthForToggle : new Date().getMonth() + 1;
          el.filterM.value = String(restoreM >= 1 && restoreM <= 12 ? restoreM : 1);
        }
      }
      _kpiAnnualRows = next;
      syncKpiAnnualBtn_();
      render();
      setHint(
        _kpiAnnualRows
          ? '연간 모드: 월을 전체(연간)로 전환하고, 표는 월 0 목표·카드는 연도 합계 실적/목표로 맞춥니다.'
          : '월간 모드: 표는 이 연도 목표 전체, 카드는 위에서 고른 월(또는 전체) 실적입니다.',
        true
      );
      window.requestAnimationFrame(function () {
        const scrollEl = el.tableWrap || el.kpiBlock;
        if (scrollEl) {
          scrollEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
      onAnPeriodChange_();
    });
  }

  async function rebuildAnalyticsSheets_() {
    if (!GAS_MODE.canSync) {
      return;
    }
    const ok = window.confirm(
      '지표 DB를 다시 생성/연결하고 집계를 다시 채웁니다.\n\n' +
        '문제가 있을 때만 사용하세요. 진행할까요?'
    );
    if (!ok) {
      return;
    }
    if (el.btnRebuildAnalytics) {
      el.btnRebuildAnalytics.disabled = true;
    }
    if (el.btnInit) {
      el.btnInit.disabled = true;
    }
    if (el.btnReset) {
      el.btnReset.disabled = true;
    }
    setHint('지표 DB를 준비하는 중…', true);
    try {
      const r = await gasJsonpWithParams(url, 'initAnalyticsSheets', null, 180000);
      if (!r || !r.ok) {
        logSolpathApi_('initAnalyticsSheets', r, null);
        setHint(formatHintWithErrorCode_(r) || '지표 DB 준비에 실패했습니다.', true);
        return;
      }
      const d0 = (r && r.data) || {};
      applyAnalyticsHeaderUrls(mount, {
        analyticsReady: true,
        analyticsSpreadsheetUrl: d0.url
      });
      ready = true;
      syncAnUi_();
      await loadTargets();
      void loadFactViz_();
      void loadMasterActuals_();
      setHint('지표 DB를 다시 준비했습니다.', true);
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
          ? '응답이 지연되었습니다. 잠시 뒤 다시 시도해 주세요.'
          : '요청이 끝나지 않았습니다. 문제가 계속되면 담당자에게 알려 주세요.',
        true
      );
    } finally {
      if (el.btnRebuildAnalytics) {
        el.btnRebuildAnalytics.disabled = !GAS_MODE.canSync;
      }
      if (el.btnInit) {
        el.btnInit.disabled = !GAS_MODE.canSync;
      }
      if (el.btnReset) {
        el.btnReset.disabled = !GAS_MODE.canSync;
      }
    }
  }

  async function resetAll_() {
    if (!GAS_MODE.canSync || !ready) {
      return;
    }
    const ok = window.confirm('여기에 적어 둔 목표·일 단위 캐시를 모두 비웁니다. 되돌릴 수 없습니다. 정말 진행할까요?');
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
  }

  if (el.btnInit) {
    el.btnInit.addEventListener('click', async function () {
      if (!GAS_MODE.canSync) {
        return;
      }
      await rebuildAnalyticsSheets_();
    });
  }

  if (el.btnRebuildAnalytics) {
    el.btnRebuildAnalytics.addEventListener('click', async function () {
      await rebuildAnalyticsSheets_();
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
      await resetAll_();
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
    setHint('연동 주소가 없어 미리보기만 됩니다. 실제 사용 전 담당자에게 연결을 요청하세요.', true);
  }

  syncAnUi_();
  rebuildFilterYearMonth_();
  syncKpiAnnualBtn_();

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
