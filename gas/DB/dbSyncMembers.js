/**
 * Open API `GET /member-info/members` — 전체 페이지 **스냅샷** → `members` 시트.
 * (Open API list[].camelCase — `dbSchema` 헤더로 매핑)
 * 그룹 표시명: `GET /member-info/groups`로 `siteGroupCode` → `title` 맵 후 회원 `group`과 조합 → `group_titles` 열
 * (`DB_GROUP_TITLE_OVERRIDES_`는 API `title`보다 우선)
 */

/**
 * `group_titles`용 — `siteGroupCode` → 고정 표시명 (아임웹 API `title` 대신/덮어쓰기)
 * @type {Object<string, string>}
 */
var DB_GROUP_TITLE_OVERRIDES_ = {
  g2025093056fe132e458fd: '관리자'
};

/**
 * @param {Object<string, string>} map `dbMemberInfoFetchGroupCodeToTitleMap_` 결과
 */
function dbMemberMergeGroupTitleOverrides_(map) {
  map = map || {};
  var k;
  for (k in DB_GROUP_TITLE_OVERRIDES_) {
    if (Object.prototype.hasOwnProperty.call(DB_GROUP_TITLE_OVERRIDES_, k)) {
      map[k] = DB_GROUP_TITLE_OVERRIDES_[k];
    }
  }
  return map;
}

/**
 * `GET /member-info/groups` 전체 페이지 → `{ siteGroupCode: title, ... }`
 * @param {string} unitCode
 * @return {Object<string, string>}
 */
function dbMemberInfoFetchGroupCodeToTitleMap_(unitCode) {
  var map = {};
  var page = 1;
  var pageSize = 100;
  while (true) {
    var g = imwebTGetWithOpenSyncRetry_('/member-info/groups', { page: page, limit: pageSize, unitCode: unitCode });
    if (g._http !== 200) {
      throw new Error('GET /member-info/groups http=' + g._http + ' ' + String(g._text).slice(0, 400));
    }
    var j = JSON.parse(g._text || '{}');
    if (j.statusCode !== 200 || j.data == null) {
      throw new Error('member-info/groups body: ' + String(g._text).slice(0, 400));
    }
    var data = j.data;
    var rawList = data.list;
    var items = [];
    if (rawList == null) {
      break;
    }
    if (Array.isArray(rawList)) {
      items = rawList;
    } else if (typeof rawList === 'object') {
      items = [rawList];
    }
    var ix;
    for (ix = 0; ix < items.length; ix++) {
      var it = items[ix] || {};
      var code = it.siteGroupCode != null ? String(it.siteGroupCode).trim() : '';
      if (code.length) {
        map[code] = it.title != null ? String(it.title).trim() : '';
      }
    }
    var cur = data.currentPage != null ? Number(data.currentPage) : page;
    var tot = data.totalPage != null ? Number(data.totalPage) : 1;
    if (cur >= tot) {
      break;
    }
    page++;
  }
  return map;
}

/**
 * 회원 `group`에서 `siteGroupCode`(및 변형) 문자열 목록
 * @param {*} groupVal
 * @return {string[]}
 */
function dbMemberExtractSiteGroupCodes_(groupVal) {
  if (groupVal == null) {
    return [];
  }
  var out = [];
  var seen = {};
  function add(c) {
    c = c != null ? String(c).trim() : '';
    if (c.length && !seen[c]) {
      seen[c] = 1;
      out.push(c);
    }
  }
  if (typeof groupVal === 'string') {
    add(groupVal);
    return out;
  }
  if (Array.isArray(groupVal)) {
    var i;
    for (i = 0; i < groupVal.length; i++) {
      var it = groupVal[i];
      if (it == null) {
        continue;
      }
      if (typeof it === 'string') {
        add(it);
      } else if (typeof it === 'object') {
        if (it.siteGroupCode != null) {
          add(it.siteGroupCode);
        } else if (it.groupCode != null) {
          add(it.groupCode);
        } else if (it.code != null) {
          add(it.code);
        }
      }
    }
    return out;
  }
  if (typeof groupVal === 'object') {
    if (groupVal.siteGroupCode != null) {
      add(groupVal.siteGroupCode);
    } else if (groupVal.groupCode != null) {
      add(groupVal.groupCode);
    }
  }
  return out;
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

function dbSyncMembersOpen() {
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
  var rows = 0;
  var status = 'OK';
  var page = 1;
  var pageSize = 100;
  var all = [];
  var nowIso = t0.toISOString();

  try {
    var codeToTitle = dbMemberMergeGroupTitleOverrides_(dbMemberInfoFetchGroupCodeToTitleMap_(uc));
    while (true) {
      var g = imwebTGetWithOpenSyncRetry_('/member-info/members', { page: page, limit: pageSize, unitCode: uc });
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
        all.push(dbMapMemberRowOpen_(list[k], nowIso, syncId, codeToTitle));
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
 * @param {Object<string, string>|undefined} codeToTitle `siteGroupCode` → `title`
 */
function dbMapMemberRowOpen_(m, fetchedAtIso, sourceSyncId, codeToTitle) {
  m = m || {};
  var g = m.group;
  var codes = dbMemberExtractSiteGroupCodes_(g);
  var titleList = [];
  var ti;
  for (ti = 0; ti < codes.length; ti++) {
    var cd = codes[ti];
    var t0 = codeToTitle && Object.prototype.hasOwnProperty.call(codeToTitle, cd) ? codeToTitle[cd] : '';
    t0 = t0 != null ? String(t0).trim() : '';
    titleList.push(t0.length ? t0 : cd);
  }
  var groupTitlesCell = titleList.length ? JSON.stringify(titleList) : '';
  return [
    m.memberCode != null ? String(m.memberCode) : '',
    m.uid != null ? String(m.uid) : '',
    m.name != null ? String(m.name) : '',
    dbNormalizeKrPhoneDashed_(m.callnum),
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
    groupTitlesCell,
    fetchedAtIso,
    sourceSyncId != null ? String(sourceSyncId) : ''
  ];
}
