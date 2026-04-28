/**
 * Open API `GET /orders` — 페이지 전체 루프·**스냅샷** → `orders` + `order_items` 시트.
 * (응답: `data.list[]` + `sections[].sectionItems[]` + `productInfo`)
 *
 * `apiTest.js` `imwebTGet_` + `imwebTBuildOpenOrdersListQuery_` 쿼리(기간) 재사용.
 *
 * [실행] — 이 파일만 열었을 때 `dbSyncOrdersOpen`·`dbSyncOpenAll`만 드롭다운에 뜨는 UI가 있음.
 * members·products까지 한 파일에서 골리려면 `RunOpenSync.js`를 연 뒤 `run_OpenSync_*` 사용.
 */

function dbSyncOrdersOpen() {
  var p = PropertiesService.getScriptProperties();
  if (
    p.getProperty('IMWEB_OAUTH_ACCESS_TOKEN') == null ||
    String(p.getProperty('IMWEB_OAUTH_ACCESS_TOKEN')).trim() === ''
  ) {
    throw new Error('IMWEB_OAUTH_ACCESS_TOKEN 없음.');
  }
  var uc = p.getProperty(DB_PROP_UNIT_CODE) != null ? String(p.getProperty(DB_PROP_UNIT_CODE)).trim() : '';
  if (!uc.length) {
    throw new Error('IMWEB_UNIT_CODE 없음. site-info 후 실행.');
  }

  var syncId = Utilities.getUuid();
  var t0 = new Date();
  var msg = '';
  var rO = 0;
  var rI = 0;
  var status = 'OK';
  var nowIso = t0.toISOString();
  var allOrders = [];
  var allItems = [];

  try {
    var page = 1;
    var pageSize = 50;
    var totPage = 1;
    do {
      if (page > 1) {
        Utilities.sleep(200);
      }
      var q = imwebTBuildOpenOrdersListQueryForPage_(uc, page, pageSize);
      var g = imwebTGetWithOpenSyncRetry_('/orders', q);
      if (g._http !== 200) {
        throw new Error('GET /orders http=' + g._http + ' ' + String(g._text).slice(0, 400));
      }
      var j = JSON.parse(g._text || '{}');
      if (j.statusCode !== 200 || j.data == null) {
        throw new Error('orders body: ' + String(g._text).slice(0, 300));
      }
      var data = j.data;
      if (data.totalPage != null) {
        totPage = Math.max(1, Number(data.totalPage));
      }
      var list = data.list;
      if (!Array.isArray(list) || !list.length) {
        break;
      }
      var a;
      for (a = 0; a < list.length; a++) {
        var ord = list[a];
        allOrders.push(dbMapOrderRowOpen_(ord, nowIso, syncId));
        var itRows = dbFlattenOrderItemRowsOpen_(ord, nowIso, syncId);
        var b;
        for (b = 0; b < itRows.length; b++) {
          allItems.push(itRows[b]);
        }
      }
      page++;
    } while (page <= totPage);

    var ss = dbOpenMaster_();
    var shO = dbGetOrCreateSheetWithHeaders_(ss, DB_SHEET_ORDERS, DB_ORDERS_HEADERS);
    var shI = dbGetOrCreateSheetWithHeaders_(ss, DB_SHEET_ORDER_ITEMS, DB_ORDER_ITEMS_HEADERS);
    var wO = DB_ORDERS_HEADERS.length;
    var wI = DB_ORDER_ITEMS_HEADERS.length;
    dbClearDataRows2Plus_(shO, wO);
    dbClearDataRows2Plus_(shI, wI);
    dbSetValuesFromRow2_(shO, allOrders, wO);
    dbSetValuesFromRow2_(shI, allItems, wI);
    rO = allOrders.length;
    rI = allItems.length;
    msg = 'orders=' + rO + ' order_items=' + rI;
  } catch (e) {
    status = 'ERROR';
    msg = e && e.message != null ? e.message : String(e);
  }

  var t1 = new Date();
  dbAppendSyncLog_({
    syncId: syncId,
    started: t0,
    ended: t1,
    entity: 'orders+order_items',
    status: status,
    rowsWritten: rO + rI,
    message: status === 'OK' ? msg : msg
  });
  if (status !== 'OK') {
    throw new Error(msg);
  }
  Logger.log('dbSyncOrdersOpen ' + msg);
  return { syncId: syncId, orderRows: rO, itemRows: rI };
}

/**
 * members → products(1p) → orders — Executions 6분 제한 주의(주문·회원이 많으면 개별 Run).
 * @return {{ members: Object, products: Object, orders: Object }}
 */
function dbSyncOpenAll() {
  Logger.log('[dbSyncOpenAll] start: 선 refresh 없음, 각 API 요청에서 401/30101일 때만 refresh 후 1회 재시도');
  return {
    members: dbSyncMembersOpen(),
    products: dbSyncProductsOnePage(),
    orders: dbSyncOrdersOpen()
  };
}

/**
 * 한국 전화번호 정규화(저장용): 000-0000-0000
 * - 02(서울) 10자리: 02-1234-5678
 * - 휴대폰/지역번호 11자리: 010-1234-5678, 031-1234-5678
 * - 10자리(비 02): 031-123-4567
 * @param {*} raw
 * @return {string}
 */
function dbNormalizeKrPhoneDashed_(raw) {
  var s = raw != null ? String(raw).trim() : '';
  if (!s.length) {
    return '';
  }
  var d = s.replace(/[^\d]/g, '');
  if (!d.length) {
    return '';
  }
  if (d.indexOf('82') === 0) {
    d = '0' + d.slice(2);
  }
  if (d.length === 11) {
    return d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7);
  }
  if (d.length === 10) {
    if (d.indexOf('02') === 0) {
      return d.slice(0, 2) + '-' + d.slice(2, 6) + '-' + d.slice(6);
    }
    return d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6);
  }
  if (d.length === 9 && d.indexOf('02') === 0) {
    return d.slice(0, 2) + '-' + d.slice(2, 5) + '-' + d.slice(5);
  }
  return d;
}

/**
 * @param {string} unitCode
 * @param {number} page
 * @param {number} limit
 */
function imwebTBuildOpenOrdersListQueryForPage_(unitCode, page, limit) {
  var end = new Date();
  var start = new Date();
  start.setDate(start.getDate() - 180);
  return {
    page: page,
    limit: limit,
    unitCode: String(unitCode != null ? unitCode : '').trim(),
    startWtime: start.toISOString(),
    endWtime: end.toISOString()
  };
}

function dbMapOrderRowOpen_(order, fetchedAtIso, sourceSyncId) {
  order = order || {};
  return [
    order.orderNo != null ? String(order.orderNo) : '',
    order.wtime != null ? String(order.wtime) : '',
    order.memberCode != null ? String(order.memberCode) : '',
    order.ordererName != null ? String(order.ordererName) : '',
    dbNormalizeKrPhoneDashed_(order.ordererCall),
    order.orderStatus != null ? String(order.orderStatus) : '',
    order.orderType != null ? String(order.orderType) : '',
    order.currency != null ? String(order.currency) : '',
    order.totalPrice != null ? order.totalPrice : '',
    order.totalDiscountPrice != null ? order.totalDiscountPrice : '',
    order.totalPoint != null ? order.totalPoint : '',
    dbSumOrderLineCouponOpen_(order),
    order.totalPaymentPrice != null ? order.totalPaymentPrice : '',
    fetchedAtIso,
    sourceSyncId != null ? String(sourceSyncId) : ''
  ];
}

function dbSumOrderLineCouponOpen_(order) {
  var t = 0;
  var secs = order.sections;
  if (!Array.isArray(secs)) {
    return t;
  }
  var s, j, it, row;
  for (s = 0; s < secs.length; s++) {
    it = secs[s] && secs[s].sectionItems;
    if (!Array.isArray(it)) {
      continue;
    }
    for (j = 0; j < it.length; j++) {
      row = it[j];
      t += dbNumO_(row && row.itemCouponDiscount);
    }
  }
  return t;
}

function dbNumO_(x) {
  if (x == null) {
    return 0;
  }
  var n = Number(x);
  return isNaN(n) ? 0 : n;
}

function dbFlattenOrderItemRowsOpen_(order, fetchedAtIso, syncId) {
  var out = [];
  var secs = order.sections;
  if (!Array.isArray(secs)) {
    return out;
  }
  var s, j, it, sec, item;
  for (s = 0; s < secs.length; s++) {
    sec = secs[s] || {};
    it = sec.sectionItems;
    if (!Array.isArray(it)) {
      continue;
    }
    for (j = 0; j < it.length; j++) {
      out.push(dbMapOrderItemRowOpen_(order, sec, it[j], fetchedAtIso, syncId));
    }
  }
  return out;
}

function dbMapOrderItemRowOpen_(order, section, item, fetchedAtIso, sourceSyncId) {
  order = order || {};
  section = section || {};
  item = item || {};
  var pi = item.productInfo || {};
  var g = dbNumO_(item.gradeDiscount);
  var c = dbNumO_(item.itemCouponDiscount);
  var pt = dbNumO_(item.itemPointAmount);
  var prm = dbNumO_(item.itemPromotionDiscount);
  var lineSale = g + c + prm;
  var opt = pi.optionInfo;
  var optStr = opt != null && typeof opt === 'object' ? JSON.stringify(opt) : opt != null ? String(opt) : '';
  var ocnt = 0;
  if (opt && typeof opt === 'object' && !Array.isArray(opt)) {
    ocnt = Object.keys(opt).length;
  }
  if (Array.isArray(pi.optionInfoList)) {
    ocnt = Math.max(ocnt, pi.optionInfoList.length);
  }
  var cType = '';
  if (section.cancelInfo && (section.cancelInfo.cancelRequestTime != null && String(section.cancelInfo.cancelRequestTime) !== '')) {
    cType = 'cancel';
  } else if (section.returnInfo && section.returnInfo.returnRequestTime) {
    cType = 'return';
  }
  var claimDetail = '';
  if (cType === 'cancel' && section.cancelInfo) {
    claimDetail = String(
      section.cancelInfo.cancelReason != null ? section.cancelInfo.cancelReason : section.cancelInfo.cancelReasonDetail != null ? section.cancelInfo.cancelReasonDetail : ''
    ).slice(0, 300);
  } else if (cType === 'return' && section.returnInfo) {
    claimDetail = String(
      section.returnInfo.returnReason != null ? section.returnInfo.returnReason : section.returnInfo.returnReasonDetail != null ? section.returnInfo.returnReasonDetail : ''
    ).slice(0, 300);
  }
  var rowObj = { orderSection: section, sectionItem: item, productInfo: pi };
  var rowStr = JSON.stringify(rowObj);
  if (rowStr.length > 49000) {
    rowStr = rowStr.slice(0, 49000) + '…(truncated)';
  }
  return [
    item.orderSectionItemNo != null ? String(item.orderSectionItemNo) : '',
    item.orderItemCode != null ? String(item.orderItemCode) : '',
    order.orderNo != null ? String(order.orderNo) : '',
    order.orderStatus != null ? String(order.orderStatus) : '',
    section.orderSectionStatus != null ? String(section.orderSectionStatus) : '',
    cType,
    claimDetail,
    pi.prodNo != null ? pi.prodNo : '',
    pi.prodName != null ? String(pi.prodName) : '',
    pi.itemPrice != null ? pi.itemPrice : '',
    lineSale,
    pt,
    c,
    '0',
    optStr,
    ocnt,
    rowStr,
    fetchedAtIso,
    sourceSyncId != null ? String(sourceSyncId) : ''
  ];
}
