/**
 * 대시보드 시각화 — GAS factReport / factRows 집계·HTML (ANALYTICS_DASHBOARD_NEXT)
 */

export const AN_FACT = {
  SALES: 'sales_amount',
  REFUND: 'refund_amount',
  REFUND_LINES: 'refund_line_count',
  LINES: 'line_count',
  UM: 'unique_members',
  UMC: 'unique_members_month_category'
};

/**
 * @param {Object[]} rows
 * @param {number} y
 * @param {number} m 1–12 또는 0(해당 연 전체)
 */
export function aggregateFactRows(rows, y, m) {
  const byDayCat = {};
  const byDayProd = {};
  let i;
  for (i = 0; i < rows.length; i++) {
    const r = rows[i] || {};
    const d = String(r.date_ymd != null ? r.date_ymd : '');
    const pr = d.split('-');
    if (pr.length < 2) {
      continue;
    }
    if (parseInt(pr[0], 10) !== y) {
      continue;
    }
    if (m >= 1 && m <= 12) {
      if (parseInt(pr[1], 10) !== m) {
        continue;
      }
    }
    const met = String(r.metric);
    if (met === AN_FACT.UMC || met === AN_FACT.UM) {
      continue;
    }
    const cat = String(r.internal_category);
    const pno = String(r.prod_no != null ? r.prod_no : '').trim();
    const v = Number(r.value);
    const v0 = isFinite(v) ? v : 0;
    if (!byDayCat[d]) {
      byDayCat[d] = {};
    }
    if (!byDayCat[d][cat]) {
      byDayCat[d][cat] = { sales: 0, refund: 0, lines: 0, refundLines: 0 };
    }
    const pk = pno.length ? cat + '\t' + pno : null;
    if (pk) {
      if (!byDayProd[d]) {
        byDayProd[d] = {};
      }
      if (!byDayProd[d][pk]) {
        byDayProd[d][pk] = { sales: 0, refund: 0, lines: 0, refundLines: 0 };
      }
    }
    if (met === AN_FACT.SALES) {
      byDayCat[d][cat].sales += v0;
      if (pk) {
        byDayProd[d][pk].sales += v0;
      }
    } else if (met === AN_FACT.REFUND) {
      byDayCat[d][cat].refund += v0;
      if (pk) {
        byDayProd[d][pk].refund += v0;
      }
    } else if (met === AN_FACT.LINES) {
      byDayCat[d][cat].lines += v0;
      if (pk) {
        byDayProd[d][pk].lines += v0;
      }
    } else if (met === AN_FACT.REFUND_LINES) {
      byDayCat[d][cat].refundLines += v0;
      if (pk) {
        byDayProd[d][pk].refundLines += v0;
      }
    }
  }
  return { byDayCat, byDayProd };
}

/**
 * @param {Object[]} rows `analyticsFactRowsGet(y,0)` 권장 — **연·라인(건)만** 모아 월(1~12)→대분류→건
 * @param {number} y
 */
export function lineCountsByMonthCategoryYear(rows, y) {
  const o = {};
  let mi;
  for (mi = 1; mi <= 12; mi++) {
    o[mi] = {};
  }
  let i;
  for (i = 0; i < rows.length; i++) {
    const r = rows[i] || {};
    if (String(r.metric) !== AN_FACT.LINES) {
      continue;
    }
    const d = String(r.date_ymd);
    const pr = d.split('-');
    if (pr.length < 2) {
      continue;
    }
    if (parseInt(pr[0], 10) !== y) {
      continue;
    }
    const mo = parseInt(pr[1], 10);
    if (mo < 1 || mo > 12) {
      continue;
    }
    const cat = String(r.internal_category);
    const pno = String(r.prod_no != null ? r.prod_no : '').trim();
    if (!pno.length) {
      continue;
    }
    const v = Number(r.value);
    const v0 = isFinite(v) ? v : 0;
    if (!o[mo][cat]) {
      o[mo][cat] = 0;
    }
    o[mo][cat] += v0;
  }
  return o;
}

/**
 * @param {Object[]} rows `analyticsFactRowsGet(y,0)` 권장 — 월(1~12)별 전체 환불 건수(상품 무관)
 * @param {number} y
 * @return {Record<number, number>}
 */
export function refundLineCountsByMonthYear(rows, y) {
  const out = {};
  for (let mi = 1; mi <= 12; mi++) {
    out[mi] = 0;
  }
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || {};
    if (String(r.metric) !== AN_FACT.REFUND_LINES) {
      continue;
    }
    const d = String(r.date_ymd != null ? r.date_ymd : '');
    const pr = d.split('-');
    if (pr.length < 2 || parseInt(pr[0], 10) !== y) {
      continue;
    }
    const mo = parseInt(pr[1], 10);
    if (mo < 1 || mo > 12) {
      continue;
    }
    const v = Number(r.value);
    out[mo] += isFinite(v) ? v : 0;
  }
  return out;
}

/**
 * @param {number} y
 * @param {number} m
 */
export function daysInMonth(y, m) {
  return new Date(y, m, 0).getDate();
}

/**
 * @param {number} y
 * @param {number} m 1–12
 * @param {number} dom
 * @return {Date} 해당 일이 속한 주의 월요일 00:00 (로컬)
 */
function mondayOfWeekLocal_(y, m, dom) {
  const dt = new Date(y, m - 1, dom);
  const dow = dt.getDay();
  const off = dow === 0 ? -6 : 1 - dow;
  dt.setDate(dt.getDate() + off);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

/**
 * 달력 주(월~일): 이 연·월 안에서만 합산할 때의 구간 시작일(1~31).
 * 이전 달에 속한 월요일이면 그 주는 이 달에서는 1일부터.
 * @param {number} y
 * @param {number} m
 * @param {number} dom
 * @return {number}
 */
export function firstDomCalendarWeekInMonth(y, m, dom) {
  const mon = mondayOfWeekLocal_(y, m, dom);
  const monthStart = new Date(y, m - 1, 1);
  monthStart.setHours(0, 0, 0, 0);
  if (mon.getTime() < monthStart.getTime()) {
    return 1;
  }
  return mon.getDate();
}

/**
 * 같은 달력 주 구간이 이 달에서 끝나는 마지막 일(말일로 잘림).
 * @param {number} y
 * @param {number} m
 * @param {number} dom
 * @return {number}
 */
export function lastDomCalendarWeekInMonth(y, m, dom) {
  const mon = mondayOfWeekLocal_(y, m, dom);
  const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
  sun.setHours(0, 0, 0, 0);
  const monthEnd = new Date(y, m, 0);
  monthEnd.setHours(0, 0, 0, 0);
  const rangeEnd = sun.getTime() <= monthEnd.getTime() ? sun : monthEnd;
  return rangeEnd.getDate();
}

/**
 * 이 달 1~daysN 각 일이 속하는 "달력 주 조각"의 1부터 시작하는 주차 번호.
 * @param {number} y
 * @param {number} m
 * @param {number} daysN
 * @return {number[]} 인덱스 dom(1~daysN) → 주차; [0] 미사용
 */
export function calendarWeekOrdinalsByDom(y, m, daysN) {
  const out = /** @type {number[]} */ ([0]);
  let ix = 0;
  let prevT = /** @type {number|null} */ (null);
  for (let d = 1; d <= daysN; d++) {
    const mon = mondayOfWeekLocal_(y, m, d);
    const t = mon.getTime();
    if (prevT === null || t !== prevT) {
      ix++;
      prevT = t;
    }
    out[d] = ix;
  }
  return out;
}
