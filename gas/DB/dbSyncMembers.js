/**
 * Open API `GET /member-info/members` — 전체 페이지 **스냅샷** → `members` 시트.
 * (Open API list[].camelCase — `dbSchema` 헤더로 매핑)
 */

function dbSyncMembersOpen() {
  var p = PropertiesService.getScriptProperties();
  var access = p.getProperty('IMWEB_OAUTH_ACCESS_TOKEN') != null ? String(p.getProperty('IMWEB_OAUTH_ACCESS_TOKEN')).trim() : '';
  if (!access.length) {
    throw new Error('IMWEB_OAUTH_ACCESS_TOKEN 없음.');
  }
  var uc = p.getProperty(DB_PROP_UNIT_CODE) != null ? String(p.getProperty(DB_PROP_UNIT_CODE)).trim() : '';
  if (!uc.length) {
    throw new Error('IMWEB_UNIT_CODE 없음. site-info 후 실행.');
  }

  var syncId = Utilities.getUuid();
  var t0 = new Date();
  var msg = '';
  var rows = 0;
  var status = 'OK';
  var page = 1;
  var pageSize = 100;
  var all = [];
  var nowIso = t0.toISOString();

  try {
    while (true) {
      var g = imwebTGet_('/member-info/members', { page: page, limit: pageSize, unitCode: uc }, access);
      if (g._http !== 200) {
        throw new Error('GET /member-info/members http=' + g._http + ' ' + String(g._text).slice(0, 400));
      }
      var j = JSON.parse(g._text || '{}');
      if (j.statusCode !== 200 || j.data == null) {
        throw new Error('members body status: ' + String(g._text).slice(0, 300));
      }
      var data = j.data;
      var list = data.list;
      if (!Array.isArray(list) || !list.length) {
        break;
      }
      var k;
      for (k = 0; k < list.length; k++) {
        all.push(dbMapMemberRowOpen_(list[k], nowIso, syncId));
      }
      var cur = data.currentPage != null ? Number(data.currentPage) : page;
      var tot = data.totalPage != null ? Number(data.totalPage) : 1;
      if (cur >= tot) {
        break;
      }
      page++;
    }

    var ss = dbOpenMaster_();
    var sh = dbGetOrCreateSheetWithHeaders_(ss, DB_SHEET_MEMBERS, DB_MEMBERS_HEADERS);
    var w = DB_MEMBERS_HEADERS.length;
    dbClearDataRows2Plus_(sh, w);
    dbSetValuesFromRow2_(sh, all, w);
    rows = all.length;
    msg = 'members snapshot rows=' + rows;
  } catch (e) {
    status = 'ERROR';
    msg = e && e.message != null ? e.message : String(e);
  }

  var t1 = new Date();
  dbAppendSyncLog_({ syncId: syncId, started: t0, ended: t1, entity: 'members', status: status, rowsWritten: rows, message: msg });
  if (status !== 'OK') {
    throw new Error(msg);
  }
  Logger.log('dbSyncMembersOpen ' + msg);
  return { syncId: syncId, rows: rows };
}

/**
 * @param {*} m member list item
 */
function dbMapMemberRowOpen_(m, fetchedAtIso, sourceSyncId) {
  m = m || {};
  var g = m.group;
  return [
    m.memberCode != null ? String(m.memberCode) : '',
    m.uid != null ? String(m.uid) : '',
    m.name != null ? String(m.name) : '',
    m.callnum != null ? String(m.callnum) : '',
    m.gender != null ? String(m.gender) : '',
    m.birth != null ? String(m.birth) : '',
    m.address != null ? String(m.address) : '',
    m.smsAgree != null ? String(m.smsAgree) : '',
    m.emailAgree != null ? String(m.emailAgree) : '',
    m.joinTime != null ? String(m.joinTime) : '',
    m.recommendCode != null && m.recommendCode !== '' ? String(m.recommendCode) : '',
    m.recommendTargetCode != null && m.recommendTargetCode !== '' ? String(m.recommendTargetCode) : '',
    m.lastLoginTime != null ? String(m.lastLoginTime) : '',
    m.grade != null ? String(m.grade) : '',
    g != null && (Array.isArray(g) || (typeof g === 'object' && g !== null)) ? JSON.stringify(g) : '',
    fetchedAtIso,
    sourceSyncId != null ? String(sourceSyncId) : ''
  ];
}
