/**
 * Open API `GET /products` — 1페이지를 원천 `products` 시트에 **전체 대체(스냅샷)**.
 * (추후 증분·페이지 루프는 여기서 확장)
 *
 * 전제: `IMWEB_OAUTH_ACCESS_TOKEN`·`IMWEB_UNIT_CODE` (또는 site-info로 이미 잡힌 값)
 * `apiTest.js`의 `imwebTGet_` 재사용.
 */
function dbSyncProductsOnePage() {
  var p = PropertiesService.getScriptProperties();
  if (
    p.getProperty('IMWEB_OAUTH_ACCESS_TOKEN') == null ||
    String(p.getProperty('IMWEB_OAUTH_ACCESS_TOKEN')).trim() === ''
  ) {
    throw new Error('IMWEB_OAUTH_ACCESS_TOKEN 없음. Open API 토큰·유닛 확보 후 실행.');
  }
  var uc = p.getProperty(DB_PROP_UNIT_CODE) != null ? String(p.getProperty(DB_PROP_UNIT_CODE)).trim() : '';
  if (!uc.length) {
    throw new Error('IMWEB_UNIT_CODE 없음. imwebApiTestAll(또는 site-info)로 unit 먼저 잡을 것.');
  }

  var syncId = Utilities.getUuid();
  var t0 = new Date();
  var msg = '';
  var rows = 0;
  var status = 'OK';

  try {
    var g = imwebTGetWithOpenSyncRetry_('/products', { page: 1, limit: 100, unitCode: uc });
    if (g._http !== 200) {
      throw new Error('GET /products http=' + g._http + ' ' + String(g._text).slice(0, 500));
    }
    var j = JSON.parse(g._text || '{}');
    if (j.statusCode !== 200 || j.data == null) {
      throw new Error('GET /products body statusCode/ data 아님: ' + String(g._text).slice(0, 400));
    }
    var list = dbExtractProductsList_(j.data);
    var nowIso = new Date().toISOString();
    var out = [];
    var k;
    for (k = 0; k < list.length; k++) {
      out.push(dbMapProductItemToRow_(list[k], nowIso, syncId));
    }
    var ss = dbOpenMaster_();
    var sh = dbGetOrCreateSheetWithHeaders_(ss, DB_SHEET_PRODUCTS, DB_PRODUCTS_HEADERS);
    var w = DB_PRODUCTS_HEADERS.length;
    dbClearDataRows2Plus_(sh, w);
    dbSetValuesFromRow2_(sh, out, w);
    rows = out.length;
    msg = 'page1 snapshot, rows=' + rows;
  } catch (e) {
    status = 'ERROR';
    msg = e && e.message != null ? e.message : String(e);
  }

  var t1 = new Date();
  dbAppendSyncLog_({
    syncId: syncId,
    started: t0,
    ended: t1,
    entity: 'products',
    status: status,
    rowsWritten: rows,
    message: msg
  });

  if (status !== 'OK') {
    throw new Error(msg);
  }
  Logger.log('dbSyncProductsOnePage ' + msg);
  return { syncId: syncId, rows: rows };
}

/**
 * @param {*} data `data` 래핑 (배열 1요소+list / 직접 list)
 */
function dbExtractProductsList_(data) {
  if (data == null) {
    return [];
  }
  if (Array.isArray(data) && data.length && data[0] && data[0].list) {
    return data[0].list;
  }
  if (data && data.list) {
    return data.list;
  }
  if (Array.isArray(data)) {
    return data;
  }
  return [];
}

/**
 * Open API `GET /products` list item → 시트 1행 (camelCase 응답 가정, §3.3.4)
 */
function dbMapProductItemToRow_(o, fetchedAtIso, sourceSyncId) {
  o = o || {};
  var cats = o.categories != null ? o.categories : [];
  var catStr = Array.isArray(cats) || typeof cats === 'object' ? JSON.stringify(cats) : String(cats);
  var ptd = o.prodTypeData != null ? o.prodTypeData : o.prod_type_data;
  var ptdStr = typeof ptd === 'object' && ptd != null ? JSON.stringify(ptd) : ptd != null ? String(ptd) : '';
  var mix = o.optionMixType != null ? String(o.optionMixType) : '';
  return [
    o.prodNo != null ? Number(o.prodNo) : o.no != null ? Number(o.no) : '',
    o.prodStatus != null ? String(o.prodStatus) : '',
    catStr,
    o.name != null ? String(o.name) : '',
    ptdStr,
    o.price != null ? o.price : '',
    o.priceOrg != null ? o.priceOrg : o.orgPrice != null ? o.orgPrice : '',
    dbYNU_(o, ['isExistOptions', 'is_exist_options']) ? 'Y' : mix && mix !== 'NONE' ? 'Y' : 'N',
    mix === 'MIX' ? 'Y' : 'N',
    o.addTime != null ? String(o.addTime) : '',
    o.editTime != null ? String(o.editTime) : '',
    fetchedAtIso,
    sourceSyncId != null ? String(sourceSyncId) : ''
  ];
}

function dbYNU_(o, keys) {
  var i;
  for (i = 0; i < keys.length; i++) {
    var v = o[keys[i]];
    if (v === 'Y' || v === 'N' || v === true || v === false) {
      return v === 'Y' || v === true;
    }
  }
  return false;
}
