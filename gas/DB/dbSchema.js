/**
 * 원천 DB (Google Sheets) — 스키마·Property 키.
 * Open API 응답(camelCase) → 아래 **헤더(snake_case) 열**로 매핑. ([BACKEND_API.md](../../docs/BACKEND_API.md) 주문 절)
 *
 * 원천 시트는 GAS만 쓰기·사람 읽기 전용(락은 시트 UI에서 별도 설정).
 *
 * --- 스프레드시트 **파일 ID** (고유값) ---
 * 소스 코드에 스프레드시트 id 문자열을 **박아 넣지 않는다**. (`.clasp.json`의 `scriptId`는 **이 GAS 프로젝트** id이지 시트 id가 아님.)
 * 시트를 만들 때 나온 id만 `PropertiesService.setProperty('SHEETS_MASTER_ID'|…, ss.getId())` 등으로 **그때마다** 넣는다.
 * “고정값” 문제는 **레포**가 아니라, GAS 편집기 **프로젝트 설정 → 스크립트 속성**에 **옛 id가 남아 있는 것** — UI에서 파일을 지워도 속성은 자동으로 안 지워진다.
 */
var DB_PROP_SHEETS_MASTER_ID = 'SHEETS_MASTER_ID';
/** (선택) 마스터 스프레드시트를 **처음 만들 때** 둘 Google Drive 폴더 ID. */
var DB_PROP_SHEETS_MASTER_PARENT_FOLDER_ID = 'SHEETS_MASTER_PARENT_FOLDER_ID';

/**
 * (선택) **레포에 박는** 팀용 폴더 ID. 비어 있으면 `dbGetParentFolderIdOfClaspScript_()` = **clasp로 연동된 이 GAS
 * 프로젝트 파일이 Drive에 있는 그 폴더**를 씀(ScriptApp.getScriptId + Drive). Properties가 최우선.
 * @type {string}
 */
var DB_DEFAULT_SHEETS_MASTER_PARENT_FOLDER_ID = '';

/**
 * `My Drive`에서 루트 → … 순으로 내려갈 **폴더 이름** (캡처: `00_admin` / `10_IMWEB_DASHBOARD`).
 * 새 마스터 DB 스프레드시트는 **여기(마지막 폴더)**에 두도록 이동. 이름 바꾸면 여기도 같이 맞출 것.
 * @type {string[]}
 */
var DB_DEFAULT_MASTER_FOLDER_PATH = ['00_admin', '10_IMWEB_DASHBOARD'];

/** `dbSetupMasterDatabase` — 스크립트가 있는 Drive 폴더 **아래** 이 이름의 하위 폴더를 만들고(없으면 사용), 시트는 그 안에 둔다. */
var DB_SUBFOLDER_NAME = 'DB';

var DB_PROP_UNIT_CODE = 'IMWEB_UNIT_CODE';

var DB_SHEET_MEMBERS = 'members';
var DB_SHEET_ORDERS = 'orders';
var DB_SHEET_ORDER_ITEMS = 'order_items';
var DB_SHEET_PRODUCTS = 'products';
var DB_SHEET_SYNC_LOG = 'sync_log';

/**
 * 층 1(운영/파생) — 상품·내부 분류 매핑. 원천 `products`와 **별도 시트(또는 별도 스프레드시트)**. (레포 `docs/SCHEMA_PRODUCT_MAPPING.md` 참고)
 * Script Property: `SHEETS_OPERATIONS_ID` — 없으면 개발/초기에는 원천 마스터와 **같은 파일**에 탭만 두는 방식으로도 동작시킬 수 있음(구현에서 결정).
 */
var DB_PROP_SHEETS_OPERATIONS_ID = 'SHEETS_OPERATIONS_ID';
var DB_SHEET_PRODUCT_MAPPING = 'product_mapping';

/**
 * @type {string[]}
 * - internal_category: `unmapped` | `solpass` | `solutine` | `challenge` | `textbook` | `jasoseo` | `toeic_rc` | `toeic_lc` (영문 키 고정)
 * - lifecycle: `active` | `archived` | `test` | `legacy` ((구)상품)
 */
/** `sales_end`: yyyy-MM-dd, archived·legacy에서만 필수(맨 끝 열 — 기존 7열 시트와 행 정렬 유지) */
var DB_PRODUCT_MAPPING_HEADERS = [
  'prod_no',
  'product_name',
  'internal_category',
  'lifecycle',
  'created_at',
  'updated_at',
  'notes',
  'sales_end'
];

/**
 * 층 2(집계·리포트) — 대시보드(임베드) **전용** 파일. Script Property: `SHEETS_ANALYTICS_ID` (docs/ANALYTICS_DASHBOARD_NEXT.md)
 */
var DB_PROP_SHEETS_ANALYTICS_ID = 'SHEETS_ANALYTICS_ID';

/**
 * 수강생 관리 전용 스프레드시트. Script Property: `SHEETS_STUDENT_ID`
 * (문서: `docs/SCHEMA_STUDENT_MANAGEMENT.md`)
 */
var DB_PROP_SHEETS_STUDENT_ID = 'SHEETS_STUDENT_ID';
var DB_STUDENT_SPREADSHEET_TITLE = '솔루션편입_수강생_마스터';
var DB_SHEET_STUDENT_MEMBER_MASTER = 'student_member_master';
var DB_SHEET_STUDENT_ORDER_EVENTS = 'student_member_order_events';

/** @type {string[]} */
var DB_STUDENT_MEMBER_HEADERS = [
  'member_code',
  'uid',
  'name',
  'callnum',
  'last_login_time',
  'group_titles',
  /** 자동 계산: `수강중`/`주의 필요`/`이탈` */
  'member_status_auto',
  /**
   * 운영 수동값(빈 값이면 자동 사용):
   * `수강중`/`주의 필요`/`이탈`/`복귀 예정`
   */
  'member_status_override',
  /** 최종 표시 값(override 우선, 없으면 auto) */
  'member_status',
  /** 멤버 비고(메모 리스트) — JSON 문자열 */
  'remarks_json',
  'fetched_at',
  'source_sync_id'
];

/** @type {string[]} — 원천 order_items 에서 가격·order_section_item_no 제외 + 조인·기간 열 */
var DB_STUDENT_ORDER_EVENT_HEADERS = [
  'order_item_code',
  'order_no',
  'member_code',
  'order_time',
  'internal_category',
  'lifecycle',
  'product_start_date',
  'product_end_date',
  'enroll_status',
  'rereg_base_date',
  /** 운영 재등록 기준일 yyyy-MM-dd (기본 종료 7일 전·동기화 시 자동). */
  'rereg_reminder_date',
  'order_status',
  'section_status',
  'claim_status',
  'claim_type',
  'claim_event_time',
  'prod_no',
  'prod_name',
  'options_raw',
  'options_count',
  'row_json',
  'updated_at',
  'fetched_at',
  'source_sync_id'
];

/**
 * 플래너(학생 공개) 전용 마스터 스프레드시트. Script Property: `SHEETS_PLANNER_MASTER_ID`
 * (문서: `docs/PLANNER_DB_ARCHITECTURE.md`)
 */
var DB_PROP_SHEETS_PLANNER_MASTER_ID = 'SHEETS_PLANNER_MASTER_ID';
var DB_PLANNER_SPREADSHEET_TITLE = '솔루션편입_플래너_마스터';
var DB_SHEET_PLANNER_REGISTRY = 'planner_registry';
/** 운영 수기(비회원/예외) 레지스트리 — 동기화(rebuild)가 덮어쓰지 않는 탭 */
var DB_SHEET_PLANNER_REGISTRY_MANUAL = 'planner_registry_manual';
var DB_SHEET_PLANNER_STUDENT_LINKS = 'planner_student_links';
/** 마스터 커리큘럼 — 강좌 카탈로그 (`planner_common_calendar` 대체). 날짜 없음. */
var DB_SHEET_PLANNER_CURRICULUM_COURSES = 'planner_curriculum_courses';
/** 마스터 커리큘럼 — 강의 카탈로그. `course_id` → `planner_curriculum_courses`. 날짜 없음. */
var DB_SHEET_PLANNER_CURRICULUM_LECTURES = 'planner_curriculum_lectures';
/** @deprecated 레거시 탭. `init` 시 삭제. */
var DB_SHEET_PLANNER_COMMON_CALENDAR = 'planner_common_calendar';
/**
 * 학생별 플래너 스프레드시트 — 할 일 탭 **접두**.
 * 실제 탭명 = 이 문자열 + `_` + `YYYY` + `_` + `MM` (월 2자리), 예: `planner_personal_todos_2026_05`.
 * 레거시 단일 탭명이 정확히 이 값과 같으면 `planner_personal_todos` (접두만)인 구 파일 호환용.
 */
var DB_SHEET_PLANNER_PERSONAL_TODOS = 'planner_personal_todos';

/** 학생별 파일 표시 이름 접두 (뒤에 `display_name(imweb_uid)` 등) */
var DB_PLANNER_STUDENT_FILE_TITLE_PREFIX = '솔루션편입_플래너_학생_';

/** 플래너 어드민 해제 암호 — `plannerAdminVerify` JSONP/POST 본문과 정확히 일치해야 함 */
var DB_PLANNER_ADMIN_UNLOCK_SECRET = 'admin_solpath';

/**
 * 마스터 `planner_registry` 1행 헤더 (17열).
 * `imweb_uid`·`member_code` 등은 수기 행에서 빈 칸 허용. 전화·프로필 열은 텍스트(`@`) 권장.
 * 화면용 `phone_display`(010-1234-5678)는 시트에 두지 않음 — API/bootstrap 시 `phone_normalized` 포맷.
 * `planner_month_ranges_json`: 학생 파일 **월 탭**을 만들 구간 목록 — JSON 배열, 원소 `{ "start_month": "yyyy-MM", "end_month": "yyyy-MM" }`.
 *   각 객체는 **시작~끝 포함 연속 달**; 구간 사이에 비는 달(미이용·휴회·재등록 전)이 있을 수 있음. 빈 배열 `[]`면 프로비저닝 시 서울 **당월** 탭만 보장.
 */
var DB_PLANNER_REGISTRY_HEADERS = [
  'member_code',
  'imweb_uid',
  'phone_normalized',
  'display_name',
  'track',
  'admission_type',
  'prev_university',
  'prev_major_gpa',
  'goal_university',
  'goal_department',
  'study_status',
  'plan_features',
  'subject_guides_json',
  'monthly_plan_notices_json',
  'first_solpass_order_id',
  'planner_month_ranges_json',
  'registry_updated_at'
];

/**
 * 마스터 `planner_student_links` 1행 헤더 (4열).
 * API·resolve용 `link_key` = `member_code` 있으면 그 값, 없으면 `imweb_uid` (시트 열 아님).
 * 운영 규정: registry 행은 `member_code`·`imweb_uid` 둘 다 비우지 않음.
 */
var DB_PLANNER_STUDENT_LINK_HEADERS = [
  'member_code',
  'imweb_uid',
  'student_spreadsheet_id',
  'provisioned_at'
];

/**
 * 학생별 월 탭 `planner_personal_todos_YYYY_MM` 1행 헤더 (11열).
 * - `task_id`: 월 탭 안 **고정 문자열** (apply가 재번호 매기지 않음).
 * - `date`: **지금** 그 할 일이 속하는 날 `YYYY-MM-DD`. 날짜 이동 시 이 칸만 바뀜(행 추가 없음).
 * - `trace_dates`: 밀림(뒤로 미룸)으로 **떠난 날**만 JSON 배열 `["YYYY-MM-DD",…]`. UI에서 그날 회색 흔적. 앞당김에는 넣지 않음. 없으면 `[]`.
 * - `category`: 과목 `grammar`|`logic`|`read`|`comprehensive`(통합)|`math`|`toeic_rc`|`toeic_lc`|`vocab`|`misc`(기타), `fixed`, `event`, `memo`, `routine` (`event`는 제목만·달력 별 표시, `routine`은 `title`로 취침·식사·자습 구분). 직접입력·커리큘럼 상수 세트는 프론트에서 정함.
 * - `lecture_id`: 마스터 `planner_curriculum_lectures.lecture_id`; 해당 없으면 빈 칸.
 * - `timeline_slots`: 슬롯 키 JSON 배열 문자열. 없으면 **`[]`**.
 * - `mark`: 일일 ○△×.
 * - `created_date` / `updated_date`: 행 생성·수정 **날짜**만 `YYYY-MM-DD`.
 */
var DB_PLANNER_PERSONAL_TODO_HEADERS = [
  'task_id',
  'title',
  'date',
  'category',
  'lecture_id',
  'timeline_slots',
  'sort_key',
  'mark',
  'trace_dates',
  'created_date',
  'updated_date'
];

/**
 * 학생 파일 월별 할 일 탭명.
 * @param {number} fullYear
 * @param {number} month1to12
 * @return {string}
 */
function dbPlannerPersonalTodosSheetName_(fullYear, month1to12) {
  var y = Number(fullYear);
  var m = Number(month1to12);
  var mm = m < 10 ? '0' + m : String(m);
  return DB_SHEET_PLANNER_PERSONAL_TODOS + '_' + y + '_' + mm;
}

/**
 * `yyyy-MM` → 월 탭명. 빈 문자열이면 **서울** 기준 이번 달.
 * @param {string} yearMonthOpt
 * @return {string}
 */
function dbPlannerPersonalTodosSheetNameFromYearMonthStr_(yearMonthOpt) {
  var s = String(yearMonthOpt != null ? yearMonthOpt : '').trim();
  var m = s.match(/^(\d{4})-(\d{1,2})$/);
  if (!m) {
    var y0 = Number(Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy'));
    var mo0 = Number(Utilities.formatDate(new Date(), 'Asia/Seoul', 'MM'));
    return dbPlannerPersonalTodosSheetName_(y0, mo0);
  }
  return dbPlannerPersonalTodosSheetName_(Number(m[1]), Number(m[2]));
}

/**
 * 마스터 `planner_curriculum_courses` 1행 헤더 (5열, 영문만).
 * `course_id` = 숫자 PK · `planner_curriculum_lectures.course_id` FK.
 */
var DB_PLANNER_CURRICULUM_COURSE_HEADERS = [
  'course_id',
  'subject',
  'instructor',
  'course_name',
  'link_url'
];

/**
 * 마스터 `planner_curriculum_lectures` 1행 헤더 (5열, 영문만).
 * `lecture_id` = 숫자 PK · `course_id` = `planner_curriculum_courses.course_id` FK.
 * `duration` = **정수(분)**. 수기 `60`·`60분`·숫자 셀 → `dbPlannerCellToDurationMinutes_` 로 읽기·시트 보정.
 */
var DB_PLANNER_CURRICULUM_LECTURE_HEADERS = [
  'lecture_id',
  'course_id',
  'lecture_no',
  'lecture_name',
  'duration'
];

/** @deprecated `planner_curriculum_courses` 로 대체 */
var DB_PLANNER_COMMON_CALENDAR_HEADERS = [
  'event_id',
  'start_date',
  'end_date',
  'title',
  'description',
  'category',
  'sort_key'
];

/** 연·월 목표 — `goal_target` = `entire` | `solpass` | `challenge` | `solutine` (빈칸 금지) */
var DB_SHEET_ANALYTICS_GOALS = '01_연월_목표';
/** 마스터 `order_items` 1:1 + 실결제·스냅샷(종료일은 운영 product_mapping.sales_end) */
var DB_SHEET_ANALYTICS_ORDER_LINES = '02_주문라인_실적';

/** @type {string[]} */
var DB_ANALYTICS_GOALS_HEADERS = ['year', 'month', 'goal_target', 'sales_target', 'people_target'];

/**
 * @type {string[]}
 * line_net_amount = order_items line_price - line_price_sale - line_point.
 * `02_주문라인_실적`에는 ISO 원본(`order_time`, `claim_event_time`)만 저장하고, 서울 날짜(`yyyy-MM-dd`) 변환은 집계 계산 시점에만 수행.
 * claim_event_time = 취소 접수 ISO — 원천 `order_items.claim_event_time` (= API `cancelInfo.cancelRequestTime`). 일별 fact·카드에서 **환불액·환불 건수는 이 시각의 서울 일자**에만 반영.
 */
var DB_ANALYTICS_ORDER_LINE_HEADERS = [
  'order_section_item_no',
  'order_item_code',
  'order_no',
  'order_time',
  'prod_no',
  'prod_name',
  'line_net_amount',
  'section_status',
  'internal_category',
  'lifecycle',
  'add_time',
  'claim_event_time'
];

/* --- 이전 집계 탭(이름·데이터 이행용) --- */
var DB_SHEET_ANALYTICS_KPI_LEGACY = 'kpi_매출건수_목표';
var DB_SHEET_ANALYTICS_KPI_OLD = '01_일월간_매출_인원_목표';
var DB_SHEET_ANALYTICS_FACT_LEGACY = 'fact_매출건수_일별';

/**
 * 리포트 `dbAnalyticsFactRowsGet_` 메모리 결과 형식 (롱) — 02_주문라인_실적에서 집계해 채움
 * @type {string[]}
 */
var DB_ANALYTICS_FACT_HEADERS = [
  'date_ymd',
  'metric',
  'internal_category',
  'prod_no',
  'value',
  'batch_id',
  'updated_at'
];

/** 끝 2열: docs/SPEC.md §5.1.1 공통 */
var DB_META_SUFFIX = ['fetched_at', 'source_sync_id'];

/** @type {string[]} */
var DB_MEMBERS_HEADERS = [
  'member_code',
  'uid',
  'name',
  'callnum',
  'gender',
  'birth',
  'addr',
  'sms_agree',
  'email_agree',
  'join_time',
  'recommend_code',
  'recommend_target_code',
  'last_login_time',
  'member_grade',
  'group_json',
  /** `GET /member-info/groups`의 `title` — `group`의 `siteGroupCode`와 매칭한 문자열 배열 JSON */
  'group_titles'
].concat(DB_META_SUFFIX);

/** @type {string[]} */
var DB_ORDERS_HEADERS = [
  'order_no',
  'order_time',
  'orderer_member_code',
  'orderer_name',
  'orderer_call',
  'order_status',
  'order_type',
  'currency',
  'total_price',
  'total_discount_price',
  'total_point',
  'line_coupon_sum',
  'payment_amount'
].concat(DB_META_SUFFIX);

/** @type {string[]} */
var DB_ORDER_ITEMS_HEADERS = [
  'order_section_item_no',
  'order_item_code',
  'order_no',
  'order_status',
  'section_status',
  'claim_status',
  'claim_type',
  'claim_event_time',
  'prod_no',
  'prod_name',
  'line_price',
  'line_price_sale',
  'line_point',
  'line_coupon',
  'line_period_discount',
  'options_raw',
  'options_count',
  'row_json'
].concat(DB_META_SUFFIX);

/** @type {string[]} — §3.3.4 + 메타 */
var DB_PRODUCTS_HEADERS = [
  'prod_no',
  'prod_status',
  'categories',
  'name',
  'prod_type_data',
  'price',
  'price_org',
  'is_exist_options',
  'is_mix',
  'add_time',
  'edit_time'
].concat(DB_META_SUFFIX);

/** @type {string[]} */
var DB_SYNC_LOG_HEADERS = [
  'sync_id',
  'started_at',
  'ended_at',
  'entity',
  'status',
  'rows_written',
  'message'
];
