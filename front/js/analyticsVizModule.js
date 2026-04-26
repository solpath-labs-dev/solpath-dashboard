/**
 * 대시보드 시각화 — GAS factReport / factRows 집계·HTML (ANALYTICS_DASHBOARD_NEXT)
 */

export const AN_FACT = {
  SALES: 'sales_amount',
  REFUND: 'refund_amount',
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
      byDayCat[d][cat] = { sales: 0, refund: 0, lines: 0 };
    }
    const pk = pno.length ? cat + '\t' + pno : null;
    if (pk) {
      if (!byDayProd[d]) {
        byDayProd[d] = {};
      }
      if (!byDayProd[d][pk]) {
        byDayProd[d][pk] = { sales: 0, refund: 0, lines: 0 };
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
 * @param {number} y
 * @param {number} m
 */
export function daysInMonth(y, m) {
  return new Date(y, m, 0).getDate();
}

/**
 * @param {number} d day of month
 */
export function startOfBlockWeekInMonth(d) {
  return (Math.ceil(d / 7) - 1) * 7 + 1;
}
