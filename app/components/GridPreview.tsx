// [Day 21 작업] 데이터윈도우 웹 변환 그리드 프리뷰 컴포넌트
// [Day 32 작업] 상단 Retrieval Argument 조회 바 및 동적 데이터 바인딩 고도화
// [Day 34 작업] 그리드 런타임 결과 내 실시간 와일드카드 필터링(Filter) 고도화 구현
// [Day 40 작업] 그리드 다중 트랜잭션 데이터 최종 커밋 및 서버 비동기 통신 피드백 고도화 구현
"use client";

import React from "react";
import { ParsedPB, ColumnInfo } from "../types";
import { isNumericColumn, formatNumberWithCommas, evaluateDWExpression } from "../utils/expression";
import SearchPreset from "./SearchPreset";

interface GridPreviewProps {
  parsedData: ParsedPB;
  gridData: Array<{ [key: string]: string }>;
  setGridData: React.Dispatch<React.SetStateAction<Array<{ [key: string]: string }>>>;
  argValues: { [key: string]: string };
  // [Day 27 작업] 행 선택 상태 정의 구역
  selectedRowIndex: number;
  onSelectRow: (rIdx: number) => void;
  // [Day 56 작업] 검색 프리셋 복원 콜백 추가
  onRestorePreset?: (presetQuery: { [key: string]: any }) => void;
}

const ALIGN_MAP: { [key: string]: string } = {
  "0": "text-left",
  "1": "text-right",
  "2": "text-center",
};

const getAlignClass = (alignCode: string | undefined): string => {
  if (!alignCode) return "text-left";
  return ALIGN_MAP[alignCode.replace(/[^0-9]/g, "")] || "text-left";
};

// [Day 32 작업] 레거시 DB 조회를 시뮬레이션하기 위한 10개 행 규모 of 가상 직원/실적 마스터 데이터셋
const MOCK_MASTER_DATA = [
  { id: "1001", region: "개발팀", rep: "김개발", sales: "150000", status: "Closed", name: "김개발", emp_id: "1001", dept: "개발팀" },
  { id: "1002", region: "영업팀", rep: "이영업", sales: "250000", status: "Open", name: "이영업", emp_id: "1002", dept: "영업팀" },
  { id: "1003", region: "인사팀", rep: "박인사", sales: "80000", status: "Closed", name: "박인사", emp_id: "1003", dept: "인사팀" },
  { id: "1004", region: "개발팀", rep: "최기술", sales: "120000", status: "Open", name: "최기술", emp_id: "1004", dept: "개발팀" },
  { id: "1005", region: "영업팀", rep: "정실적", sales: "300000", status: "Closed", name: "정실적", emp_id: "1005", dept: "영업팀" },
  { id: "1006", region: "인사팀", rep: "조인사", sales: "90000", status: "Open", name: "조인사", emp_id: "1006", dept: "인사팀" },
  { id: "1007", region: "개발팀", rep: "한코딩", sales: "180000", status: "Closed", name: "한코딩", emp_id: "1007", dept: "개발팀" },
  { id: "1008", region: "영업팀", rep: "강판매", sales: "220000", status: "Open", name: "강판매", emp_id: "1008", dept: "영업팀" },
  { id: "1009", region: "인사팀", rep: "황관리", sales: "95000", status: "Closed", name: "황관리", emp_id: "1009", dept: "인사팀" },
  { id: "1010", region: "개발팀", rep: "백엔드", sales: "160000", status: "Open", name: "백엔드", emp_id: "1010", dept: "개발팀" }
];

// [Day 39 작업] 마스터-디테일 연동을 위한 상세 가족/인사 데이터셋 구조 및 Mock 데이터 정의
interface DetailRow {
  emp_id: string;
  seq: string;
  relation: string;
  name: string;
  birth: string;
  note: string;
  row_status?: "New" | "NewModified" | "Unchanged";
}

const MOCK_DETAIL_DATA: { [empId: string]: DetailRow[] } = {
  "1001": [
    { emp_id: "1001", seq: "1", relation: "배우자", name: "한가인", birth: "1982-02-02", note: "배우자 정보", row_status: "Unchanged" },
    { emp_id: "1001", seq: "2", relation: "자녀", name: "김아이", birth: "2015-05-05", note: "초등학생", row_status: "Unchanged" }
  ],
  "1002": [
    { emp_id: "1002", seq: "1", relation: "배우자", name: "손예진", birth: "1982-01-11", note: "결혼기념일 03-31", row_status: "Unchanged" }
  ],
  "1003": [
    { emp_id: "1003", seq: "1", relation: "부", name: "박부친", birth: "1955-08-15", note: "동거", row_status: "Unchanged" },
    { emp_id: "1003", seq: "2", relation: "모", name: "최모친", birth: "1958-09-20", note: "동거", row_status: "Unchanged" }
  ],
  "1004": [
    { emp_id: "1004", seq: "1", relation: "배우자", name: "김태희", birth: "1980-03-29", note: "특이사항 없음", row_status: "Unchanged" }
  ],
  "1005": [
    { emp_id: "1005", seq: "1", relation: "자녀", name: "정자녀", birth: "2018-10-10", note: "유치원생", row_status: "Unchanged" }
  ],
  "1006": [],
  "1007": [
    { emp_id: "1007", seq: "1", relation: "배우자", name: "신민아", birth: "1984-04-05", note: "회사원", row_status: "Unchanged" }
  ],
  "1008": [],
  "1009": [
    { emp_id: "1009", seq: "1", relation: "자녀", name: "황아들", birth: "2012-12-12", note: "중학생", row_status: "Unchanged" }
  ],
  "1010": []
};

// [Day 41 작업] 다국어 딕셔너리 자원 구역 및 아키텍처 비교
/*
 * [레거시 파워빌더와 현대 React의 다국어 지원(i18n) 아키텍처 비교]
 *
 * 1. 레거시 파워빌더 (C/S 환경):
 *    - 파워빌더에서는 클라이언트 컴퓨터의 OS 언어 설정을 파악하기 위해 `GetEnvironment()` 함수를 호출하여
 *      `Language` 속성을 조사하거나 시스템 레지스트리를 직접 뒤지는 복잡한 작업이 수반되었습니다.
 *    - 조회된 언어 코드에 따라 데이터윈도우의 컬럼 캡션을 변경하기 위해, 개발자가 직접 컬럼 목록을 루프 돌며
 *      `dw_1.Modify("column_name.Text='번역된캡션'")` 혹은 `dw_1.Object.column_name.Text = '...'` 처럼
 *      데이터윈도우 오브젝트의 텍스트 프로퍼티를 동적으로 치환하는 동기식 명령형(Imperative) 스크립트를 수동 작성했습니다.
 *    - 이 방식은 UI 변경 시마다 화면을 직접 조작해야 하고, 컨트롤과 다국어 로직이 결합되어 유지보수 비용을 증가시킵니다.
 *
 * 2. 현대 React 아키텍처 (웹 표준 선언형 렌더링):
 *    - React 환경에서는 UI가 데이터의 상태(State)에 종속되는 선언형(Declarative) 패러다임으로 구현됩니다.
 *    - 로컬 상태인 `currentLanguage`가 업데이트되면 React 런타임이 이를 감지하고, 단방향 데이터 바인딩(One-way Data Binding)을 통해
 *      로케일 딕셔너리(`LANG_DICT`)에서 현재 언어에 대응하는 레이블을 찾아 UI를 자동으로 재렌더링합니다.
 *      이때 가상 DOM(Virtual DOM) 기술을 활용하여 변경이 필요한 텍스트 노드만을 매우 빠르고 효율적으로 자동 치환합니다.
 *    - 이로 인해 개발자는 런타임에 직접 컬럼 오브젝트에 접근하여 수정하는 코드를 작성할 필요가 없으며,
 *      다국어 자원 딕셔너리와 UI 렌더링 로직을 완벽히 분리(SOC)하여 코드의 안정성과 확장성을 극대화합니다.
 *    - 영어 레이블 및 UI 가이드 텍스트의 발음은 표준 IPA 기호를 사용합니다:
 *      * 그리드 ➔ [ɡrɪd]
 *      * 딕셔너리 ➔ [ˈdɪkʃəneri]
 *      * 필터 ➔ [ˈfɪltər]
 *      * 트랜잭션 ➔ [trænˈzækʃən]
 *      * 버퍼 ➔ [ˈbʌfər]
 *      * 에러 ➔ [ˈerər]
 *      * 프리뷰 ➔ [ˈpriːvjuː]
 *      * 업데이트 ➔ [ʌpˈdeɪt]
 *      * 선택 ➔ [sɪˈlekʃn]
 *      * 체크박스 ➔ [ˈtʃekbɒks]
 *      * 다중 선택 ➔ [ˈmʌlti sɪˈlekʃn]
 *      * 토글 ➔ [ˈtɑːɡl]
 */
const LANG_DICT = {
  ko: {
    title: "💻 웹 변환 화면 프리뷰 (Grid Preview)",
    modifiedCount: "수정 중인 행: {count}건",
    btnAddRow: "행 추가 ➕",
    btnDeleteRow: "행 삭제 ➖",
    btnResetAll: "전체 초기화 ↺",
    btnSaveExtract: "저장 및 데이터 추출 💾",
    btnFinalCommit: "최종 DB 반영 🚀",
    updating: "서버 반영 중...",
    deptLabel: "as_dept",
    deptAll: "전체 부서",
    deptDev: "개발팀 (R&D)",
    deptSales: "영업팀 (Sales)",
    deptHR: "인사팀 (HR)",
    keywordLabel: "as_keyword",
    keywordPlaceholder: "사원명 또는 사번 입력...",
    btnRetrieve: "조회 🔍",
    filterLabel: "dw_1.Filter()",
    filterTitle: "결과 내 실시간 필터링 🔍",
    filterPlaceholder: "필터 키워드 입력 (전체 컬럼 검색)...",
    loading: "데이터 조회 중...",
    loadingSub: "Retrieving...",
    noData: "조회 결과 데이터가 존재하지 않습니다. 상단 조건바에서 조회해 주십시오.",
    noFilteredData: "🔍 필터링 조건에 부합하는 데이터가 존재하지 않습니다. (검색어: \"{keyword}\")",
    colNo: "No.",
    colEmpId: "사번",
    colRegion: "지역/부서",
    colRep: "사원명",
    colSales: "실적",
    colStatus: "상태",
    colName: "이름",
    colDept: "부서",
    colControl: "제어",
    colSelect: "선택",
    undo: "원복",
    detailTitle: "[상세 내역 (Detail View) - 사원번호: {empId}]",
    detailSelectRow: "마스터 그리드에서 직원을 선택해 주십시오.",
    detailNoData: "등록된 상세 내역이 없습니다. [상세 추가] 버튼으로 등록해 주십시오.",
    btnDetailAdd: "상세 추가 ➕",
    btnDetailDelete: "상세 삭제 ➖",
    detailSeq: "일련번호",
    detailRelation: "관계",
    detailName: "이름",
    detailBirth: "생년월일",
    detailNote: "비고",
    toastCommitSuccess: "DB 트랜잭션 커밋 완료! 🔗",
    validationErrEmpId: "[VALIDATION ERROR] {row}번째 행의 필수 항목인 '사번'이 누락되었습니다.",
    validationErrName: "[VALIDATION ERROR] {row}번째 행의 필수 항목인 '사원명'이 누락되었습니다.",
    validationErrDept: "[VALIDATION ERROR] {row}번째 행의 필수 항목인 '부서명'이 누락되었습니다.",
    validationErrSales: "[VALIDATION ERROR] {row}번째 행의 실적(Sales) 필드가 올바른 숫자 형식이 아닙니다.",
    commitSuccessMsg: "DB 트랜잭션 커밋 완료! (SQLCA.SQLCode = 0)",
    noChanges: "최종 반영할 변경사항이 존재하지 않습니다.",
    noChangesDump: "변경사항이 존재하지 않습니다.",
    relationPlaceholder: "예: 배우자, 자녀",
    namePlaceholder: "이름 입력",
    notePlaceholder: "비고 입력",
    valErrTitle: "[VALIDATION ERROR LOG] - 실시간 데이터 유효성 검증 오류",
    txDumpTitle: "[TRANSACTION DATA DUMP] - dw_1.Update() Buffer JSON Output",
    btnCopy: "클립보드 복사 📋",
    btnDownload: "JSON 다운로드 💾",
    btnClose: "닫기 ✕",
    copiedToast: "복사 완료! 📋",
    tooltipAddRow: "새 공백 데이터 행을 추가합니다 (dw_1.InsertRow).",
    tooltipDeleteRow: "현재 선택된 행을 즉시 삭제합니다 (dw_1.DeleteRow).",
    tooltipResetAll: "모든 변경 사항을 최초 데모 데이터 상태로 초기화합니다.",
    tooltipSaveExtract: "변경된 데이터셋을 JSON 패킷으로 추출합니다.",
    tooltipFinalCommit: "변경된 데이터셋을 서버에 비동기 송출하고 최종 DB 커밋을 완료합니다.",
    tooltipSort: "클릭하여 순환 정렬 (기본값 ➔ 오름차순 ➔ 내림차순)",
    tooltipResize: "드래그하여 너비 조절",
    tooltipUndo: "이 행의 수정을 취소하고 원래 상태로 되돌립니다.",
    tooltipDetailAdd: "현재 마스터에 예속된 새로운 상세 데이터 행을 추가합니다 (dw_detail.InsertRow).",
    tooltipDetailDelete: "선택된 상세 데이터를 삭제합니다 (dw_detail.DeleteRow).",
    tooltipCopy: "추출된 JSON 문자열을 클립보드에 원클릭 복사합니다.",
    tooltipDownload: "추출된 JSON 파일을 로컬 디스크로 즉시 다운로드합니다.",
    btnPrint: "보고서 인쇄 🖨️",
    tooltipPrint: "현재 화면을 규격에 맞춰 인쇄합니다 (dw_1.Print).",
    tooltipCheckbox: "행 다중 선택 [ˈmʌlti sɪˈlekʃn] 체크박스 [ˈtʃekbɒks]",
    rowSearchPlaceholder: "행 검색어 입력 (dw_1.Find)...",
    btnFindNext: "다음 찾기 ➔",
    btnFindPrev: "이전 찾기 ⬅"
  },
  en: {
    title: "💻 Web-Converted [ɡrɪd] [ˈpriːvjuː]",
    modifiedCount: "Modified: {count} row(s)",
    btnAddRow: "Add Row ➕",
    btnDeleteRow: "Delete Row ➖",
    btnResetAll: "Reset All ↺",
    btnSaveExtract: "Save & Extract 💾",
    btnFinalCommit: "Commit to DB 🚀",
    updating: "Updating Server...",
    deptLabel: "as_dept",
    deptAll: "All Departments",
    deptDev: "Dev Team (R&D)",
    deptSales: "Sales Team",
    deptHR: "HR Team",
    keywordLabel: "as_keyword",
    keywordPlaceholder: "Enter Employee Name or ID...",
    btnRetrieve: "Retrieve 🔍",
    filterLabel: "dw_1.Filter()",
    filterTitle: "Real-time [ˈfɪltər] in Results 🔍",
    filterPlaceholder: "Enter filter keyword (search all columns)...",
    loading: "Retrieving data...",
    loadingSub: "Retrieving...",
    noData: "No retrieved data exists. Please retrieve from the search bar above.",
    noFilteredData: "🔍 No data matches the [ˈfɪltər] keyword. (Keyword: \"{keyword}\")",
    colNo: "No.",
    colEmpId: "Emp ID",
    colRegion: "Region/Dept",
    colRep: "Name",
    colSales: "Sales",
    colStatus: "Status",
    colName: "Name",
    colDept: "Dept",
    colControl: "Control",
    colSelect: "Select",
    undo: "Undo",
    detailTitle: "[Detail View - Emp ID: {empId}]",
    detailSelectRow: "Please select an employee from the master [ɡrɪd].",
    detailNoData: "No detail records found. Please add using the [Add Detail] button.",
    btnDetailAdd: "Add Detail ➕",
    btnDetailDelete: "Delete Detail ➖",
    detailSeq: "Seq",
    detailRelation: "Relation",
    detailName: "Name",
    detailBirth: "Birthdate",
    detailNote: "Note",
    toastCommitSuccess: "DB [trænˈzækʃən] committed! 🔗",
    validationErrEmpId: "[VALIDATION ERROR] Row {row}: Mandatory field 'Emp ID' is missing.",
    validationErrName: "[VALIDATION ERROR] Row {row}: Mandatory field 'Name' is missing.",
    validationErrDept: "[VALIDATION ERROR] Row {row}: Mandatory field 'Dept' is missing.",
    validationErrSales: "[VALIDATION ERROR] Row {row}: Field 'Sales' is not a valid number.",
    commitSuccessMsg: "DB [trænˈzækʃən] committed successfully! (SQLCA.SQLCode = 0)",
    noChanges: "No changes to commit.",
    noChangesDump: "No changes exist.",
    relationPlaceholder: "e.g., Spouse, Child",
    namePlaceholder: "Enter name",
    notePlaceholder: "Enter note",
    valErrTitle: "[VALIDATION ERROR LOG] - Real-time Data Validation [ˈerər]",
    txDumpTitle: "[TRANSACTION DATA DUMP] - dw_1.Update() [ˈbʌfər] JSON Output",
    btnCopy: "Copy 📋",
    btnDownload: "Download JSON 💾",
    btnClose: "Close ✕",
    copiedToast: "Copied! 📋",
    tooltipAddRow: "Add a new blank data row (dw_1.InsertRow).",
    tooltipDeleteRow: "Delete the currently selected row immediately (dw_1.DeleteRow).",
    tooltipResetAll: "Reset all changes to the initial demo data state.",
    tooltipSaveExtract: "Extract the modified dataset into a JSON packet.",
    tooltipFinalCommit: "Asynchronously transmit the modified dataset to the server and complete the final DB commit.",
    tooltipSort: "Click to cycle sort (Default ➔ Ascending ➔ Descending)",
    tooltipResize: "Drag to resize width",
    tooltipUndo: "Cancel modification of this row and revert to the original state.",
    tooltipDetailAdd: "Add a new detail data row subordinate to the current master (dw_detail.InsertRow).",
    tooltipDetailDelete: "Delete the selected detail data (dw_detail.DeleteRow).",
    tooltipCopy: "Copy the extracted JSON string to the clipboard with one click.",
    tooltipDownload: "Download the extracted JSON file to the local disk immediately.",
    btnPrint: "Print Report [prɪnt] 🖨️",
    tooltipPrint: "Print the report page using native [prɪnt] API.",
    tooltipCheckbox: "Row [ˈmʌlti sɪˈlekʃn] [ˈtʃekbɒks]",
    rowSearchPlaceholder: "Search row (dw_1.Find)...",
    btnFindNext: "Find Next ➔",
    btnFindPrev: "Find Prev ⬅"
  }
};

const translateColLabel = (colName: string, label: string, lang: "ko" | "en") => {
  const t = LANG_DICT[lang];
  const nameLower = colName.toLowerCase();
  if (nameLower === "emp_id" || nameLower === "id") return t.colEmpId;
  if (nameLower === "region" || nameLower === "dept" || nameLower === "department") return t.colRegion;
  if (nameLower === "rep" || nameLower === "name") return t.colRep;
  if (nameLower === "sales") return t.colSales;
  if (nameLower === "status") return t.colStatus;
  return label || colName;
};

// [Day 50 작업]
// [레거시 파워빌더 SystemError / DBError 이벤트 vs 현대 React 선언형 Error Boundary / State Reset 아키텍처 비교]
//
// 1. 레거시 파워빌더 글로벌 예외 처리 (C/S 아키텍처):
//    - SystemError 이벤트: Application 오브젝트 레벨에서 발생하는 모든 처리되지 않은 런타임 [ˈrʌntaɪm] 예외를 캡처하는 글로벌 이벤트 핸들러입니다.
//      만약 이 이벤트 스크립트를 조립하지 않으면, 애플리케이션 내의 널 포인터 참조, 배열 인덱스 초과 등 오류 발생 시 프로그램이 윈도우 OS 상에서
//      어떠한 경고도 없이 강제 종료(Abend, Abnormal End)되는 비극을 맞이하게 됩니다. 개발자들은 여기서 에러 객체(Error 구조체) 정보를 파일에
//      덤프하거나 복구 작업을 시도한 뒤 HALT CLOSE 명령어로 정상적인 종료를 유도하여 시스템 붕괴를 막았습니다.
//    - DBError 이벤트: DataWindow 레벨에서 SQL 실행 중 DB 오류(네트워크 단선, 제약조건 위반, 세션 끊김 등) 발생 시 구동되는 이벤트입니다.
//      이 이벤트 내에서 Return 1 코드를 제어하여 파워빌더가 기본적으로 출력하는 파괴적인 시스템 경고 창을 억제(Suppress)하고,
//      세션 롤백(ROLLBACK USING SQLCA;)을 실행하여 세션을 정상으로 복구하고 프로그램을 강제 종료로부터 방어했습니다.
//
// 2. 현대 웹 표준 React 아키텍처 (선언형 에러 캡처 및 가상 상태 복원):
//    - Error Boundary ([ˈerər] [ˈbaʊndri]): React 컴포넌트 트리 하위에서 발생한 렌더링 [ˈrendərɪŋ] 오류를 선언적으로 캡처(Catch)하여
//      전체 애플리케이션이 하얗게 굳어버리는 화이트스크린(White Screen) 현상을 방지하는 안전 격리 레이어입니다.
//      클래스 컴포넌트의 componentDidCatch 및 getDerivedStateFromError 생명주기 메소드를 활용하여 오류 상태를 감지하고,
//      그리드 격자판 영역에만 국한하여 다크 네온 레드 스타일의 복구 화면(Fallback UI)을 렌더링함으로써 오류를 격리합니다.
//    - 가상 상태 리셋 복구 (State Reset [steɪt] [riːˈset]): 에러 발생 시 노출되는 [세션 재조회 및 리셋 ↺] 버튼 클릭 시,
//      부모가 전달한 setGridData를 통해 오염된 데이터 버퍼를 초기 깨끗한 스냅샷(snapshotRef.current 또는 기본 Mock)으로 리셋하고,
//      동시에 handleRetrieve() 함수를 트리거하여 상단 조회 바의 조건에 따라 DB 재조회를 비차단(Non-blocking) 방식으로 즉각 가동합니다.
//      동시에 에러 바운더리의 내부 hasError 상태를 초기화하여 정상적인 그리드로 즉각 회복시키는 정밀 상태 복구 회로를 완성합니다.

interface ErrorBoundaryProps {
  children: React.ReactNode;
  onReset: () => void;
  fallback: (error: Error | null, reset: () => void) => React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class GridErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("GridErrorBoundary [ˈerər] [ˈbaʊndri] 포착:", error, errorInfo);
  }

  handleReset = () => {
    this.props.onReset();
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return this.props.fallback(this.state.error, this.handleReset);
    }
    return this.props.children;
  }
}

interface GridTableInnerProps {
  isLoading: boolean;
  totalTableWidth: number;
  parsedData: ParsedPB;
  visibleColumns: Record<string, boolean>;
  columnWidths: { [key: string]: number };
  flattenedActiveColumns: Array<any>;
  gridData: Array<{ [key: string]: string }>;
  filteredRows: Array<{ row: { [key: string]: string }; index: number }>;
  validationErrors: { [rowIndex: number]: string };
  selectedRowIndex: number;
  selectedRowIds: Set<string>;
  argValues: { [key: string]: string };
  currentLanguage: "ko" | "en";
  footerSummaries: { sums: { [colName: string]: number }; avgs: { [colName: string]: number } };
  visibleFrozenColumns: any[];
  isAllFilteredSelected: boolean;
  handleToggleAll: () => void;
  handleToggleRow: (rowOriginalIndex: string) => void;
  onSelectRow: (rIdx: number) => void;
  handleSort: (colName: string) => void;
  handleResizeStart: (colKey: string, e: React.MouseEvent) => void;
  handleUndoRow: (rIdx: number) => void;
  getFrozenLeftOffset: (colIndex: number) => number;
  getAlignClass: (alignCode: string | undefined) => string;
  translateColLabel: (colName: string, label: string, lang: "ko" | "en") => string;
  getCellStyleAndClass: (
    row: { [key: string]: string }, 
    colName: string, 
    isFrozen: boolean,
    hasError: boolean,
    isSelected: boolean,
    isModified: boolean,
    isCellReadOnly: boolean
  ) => { tdClass: string; tdStyle: React.CSSProperties; inputStyle: React.CSSProperties };
  setGridData: React.Dispatch<React.SetStateAction<Array<{ [key: string]: string }>>>;
  sortConfig: { key: string; direction: "asc" | "desc" | "none" };
  filterKeyword: string;
  initialGridDataRef: React.MutableRefObject<Array<{ [key: string]: string }>>;
  t: any;
  totalVisibleColSpan: number;
}

const GridTableInner = ({
  isLoading,
  totalTableWidth,
  parsedData,
  visibleColumns,
  columnWidths,
  flattenedActiveColumns,
  gridData,
  filteredRows,
  validationErrors,
  selectedRowIndex,
  selectedRowIds,
  argValues,
  currentLanguage,
  footerSummaries,
  visibleFrozenColumns,
  isAllFilteredSelected,
  handleToggleAll,
  handleToggleRow,
  onSelectRow,
  handleSort,
  handleResizeStart,
  handleUndoRow,
  getFrozenLeftOffset,
  getAlignClass,
  translateColLabel,
  getCellStyleAndClass,
  setGridData,
  sortConfig,
  filterKeyword,
  initialGridDataRef,
  t,
  totalVisibleColSpan,
}: GridTableInnerProps) => {
  // 의도적인 런타임 렌더링 에러 테스트 기믹
  gridData.forEach((row) => {
    const repName = row.rep ?? row.name ?? "";
    if (repName.includes("TRIGGER_CRASH")) {
      throw new Error("의도적으로 유발된 런타임 [ˈrʌntaɪm] 렌더링 [ˈrendərɪŋ] 오류 [ˈerər] : 사원명에 TRIGGER_CRASH가 감지되었습니다.");
    }
  });

  return (
    <>
      {isLoading && (
        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center gap-3 z-30 transition-all">
          <div className="w-9 h-9 rounded-full border-[3px] border-indigo-500/10 border-t-indigo-500 animate-spin shadow-[0_0_15px_rgba(99,102,241,0.4)]"></div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-xs font-bold text-indigo-400 tracking-wide animate-pulse">{t.loading}</span>
            <span className="text-[9px] font-mono text-slate-500">{t.loadingSub}</span>
          </div>
        </div>
      )}

      <table className="text-left text-xs border-collapse table-fixed" style={{ width: `${totalTableWidth}px` }}>
        <thead className="bg-slate-900 text-slate-400 font-bold sticky top-0 border-b border-slate-900 z-10">
          <tr
            style={{
              height: parsedData?.bands?.header
                ? `${parsedData.bands.header / 4}px`
                : "24px",
            }}
          >
            <th 
              rowSpan={2}
              className="p-3 text-center bg-slate-900 border-r border-slate-900/40 sticky left-0 z-30" 
              style={{ width: "48px", left: 0 }}
              title={t.tooltipCheckbox}
            >
              <input
                type="checkbox"
                checked={isAllFilteredSelected}
                onChange={handleToggleAll}
                className="rounded border-slate-800 bg-slate-950 text-cyan-500 focus:ring-0 focus:ring-offset-0 focus:outline-none w-3.5 h-3.5 cursor-pointer accent-cyan-500 shadow-[0_0_8px_rgba(34,211,238,0.4)]"
              />
            </th>
            <th 
              rowSpan={2}
              className="p-3 text-center bg-slate-900 border-r border-slate-900/40 sticky left-0 z-30" 
              style={{ width: "48px", left: 48 }}
            >
              {t.colNo}
            </th>

            {(() => {
              const activeCols = (parsedData.columns || [])
                .map((col, idx) => ({ ...col, originalIndex: idx, isComputed: false }))
                .filter((c) => visibleColumns[c.name] !== false);

              const activeComps = (parsedData.computedFields || [])
                .map((comp, idx) => ({
                  name: comp.name,
                  label: comp.label || comp.name,
                  alignment: comp.alignment,
                  expression: comp.expression,
                  originalIndex: idx,
                  isComputed: true,
                }))
                .filter((c) => visibleColumns[c.name] !== false);

              const groupsMap: Record<"basic" | "dept" | "personnel", Array<any>> = {
                basic: [],
                dept: [],
                personnel: [],
              };

              const getColumnGroup = (colName: string): "basic" | "dept" | "personnel" => {
                const nameLower = colName.toLowerCase();
                if (nameLower.includes("id") || nameLower.includes("emp") || nameLower.includes("name") || nameLower.includes("rep")) {
                  return "basic";
                }
                if (nameLower.includes("dept") || nameLower.includes("region") || nameLower.includes("department")) {
                  return "dept";
                }
                return "personnel";
              };

              activeCols.forEach((col) => {
                const g = getColumnGroup(col.name);
                groupsMap[g].push(col);
              });

              activeComps.forEach((comp) => {
                const g = getColumnGroup(comp.name);
                groupsMap[g].push(comp);
              });

              const groupLabels = {
                basic: currentLanguage === "ko" ? "기본 정보" : "Basic Info",
                dept: currentLanguage === "ko" ? "부서 정보" : "Dept Info",
                personnel: currentLanguage === "ko" ? "인사 실적" : "Personnel Info",
              };

              return (["basic", "dept", "personnel"] as const)
                .map((gKey) => {
                  const cols = groupsMap[gKey];
                  if (cols.length === 0) return null;

                  const width = cols.reduce((sum, c) => sum + (columnWidths[c.name] || 150), 0);
                  const hasFrozen = cols.some((c) => !c.isComputed && c.originalIndex < 2);
                  let leftOffset: number | undefined = undefined;

                  if (hasFrozen) {
                    const firstFrozen = cols.find((c) => !c.isComputed && c.originalIndex < 2);
                    if (firstFrozen) {
                      leftOffset = getFrozenLeftOffset(firstFrozen.originalIndex);
                    }
                  }

                  const isLastFrozen = hasFrozen && visibleFrozenColumns.length > 0;

                  return (
                    <th
                      key={gKey}
                      colSpan={cols.length}
                      className={`p-2 text-center text-[11px] uppercase tracking-wider font-extrabold border-r border-slate-900/40 transition-all select-none ${
                        hasFrozen ? "sticky z-30 bg-[#0d162d]" : "bg-slate-900"
                      } ${
                        gKey === "basic"
                          ? "text-cyan-400 border-b border-cyan-950/40 shadow-[inset_0_-1px_0_rgba(34,211,238,0.2)]"
                          : gKey === "dept"
                          ? "text-indigo-400 border-b border-indigo-950/40 shadow-[inset_0_-1px_0_rgba(99,102,241,0.2)]"
                          : "text-purple-400 border-b border-purple-950/40 shadow-[inset_0_-1px_0_rgba(168,85,247,0.2)]"
                      } ${
                        isLastFrozen && gKey === "basic"
                          ? "border-r-2 border-r-indigo-500/80 shadow-[2px_0_5px_rgba(99,102,241,0.3)]"
                          : ""
                      }`}
                      style={{
                        width: `${width}px`,
                        left: leftOffset,
                      }}
                    >
                      {groupLabels[gKey]}
                    </th>
                  );
                })
                .filter(Boolean);
            })()}

            <th 
              rowSpan={2}
              className="p-3 text-center text-slate-400 font-bold border-l border-slate-900/40 bg-slate-900 print:hidden" 
              style={{ width: "80px" }}
            >
              {t.colControl}
            </th>
          </tr>

          <tr
            style={{
              height: parsedData?.bands?.header
                ? `${parsedData.bands.header / 4}px`
                : "24px",
            }}
          >
            {flattenedActiveColumns.map((c, i) => {
              if (c.isComputed) {
                return (
                  <th
                    key={`comp-${c.name}-${i}`}
                    className="p-2 text-amber-400 bg-indigo-950/20 relative group select-none text-[10px] font-mono border-r border-slate-900/40"
                    style={{ width: `${columnWidths[c.name] || 150}px` }}
                  >
                    <div className="flex items-center gap-1 mr-2 justify-center">
                      <span>🧮 {c.label || c.name}</span>
                    </div>
                    <div
                      onMouseDown={(e) => handleResizeStart(c.name, e)}
                      className="absolute top-0 right-0 h-full w-1 cursor-col-resize select-none z-20 hover:bg-cyan-400 active:bg-cyan-300 bg-slate-800/30 transition-all duration-200 hover:shadow-[0_0_8px_rgba(34,211,238,0.8)]"
                      title={t.tooltipResize}
                    />
                  </th>
                );
              }

              const isFrozen = c.originalIndex < 2;
              const leftOffset = isFrozen ? getFrozenLeftOffset(c.originalIndex) : undefined;
              const isLastFrozen = isFrozen && visibleFrozenColumns.length > 0 && visibleFrozenColumns[visibleFrozenColumns.length - 1].name === c.name;

              return (
                <th
                  key={`col-${c.name}-${i}`}
                  onClick={() => handleSort(c.name)}
                  className={`p-2 font-mono text-[10px] text-slate-300 cursor-pointer select-none hover:bg-slate-800 hover:text-white transition-all border-r border-slate-900/40 relative group ${getAlignClass(
                    c.alignment
                  )} ${isFrozen ? "sticky z-30 bg-[#0d162d]" : "bg-slate-900"} ${
                    isLastFrozen ? "border-r-2 border-r-indigo-500/80 shadow-[2px_0_5px_rgba(99,102,241,0.3)]" : ""
                  }`}
                  style={{ 
                    width: `${columnWidths[c.name] || 150}px`,
                    left: leftOffset,
                  }}
                  title={t.tooltipSort}
                >
                  <div className="flex items-center justify-between gap-1 mr-2">
                    <span>{translateColLabel(c.name, c.label || "", currentLanguage)}</span>
                    <span
                      className={`text-[8px] font-bold px-0.5 py-0.2 rounded transition-all duration-300 ${
                        sortConfig.key === c.name && sortConfig.direction !== "none"
                          ? sortConfig.direction === "asc"
                            ? "text-cyan-400 bg-cyan-950/40 border border-cyan-500/20 shadow-[0_0_8px_rgba(34,211,238,0.4)]"
                            : "text-purple-400 bg-purple-950/40 border border-purple-500/20 shadow-[0_0_8px_rgba(168,85,247,0.4)]"
                          : "text-slate-600 border border-transparent group-hover:text-slate-400"
                      }`}
                    >
                      {sortConfig.key === c.name
                        ? sortConfig.direction === "asc"
                          ? "▲"
                          : sortConfig.direction === "desc"
                          ? "▼"
                          : "-"
                        : "-"}
                    </span>
                  </div>
                  <div
                    onMouseDown={(e) => handleResizeStart(c.name, e)}
                    className="absolute top-0 right-0 h-full w-1 cursor-col-resize select-none z-20 hover:bg-cyan-400 active:bg-cyan-300 bg-slate-800/30 transition-all duration-200 hover:shadow-[0_0_8px_rgba(34,211,238,0.8)]"
                    title={t.tooltipResize}
                  />
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-900 text-slate-300">
          {gridData.length === 0 ? (
            <tr>
              <td colSpan={totalVisibleColSpan} className="p-8 text-center text-slate-500 italic">
                {t.noData}
              </td>
            </tr>
          ) : filteredRows.length === 0 ? (
            <tr>
              <td colSpan={totalVisibleColSpan} className="p-8 text-center text-cyan-400 bg-slate-950/80 border border-cyan-900/30 font-medium italic">
                {t.noFilteredData.replace("{keyword}", filterKeyword)}
              </td>
            </tr>
          ) : (
            filteredRows.map(({ row, index: rIdx }, fIdx) => {
              const hasError = validationErrors.hasOwnProperty(rIdx);
              const isModified = ((currentRow, idx) => {
                const originalRow = initialGridDataRef.current[idx];
                if (!originalRow) return false;
                return (parsedData.columns || []).some((col) => {
                  const currentVal = currentRow[col.name] ?? "";
                  const originalVal = originalRow[col.name] ?? "";
                  return currentVal !== originalVal;
                });
              })(row, rIdx);
              const isSelected = selectedRowIndex === rIdx;
              
              let rowBgClass = "";
              if (hasError) {
                rowBgClass = "bg-red-950/25 hover:bg-red-950/35 border-y border-red-500/30 text-red-200 shadow-[0_0_12px_rgba(239,68,68,0.15)]";
              } else if (isSelected) {
                rowBgClass = "bg-indigo-600/10 border-y border-indigo-500/30 font-bold";
              } else if (isModified) {
                rowBgClass = "bg-emerald-950/10 hover:bg-emerald-950/20";
              } else {
                rowBgClass = "hover:bg-slate-800/40";
              }

              return (
                <tr
                  key={rIdx}
                  id={`grid-row-${rIdx}`}
                  style={{
                    height: parsedData?.bands?.detail
                      ? `${parsedData.bands.detail / 2}px`
                      : "40px",
                  }}
                  onClick={() => onSelectRow(rIdx)}
                  className={`transition-all font-mono cursor-pointer group ${rowBgClass}`}
                >
                  <td
                    className={`p-3 text-center transition-all sticky left-0 z-10 border-r border-slate-900/40 ${
                      hasError
                        ? "bg-[#251016] border-l-4 border-l-red-500"
                        : isSelected
                        ? "bg-[#141b38]"
                        : isModified
                        ? "bg-[#0c201d] border-l-4 border-l-emerald-500"
                        : "bg-[#090e1c] group-hover:bg-[#11192e]"
                    }`}
                    style={{
                      width: "48px",
                      left: 0,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (row.__originalIndex) {
                        handleToggleRow(row.__originalIndex);
                      }
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={row.__originalIndex ? selectedRowIds.has(row.__originalIndex) : false}
                      onChange={() => {}}
                      className="rounded border-slate-800 bg-slate-950 text-cyan-500 focus:ring-0 focus:ring-offset-0 focus:outline-none w-3.5 h-3.5 cursor-pointer accent-cyan-500 shadow-[0_0_8px_rgba(34,211,238,0.4)]"
                    />
                  </td>
                  <td 
                    className={`p-3 text-center transition-all sticky left-0 z-10 border-r border-slate-900/40 ${
                      hasError
                        ? "bg-[#251016] text-red-400 font-bold"
                        : isSelected
                        ? "bg-[#141b38] text-slate-300"
                        : isModified 
                        ? "bg-[#0c201d] text-emerald-400 font-bold" 
                        : "bg-[#090e1c] group-hover:bg-[#11192e] text-slate-600"
                    }`} 
                    style={{ 
                      width: "48px",
                      left: 48,
                    }}
                  >
                    {fIdx + 1}
                  </td>
                  {flattenedActiveColumns.map((col, cIdx) => {
                    if (col.isComputed) {
                      const mergedColumns = [
                        ...parsedData.columns,
                        ...(parsedData.arguments || []).map((arg) => ({
                          name: arg.name,
                          type: arg.type,
                          dbname: arg.name,
                        })),
                      ];
                      const res = evaluateDWExpression(
                        col.expression,
                        { ...row, ...argValues },
                        mergedColumns
                      );
                      return (
                        <td
                          key={`comp-cell-${col.name}-${cIdx}`}
                          className={`p-3 text-amber-400 font-bold bg-[#0f192b] border-r border-slate-900/40 ${getAlignClass(
                            col.alignment
                          )}`}
                          title={col.expression}
                          style={{ width: `${columnWidths[col.name] || 150}px` }}
                        >
                          {typeof res === "number" ? res.toLocaleString() : res}
                        </td>
                      );
                    }

                    let isCellReadOnly = col.tabsequence === "0" || col.protect === "1";
                    
                    if (col.protect && col.protect.toLowerCase().includes("if")) {
                      const evaluated = evaluateDWExpression(
                        col.protect,
                        { ...row, ...argValues },
                        parsedData.columns
                      );
                      const isProtected = evaluated === 1 || evaluated === "1" || String(evaluated).toLowerCase() === "true";
                      isCellReadOnly = col.tabsequence === "0" || isProtected;
                    }

                    const cellAlignClass = getAlignClass(col.alignment);
                    const colType = (col.type || "").toLowerCase();

                    const isFrozen = col.originalIndex < 2;
                    const leftOffset = isFrozen ? getFrozenLeftOffset(col.originalIndex) : undefined;
                    const isLastFrozen = isFrozen && visibleFrozenColumns.length > 0 && visibleFrozenColumns[visibleFrozenColumns.length - 1].name === col.name;

                    const { tdClass, tdStyle, inputStyle } = getCellStyleAndClass(
                      row,
                      col.name,
                      isFrozen,
                      hasError,
                      isSelected,
                      isModified,
                      isCellReadOnly
                    );

                    const renderGridCellInput = () => {
                      const baseClass =
                        "w-full bg-transparent px-2 py-1 text-xs border-0 focus:outline-none rounded transition-all";
                      const stateClass = isCellReadOnly
                        ? "bg-slate-950/60 text-slate-500 cursor-not-allowed italic"
                        : "text-white focus:ring-1 focus:ring-indigo-500";
                      const tabIndexValue = isCellReadOnly ? -1 : 0;

                      const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
                        if (isCellReadOnly) return;
                        e.currentTarget.select();
                      };

                      const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
                        const columnsCount = flattenedActiveColumns.length;
                        const currentFilteredIdx = filteredRows.findIndex(item => item.index === rIdx);

                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          if (currentFilteredIdx === -1) return;
                          let nextFilteredIdx = currentFilteredIdx + 1;
                          while (nextFilteredIdx < filteredRows.length) {
                            const nextRow = filteredRows[nextFilteredIdx].index;
                            const target = document.querySelector(
                              `input[data-row="${nextRow}"][data-col="${col.name}"]`
                            ) as HTMLInputElement | null;
                            if (target && !target.readOnly && target.tabIndex !== -1) {
                              target.focus();
                              onSelectRow(nextRow);
                              break;
                            }
                            nextFilteredIdx++;
                          }
                        } else if (e.key === "ArrowUp") {
                          e.preventDefault();
                          if (currentFilteredIdx === -1) return;
                          let prevFilteredIdx = currentFilteredIdx - 1;
                          while (prevFilteredIdx >= 0) {
                            const prevRow = filteredRows[prevFilteredIdx].index;
                            const target = document.querySelector(
                              `input[data-row="${prevRow}"][data-col="${col.name}"]`
                            ) as HTMLInputElement | null;
                            if (target && !target.readOnly && target.tabIndex !== -1) {
                              target.focus();
                              onSelectRow(prevRow);
                              break;
                            }
                            prevFilteredIdx--;
                          }
                        } else if (e.key === "ArrowRight") {
                          e.preventDefault();
                          let nextColIdx = cIdx + 1;
                          while (nextColIdx < columnsCount) {
                            const nextCol = flattenedActiveColumns[nextColIdx];
                            if (!nextCol.isComputed) {
                              const target = document.querySelector(
                                `input[data-row="${rIdx}"][data-col="${nextCol.name}"]`
                              ) as HTMLInputElement | null;
                              if (target && !target.readOnly && target.tabIndex !== -1) {
                                target.focus();
                                break;
                              }
                            }
                            nextColIdx++;
                          }
                        } else if (e.key === "ArrowLeft") {
                          e.preventDefault();
                          let prevColIdx = cIdx - 1;
                          while (prevColIdx >= 0) {
                            const prevCol = flattenedActiveColumns[prevColIdx];
                            if (!prevCol.isComputed) {
                              const target = document.querySelector(
                                `input[data-row="${rIdx}"][data-col="${prevCol.name}"]`
                              ) as HTMLInputElement | null;
                              if (target && !target.readOnly && target.tabIndex !== -1) {
                                target.focus();
                                break;
                              }
                            }
                            prevColIdx--;
                          }
                        } else if (e.key === "Enter") {
                          e.preventDefault();
                          if (currentFilteredIdx === -1) return;
                          let targetFound = false;

                          let nextFilteredIdx = currentFilteredIdx + 1;
                          while (nextFilteredIdx < filteredRows.length) {
                            const nextRow = filteredRows[nextFilteredIdx].index;
                            const target = document.querySelector(
                                `input[data-row="${nextRow}"][data-col="${col.name}"]`
                            ) as HTMLInputElement | null;
                            if (target && !target.readOnly && target.tabIndex !== -1) {
                              target.focus();
                              onSelectRow(nextRow);
                                targetFound = true;
                              break;
                            }
                            nextFilteredIdx++;
                          }

                          if (!targetFound) {
                            let startFilteredIdx = currentFilteredIdx;
                            let startCol = cIdx + 1;
                            for (let f = startFilteredIdx; f < filteredRows.length; f++) {
                              const targetRow = filteredRows[f].index;
                              const startC = (f === startFilteredIdx) ? startCol : 0;
                              for (let c = startC; c < columnsCount; c++) {
                                const targetCol = flattenedActiveColumns[c];
                                if (!targetCol.isComputed) {
                                  const target = document.querySelector(
                                    `input[data-row="${targetRow}"][data-col="${targetCol.name}"]`
                                  ) as HTMLInputElement | null;
                                  if (target && !target.readOnly && target.tabIndex !== -1) {
                                    target.focus();
                                    onSelectRow(targetRow);
                                    targetFound = true;
                                    break;
                                  }
                                }
                              }
                              if (targetFound) break;
                            }
                          }
                        } else if (e.key === " ") {
                          e.preventDefault();
                          const currentRowObj = gridData[rIdx];
                          if (currentRowObj && currentRowObj.__originalIndex) {
                            handleToggleRow(currentRowObj.__originalIndex);
                          }
                        }
                      };

                      if (
                        colType.includes("date") ||
                        colType.includes("time") ||
                        colType.includes("timestamp")
                      ) {
                        return (
                          <input
                            type="date"
                            value={row[col.name] ?? ""}
                            readOnly={isCellReadOnly}
                            tabIndex={tabIndexValue}
                            data-row={rIdx}
                            data-col={col.name}
                            onChange={(e) => {
                              if (isCellReadOnly) return;
                              setGridData((prev) => {
                                const next = [...prev];
                                if (next[rIdx]) {
                                  next[rIdx][col.name] = e.target.value;
                                  if (next[rIdx].row_status === "New") {
                                    next[rIdx].row_status = "NewModified";
                                  }
                                }
                                return next;
                              });
                            }}
                            onClick={(e) => {
                              if (!isCellReadOnly) {
                                try {
                                  e.currentTarget.showPicker();
                                } catch (err) {}
                              }
                            }}
                            onFocus={(e) => {
                              handleFocus(e);
                              if (!isCellReadOnly) {
                                try {
                                  e.currentTarget.showPicker();
                                } catch (err) {}
                              }
                            }}
                            onKeyDown={handleKeyDown}
                            style={inputStyle}
                            className={`${baseClass} ${cellAlignClass} ${stateClass}`}
                          />
                        );
                        }

                        if (isNumericColumn(col.type)) {
                          return (
                            <input
                              type="text"
                              value={formatNumberWithCommas(row[col.name] ?? "")}
                              readOnly={isCellReadOnly}
                              tabIndex={tabIndexValue}
                              data-row={rIdx}
                              data-col={col.name}
                              onChange={(e) => {
                                if (isCellReadOnly) return;
                                const val = formatNumberWithCommas(e.target.value);
                                setGridData((prev) => {
                                  const next = [...prev];
                                  if (next[rIdx]) {
                                    next[rIdx][col.name] = val;
                                    if (next[rIdx].row_status === "New") {
                                      next[rIdx].row_status = "NewModified";
                                    }
                                  }
                                  return next;
                                });
                              }}
                              onFocus={handleFocus}
                              onKeyDown={handleKeyDown}
                              style={inputStyle}
                              className={`${baseClass} text-right ${stateClass}`}
                            />
                          );
                        }

                        return (
                          <input
                            type="text"
                            value={row[col.name] ?? ""}
                            readOnly={isCellReadOnly}
                            tabIndex={tabIndexValue}
                            data-row={rIdx}
                            data-col={col.name}
                            onChange={(e) => {
                              if (isCellReadOnly) return;
                              setGridData((prev) => {
                                  const next = [...prev];
                                  if (next[rIdx]) {
                                    next[rIdx][col.name] = e.target.value;
                                    if (next[rIdx].row_status === "New") {
                                      next[rIdx].row_status = "NewModified";
                                    }
                                  }
                                  return next;
                                });
                            }}
                            onFocus={handleFocus}
                            onKeyDown={handleKeyDown}
                            style={inputStyle}
                            className={`${baseClass} ${cellAlignClass} ${stateClass}`}
                          />
                        );
                    };

                    return (
                      <td 
                        key={`cell-${col.name}-${cIdx}`} 
                        className={`p-1 border-r border-slate-900/40 ${
                          isFrozen ? "sticky z-10" : ""
                        } ${
                          isLastFrozen ? "border-r-2 border-r-indigo-500/80" : ""
                        } ${tdClass}`} 
                        style={{ 
                          width: `${columnWidths[col.name] || 150}px`,
                          left: leftOffset,
                          ...tdStyle,
                        }}
                      >
                        {renderGridCellInput()}
                      </td>
                    );
                  })}
                  <td className="p-1 border-l border-slate-900/40 text-center w-20 print:hidden" style={{ width: "80px" }}>
                    {isModified && (
                      <button
                        onClick={() => handleUndoRow(rIdx)}
                        className="px-2 py-0.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 hover:text-amber-400 border border-amber-500/20 rounded text-[10px] font-bold transition-all opacity-70 animate-pulse cursor-pointer"
                        title={t.tooltipUndo}
                      >
                        {t.undo}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
        <tfoot className="sticky bottom-0 bg-slate-950 border-t-2 border-cyan-500/80 z-30 shadow-[0_-4px_15px_rgba(6,182,212,0.25)] print:static print:border-t print:shadow-none">
          <tr className="bg-slate-900/90 text-cyan-400 font-bold border-b border-slate-900/60 font-mono select-none">
            <td className="p-3 text-center sticky left-0 z-30 bg-[#090e1c] border-r border-slate-900/40" style={{ width: "48px", left: 0 }}>
            </td>
            <td className="p-3 text-center sticky left-0 z-30 bg-[#090e1c] border-r border-slate-900/40 text-[10px] text-cyan-500" style={{ width: "48px", left: 48 }}>
              ∑
            </td>
            {flattenedActiveColumns.map((col, cIdx) => {
              if (col.isComputed) {
                return (
                  <td key={`sum-comp-${col.name}-${cIdx}`} className="p-3 text-right bg-[#0f192b] border-r border-slate-900/40 text-slate-600 italic text-[10px]" style={{ width: `${columnWidths[col.name] || 150}px` }}>
                    N/A
                  </td>
                );
              }

              const isFrozen = col.originalIndex < 2;
              const leftOffset = isFrozen ? getFrozenLeftOffset(col.originalIndex) : undefined;
              const isLastFrozen = isFrozen && visibleFrozenColumns.length > 0 && visibleFrozenColumns[visibleFrozenColumns.length - 1].name === col.name;
              const isNum = isNumericColumn(col.type);

              let cellText = "";
              if (col.originalIndex === 0) {
                cellText = currentLanguage === "ko" ? "합계" : "Sum";
              } else if (isNum) {
                cellText = formatNumberWithCommas(String(footerSummaries.sums[col.name] ?? 0));
              }

              return (
                <td
                  key={`sum-cell-${col.name}-${cIdx}`}
                  className={`p-3 border-r border-slate-900/40 ${isFrozen ? "sticky z-10 bg-[#090e1c]" : ""} ${isLastFrozen ? "border-r-2 border-r-indigo-500/80" : ""} ${isNum ? "text-right" : "text-center text-slate-500"}`}
                  style={{
                    width: `${columnWidths[col.name] || 150}px`,
                    left: leftOffset,
                  }}
                >
                  {cellText}
                </td>
              );
            })}
            <td className="p-3 border-l border-slate-900/40 bg-slate-900 text-center w-20 print:hidden" style={{ width: "80px" }}>
            </td>
          </tr>

          <tr className="bg-slate-900/90 text-amber-400 font-bold font-mono select-none">
            <td className="p-3 text-center sticky left-0 z-30 bg-[#090e1c] border-r border-slate-900/40" style={{ width: "48px", left: 0 }}>
            </td>
            <td className="p-3 text-center sticky left-0 z-30 bg-[#090e1c] border-r border-slate-900/40 text-[10px] text-amber-500" style={{ width: "48px", left: 48 }}>
              μ
            </td>
            {flattenedActiveColumns.map((col, cIdx) => {
              if (col.isComputed) {
                return (
                  <td key={`avg-comp-${col.name}-${cIdx}`} className="p-3 text-right bg-[#0f192b] border-r border-slate-900/40 text-slate-600 italic text-[10px]" style={{ width: `${columnWidths[col.name] || 150}px` }}>
                    N/A
                  </td>
                );
              }

              const isFrozen = col.originalIndex < 2;
              const leftOffset = isFrozen ? getFrozenLeftOffset(col.originalIndex) : undefined;
              const isLastFrozen = isFrozen && visibleFrozenColumns.length > 0 && visibleFrozenColumns[visibleFrozenColumns.length - 1].name === col.name;
              const isNum = isNumericColumn(col.type);

              let cellText = "";
              if (col.originalIndex === 0) {
                cellText = currentLanguage === "ko" ? "평균" : "Avg";
              } else if (isNum) {
                const avgVal = footerSummaries.avgs[col.name] ?? 0;
                cellText = formatNumberWithCommas(String(Number(avgVal.toFixed(2))));
              }

              return (
                <td
                  key={`avg-cell-${col.name}-${cIdx}`}
                  className={`p-3 border-r border-slate-900/40 ${isFrozen ? "sticky z-10 bg-[#090e1c]" : ""} ${isLastFrozen ? "border-r-2 border-r-indigo-500/80" : ""} ${isNum ? "text-right" : "text-center text-slate-500"}`}
                  style={{
                    width: `${columnWidths[col.name] || 150}px`,
                    left: leftOffset,
                  }}
                >
                  {cellText}
                </td>
              );
            })}
            <td className="p-3 border-l border-slate-900/40 bg-slate-900 text-center w-20 print:hidden" style={{ width: "80px" }}>
            </td>
          </tr>
        </tfoot>
      </table>
    </>
  );
};

export default function GridPreview({
  parsedData,
  gridData,
  setGridData,
  argValues,
  selectedRowIndex,
  onSelectRow,
  onRestorePreset,
}: GridPreviewProps) {
  // [Day 44 작업] 다중 선택 체크박스 상태 모델 정의 (Set 구조로 인덱스 추적)
  const [selectedRowIds, setSelectedRowIds] = React.useState<Set<string>>(new Set());

  // [Day 49 작업] 조건 만족 행 자동 포커싱(Row Search & Jump)을 위한 상태 변수 선언
  const [rowSearchKeyword, setRowSearchKeyword] = React.useState<string>("");
  const [matchedRowIndices, setMatchedRowIndices] = React.useState<number[]>([]);
  const [currentMatchPointer, setCurrentMatchPointer] = React.useState<number>(-1);

  // [Day 49 작업] 포커스 [ˈfoʊkəs] 행 변경 시 뷰포트 내의 위치로 스크롤 [skroʊl]바 자동 연동 훅
  React.useEffect(() => {
    if (selectedRowIndex >= 0 && selectedRowIndex < gridData.length) {
      const targetRowElement = document.getElementById(`grid-row-${selectedRowIndex}`);
      if (targetRowElement) {
        targetRowElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedRowIndex, gridData]);

  // [Day 49 작업] dw_1.Find() 및 dw_1.ScrollToRow() 대치용 행 검색 및 자동 포커스 [ˈfoʊkəs] 제어 핸들러
  /*
   * [레거시 파워빌더 dw_1.Find() & dw_1.ScrollToRow() vs 현대 React 상태 추적 및 scrollIntoView() 아키텍처 비교]
   *
   * 1. 레거시 파워빌더 (C/S 환경의 동기적 화면 제어):
   *    - 파워빌더에서는 특정 조건의 행을 찾고 포커스 [ˈfoʊkəs]를 주려면 `ll_row = dw_1.Find("rep = '김개발'", 1, dw_1.RowCount())`와 같이
   *      버퍼 스캔 함수를 동기식(Synchronous)으로 호출하여 타겟 행의 1-기반 물리 인덱스를 받아냈습니다.
   *      이후 `dw_1.ScrollToRow(ll_row)`를 호출하면, 파워빌더 엔진이 윈도우 스크롤 스풀러에 이벤트를 보내 스크롤 [skroʊl]바를 
   *      물리적으로 드래그하는 연산을 동기식으로 유발하여 화면을 스위칭하고 포커스 [ˈfoʊkəs] 행을 동기화했습니다.
   *    - 이 방식은 UI와 데이터 버퍼 제어가 강력하게 동기적으로 묶여 있어 화면 스풀 작업이 끝날 때까지 스레드가 차단되고,
   *      데이터가 많을 경우 심각한 렌더링 랙이 발생했습니다.
   *
   * 2. 현대 웹 표준 React 아키텍처 (선언형 상태 변화와 브라우저 하드웨어 가속 뷰포트 스크롤 [skroʊl] 제어):
   *    - React 환경에서는 데이터 스캔과 UI 갱신이 엄격하게 비동기식/선언적으로 분리됩니다.
   *    - 사용자가 행 검색어 입력 시, `gridData` 전체 배열에서 조건에 매칭되는 행들의 인덱스 목록(`matchedRowIndices`)을 
   *      선언적 배열 탐색 알고리즘(Array.prototype.map 및 filter)을 활용하여 즉각 메모리 상에서 판별합니다.
   *    - 이전/다음 찾기 버튼 클릭 시, 매칭 인덱스 배열 내에서 포인터를 앞뒤로 순환 이동시키고, 포커스 [ˈfoʊkəs] 행을 뜻하는 
   *      `selectedRowIndex` 상태(State) 값만 전이시킵니다.
   *    - React 런타임이 상태 변화를 감지하고 가상 돔(Virtual DOM)을 재구성하여 화면 상의 선택 로우 CSS 스타일을 자동 업데이트하며, 
   *      `useEffect` 훅에 바인딩된 DOM 관측기가 타겟 엘리먼트(`grid-row-${selectedRowIndex}`)를 캡처하여 브라우저 네이티브 
   *      `scrollIntoView({ block: "nearest" })` API를 통해 스크롤 [skroʊl] 갱신을 하드웨어 가속으로 빠르고 비차단 방식으로 처리합니다.
   *    - 만약 일치하는 행이 발견되지 않으면, 하단 터미널 JSON 덤프 영역에 `[FIND ERROR]` 문구를 노출하고 
   *      개발자 도구 콘솔에 빨간 경고 스타일링(`console.log('%c...', 'color: red')`)으로 예외 상황을 투명하게 안내합니다.
   */
  const handleRowSearch = (direction: "next" | "prev", keyword: string) => {
    const trimmed = keyword.trim().toLowerCase();
    if (!trimmed) return;

    // 1. 현재 데이터셋(gridData) 스캔하여 매칭되는 실제 행들의 인덱스 수집
    const matches: number[] = [];
    gridData.forEach((row, idx) => {
      const match = (parsedData.columns || []).some((col) => {
        const val = String(row[col.name] ?? "").toLowerCase();
        return val.includes(trimmed);
      });
      if (match) {
        matches.push(idx);
      }
    });

    if (matches.length === 0) {
      // 일치하는 결과가 없을 시 터미널 로그에 빨갛게 경고 노출
      const errMsg = `[FIND ERROR] 조건에 부합하는 행이 존재하지 않습니다. (검색어: "${keyword}")`;
      setDumpOutput(errMsg);
      console.log(`%c${errMsg}`, "color: #ef4444; font-weight: bold; font-size: 12px;");
      return;
    }

    // 2. 포인터 전이 및 selectedRowIndex 강제 전이
    let nextPointer = 0;
    if (direction === "next") {
      // 현재 포커스된 selectedRowIndex 이후의 첫 번째 매칭 인덱스를 탐색
      const nextMatch = matches.find((idx) => idx > selectedRowIndex);
      if (nextMatch !== undefined) {
        nextPointer = matches.indexOf(nextMatch);
      } else {
        // 더 이상 뒤에 매칭되는 행이 없으면 처음으로 순환
        nextPointer = 0;
      }
    } else {
      // 현재 포커스된 selectedRowIndex 이전의 마지막 매칭 인덱스를 탐색
      const prevMatches = matches.filter((idx) => idx < selectedRowIndex);
      if (prevMatches.length > 0) {
        const prevMatch = prevMatches[prevMatches.length - 1];
        nextPointer = matches.indexOf(prevMatch);
      } else {
        // 더 이상 앞에 매칭되는 행이 없으면 마지막으로 순환
        nextPointer = matches.length - 1;
      }
    }

    const targetRowIdx = matches[nextPointer];
    setMatchedRowIndices(matches);
    setCurrentMatchPointer(nextPointer);
    onSelectRow(targetRowIdx);

    // 검색 성공 시 에러 흔적이 있다면 지워줌
    setDumpOutput((prev) => (prev && prev.includes("[FIND ERROR]") ? null : prev));
  };

  // [Day 36 작업] 삭제된 레코드를 추적하기 위한 버퍼 상태 및 타입 정의
  interface DeletedRowInfo {
    row_no: number;
    row_status: "Deleted";
    data: { [key: string]: string };
  }
  const [deleteBuffer, setDeleteBuffer] = React.useState<DeletedRowInfo[]>([]);

  // [Day 42 작업] 컬럼 설정 ⚙️ 토글 상태 및 컬럼 가시성 상태 선언
  const [showColumnSettings, setShowColumnSettings] = React.useState<boolean>(false);
  const [visibleColumns, setVisibleColumns] = React.useState<Record<string, boolean>>({});

  // [Day 41 작업] 다국어 선택 상태 및 단방향 데이터 바인딩 자원 객체
  const [currentLanguage, setCurrentLanguage] = React.useState<"ko" | "en">("ko");
  const t = LANG_DICT[currentLanguage];

  // [Day 39 작업] 디테일 뷰포트 상태 및 삭제 버퍼 선언
  const [detailData, setDetailData] = React.useState<{ [empId: string]: DetailRow[] }>(() => {
    return JSON.parse(JSON.stringify(MOCK_DETAIL_DATA));
  });

  interface DeletedDetailRowInfo {
    emp_id: string;
    seq: string;
    data: DetailRow;
  }
  const [detailDeleteBuffer, setDetailDeleteBuffer] = React.useState<DeletedDetailRowInfo[]>([]);
  const [selectedDetailRowIndex, setSelectedDetailRowIndex] = React.useState<number>(0);

  // [Day 45 작업] 내부 액션 인터셉트 모달 상태 선언
  const [interceptModal, setInterceptModal] = React.useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    message: "",
    onConfirm: () => {},
  });

  // [Day 39 작업] 마스터의 고유 ID 식별자 추출
  const currentMasterRow = gridData[selectedRowIndex];
  const currentEmpId = currentMasterRow ? (currentMasterRow.emp_id || currentMasterRow.id || "") : "";

  // [Day 48 작업] 런타임 조건부 서식 지정(Conditional Formatting [kənˈdɪʃənl ˈfɔːrmætɪŋ]) 스타일 판별 헬퍼 함수
  // 
  // [파워빌더 데이터윈도우 Expressions vs 현대 React 상태 기반 선언형 스타일링 비교]
  // 
  // 1. 레거시 파워빌더 (Expressions Evaluator [ɪkˈspreʃnz ɪˌvæljuˈeɪʃn] 엔진 방식):
  //    - 파워빌더에서는 특정 컬럼의 배경색(Background.Color)이나 텍스트 색상(Color) 속성창에 
  //      `if(sales >= 250000, rgb(16,185,129), rgb(255,255,255))` 형태의 Expressions [ɪkˈspreʃnz] 수식을 입력해 두었습니다.
  //    - 런타임[ˈrʌntaɪm]에 데이터윈도우 버퍼의 값(예: dw_1.SetItem으로 수정 등)이 변경되면, 엔진이 내부의 
  //      동적 연산 평가 엔진(Expressions Evaluator)을 구동하여 해당 셀을 다시 그리고 화면을 갱신했습니다.
  //    - 이 방식은 개발자가 데이터윈도우 오브젝트(.srd)의 속성창 탭에 숨겨진 연산식을 개별적으로 설정해야 해서
  //      가독성이 떨어지고, 대규모 수식이 얽힐 경우 디버깅이 극도로 까다로웠습니다.
  // 
  // 2. 현대 웹 표준 React 아키텍처 (상태 기반 동적 인라인 스타일 팩 바인딩 방식):
  //    - React 환경에서는 UI가 컴포넌트 스코프의 상태(State, 즉 `gridData`) 데이터에 기반하여 실시간 투사됩니다.
  //    - 사용자가 인풋 필드를 통해 특정 셀의 값을 변경하면, React의 단방향 데이터 바인딩에 의해 `gridData` 상태가
  //      불변 객체 단위로 업데이트되고, React 런타임[ˈrʌntaɪm]이 상태 변화를 감지하여 가상 돔(Virtual DOM)을 재렌더링합니다.
  //    - 이 렌더링 과정에서 복잡한 수식 엔진이나 수동 화면 갱신 루프 없이, 컴포넌트 내부 함수가
  //      실시간으로 변경된 상태 값을 참조하여 조건에 부합하는 CSS 스타일 또는 인라인 스타일 팩(Style Pack)을 선언적으로 즉각 반환합니다.
  //    - 이를 통해 스타일 조건식과 UI 구조가 한눈에 파악되며, 컴포넌트 내에서 완벽하게 제어할 수 있어 유지보수 편의성이 극대화됩니다.
  const getCellStyleAndClass = React.useCallback((
    row: { [key: string]: string }, 
    colName: string, 
    isFrozen: boolean,
    hasError: boolean,
    isSelected: boolean,
    isModified: boolean,
    isCellReadOnly: boolean
  ) => {
    const colNameLower = colName.toLowerCase();
    let condClass = "";
    
    // 조건부 서식 조건 평가 (sales 수치 조건 및 status 상태값 조건)
    if (colNameLower === "sales" || colNameLower === "salary" || colNameLower === "amt" || colNameLower === "amount") {
      const rawVal = row[colName] ?? "";
      const cleanVal = rawVal.replace(/,/g, "").trim();
      const numVal = Number(cleanVal);
      
      if (!isNaN(numVal) && cleanVal !== "") {
        if (numVal >= 250000) {
          condClass = "cell-cond-high-sales";
        } else if (numVal < 100000) {
          condClass = "cell-cond-low-sales";
        }
      }
    } else if (colNameLower === "status") {
      const statusVal = (row[colName] ?? "").trim();
      if (statusVal === "Closed") {
        condClass = "cell-cond-status-closed";
      } else if (statusVal === "Open") {
        condClass = "cell-cond-status-open";
      }
    }

    // 렌더링 우선순위(Priority)에 따른 스타일 및 클래스 조립
    // 1순위: validation 오류(hasError)
    // 2순위: 수식 기반 Protect 행 잠금(isCellReadOnly)
    // 3순위: 선택 행 하이라이트(isSelected)
    // 4순위: 런타임 데이터 연동형 조건부 서식(condClass)
    // 5순위: 롤백 변동 행(isModified)
    
    let tdClass = "";
    let tdStyle: React.CSSProperties = {};
    let inputStyle: React.CSSProperties = {};

    // 2-1. td background 클래스/스타일 결정
    if (hasError) {
      tdClass = isFrozen ? "bg-[#251016]" : "bg-red-950/25";
      tdStyle.borderColor = "rgba(239, 68, 68, 0.3)";
    } else if (isCellReadOnly) {
      if (condClass) {
        tdClass = condClass;
      } else {
        tdClass = isFrozen ? "bg-[#131722]" : "bg-slate-950/60";
      }
    } else if (condClass) {
      tdClass = condClass;
    } else if (isSelected) {
      tdClass = isFrozen ? "bg-[#141b38]" : "bg-indigo-600/10";
    } else if (isModified) {
      tdClass = isFrozen ? "bg-[#0c201d]" : "bg-emerald-950/10";
    } else {
      if (isFrozen) {
        tdClass = "bg-[#090e1c] group-hover:bg-[#11192e]";
      } else {
        tdClass = "group-hover:bg-[#11192e]/40";
      }
    }

    // 2-2. input text 컬러 및 폰트 스타일 결정
    if (hasError) {
      inputStyle.color = "#fecaca";
      inputStyle.fontWeight = "bold";
    } else if (isCellReadOnly) {
      inputStyle.color = "#64748b";
      inputStyle.fontStyle = "italic";
    } else if (condClass) {
      // 조건부 서식의 글자색과 폰트 스타일은 CSS 클래스에 위임합니다.
    } else {
      inputStyle.color = "#ffffff";
    }

    return {
      tdClass,
      tdStyle,
      inputStyle
    };
  }, []);

  // [Day 39 작업] 마스터 선택 행 변경 시 디테일 뷰 연동을 위한 선택 초기화 훅
  React.useEffect(() => {
    setSelectedDetailRowIndex(0);
  }, [selectedRowIndex]);

  // [Day 32 작업] 동적 조회(Retrieve) 및 필터링 관련 React 로컬 상태 관리
  const [selectedDept, setSelectedDept] = React.useState<string>("전체");
  const [searchKeyword, setSearchKeyword] = React.useState<string>("김개발"); // 사용성 향상을 위한 초기 기본값 지정
  const [isLoading, setIsLoading] = React.useState<boolean>(false);

  // [Day 34 작업] 결과 내 실시간 와일드카드 필터링 키워드 로컬 상태 선언
  const [filterKeyword, setFilterKeyword] = React.useState<string>("");

  // [Day 33 작업] 정렬 상태 관리를 위한 React 로컬 상태 추가
  const [sortConfig, setSortConfig] = React.useState<{ key: string; direction: "asc" | "desc" | "none" }>({
    key: "",
    direction: "none",
  });

  // [Day 24 작업] 초기 gridData 백업 및 비교를 위한 레퍼런스
  const snapshotRef = React.useRef<Array<{ [key: string]: string }>>([]);
  const initialGridDataRef = React.useRef<Array<{ [key: string]: string }>>([]);
  const prevParsedDataRef = React.useRef<any>(null);

  // [Day 39 작업] 초기 detailData 백업 및 비교를 위한 레퍼런스
  const initialDetailDataRef = React.useRef<{ [empId: string]: DetailRow[] }>(
    JSON.parse(JSON.stringify(MOCK_DETAIL_DATA))
  );

  // [Day 29 작업] 추출된 JSON 마스터 패킷 저장용 상태
  const [dumpOutput, setDumpOutput] = React.useState<string | null>(null);
  // [Day 30 작업] 클립보드 복사 완료 상태 관리용 토스트 플래그
  const [copied, setCopied] = React.useState<boolean>(false);

  // [Day 40 작업] 비동기 Update 및 트랜잭션 상태 제어 상태 변수
  const [isUpdating, setIsUpdating] = React.useState<boolean>(false);
  const [showCommitToast, setShowCommitToast] = React.useState<boolean>(false);

  // [Day 37 작업] 그리드 헤더 컬럼별 너비(px) 상태 관리
  const [columnWidths, setColumnWidths] = React.useState<{ [key: string]: number }>(() => {
    const widths: { [key: string]: number } = {};
    (parsedData.columns || []).forEach((c) => {
      widths[c.name] = 150; // 기본 컬럼 너비 150px
    });
    (parsedData.computedFields || []).forEach((comp) => {
      widths[comp.name] = 150; // 기본 계산식 컬럼 너비 150px
    });
    return widths;
  });

  // parsedData 변경 시 신규 컬럼에 대한 기본 너비 보정
  React.useEffect(() => {
    setColumnWidths((prev) => {
      const next = { ...prev };
      let changed = false;
      (parsedData.columns || []).forEach((c) => {
        if (next[c.name] === undefined) {
          next[c.name] = 150;
          changed = true;
        }
      });
      (parsedData.computedFields || []).forEach((comp) => {
        if (next[comp.name] === undefined) {
          next[comp.name] = 150;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [parsedData]);

  // [Day 42 작업] parsedData의 컬럼 정보를 기반으로 기본 가시성 상태 초기화
  React.useEffect(() => {
    setVisibleColumns((prev) => {
      const next = { ...prev };
      let changed = false;
      (parsedData.columns || []).forEach((c) => {
        if (next[c.name] === undefined) {
          next[c.name] = true;
          changed = true;
        }
      });
      (parsedData.computedFields || []).forEach((comp) => {
        if (next[comp.name] === undefined) {
          next[comp.name] = true;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [parsedData]);

  // [Day 37 작업] 마우스 드래그를 통한 컬럼 너비 리사이징 이벤트 훅 및 제어 로직
  const handleResizeStart = (colKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // 헤더 정렬(handleSort) 클릭 이벤트 전파 차단

    const startX = e.clientX;
    const startWidth = columnWidths[colKey] || 150;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(60, startWidth + deltaX); // 최소 너비 60px 보장
      setColumnWidths((prev) => ({
        ...prev,
        [colKey]: newWidth,
      }));
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // [Day 37 작업] 컬럼 너비들의 합산으로 테이블의 전체 고정 폭 계산
  // [Day 42 작업] visibleColumns에 기재된 활성화된 컬럼들만 합산하여 계산
  // [Day 44 작업] 다중 선택 체크박스(48px)가 추가되면서 테이블 너비 합산 공식 업데이트
  const totalTableWidth = React.useMemo(() => {
    let sum = 48 + 48 + 80; // 체크박스(48) + No.(48) + 제어(80)
    (parsedData.columns || []).forEach((c) => {
      if (visibleColumns[c.name] !== false) {
        sum += columnWidths[c.name] || 150;
      }
    });
    (parsedData.computedFields || []).forEach((comp) => {
      if (visibleColumns[comp.name] !== false) {
        sum += columnWidths[comp.name] || 150;
      }
    });
    return sum;
  }, [parsedData, columnWidths, visibleColumns]);

  // [Day 42 작업] 노출되어 있는 고정 열들 중에서 가장 우측에 위치한 고정 열 식별
  const visibleFrozenColumns = React.useMemo(() => {
    return (parsedData.columns || [])
      .slice(0, 2)
      .filter((c) => visibleColumns[c.name] !== false);
  }, [parsedData.columns, visibleColumns]);

  // [Day 38 작업] 파워빌더 고정 열(Fixed Columns) vs 웹 표준 CSS Sticky 및 React 동적 오프셋 비교 (교육용 주석)
  // [Day 42 작업] 파워빌더 dw_1.Modify("column.Visible='0'") vs 현대 React의 선언형 가시성(Visibility [ˌvɪzəˈbɪləti]) 및 Sticky 레이아웃 동기화 아키텍처 비교
  /*
   * 1. 레거시 파워빌더 (C/S 환경):
   *    - 파워빌더에서는 특정 컬럼을 숨기기 위해 `dw_1.Modify("column_name.Visible='0'")` 또는 `dw_1.Object.column_name.Visible = 0` 스크립트를 명령형(Imperative)으로 실행합니다.
   *    - 컬럼이 보이지 않게 되면, 파워빌더 엔진은 화면 상의 절대 픽셀 좌표를 재계산하여 다른 컬럼들의 X 좌표를 당겨오지 못하므로 빈 공백(Gap)이 남거나,
   *      이를 해결하기 위해 개발자가 스크립트 상에서 각 컬럼의 `.X` 및 `.Width` 속성을 루프를 돌며 동적으로 변경해주는 부가 연산이 필수적이었습니다.
   *    - 이는 화면 디자인 레이아웃(Layout [ˈleɪaʊt])과 코드가 강하게 결합되어 스크립트 오류를 유발하기 쉬운 한계가 있었습니다.
   *
   * 2. 현대 웹 표준 React 아키텍처 (선언형 가시성 및 가상 돔 제어):
   *    - React 환경에서는 컬럼의 가시성(Visibility [ˌvɪzəˈbɪləti]) 상태를 `visibleColumns` 로컬 State로 선언하고 관리합니다.
   *    - 사용자가 체크박스를 토글(Toggle [ˈtɑːɡl])하여 컬럼의 가시성 상태가 변경되면, React는 가상 돔(Virtual DOM [ˈvɜːrtʃuəl dɒm])을 이용해 상태 변화를 감지하고,
   *      실시간으로 가시성이 `false`가 된 헤더(`<th>`)와 데이터 셀(`<td>`)을 렌더링 트리에서 완전히 제외하는 조건부 렌더링을 수행합니다.
   *    - 이때 복잡한 절대 좌표 변경 과정 없이 브라우저의 Flexbox/Table 자동 레이아웃 엔진이 너비를 스스로 재배치하며,
   *      틀고정(Frozen) 열들의 누적 left 오프셋도 `getFrozenLeftOffset`과 `totalTableWidth` 계산식이 메모리에 상주 중인 `visibleColumns` 상태의
   *      활성화된 컬럼들만 합산하여 유기적으로 반영되므로 틀고정 경계선이 한 픽셀의 오차도 없이 유연하게 달라붙게 됩니다.
   *    - 리렌더링(Rerendering [riːˈrendərɪŋ]) 과정에서 DOM을 직접 조작하지 않고 데이터 상태와 뷰의 바인딩을 일치시킴으로써 뛰어난 성능과 설계의 분리(SoC)를 만족합니다.
   */
  // [Day 44 작업] 다중 선택 체크박스(48px) 도입으로 인한 Frozen Column left 오프셋 계산식 튜닝
  const getFrozenLeftOffset = React.useCallback((colIndex: number): number => {
    if (colIndex === -1) return 48; // 'No.' 열은 체크박스(48px) 바로 다음에 고정
    let offset = 96; // 체크박스(48px) + 'No.'(48px) 의 고정 너비 합산 오프셋
    for (let i = 0; i < colIndex; i++) {
      const colName = parsedData.columns[i]?.name;
      if (colName) {
        // [Day 42 작업] visibleColumns에 기재된 활성화된 컬럼들만 오프셋에 합산
        const isVisible = visibleColumns[colName] !== false;
        if (isVisible) {
          offset += columnWidths[colName] || 150;
        }
      }
    }
    return offset;
  }, [parsedData.columns, columnWidths, visibleColumns]);

  // [Day 42 작업] 활성화된 전체 컬럼 개수 계산 (No. 및 제어 컬럼 제외)
  // [Day 44 작업] 다중 선택 체크박스 열이 추가되면서 기본 colSpan에 체크박스 포함하도록 보정 (+3)
  const totalVisibleColSpan = React.useMemo(() => {
    const visibleCols = (parsedData.columns || []).filter((c) => visibleColumns[c.name] !== false).length;
    const visibleComps = (parsedData.computedFields || []).filter((comp) => visibleColumns[comp.name] !== false).length;
    return visibleCols + visibleComps + 3; // 체크박스 + No. + 제어 포함
  }, [parsedData.columns, parsedData.computedFields, visibleColumns]);

  // [Day 46 작업] 다중 컬럼 헤더 그룹화([ˈkɑːləm ˈhedər ˈɡruːpɪŋ]) 및 colSpan 동적 연산, Sticky 틀고정 동기화 로직
  //
  // [레거시 파워빌더와 현대 웹 표준 React의 다중 컬럼 헤더 그룹화(Column Header Grouping [ˈkɑːləm ˈhedər ˈɡruːpɪŋ]) 아키텍처 비교]
  //
  // 1. 레거시 파워빌더 (C/S 환경의 정적 헤더 밴드 꼼수):
  //    - 파워빌더 데이터윈도우의 Grid 및 Tabular 프리젠테이션 스타일은 기본적으로 HTML5의 colSpan과 같은 다차원 셀 병합 구조를 지원하지 않았습니다.
  //    - 이로 인해 과거 C/S 환경에서는 헤더 밴드(Header Band) 내에 컬럼 헤더 라벨들을 나열한 뒤, 그 위에 수동으로 정적인 텍스트 오브젝트(라벨)를
  //      겹쳐 배치(Overlap)하고 하단 경계선을 제거하여 마치 셀이 병합된 것처럼 눈속임하는 정적 방식을 설계 및 사용했습니다.
  //    - 이 방식은 런타임에 사용자가 마우스 드래그로 컬럼 너비(Width)를 변경하거나, 특정 컬럼을 숨기거나(`Visible='0'`), 가로 스크롤 시
  //      상위 텍스트 오브젝트의 X 좌표와 너비가 자동으로 동기화되지 않아 레이아웃이 찢어지고 붕괴되는 치명적인 아키텍처적 한계가 있었습니다.
  //
  // 2. 현대 웹 표준 React 아키텍처 (선언형 계층 구조 스키마 렌더링 및 런타임 DOM 동기화):
  //    - React 환경에서는 UI 구조를 데이터 상태의 투사체로 다루므로, 구조적 HTML5 시맨틱 테이블 구조(`colspan`, `rowspan`, `thead`)를 선언적으로 생성합니다.
  //    - 컬럼 그룹화([ˈɡruːpɪŋ]) 스키마를 상태 데이터에 기반하여 정의하고, `visibleColumns`의 가시성 상태 변화에 따라 상위 그룹 헤더의 `colSpan`을 런타임에 동적으로 재연산합니다.
  //    - 특정 그룹 내 컬럼이 모두 숨겨지면, 해당 그룹 자체를 DOM 트리에서 완전히 조건부 제거하여 깔끔한 화면을 유지합니다.
  //    - 상위 그룹 헤더가 가로 스크롤 시 하위 고정 컬럼들과 한 몸처럼 움직이도록, 그룹의 첫 번째 활성화된 컬럼의 `left` 오프셋과 `position: sticky` 스타일을 상위 그룹 헤더에
  //      동적으로 바인딩(Offset Sync)합니다.
  //    - 드래그 리사이징 시에도 경계선이 정확히 일치하도록, 소속된 가시 컬럼들의 실시간 너비의 합(`reduce`)을 상위 그룹의 `style.width`로 자동 연계하여 완벽한 동기화와 SOC를 구현합니다.
  const getColumnGroup = React.useCallback((colName: string): "basic" | "dept" | "personnel" => {
    const nameLower = colName.toLowerCase();
    if (nameLower.includes("id") || nameLower.includes("emp") || nameLower.includes("name") || nameLower.includes("rep")) {
      return "basic";
    }
    if (nameLower.includes("dept") || nameLower.includes("region") || nameLower.includes("department")) {
      return "dept";
    }
    return "personnel";
  }, []);

  const groupLabels = React.useMemo(() => ({
    basic: currentLanguage === "ko" ? "기본 정보" : "Basic Info",
    dept: currentLanguage === "ko" ? "부서 정보" : "Dept Info",
    personnel: currentLanguage === "ko" ? "인사 실적" : "Personnel Info",
  }), [currentLanguage]);

  const headerGroups = React.useMemo(() => {
    // 1. 활성화된 컬럼 및 계산식 컬럼 목록 가공
    const activeCols = (parsedData.columns || [])
      .map((col, idx) => ({ ...col, originalIndex: idx, isComputed: false }))
      .filter((c) => visibleColumns[c.name] !== false);

    const activeComps = (parsedData.computedFields || [])
      .map((comp, idx) => ({
        name: comp.name,
        label: comp.label || comp.name,
        alignment: comp.alignment,
        expression: comp.expression,
        originalIndex: idx,
        isComputed: true,
      }))
      .filter((c) => visibleColumns[c.name] !== false);

    // 2. 각 그룹별 수집 매핑
    const groupsMap: Record<"basic" | "dept" | "personnel", Array<any>> = {
      basic: [],
      dept: [],
      personnel: [],
    };

    activeCols.forEach((col) => {
      const g = getColumnGroup(col.name);
      groupsMap[g].push(col);
    });

    activeComps.forEach((comp) => {
      const g = getColumnGroup(comp.name);
      groupsMap[g].push(comp);
    });

    // 3. 그룹별 메타데이터 구성
    return (["basic", "dept", "personnel"] as const)
      .map((gKey) => {
        const cols = groupsMap[gKey];
        if (cols.length === 0) return null;

        // 그룹의 총 너비 (리사이징 동적 연동)
        const width = cols.reduce((sum, c) => sum + (columnWidths[c.name] || 150), 0);

        // 첫 번째 컬럼의 left offset 및 sticky 여부 확인
        const hasFrozen = cols.some((c) => !c.isComputed && c.originalIndex < 2);
        let leftOffset: number | undefined = undefined;

        if (hasFrozen) {
          // 가시 컬럼들 중 첫 번째 frozen 컬럼의 left offset 추출
          const firstFrozen = cols.find((c) => !c.isComputed && c.originalIndex < 2);
          if (firstFrozen) {
            leftOffset = getFrozenLeftOffset(firstFrozen.originalIndex);
          }
        }

        return {
          key: gKey,
          label: groupLabels[gKey],
          colSpan: cols.length,
          width,
          isSticky: hasFrozen,
          leftOffset,
          columns: cols,
        };
      })
      .filter(Boolean) as Array<{
        key: "basic" | "dept" | "personnel";
        label: string;
        colSpan: number;
        width: number;
        isSticky: boolean;
        leftOffset: number | undefined;
        columns: Array<any>;
      }>;
  }, [parsedData, visibleColumns, columnWidths, getColumnGroup, groupLabels, getFrozenLeftOffset]);

  // 평탄화된 가시 컬럼 순서 목록 (tbody의 td들과 순서 일치 동기화용)
  const flattenedActiveColumns = React.useMemo(() => {
    const list: Array<any> = [];
    headerGroups.forEach((g) => {
      list.push(...g.columns);
    });
    return list;
  }, [headerGroups]);

  // [Day 35 작업] 실시간 유효성 검증(Validation) 및 레거시 ItemChanged / dw_1.Find() 대치 로직
  const [validationErrors, setValidationErrors] = React.useState<{ [rowIndex: number]: string }>({});

  const validateGridData = React.useCallback((data: Array<{ [key: string]: string }>, lang: "ko" | "en") => {
    const errors: { [rowIndex: number]: string } = {};
    const dict = LANG_DICT[lang];
    
    data.forEach((row, idx) => {
      if (row.row_status === "New") {
        return;
      }

      const empName = row.rep ?? row.name ?? "";
      const deptName = row.dept ?? row.region ?? "";
      const empId = row.emp_id ?? row.id ?? "";

      if (!empId.trim()) {
        errors[idx] = dict.validationErrEmpId.replace("{row}", String(idx + 1));
        return;
      }
      if (!empName.trim()) {
        errors[idx] = dict.validationErrName.replace("{row}", String(idx + 1));
        return;
      }
      if (!deptName.trim()) {
        errors[idx] = dict.validationErrDept.replace("{row}", String(idx + 1));
        return;
      }

      const salesVal = row.sales ?? "";
      if (salesVal.trim()) {
        const cleanSales = salesVal.replace(/,/g, "");
        if (isNaN(Number(cleanSales))) {
          errors[idx] = dict.validationErrSales.replace("{row}", String(idx + 1));
          return;
        }
      }
    });

    setValidationErrors(errors);
  }, []);

  // gridData의 변경을 실시간으로 감시하여 유효성 검증 수행
  React.useEffect(() => {
    validateGridData(gridData, currentLanguage);
  }, [gridData, currentLanguage, validateGridData]);

  // 실시간 에러 발생 시 하단 터미널에 에러 문구를 실시간 스트리밍 출력
  React.useEffect(() => {
    const errorKeys = Object.keys(validationErrors);
    if (errorKeys.length > 0) {
      const errorMsg = errorKeys
        .map((k) => validationErrors[Number(k)])
        .join("\n");
      setDumpOutput(errorMsg);
    } else {
      setDumpOutput((prev) => {
        if (prev && prev.includes("[VALIDATION ERROR]")) {
          return null;
        }
        return prev;
      });
    }
  }, [validationErrors]);

  // [Day 32 작업] 파싱된 컬럼 정보 규격에 맞게 동적 데이터 행을 조립하는 헬퍼 함수
  const generateRowData = (mockItem: typeof MOCK_MASTER_DATA[0], columns: ColumnInfo[]) => {
    const row: { [key: string]: string } = {};
    columns.forEach((col) => {
      const colName = col.name;
      const lowerName = colName.toLowerCase();
      
      if (mockItem[colName as keyof typeof mockItem] !== undefined) {
        row[colName] = mockItem[colName as keyof typeof mockItem];
      } else if (lowerName.includes("id")) {
        row[colName] = mockItem.id;
      } else if (lowerName.includes("region") || lowerName.includes("dept") || lowerName.includes("department")) {
        row[colName] = mockItem.region;
      } else if (lowerName.includes("rep") || lowerName.includes("name") || lowerName.includes("emp")) {
        row[colName] = mockItem.rep;
      } else if (lowerName.includes("sales") || lowerName.includes("salary") || lowerName.includes("amt") || lowerName.includes("amount")) {
        row[colName] = mockItem.sales;
      } else if (lowerName.includes("status")) {
        row[colName] = mockItem.status;
      } else {
        const numTypes = ["number", "decimal", "numeric", "double", "real", "float", "integer", "int", "long", "ulong"];
        const colType = (col.type || "").toLowerCase();
        const isNum = numTypes.some((t) => colType.includes(t));
        row[colName] = isNum ? "0" : `${colName} Val`;
      }
    });
    return row;
  };

  // [Day 34 작업] dw_1.SetFilter() 및 dw_1.Filter() 대치용 React 파생 상태(Derived State) 필터링 핸들러
  const filteredRows = React.useMemo(() => {
    const lowerKeyword = filterKeyword.toLowerCase().trim();
    return gridData.map((row, index) => ({ row, index })).filter(({ row }) => {
      if (!lowerKeyword) return true;
      return (parsedData.columns || []).some((col) => {
        const val = row[col.name] ?? "";
        return val.toLowerCase().includes(lowerKeyword);
      });
    });
  }, [gridData, filterKeyword, parsedData.columns]);

  // [Day 32 작업] dw_1.Retrieve(as_dept) 대응 조회 이벤트 핸들러
  const handleRetrieve = () => {
    setIsLoading(true);
    
    setTimeout(() => {
      const filteredMock = MOCK_MASTER_DATA.filter((item) => {
        const matchDept = selectedDept === "전체" || item.region === selectedDept;
        const matchKeyword = !searchKeyword.trim() || 
          item.rep.toLowerCase().includes(searchKeyword.toLowerCase().trim()) ||
          item.id.toLowerCase().includes(searchKeyword.toLowerCase().trim());
        return matchDept && matchKeyword;
      });

      const updatedRows = filteredMock.map((mockItem, idx) => {
        const row = generateRowData(mockItem, parsedData.columns || []);
        row.__originalIndex = String(idx);
        return row;
      });
      
      setSortConfig({ key: "", direction: "none" });
      setFilterKeyword("");
      setDeleteBuffer([]);
      setSelectedRowIds(new Set());
      setRowSearchKeyword("");
      setMatchedRowIndices([]);
      setCurrentMatchPointer(-1);

      setDetailData(JSON.parse(JSON.stringify(MOCK_DETAIL_DATA)));
      setDetailDeleteBuffer([]);
      setSelectedDetailRowIndex(0);
      initialDetailDataRef.current = JSON.parse(JSON.stringify(MOCK_DETAIL_DATA));

      setGridData(updatedRows);
      setIsLoading(false);
      onSelectRow(0);

      snapshotRef.current = JSON.parse(JSON.stringify(updatedRows));
      initialGridDataRef.current = JSON.parse(JSON.stringify(updatedRows));
    }, 300);
  };

  // [Day 30 작업] 클립보드 복사 함수 및 파일 다운로드 가동 스크립트 블록
  const handleCopyToClipboard = async () => {
    if (!dumpOutput) return;
    try {
      await navigator.clipboard.writeText(dumpOutput);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 1500);
    } catch (err) {
      console.error("클립보드 복사 실패:", err);
    }
  };

  const handleDownloadJSON = () => {
    if (!dumpOutput) return;
    try {
      const blob = new Blob([dumpOutput], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "pb_bridge_data_dump.json";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("JSON 다운로드 실패:", err);
    }
  };

  // [Day 33 작업] dw_1.SetSort() 및 dw_1.Sort() 대치용 동적 정렬 이벤트 핸들러 및 처리기
  const handleSort = (colName: string) => {
    let nextDirection: "asc" | "desc" | "none" = "asc";
    if (sortConfig.key === colName) {
      if (sortConfig.direction === "asc") nextDirection = "desc";
      else if (sortConfig.direction === "desc") nextDirection = "none";
      else nextDirection = "asc";
    }

    setSortConfig({ key: colName, direction: nextDirection });

    const compareFn = (a: { [key: string]: string }, b: { [key: string]: string }) => {
      if (nextDirection === "none") {
        const idxA = parseInt(a.__originalIndex || "0", 10);
        const idxB = parseInt(b.__originalIndex || "0", 10);
        return idxA - idxB;
      }

      const valA = a[colName] ?? "";
      const valB = b[colName] ?? "";

      const isNum = isNumericColumn(parsedData.columns?.find((c) => c.name === colName)?.type || "");
      if (isNum) {
        const numA = parseFloat(valA.replace(/,/g, "")) || 0;
        const numB = parseFloat(valB.replace(/,/g, "")) || 0;
        return nextDirection === "asc" ? numA - numB : numB - numA;
      }

      return nextDirection === "asc"
        ? valA.localeCompare(valB, currentLanguage, { numeric: true })
        : valB.localeCompare(valA, currentLanguage, { numeric: true });
    };

    const sortedGridData = [...gridData].sort(compareFn);
    const sortedInitial = [...initialGridDataRef.current].sort(compareFn);
    const sortedSnapshot = [...snapshotRef.current].sort(compareFn);

    setGridData(sortedGridData);
    initialGridDataRef.current = sortedInitial;
    snapshotRef.current = sortedSnapshot;

    onSelectRow(0);
  };

  // [Day 33 작업] 부모 컴포넌트로부터 유입되는 최초 gridData에 순서 복원용 고유 인덱스(__originalIndex) 주입
  React.useEffect(() => {
    if (gridData.length > 0 && !gridData[0].hasOwnProperty("__originalIndex")) {
      setGridData((prev) =>
        prev.map((row, idx) => (row.__originalIndex ? row : { ...row, __originalIndex: String(idx) }))
      );
    }
  }, [gridData, setGridData]);

  React.useEffect(() => {
    if (gridData.length > 0 && gridData.every((row) => row.hasOwnProperty("__originalIndex"))) {
      if (snapshotRef.current.length === 0) {
        snapshotRef.current = JSON.parse(JSON.stringify(gridData));
      }
      if (
        prevParsedDataRef.current !== parsedData ||
        initialGridDataRef.current.length !== gridData.length ||
        initialGridDataRef.current.length === 0
      ) {
        initialGridDataRef.current = JSON.parse(JSON.stringify(gridData));
        prevParsedDataRef.current = parsedData;
      }
    }
  }, [gridData, parsedData]);

  // [Day 25 작업] 전체 초기화(Reset) 핸들러
  const handleResetAll = () => {
    if (snapshotRef.current.length > 0) {
      const resetSnapshot = JSON.parse(JSON.stringify(snapshotRef.current));
      setGridData(resetSnapshot);
      setFilterKeyword("");
      setDeleteBuffer([]);
      setSelectedRowIds(new Set());
      setRowSearchKeyword("");
      setMatchedRowIndices([]);
      setCurrentMatchPointer(-1);
      initialGridDataRef.current = JSON.parse(JSON.stringify(snapshotRef.current));

      setDetailData(JSON.parse(JSON.stringify(MOCK_DETAIL_DATA)));
      setDetailDeleteBuffer([]);
      setSelectedDetailRowIndex(0);
      initialDetailDataRef.current = JSON.parse(JSON.stringify(MOCK_DETAIL_DATA));
    }
  };

  // [Day 25 작업] 개별 행 원복(Undo) 핸들러
  const handleUndoRow = (rIdx: number) => {
    const originalRow = snapshotRef.current[rIdx];
    if (!originalRow) return;
    setGridData((prev) => {
      const next = [...prev];
      next[rIdx] = JSON.parse(JSON.stringify(originalRow));
      return next;
    });
    if (initialGridDataRef.current[rIdx]) {
      initialGridDataRef.current[rIdx] = JSON.parse(JSON.stringify(originalRow));
    }
  };

  // [Day 36 작업] 파워빌더 dw_1.InsertRow 및 DeleteRow 버퍼 트랜잭션 메커니즘 React 포팅
  const handleInsertRow = () => {
    const newRow: { [key: string]: string } = {};
    (parsedData.columns || []).forEach((col) => {
      if (isNumericColumn(col.type)) {
        newRow[col.name] = "0";
      } else {
        newRow[col.name] = "";
      }
    });

    newRow.row_status = "New";
    
    const maxOrgIdx = gridData.reduce((max, r) => {
      const idx = parseInt(r.__originalIndex || "0", 10);
      return idx > max ? idx : max;
    }, 0);
    newRow.__originalIndex = String(maxOrgIdx + 1);

    setGridData((prev) => {
      const next = [...prev];
      const insertIdx = selectedRowIndex >= 0 && selectedRowIndex <= prev.length 
        ? selectedRowIndex + 1 
        : prev.length;
      
      next.splice(insertIdx, 0, newRow);
      
      setTimeout(() => {
        onSelectRow(insertIdx);
      }, 0);
      
      return next;
    });
  };

  const handleDeleteRow = () => {
    // [Day 44 작업] 일괄 행 삭제 연동 파이프라인
    // 체크박스로 다중 선택된 행이 있다면 일괄 삭제를 진행하고, 없으면 기존처럼 포커스된 단일 행을 삭제합니다.
    const hasMultiSelected = selectedRowIds.size > 0;
    
    let targetRowIndices: number[] = [];
    if (hasMultiSelected) {
      // 선택된 __originalIndex를 가진 행들의 현재 인덱스를 찾음
      gridData.forEach((row, idx) => {
        if (row.__originalIndex && selectedRowIds.has(row.__originalIndex)) {
          targetRowIndices.push(idx);
        }
      });
    } else {
      if (selectedRowIndex >= 0 && selectedRowIndex < gridData.length) {
        targetRowIndices.push(selectedRowIndex);
      }
    }

    if (targetRowIndices.length === 0) return;

    // 1. deleteBuffer에 적재할 삭제 대상 가공 및 추가
    const deletedItems: DeletedRowInfo[] = [];
    targetRowIndices.forEach((idx) => {
      const rowToDelete = gridData[idx];
      if (rowToDelete && rowToDelete.row_status !== "New" && rowToDelete.row_status !== "NewModified") {
        const { __originalIndex, row_status, ...cleanRow } = rowToDelete;
        deletedItems.push({
          row_no: idx + 1,
          row_status: "Deleted",
          data: cleanRow,
        });
      }
    });

    if (deletedItems.length > 0) {
      setDeleteBuffer((prev) => [...prev, ...deletedItems]);
    }

    // 2. gridData에서 대상 행들 필터링하여 제외
    const targetSet = new Set(targetRowIndices);
    setGridData((prev) => {
      const next = prev.filter((_, idx) => !targetSet.has(idx));
      
      // 삭제 후 포커스 행 인덱스 보정
      if (next.length > 0) {
        let nextSelectIdx = selectedRowIndex;
        // 만약 기존 포커스 행이 삭제되었다면 가장 가까운 행으로 이동
        if (targetSet.has(selectedRowIndex)) {
          const smallerIndices = targetRowIndices.filter(i => i < selectedRowIndex);
          const deletedBeforeCount = smallerIndices.length;
          nextSelectIdx = Math.max(0, selectedRowIndex - deletedBeforeCount);
          if (nextSelectIdx >= next.length) {
            nextSelectIdx = next.length - 1;
          }
        } else {
          // 기존 포커스 행이 삭제되지 않았더라도, 그 앞에 몇 개가 삭제되었는지 세서 당겨줌
          const deletedBeforeCount = targetRowIndices.filter(i => i < selectedRowIndex).length;
          nextSelectIdx = Math.max(0, selectedRowIndex - deletedBeforeCount);
        }
        setTimeout(() => {
          onSelectRow(nextSelectIdx);
        }, 0);
      } else {
        setTimeout(() => {
          onSelectRow(-1);
        }, 0);
      }
      return next;
    });

    // 3. 다중 선택 상태 클리어
    setSelectedRowIds(new Set());
  };

  // [Day 44 작업] 다중 행 선택(Multi-Selection [ˈmʌlti sɪˈlekʃn]) 토글 [ˈtɑːɡl] 및 아키텍처 비교 주석
  /*
   * [레거시 파워빌더 다중 선택 vs 현대 React 선언형 Set 모델 아키텍처 비교]
   *
   * 1. 레거시 파워빌더 (C/S 환경):
   *    - 파워빌더에서는 그리드(DataWindow)에서 여러 행을 다중 선택하기 위해 `dw_1.SelectRow(i, true)` 또는 `dw_1.SelectRow(i, false)` 함수를 호출하여
   *      데이터윈도우 내 각 로우의 그래픽 상태 레이어를 명령형(Imperative)으로 제어하고 물리적 선택 상태를 반전시켰습니다.
   *    - 이후 선택된 다중 행들을 판별하거나 추출하려면, 개발자가 1부터 `dw_1.RowCount()`까지 루프를 돌리며 `dw_1.IsSelected(i)`를
   *      일일이 호출해 스캔하는 절차적이고 비효율적인 방식이 수반되었습니다. 이는 데이터 버퍼 상태와 UI 렌더링 레이어가 파워빌더 엔진 내부에
   *      완전 통합(Hard-coupled)되어 개발자가 로우 상태를 투명하게 추적하거나 외부 파이프라인으로 일괄 연동하기 매우 까다로웠습니다.
   *
   * 2. 현대 웹 표준 React 아키텍처 (선언형 Set 기반 상태 매핑 및 키보드 웹 접근성):
   *    - React 환경에서는 UI가 로우 레벨 상태의 투사체에 불과하다는 선언형(Declarative) 렌더링 패러다임을 따릅니다.
   *    - 다중 행 선택(Multi-Selection [ˈmʌlti sɪˈlekʃn]) 상태는 `selectedRowIds` 라는 고유의 Set 객체 상태(State)로 선언하여 격리 관리됩니다.
   *    - 개별 행 체크박스 토글(Toggle [ˈtɑːɡl]) 시, 대상 행의 고유 불변 키(`__originalIndex`)를 Set에 삽입/삭제(Set.has ? delete : add)하는 상태 변경 함수가 실행되며,
   *      React는 이 상태 변동을 감지하고 가상 돔(Virtual DOM) 리렌더링을 유발하여 체크박스의 체크 여부(`checked={selectedRowIds.has(row.__originalIndex)}`)를 즉시 자동 맵핑합니다.
   *    - 복잡한 루프 스캔 없이 단순히 `selectedRowIds` 집합의 존재 여부를 통해 즉시 다중 행 선택 여부를 판별(O(1))할 수 있으며,
   *      스페이스바(`Space`) 키 이벤트를 Listen하여 키보드 웹 접근성 규칙에 맞춰 현재 포커스 행(`selectedRowIndex`)의 체크 상태를 즉각 반전시킬 수 있어
   *      C/S 수준의 풍부한 UX와 명확한 아키텍처적 SoC(관심사 분리)를 완벽히 달성합니다.
   */
  const handleToggleRow = React.useCallback((rowOriginalIndex: string) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowOriginalIndex)) {
        next.delete(rowOriginalIndex);
      } else {
        next.add(rowOriginalIndex);
      }
      return next;
    });
  }, []);

  const isAllFilteredSelected = React.useMemo(() => {
    if (filteredRows.length === 0) return false;
    return filteredRows.every(({ row }) => selectedRowIds.has(row.__originalIndex || ""));
  }, [filteredRows, selectedRowIds]);

  const handleToggleAll = React.useCallback(() => {
    if (isAllFilteredSelected) {
      setSelectedRowIds((prev) => {
        const next = new Set(prev);
        filteredRows.forEach(({ row }) => {
          if (row.__originalIndex) {
            next.delete(row.__originalIndex);
          }
        });
        return next;
      });
    } else {
      setSelectedRowIds((prev) => {
        const next = new Set(prev);
        filteredRows.forEach(({ row }) => {
          if (row.__originalIndex) {
            next.add(row.__originalIndex);
          }
        });
        return next;
      });
    }
  }, [filteredRows, isAllFilteredSelected]);

  // [Day 39 작업] 파워빌더 RowFocusChanged / ShareData 대치 설명 및 연동 상태 제어
  // [Day 39 작업] 디테일 데이터 행 추가 (dw_detail.InsertRow)
  const handleInsertDetailRow = () => {
    if (!currentEmpId) return;

    const currentDetails = detailData[currentEmpId] || [];
    const maxSeq = currentDetails.reduce((max, r) => {
      const seqNum = parseInt(r.seq || "0", 10);
      return seqNum > max ? seqNum : max;
    }, 0);

    const newDetailRow: DetailRow = {
      emp_id: currentEmpId,
      seq: String(maxSeq + 1),
      relation: "",
      name: "",
      birth: "",
      note: "",
      row_status: "New"
    };

    setDetailData((prev) => ({
      ...prev,
      [currentEmpId]: [...currentDetails, newDetailRow]
    }));

    setTimeout(() => {
      setSelectedDetailRowIndex(currentDetails.length);
    }, 0);
  };

  // [Day 39 작업] 디테일 데이터 행 삭제 (dw_detail.DeleteRow)
  const handleDeleteDetailRow = () => {
    if (!currentEmpId) return;
    const currentDetails = detailData[currentEmpId] || [];
    if (selectedDetailRowIndex < 0 || selectedDetailRowIndex >= currentDetails.length) return;

    const rowToDelete = currentDetails[selectedDetailRowIndex];

    if (rowToDelete.row_status !== "New" && rowToDelete.row_status !== "NewModified") {
      const deletedItem: DeletedDetailRowInfo = {
        emp_id: currentEmpId,
        seq: rowToDelete.seq,
        data: rowToDelete
      };
      setDetailDeleteBuffer((prev) => [...prev, deletedItem]);
    }

    const updatedDetails = currentDetails.filter((_, idx) => idx !== selectedDetailRowIndex);
    setDetailData((prev) => ({
      ...prev,
      [currentEmpId]: updatedDetails
    }));

    if (updatedDetails.length > 0) {
      const nextSelectIdx = selectedDetailRowIndex >= updatedDetails.length ? updatedDetails.length - 1 : selectedDetailRowIndex;
      setSelectedDetailRowIndex(nextSelectIdx);
    } else {
      setSelectedDetailRowIndex(-1);
    }
  };

  // [Day 39 작업] 디테일 셀 변경 제어 핸들러 (dw_detail.ItemChanged)
  const handleDetailCellChange = (seq: string, fieldName: keyof DetailRow, value: string) => {
    if (!currentEmpId) return;
    const currentDetails = detailData[currentEmpId] || [];

    const updatedDetails = currentDetails.map((row) => {
      if (row.seq === seq) {
        const nextStatus = row.row_status === "New" ? "NewModified" : row.row_status;
        return {
          ...row,
          [fieldName]: value,
          row_status: nextStatus
        };
      }
      return row;
    });

    setDetailData((prev) => ({
      ...prev,
      [currentEmpId]: updatedDetails
    }));
  };

  // [Day 40 작업] 공용 트랜잭션 빌더 헬퍼 함수
  const getHierarchyPacket = () => {
    const errorKeys = Object.keys(validationErrors);
    if (errorKeys.length > 0) {
      return {
        error: true,
        data: errorKeys
          .map((k) => validationErrors[Number(k)] || "")
          .filter(Boolean)
          .join("\n")
      };
    }

    const hierarchyPacket: any[] = [];

    // 1. 마스터 데이터 기준 스캔
    gridData.forEach((masterRow, rIdx) => {
      const masterEmpId = masterRow.emp_id || masterRow.id || "";
      const { __originalIndex, row_status, ...cleanMasterRow } = masterRow;
      
      const isMasterMod = isRowModified(masterRow, rIdx);
      const isNewMasterMod = masterRow.row_status === "NewModified";

      const currentDetails = detailData[masterEmpId] || [];
      const initialDetails = initialDetailDataRef.current[masterEmpId] || [];
      const detailChanges: any[] = [];

      currentDetails.forEach((detRow) => {
        const isNewDet = detRow.row_status === "NewModified";
        const origDet = initialDetails.find((d) => d.seq === detRow.seq);
        const isDetMod = origDet ? (
          origDet.relation !== detRow.relation ||
          origDet.name !== detRow.name ||
          origDet.birth !== detRow.birth ||
          origDet.note !== detRow.note
        ) : false;

        if (detRow.row_status === "New" || isNewDet) {
          detailChanges.push({
            seq: detRow.seq,
            row_status: "Inserted",
            data: {
              relation: detRow.relation,
              name: detRow.name,
              birth: detRow.birth,
              note: detRow.note
            }
          });
        } else if (isDetMod) {
          detailChanges.push({
            seq: detRow.seq,
            row_status: "Updated",
            data: {
              relation: detRow.relation,
              name: detRow.name,
              birth: detRow.birth,
              note: detRow.note
            }
          });
        }
      });

      const masterDeletedDetails = detailDeleteBuffer.filter((del) => del.emp_id === masterEmpId);
      masterDeletedDetails.forEach((delItem) => {
        detailChanges.push({
          seq: delItem.seq,
          row_status: "Deleted",
          data: {
            relation: delItem.data.relation,
            name: delItem.data.name,
            birth: delItem.data.birth,
            note: delItem.data.note
          }
        });
      });

      if (isNewMasterMod || isMasterMod || masterRow.row_status === "New" || detailChanges.length > 0) {
        let currentStatus: "Inserted" | "Updated" | "Unchanged" = "Unchanged";
        if (isNewMasterMod || masterRow.row_status === "New") {
          currentStatus = "Inserted";
        } else if (isMasterMod) {
          currentStatus = "Updated";
        }

        hierarchyPacket.push({
          row_no: rIdx + 1,
          emp_id: masterEmpId,
          row_status: currentStatus,
          data: cleanMasterRow,
          details: detailChanges
        });
      }
    });

    // 2. 삭제된 마스터들에 대해 수집
    deleteBuffer.forEach((deletedMaster) => {
      const deletedMasterEmpId = deletedMaster.data.emp_id || deletedMaster.data.id || "";
      const masterDeletedDetails = detailDeleteBuffer.filter((del) => del.emp_id === deletedMasterEmpId);
      const detailChanges = masterDeletedDetails.map(delItem => ({
        seq: delItem.seq,
        row_status: "Deleted",
        data: {
          relation: delItem.data.relation,
          name: delItem.data.name,
          birth: delItem.data.birth,
          note: delItem.data.note
        }
      }));

      hierarchyPacket.push({
        row_no: deletedMaster.row_no,
        emp_id: deletedMasterEmpId,
        row_status: "Deleted",
        data: deletedMaster.data,
        details: detailChanges
      });
    });

    const sortedPacket = [...hierarchyPacket].sort((a, b) => a.row_no - b.row_no);
    return { error: false, packet: sortedPacket };
  };

  // [Day 39 작업] 마스터-디테일 계층형 트랜잭션 빌더 (dw_master & dw_detail Update)
  const handleSaveAndExtract = () => {
    const res = getHierarchyPacket();
    if (res.error) {
      setDumpOutput(res.data ?? "");
      return;
    }

    const packet = res.packet || [];
    if (packet.length === 0) {
      setDumpOutput(
        JSON.stringify(
          {
            message: t.noChangesDump,
            status: "NO_CHANGES",
            timestamp: new Date().toISOString(),
          },
          null,
          2
        )
      );
    } else {
      setDumpOutput(JSON.stringify(packet, null, 2));
    }
  };

  // [Day 40 작업] 비동기 Update 핸들러 및 트랜잭션 상태 리셋
  /*
   * 파워빌더 dw_1.Update() / COMMIT & ROLLBACK vs 현대 웹 비동기 Fetch 및 리액트 상태 리셋 대치 설명 (교육용 주석)
   *
   * 1. 파워빌더 (레거시 C/S 환경):
   *    - 파워빌더에서는 `dw_1.Update()`를 호출하면 데이터윈도우가 Primary! 버퍼와 Delete! 버퍼를 내부적으로 자동 전수 스캔합니다.
   *    - 각 행의 상태 플래그(New!, NewModified!, DataModified!)와 Delete! 버퍼 내의 행을 기반으로 SQL(INSERT, UPDATE, DELETE)을 자동 생성하여
   *      데이터베이스 세션(예: SQLCA)으로 '동기식(Synchronous) 블로킹' 방식으로 송출합니다.
   *    - 이 송출 과정은 애플리케이션의 메인 UI 스레드를 차단(Blocking)하며, 네트워크 지연이나 DB 처리 동안 화면이 프리징되는 유저 경험 저하를 유발합니다.
   *    - DB 반영 후 `SQLCA.SQLCode` 결과가 0(성공)이면 명시적으로 `COMMIT USING SQLCA;`를 수행하고,
   *      실패(-1)하면 `ROLLBACK USING SQLCA;`를 호출하여 전체 트랜잭션을 롤백 제어해야 합니다.
   *    - COMMIT이 완료되면 데이터윈도우는 내부적으로 `dw_1.ResetUpdate()`를 호출하여 Primary! 버퍼 내 모든 행 상태를 `NotModified!`로 갱신하고
   *      Delete! 버퍼를 깨끗이 비워 다음 트랜잭션을 수용할 준비를 마칩니다.
   *
   * 2. 현대 웹 표준 React 아키텍처 (비동기 비차단 통신 및 선언형 상태 리셋):
   *    - 웹 브라우저 환경에서는 단일 UI 스레드 상에서 렌더링이 이루어지므로, 서버 통신 시 동기식 차단 요청은 원천 금지되어 있습니다.
   *    - 대신 웹 표준 API인 비동기 비차단(Asynchronous Non-blocking) `fetch` 함수를 사용하여 서버 엔드포인트에 계층형 JSON 패킷을 송출합니다.
   *    - 요청 송출 중에는 `isUpdating` 상태를 `true`로 설정하여 반영 버튼을 비활성화하고 로딩 링을 렌더링함으로써 사용자의 중복 클릭 및 비정상 입력을 방지합니다.
   *    - 가상 서버 엔드포인트(`/api/update-simulation`)와 통신하여 트랜잭션의 커밋 성공(Success) 피드백을 수신하면,
   *      리액트의 상태 불변성을 유지하면서 클라이언트 메모리에 있는 원본 데이터 스냅샷을 갱신합니다.
   *    - 구체적으로 `gridData` 내 모든 마스터 행의 `row_status`를 기본값인 `"NotModified"`로 리셋하고,
   *      `detailData`의 모든 상세 행들의 `row_status`를 `"Unchanged"`로 전환하며,
   *      누적된 삭제 버퍼(`deleteBuffer`, `detailDeleteBuffer`)를 빈 배열(`[]`)로 완전 클리어합니다.
   *    - 마지막으로 변경 사항 비교의 기준점인 레퍼런스 Ref 객체들(`snapshotRef`, `initialGridDataRef`, `initialDetailDataRef`)을
   *      현재 커밋 완료된 최신 데이터 상태로 깊은 복사하여 기준선을 최신화(Sync Baseline)해 줍니다.
   *    - 이 모든 과정이 끝나면 "DB 트랜잭션 커밋 완료! 🔗" 라는 다크 에메랄드 네온 토스트 메시지를 화면 우측 상단에 노출하여
   *      과거 파워빌더 개발자들이 익숙했던 SQLCA 트랜잭션 완료 메시지 박스의 직관적인 피드백을 웹 UI 환경에 맞게 제공합니다.
   */
  const handleFinalCommit = async () => {
    const res = getHierarchyPacket();
    if (res.error) {
      setDumpOutput(res.data ?? "");
      return;
    }

    const packet = res.packet || [];
    if (packet.length === 0) {
      setDumpOutput(
        JSON.stringify(
          {
            message: t.noChanges,
            status: "NO_CHANGES",
            timestamp: new Date().toISOString(),
          },
          null,
          2
        )
      );
      return;
    }

    setIsUpdating(true);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      let isSuccess = false;
      try {
        const response = await fetch("/api/update-simulation", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(packet),
          signal: controller.signal
        });
        
        if (response.ok || response.status === 404) {
          isSuccess = true;
        }
      } catch (fetchErr) {
        isSuccess = true;
      } finally {
        clearTimeout(timeoutId);
      }

      await new Promise((resolve) => setTimeout(resolve, 1500));

      if (isSuccess) {
        const updatedGridData = gridData.map((row) => {
          const { row_status, ...rest } = row;
          return {
            ...rest,
            row_status: "NotModified" as const
          };
        });
        setGridData(updatedGridData);

        const updatedDetailData = { ...detailData };
        Object.keys(updatedDetailData).forEach((empId) => {
          updatedDetailData[empId] = updatedDetailData[empId].map((detRow) => {
            const { row_status, ...rest } = detRow;
            return {
              ...rest,
              row_status: "Unchanged" as const
            };
          });
        });
        setDetailData(updatedDetailData);

        setDeleteBuffer([]);
        setDetailDeleteBuffer([]);
        setSelectedRowIds(new Set());

        snapshotRef.current = JSON.parse(JSON.stringify(updatedGridData));
        initialGridDataRef.current = JSON.parse(JSON.stringify(updatedGridData));
        initialDetailDataRef.current = JSON.parse(JSON.stringify(updatedDetailData));

        setDumpOutput(
          JSON.stringify(
            {
              message: t.commitSuccessMsg,
              status: "COMMITTED",
              committed_rows_count: packet.length,
              timestamp: new Date().toISOString(),
              packet: packet
            },
            null,
            2
          )
        );

        setShowCommitToast(true);
        setTimeout(() => {
          setShowCommitToast(false);
        }, 3000);
      }
    } catch (err) {
      console.error("DB 트랜잭션 처리 중 에러 발생:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  // [Day 43 작업] 브라우저 네이티브 인쇄 팝업 호출 핸들러
  /*
   * [레거시 파워빌더 dw_1.Print() vs 현대 웹 표준 브라우저 인쇄 API 아키텍처 비교]
   *
   * 1. 레거시 파워빌더 (C/S 환경):
   *    - 파워빌더에서 `dw_1.Print(true)`를 호출하면 클라이언트 OS의 프린터 스풀러(Printer Spooler)와
   *      직접 동기식(Synchronous) 통신을 수립하여 인쇄 작업을 큐에 밀어 넣습니다.
   *    - Print Preview 속성을 활성화하면 화면 디스플레이용 데이터윈도우 엔진을 인쇄 페이지 가상 뷰어로 일시 전환하여
   *      임시 레이아웃을 제어하는 구조였습니다.
   *    - 이 방식은 클라이언트 로컬 드라이버 의존성이 크며 동기식 제어로 인해 인쇄 스풀링 중 화면이 멈추는 현상이 존재했습니다.
   *
   * 2. 현대 웹 표준 React 아키텍처 (선언형 DOM 인쇄 뷰 및 비차단 Print API):
   *    - 웹 환경에서는 비차단(Non-blocking) 방식의 브라우저 표준 API인 `window.print()`를 사용합니다.
   *    - 화면 레이아웃의 변환은 명령형 스크립트로 픽셀을 재계산하는 대신, CSS `@media print` 스타일 미디어 쿼리를 정의하여
   *      인쇄 모드(Print Mode, [prɪnt] [moʊd]) 진입 시 브라우저 렌더링 엔진이 선언적으로 스타일을 재조정하도록 유도합니다.
   *    - 이를 통해 불필요한 컨트롤 요소를 DOM 트리에서 제거하거나 보이지 않게 처리(`print:hidden`)하고,
   *      스크롤 영역의 제한을 해제(`max-h-none`, `overflow-visible`)하여 A4 가로/세로 영역에 맞게 모든 행이 종이에 고르게 출력되도록 제어합니다.
   *    - 또한 기존 다크 테마를 흰색 배경에 선명한 검은색 격자선으로 실시간 맵핑하여 ERP 보고서 규격으로 자동 레이아웃 변환을 수행합니다.
   */
  const handlePrintReport = () => {
    window.print();
  };

  const handleResetBoundary = () => {
    if (snapshotRef.current.length > 0) {
      const resetSnapshot = JSON.parse(JSON.stringify(snapshotRef.current));
      setGridData(resetSnapshot);
    } else {
      setGridData([]);
    }
    setFilterKeyword("");
    setDeleteBuffer([]);
    setSelectedRowIds(new Set());
    setRowSearchKeyword("");
    setMatchedRowIndices([]);
    setCurrentMatchPointer(-1);
    
    setDetailData(JSON.parse(JSON.stringify(MOCK_DETAIL_DATA)));
    setDetailDeleteBuffer([]);
    setSelectedDetailRowIndex(0);
    initialDetailDataRef.current = JSON.parse(JSON.stringify(MOCK_DETAIL_DATA));

    handleRetrieve();
  };

  const ErrorFallback = (error: Error | null, reset: () => void) => {
    return (
      <div className="w-full min-h-[260px] bg-slate-950/90 border border-red-500/50 rounded-xl p-6 flex flex-col justify-center items-center gap-4 text-center backdrop-blur-md shadow-[0_0_30px_rgba(239,68,68,0.3)] select-none">
        <div className="text-red-500 text-5xl animate-pulse">☠️</div>
        <div className="flex flex-col gap-1">
          <h4 className="text-white text-base font-extrabold tracking-tight">
            그리드 런타임 [ˈrʌntaɪm] 예외 격리 방어선 작동
          </h4>
          <p className="text-[11px] text-red-400 font-mono">
            [ˈerər] [ˈbaʊndri] 포착: 렌더링 크래시 및 시스템 붕괴를 안전하게 격리했습니다.
          </p>
        </div>
        
        <div className="w-full max-w-lg bg-black/60 border border-red-950/60 rounded-lg p-3 text-left">
          <div className="text-[10px] font-mono text-red-500 font-bold uppercase tracking-wider mb-1 border-b border-red-950/30 pb-1">
            Error Message
          </div>
          <pre className="text-[10px] font-mono text-red-200 overflow-auto max-h-24 scrollbar-thin whitespace-pre-wrap leading-relaxed select-all">
            {error ? error.message : "알 수 없는 런타임 예외가 발생했습니다."}
            {error?.stack && `\n\n${error.stack.split("\n").slice(0, 3).join("\n")}`}
          </pre>
        </div>

        <button
          onClick={reset}
          className="px-5 py-2.5 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-500/50 hover:border-red-400 text-red-400 hover:text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(239,68,68,0.4)] hover:shadow-[0_0_20px_rgba(239,68,68,0.6)] cursor-pointer flex items-center gap-2 hover:scale-[1.02] active:scale-95 duration-200"
        >
          <span>세션 재조회 및 리셋 ↺</span>
        </button>
      </div>
    );
  };

  // [Day 24 작업] 단 하나의 컬럼이라도 값의 변동이 생겼는지 감지하는 판별 로직 (isRowModified)
  const isRowModified = (currentRow: { [key: string]: string }, rIdx: number): boolean => {
    const originalRow = initialGridDataRef.current[rIdx];
    if (!originalRow) return false;

    return (parsedData.columns || []).some((col) => {
      const currentVal = currentRow[col.name] ?? "";
      const originalVal = originalRow[col.name] ?? "";
      return currentVal !== originalVal;
    });
  };

  // [Day 36 작업] 실시간 변경사항 총 건수 계산 (기존 수정 건 + 신규 입력 건 + 삭제 건)
  const modifiedRowsCount = React.useMemo(() => {
    const editCount = gridData.reduce((count, row, rIdx) => {
      const isNewMod = row.row_status === "NewModified";
      const isUpdated = row.row_status !== "New" && row.row_status !== "NewModified" && isRowModified(row, rIdx);
      return count + (isNewMod || isUpdated ? 1 : 0);
    }, 0);
    
    // 디테일 변경사항도 modifiedRowsCount에 합산되도록 구성
    let detailModCount = 0;
    Object.keys(detailData).forEach((empId) => {
      const currentDetails = detailData[empId] || [];
      const initialDetails = initialDetailDataRef.current[empId] || [];
      
      currentDetails.forEach((detRow) => {
        if (detRow.row_status === "New" || detRow.row_status === "NewModified") {
          detailModCount++;
        } else {
          const origDet = initialDetails.find((d) => d.seq === detRow.seq);
          const isDetMod = origDet ? (
            origDet.relation !== detRow.relation ||
            origDet.name !== detRow.name ||
            origDet.birth !== detRow.birth ||
            origDet.note !== detRow.note
          ) : false;
          if (isDetMod) {
            detailModCount++;
          }
        }
      });
    });

    return editCount + deleteBuffer.length + detailModCount + detailDeleteBuffer.length;
  }, [gridData, deleteBuffer, detailData, detailDeleteBuffer]);

  // [Day 45 작업] 데이터 이탈 방지(Dirty Check [ˈdɜːrti tʃek]) 상시 연산 구조
  const isDirty = modifiedRowsCount > 0;

  // [Day 47 작업] Array.reduce [əˈreɪ rɪˈdjuːs] 기반 실시간 파생 집계 연산 로직
  /*
   * [레거시 파워빌더 Summary Band [bænd] & Compute Object [kəmˈpjuːt ˈɒbdʒekt] vs 현대 React Derived State [dɪˈraɪvd steɪt] & CSS Sticky [ˈstɪki] 아키텍처 비교]
   *
   * 1. 레거시 파워빌더 (C/S 환경):
   *    - 파워빌더 데이터윈도우에서는 특정 영역인 Summary Band [bænd] 또는 Footer Band [bænd]에 
   *      Compute Object [kəmˈpjuːt ˈɒbdʒekt]를 드래그 앤 드롭한 뒤, `Sum(salary for detail)` 등 
   *      엔진 내부 고유 함수를 지정해 동기식으로 데이터윈도우 버퍼를 역추적하여 수치를 평가했습니다.
   *    - 이는 데이터윈도우의 2-Pass 또는 런타임 평가 엔진이 버퍼의 로우가 추가, 삭제, 수정될 때마다 
   *      내부적으로 해당 Compute Object의 값 영역을 다시 계산하는 방식이었습니다.
   *    - 이 방식은 화면 디자인(Layout) 밴드 내에 수치가 강력하게 바인딩되어 있으며, 가로/세로 스크롤 시
   *      화면 하단에 이 수치들을 고정하려면 Grid 스타일이 아닌 Freeform이나 별도 윈도우 조작 꼼수를 써야 하는 등
   *      C/S 특유의 표현적 제약이 컸습니다.
   *
   * 2. 현대 React 아키텍처 (Derived State [dɪˈraɪvd steɪt], Array.reduce [əˈreɪ rɪˈdjuːs] 및 CSS Sticky [ˈstɪki]):
   *    - React 환경에서는 데이터가 상태(State)로 선언되고, UI는 이 상태의 순수 함수로서 렌더링됩니다.
   *    - 별도의 집계용 로컬 상태를 두어 수동 업데이트하는 것이 아니라, `gridData` 상태가 변경될 때마다 
   *      런타임에 이를 스캔하여 새로운 값을 계산해 내는 파생 상태(Derived State [dɪˈraɪvd steɪt]) 패러다임을 사용합니다.
   *    - 이 과정에서 함수형 프로그래밍의 핵심 도구인 `Array.reduce` [əˈreɪ rɪˈdjuːs] 메소드를 활용하여 
   *      단 한 번의 선언적인 스캔으로 정확한 총합계(Total [ˈtəʊtl]) 및 평균(Average [ˈævərɪdʒ])을 딜레이 없이 도출합니다.
   *    - 또한, 웹 표준 CSS의 `position: sticky; bottom: 0;` 속성을 활용하면, 복잡한 스크롤 좌표 연산 스크립트 없이도
   *      브라우저 자체 하드웨어 가속(GPU) 기술을 타며 세로 스크롤 시 항상 뷰포트 최하단에 서머리(Summary [ˈsʌməri]) 행을
   *      부드럽고 안정적으로 고정할 수 있습니다.
   *    - 가로 스크롤 시에도 헤더 및 본문의 고정(Frozen) 오프셋 수식(`getFrozenLeftOffset`)을 푸터의 각 열에 
   *      그대로 투사하여 틀고정 컬럼들과 한 픽셀의 오차도 없이 완벽히 정렬을 일치시킵니다.
   */
  const footerSummaries = React.useMemo(() => {
    const sums: { [colName: string]: number } = {};
    const avgs: { [colName: string]: number } = {};
    const counts: { [colName: string]: number } = {};

    const numericCols = (parsedData.columns || []).filter(c => isNumericColumn(c.type));
    numericCols.forEach(c => {
      sums[c.name] = 0;
      counts[c.name] = 0;
    });

    gridData.forEach((row) => {
      numericCols.forEach((col) => {
        const rawValue = row[col.name] ?? "";
        const cleanValue = rawValue.replace(/,/g, "").trim();
        if (cleanValue && !isNaN(Number(cleanValue))) {
          sums[col.name] += Number(cleanValue);
          counts[col.name] += 1;
        }
      });
    });

    numericCols.forEach((col) => {
      const count = counts[col.name];
      avgs[col.name] = count > 0 ? sums[col.name] / count : 0;
    });

    return { sums, avgs };
  }, [gridData, parsedData.columns]);

  // [Day 45 작업] 브라우저 이탈 방지 beforeunload 이벤트 바인딩 및 버튼 인터셉트 조건절 블록
  /*
   * [파워빌더 레거시 CloseQuery / ModifiedCount / DeletedCount vs 현대 리액트 선언형 Dirty Check 아키텍처 비교]
   *
   * 1. 레거시 파워빌더 (C/S 환경의 트랜잭션 방어):
   *    - 파워빌더 개발자들은 윈도우가 닫힐 때(Close) 또는 사용자가 새로운 조회를 수행하여 기존 버퍼가 덮어씌워지기 전에,
   *      데이터 유실을 막기 위해 윈도우의 `CloseQuery` 이벤트나 조회 전단계에서 직접 명령형 스크립트를 수행했습니다.
   *    - 이 때 `dw_1.ModifiedCount()`와 `dw_1.DeletedCount()` 함수를 명시적으로 호출하여 리턴값이 0보다 큰지
   *      조사(Dirty Check [ˈdɜːrti tʃek])하는 조건문을 작성했습니다.
   *    - 변경 사항이 발견되면 `MessageBox`를 띄워 저장 여부를 묻고, 사용자의 응답에 따라 `Message.ReturnValue = 1`을 설정해
   *      이벤트 체인을 강제로 중단(Cancel)시키는 물리적 제어 방식을 사용했습니다.
   *    - 이 방식은 UI 컴포넌트의 상태값들을 개발자가 직접 명령어로 수동 조회하고 판단해야 하므로, 복잡한 다중 버퍼 구조에서 누락이 발생하기 쉽습니다.
   *
   * 2. 현대 React 아키텍처 (선언형 파생 상태와 브라우저 수명 주기 캡처):
   *    - React 환경에서는 상태(State)가 단일 진실 공급원(Single Source of Truth)으로 관리되며, UI와 데이터의 무결성은
   *      선언형 파생 상태(Derived State)를 통해 실시간으로 자동 연산됩니다.
   *    - 본 시스템의 `isDirty` 변수는 마스터와 디테일 그리드의 추가, 수정, 삭제 상태 변경 건수의 합산인 `modifiedRowsCount`에 의존하여
   *      어떠한 추가 명령형 호출 없이도 렌더링 파이프라인에서 상시 동적으로 평가됩니다.
   *    - 브라우저 이탈(탭 닫기, 새로고침) 시에는 브라우저 세션 라이프사이클 캡처 기술인 `beforeunload` 이벤트 리스너를 `useEffect` 훅으로
   *      정밀하게 바인딩하여 OS 및 브라우저 레벨에서 안전하게 이탈을 방어합니다.
   *    - 내부 액션(재조회 `triggerRetrieve`, 전체 초기화 `triggerResetAll`) 또한 `isDirty`를 기준으로
   *      인터셉트(Intercept [ˌɪntərˈsept]) 장벽을 구성하여, 저장되지 않은 변경 사항의 소멸을 사전에 방지하는 커스텀 다이얼로그 모달로 분기 처리를 수행합니다.
   *    - `[최종 DB 반영 🚀]` 커밋 성공 시에는 버퍼 상태가 리셋됨에 따라 `isDirty`가 즉각 `false`로 클리어되어 무결한 동기화 상태를 달성합니다.
   */
  React.useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
      return "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty]);

  const triggerRetrieve = () => {
    if (isDirty) {
      setInterceptModal({
        isOpen: true,
        message: "저장되지 않은 변경 사항이 소멸됩니다. 계속하시겠습니까?",
        onConfirm: () => {
          handleRetrieve();
        },
      });
    } else {
      handleRetrieve();
    }
  };

  const triggerResetAll = () => {
    if (isDirty) {
      setInterceptModal({
        isOpen: true,
        message: "저장되지 않은 변경 사항이 소멸됩니다. 계속하시겠습니까?",
        onConfirm: () => {
          handleResetAll();
        },
      });
    } else {
      handleResetAll();
    }
  };

  return (
    <section className="bg-slate-950/80 border border-slate-900 rounded-2xl overflow-hidden shadow-2xl p-5 flex flex-col gap-4 relative print:p-0 print:border-none print:shadow-none print:bg-white print:text-black">
      {/* [Day 43 작업] 인쇄 전용 전역 스타일 정의 */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
          }
          /* 스크롤 제거 및 잘림 방지 */
          .overflow-x-auto, .overflow-y-auto {
            overflow: visible !important;
            max-height: none !important;
            min-height: auto !important;
          }
          table {
            width: 100% !important;
            table-layout: auto !important; /* A4 용지 가로 폭 피팅 */
            border-collapse: collapse !important;
          }
          /* 다크 테마 완전 제거 및 검은색 격자선 */
          table, th, td, tr {
            background-color: #ffffff !important;
            color: #000000 !important;
            border: 1px solid #000000 !important;
            box-shadow: none !important;
          }
          th {
            font-weight: bold !important;
            background-color: #f3f4f6 !important;
          }
          input, select {
            background: transparent !important;
            color: #000000 !important;
            border: none !important;
            box-shadow: none !important;
            outline: none !important;
          }
          /* Sticky 포지션 해제 */
          .sticky {
            position: static !important;
          }
          tfoot {
            position: static !important;
            display: table-row-group !important;
          }
          .border-r-2 {
            border-right-width: 1px !important;
            border-color: #000000 !important;
          }
        }

        /* [Day 48 작업] 다크 네온 ERP 테마 맞춤형 조건부 서식 전용 스타일 */
        .cell-cond-high-sales {
          background-color: rgba(16, 185, 129, 0.15) !important;
        }
        .cell-cond-high-sales input {
          color: #10b981 !important;
          font-weight: bold !important;
        }
        
        .cell-cond-low-sales {
          background-color: rgba(244, 63, 94, 0.12) !important;
        }
        .cell-cond-low-sales input {
          color: #f43f5e !important;
        }
        
        .cell-cond-status-closed {
          background-color: rgba(148, 163, 184, 0.1) !important;
        }
        .cell-cond-status-closed input {
          color: #94a3b8 !important;
        }
        
        .cell-cond-status-open {
          background-color: rgba(251, 191, 36, 0.12) !important;
        }
        .cell-cond-status-open input {
          color: #fbbf24 !important;
          font-weight: bold !important;
        }
      `}} />

      {/* [Day 40 작업] DB 트랜잭션 커밋 완료 녹색 네온 토스트 알림 */}
      {showCommitToast && (
        <div className="fixed top-6 right-6 bg-slate-950/95 border border-emerald-500 text-emerald-400 px-5 py-3 rounded-xl text-sm font-bold shadow-[0_0_20px_rgba(16,185,129,0.6)] animate-bounce z-50 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
          <span>{t.toastCommitSuccess}</span>
        </div>
      )}

      {/* 타이틀 구역 및 수정 카운터 뱃지 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-bold text-white">
            {t.title}
          </h3>
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border transition-all ${
              modifiedRowsCount > 0
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.2)] animate-pulse"
                : "bg-slate-900/60 text-slate-500 border-slate-800"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${modifiedRowsCount > 0 ? "bg-emerald-400" : "bg-slate-600"}`}></span>
            {t.modifiedCount.replace("{count}", String(modifiedRowsCount))}
          </span>
          {/* [Day 36 작업] 다크 네온 스타일 행 추가 및 행 삭제 버튼 */}
          <button
            onClick={handleInsertRow}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold border border-cyan-500/30 bg-cyan-950/80 text-cyan-400 hover:bg-cyan-900/50 hover:text-cyan-300 hover:shadow-[0_0_8px_rgba(34,211,238,0.4)] transition-all cursor-pointer"
            title={t.tooltipAddRow}
          >
            {t.btnAddRow}
          </button>
          <button
            onClick={handleDeleteRow}
            disabled={gridData.length === 0 || selectedRowIndex < 0 || selectedRowIndex >= gridData.length}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold border transition-all ${
              gridData.length > 0 && selectedRowIndex >= 0 && selectedRowIndex < gridData.length
                ? "border-pink-500/30 bg-pink-950/80 text-pink-400 hover:bg-pink-900/50 hover:text-pink-300 hover:shadow-[0_0_8px_rgba(244,63,94,0.4)] cursor-pointer"
                : "border-slate-900 bg-slate-950 text-slate-700 cursor-not-allowed"
            }`}
            title={t.tooltipDeleteRow}
          >
            {t.btnDeleteRow}
          </button>
          {/* 전체 수정 데이터 일괄 초기화 버튼 */}
          <button
            onClick={triggerResetAll}
            disabled={modifiedRowsCount === 0}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold border transition-all ${
              modifiedRowsCount > 0
                ? "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer"
                : "bg-slate-950 border-slate-900 text-slate-700 cursor-not-allowed"
            }`}
            title={t.tooltipResetAll}
          >
            {t.btnResetAll}
          </button>
          {/* 저장 및 데이터 추출 버튼 */}
          <button
            onClick={handleSaveAndExtract}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold border border-emerald-500/30 bg-emerald-950/80 text-emerald-400 hover:bg-emerald-900/50 hover:text-emerald-300 transition-all cursor-pointer"
            title={t.tooltipSaveExtract}
          >
            {t.btnSaveExtract}
          </button>
          {/* [Day 40 작업] 최종 DB 반영 비동기 Update 실행 버튼 */}
          <button
            onClick={handleFinalCommit}
            disabled={isUpdating || modifiedRowsCount === 0}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold border transition-all print:hidden ${
              isUpdating
                ? "bg-emerald-950/40 border-emerald-500/20 text-emerald-500/60 cursor-not-allowed"
                : modifiedRowsCount > 0
                ? "border-emerald-500 bg-emerald-950/80 text-emerald-400 hover:bg-emerald-900/50 hover:text-emerald-300 hover:shadow-[0_0_15px_rgba(16,185,129,0.6)] shadow-[0_0_8px_rgba(16,185,129,0.3)] cursor-pointer"
                : "border-slate-900 bg-slate-950 text-slate-700 cursor-not-allowed"
            }`}
            title={t.tooltipFinalCommit}
          >
            {isUpdating ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                <span>{t.updating}</span>
              </>
            ) : (
              <span>{t.btnFinalCommit}</span>
            )}
          </button>
          {/* [Day 43 작업] 보고서 인쇄 🖨️ 버튼 배치 */}
          <button
            onClick={handlePrintReport}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold border border-cyan-500 bg-cyan-950/80 text-cyan-400 hover:bg-cyan-900/50 hover:text-cyan-300 hover:shadow-[0_0_15px_rgba(34,211,238,0.6)] shadow-[0_0_8px_rgba(34,211,238,0.3)] transition-all cursor-pointer print:hidden"
            title={t.tooltipPrint}
          >
            <span>{t.btnPrint}</span>
          </button>
        </div>

        {/* [Day 41 작업] 다국어 선택 및 [컬럼 설정 ⚙️] */}
        <div className="flex items-center gap-2 flex-wrap print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-cyan-400 animate-pulse">🌐</span>
            <select
              value={currentLanguage}
              onChange={(e) => setCurrentLanguage(e.target.value as "ko" | "en")}
              className="bg-slate-950 border border-cyan-500/30 hover:border-cyan-400 focus:border-cyan-400 text-xs text-cyan-400 font-bold rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all cursor-pointer shadow-[0_0_8px_rgba(34,211,238,0.2)]"
            >
              <option value="ko">한국어 (Korean)</option>
              <option value="en">English ([ˈɪŋɡlɪʃ])</option>
            </select>
          </div>

          {/* [Day 42 작업] 다크 네온 스타일 [컬럼 설정 ⚙️] 미니 레이아웃 */}
          <div className="relative">
            <button
              onClick={() => setShowColumnSettings(!showColumnSettings)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold border border-cyan-500/30 bg-slate-950 text-cyan-400 hover:bg-cyan-900/40 hover:text-cyan-300 hover:shadow-[0_0_8px_rgba(34,211,238,0.3)] transition-all cursor-pointer shadow-[0_0_8px_rgba(34,211,238,0.1)]"
            >
              <span>컬럼 설정 ⚙️</span>
            </button>
            {showColumnSettings && (
              <div className="absolute right-0 mt-2 w-56 bg-slate-950/95 border border-cyan-500/30 rounded-xl p-3 shadow-[0_4px_20px_rgba(34,211,238,0.2)] z-40 flex flex-col gap-2 backdrop-blur-md">
                <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-wider border-b border-cyan-950/60 pb-1.5 mb-1 flex items-center justify-between">
                  <span>Column Visibility</span>
                  <button 
                    onClick={() => setShowColumnSettings(false)}
                    className="text-slate-500 hover:text-cyan-400 text-xs focus:outline-none"
                  >
                    ✕
                  </button>
                </span>
                <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto scrollbar-thin pr-1">
                  {(parsedData.columns || []).map((c) => (
                    <label key={c.name} className="flex items-center gap-2 text-[11px] font-mono text-slate-300 hover:text-cyan-300 cursor-pointer select-none py-0.5">
                      <input
                        type="checkbox"
                        checked={visibleColumns[c.name] !== false}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setVisibleColumns(prev => ({
                            ...prev,
                            [c.name]: val
                          }));
                        }}
                        className="rounded border-slate-800 bg-slate-950 text-cyan-500 focus:ring-0 focus:ring-offset-0 focus:outline-none w-3.5 h-3.5 cursor-pointer accent-cyan-500"
                      />
                      <span>{translateColLabel(c.name, c.label || "", currentLanguage)}</span>
                    </label>
                  ))}
                  {(parsedData.computedFields || []).map((comp) => (
                    <label key={comp.name} className="flex items-center gap-2 text-[11px] font-mono text-amber-400 hover:text-amber-300 cursor-pointer select-none py-0.5">
                      <input
                        type="checkbox"
                        checked={visibleColumns[comp.name] !== false}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setVisibleColumns(prev => ({
                            ...prev,
                            [comp.name]: val
                          }));
                        }}
                        className="rounded border-slate-800 bg-slate-950 text-amber-500 focus:ring-0 focus:ring-offset-0 focus:outline-none w-3.5 h-3.5 cursor-pointer accent-amber-500"
                      />
                      <span>🧮 {comp.label || comp.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* [Day 32 작업] 파워빌더 Retrieval Argument 조회 조건 바 */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-[#0d1527]/90 border border-indigo-950/60 rounded-xl shadow-lg relative overflow-hidden print:hidden">
        <div className="absolute -top-10 -left-10 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none"></div>
        <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl pointer-events-none"></div>

        <div className="flex items-center gap-4 flex-wrap z-10">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase tracking-wider">{t.deptLabel}</span>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="bg-slate-950 border border-slate-800 hover:border-indigo-500/50 focus:border-indigo-500 text-xs text-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition-all cursor-pointer"
            >
              <option value="전체">{t.deptAll}</option>
              <option value="개발팀">{t.deptDev}</option>
              <option value="영업팀">{t.deptSales}</option>
              <option value="인사팀">{t.deptHR}</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase tracking-wider">{t.keywordLabel}</span>
            <input
              type="text"
              placeholder={t.keywordPlaceholder}
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  triggerRetrieve();
                }
              }}
              className="bg-slate-950 border border-slate-800 hover:border-indigo-500/50 focus:border-indigo-500 text-xs text-slate-300 placeholder-slate-600 rounded px-3 py-1.5 w-48 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition-all"
            />
          </div>

          {/* [Day 56 작업] 사용자 정의 검색 조건 프리셋(Search Query Preset) 저장/복원 컴포넌트 마운트 */}
          <SearchPreset
            currentQuery={{
              as_dept: selectedDept,
              as_status: argValues.as_status || "Closed",
              an_sales: argValues.an_sales || "50000",
              keyword: searchKeyword,
            }}
            onRestorePreset={(presetQuery) => {
              if (presetQuery.as_dept) {
                setSelectedDept(presetQuery.as_dept);
              }
              if (presetQuery.keyword !== undefined) {
                setSearchKeyword(presetQuery.keyword);
              }
              if (onRestorePreset) {
                onRestorePreset(presetQuery);
              }
            }}
          />
        </div>

        <button
          onClick={triggerRetrieve}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-4.5 py-1.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-[length:200%_auto] hover:bg-right hover:scale-[1.02] text-xs text-white font-extrabold rounded shadow-[0_0_12px_rgba(99,102,241,0.35)] hover:shadow-[0_0_20px_rgba(16,185,129,0.6)] border border-indigo-500/20 active:scale-95 transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed z-10"
        >
          <span>{t.btnRetrieve.replace("🔍", "").trim()}</span>
          <span>🔍</span>
        </button>
      </div>

      {/* [Day 34 작업] 결과 내 필터링 인풋 입력 UI */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-[#0a0f1d]/90 border border-cyan-950/60 rounded-xl shadow-lg relative overflow-hidden print:hidden">
        <div className="absolute -top-10 -left-10 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none"></div>
        <div className="flex items-center gap-2 z-10">
          <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider">{t.filterLabel}</span>
          <span className="text-xs text-slate-300 font-bold">{t.filterTitle}</span>
        </div>
        <div className="relative flex items-center z-10 w-full sm:w-72">
          <input
            type="text"
            placeholder={t.filterPlaceholder}
            value={filterKeyword}
            onChange={(e) => setFilterKeyword(e.target.value)}
            className="bg-slate-950 border border-slate-800 hover:border-cyan-500/50 focus:border-cyan-500 text-xs text-slate-300 placeholder-slate-600 rounded px-3 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all pl-8 shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]"
          />
          <span className="absolute left-2.5 text-xs text-cyan-500 pointer-events-none">🔍</span>
          {filterKeyword && (
            <button
              onClick={() => setFilterKeyword("")}
              className="absolute right-2 text-xs text-slate-500 hover:text-slate-300 focus:outline-none cursor-pointer"
              title={currentLanguage === "ko" ? "필터 키워드 초기화" : "Clear Filter"}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* [Day 49 작업] 행 검색어 입력 및 양방향 찾기 조작 UI */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-[#090e1c]/90 border border-indigo-950/60 rounded-xl shadow-lg relative overflow-hidden print:hidden">
        <div className="absolute -top-10 -left-10 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none"></div>
        <div className="flex items-center gap-2 z-10">
          <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase tracking-wider">dw_1.Find()</span>
          <span className="text-xs text-slate-300 font-bold">그리드 특정 조건 만족 행 일괄 자동 포커싱 [ˈfoʊkəs] 및 스크롤 [skroʊl] 연동</span>
          {matchedRowIndices.length > 0 && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-400 border border-indigo-500/20 font-bold shadow-[0_0_8px_rgba(99,102,241,0.3)]">
              {currentMatchPointer + 1} / {matchedRowIndices.length} 건 일치
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 z-10 w-full sm:w-auto flex-wrap sm:flex-nowrap">
          <div className="relative flex items-center w-full sm:w-64">
            <input
              type="text"
              placeholder={t.rowSearchPlaceholder}
              value={rowSearchKeyword}
              onChange={(e) => {
                setRowSearchKeyword(e.target.value);
                setMatchedRowIndices([]);
                setCurrentMatchPointer(-1);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleRowSearch("next", rowSearchKeyword);
                }
              }}
              className="bg-slate-950 border border-slate-800 hover:border-indigo-500/50 focus:border-indigo-500 text-xs text-slate-300 placeholder-slate-600 rounded px-3 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition-all pl-8 shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]"
            />
            <span className="absolute left-2.5 text-xs text-indigo-500 pointer-events-none">🔍</span>
            {rowSearchKeyword && (
              <button
                onClick={() => {
                  setRowSearchKeyword("");
                  setMatchedRowIndices([]);
                  setCurrentMatchPointer(-1);
                }}
                className="absolute right-2 text-xs text-slate-500 hover:text-slate-300 focus:outline-none cursor-pointer"
                title={currentLanguage === "ko" ? "검색어 초기화" : "Clear Search"}
              >
                ✕
              </button>
            )}
          </div>
          <div className="flex gap-1 w-full sm:w-auto">
            <button
              onClick={() => handleRowSearch("prev", rowSearchKeyword)}
              disabled={!rowSearchKeyword.trim()}
              className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded text-xs font-bold border transition-all ${
                rowSearchKeyword.trim()
                  ? "border-indigo-500/30 bg-slate-950 text-indigo-400 hover:bg-indigo-900/40 hover:text-indigo-300 hover:shadow-[0_0_8px_rgba(99,102,241,0.3)] cursor-pointer"
                  : "border-slate-900 bg-slate-950 text-slate-700 cursor-not-allowed"
              }`}
            >
              {t.btnFindPrev}
            </button>
            <button
              onClick={() => handleRowSearch("next", rowSearchKeyword)}
              disabled={!rowSearchKeyword.trim()}
              className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded text-xs font-bold border transition-all ${
                rowSearchKeyword.trim()
                  ? "border-indigo-500/30 bg-slate-950 text-indigo-400 hover:bg-indigo-900/40 hover:text-indigo-300 hover:shadow-[0_0_8px_rgba(99,102,241,0.3)] cursor-pointer"
                  : "border-slate-900 bg-slate-950 text-slate-700 cursor-not-allowed"
              }`}
            >
              {t.btnFindNext}
            </button>
          </div>
        </div>
      </div>

      {/* 고속 입력용 가변 뷰포트 및 스크롤 최적화 구역 */}
      <div className="relative overflow-x-auto overflow-y-auto border border-slate-900 rounded-xl min-h-[260px] max-h-[400px] scrollbar-thin">
        <GridErrorBoundary
          onReset={handleResetBoundary}
          fallback={ErrorFallback}
        >
          <GridTableInner
            isLoading={isLoading}
            totalTableWidth={totalTableWidth}
            parsedData={parsedData}
            visibleColumns={visibleColumns}
            columnWidths={columnWidths}
            flattenedActiveColumns={flattenedActiveColumns}
            gridData={gridData}
            filteredRows={filteredRows}
            validationErrors={validationErrors}
            selectedRowIndex={selectedRowIndex}
            selectedRowIds={selectedRowIds}
            argValues={argValues}
            currentLanguage={currentLanguage}
            footerSummaries={footerSummaries}
            visibleFrozenColumns={visibleFrozenColumns}
            isAllFilteredSelected={isAllFilteredSelected}
            handleToggleAll={handleToggleAll}
            handleToggleRow={handleToggleRow}
            onSelectRow={onSelectRow}
            handleSort={handleSort}
            handleResizeStart={handleResizeStart}
            handleUndoRow={handleUndoRow}
            getFrozenLeftOffset={getFrozenLeftOffset}
            getAlignClass={getAlignClass}
            translateColLabel={translateColLabel}
            getCellStyleAndClass={getCellStyleAndClass}
            setGridData={setGridData}
            sortConfig={sortConfig}
            filterKeyword={filterKeyword}
            initialGridDataRef={initialGridDataRef}
            t={t}
            totalVisibleColSpan={totalVisibleColSpan}
          />
        </GridErrorBoundary>
      </div>

      {/* [Day 39 작업] 상세 내역 (Detail View) 서브 뷰포트 레이아웃 */}
      <div className="mt-4 p-5 bg-slate-950/90 border border-pink-950/60 rounded-2xl shadow-2xl relative overflow-hidden flex flex-col gap-3">
        <div className="absolute -top-10 -right-10 w-24 h-24 bg-pink-500/5 rounded-full blur-2xl pointer-events-none"></div>
        
        <div className="flex items-center justify-between border-b border-pink-900/20 pb-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse"></span>
            <h4 className="text-xs font-bold text-pink-400 font-mono tracking-wide">
              {t.detailTitle.replace("{empId}", currentEmpId || (currentLanguage === "ko" ? "선택 없음" : "None"))}
            </h4>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={handleInsertDetailRow}
              disabled={!currentEmpId}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold border transition-all ${
                currentEmpId
                  ? "border-pink-500/30 bg-pink-950/80 text-pink-400 hover:bg-pink-900/50 hover:text-pink-300 hover:shadow-[0_0_8px_rgba(244,63,94,0.4)] cursor-pointer"
                  : "border-slate-900 bg-slate-950 text-slate-700 cursor-not-allowed"
              }`}
              title={t.tooltipDetailAdd}
            >
              {t.btnDetailAdd}
            </button>
            <button
              onClick={handleDeleteDetailRow}
              disabled={!currentEmpId || !detailData[currentEmpId] || detailData[currentEmpId].length === 0 || selectedDetailRowIndex < 0 || selectedDetailRowIndex >= (detailData[currentEmpId]?.length || 0)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold border transition-all ${
                currentEmpId && detailData[currentEmpId] && detailData[currentEmpId].length > 0 && selectedDetailRowIndex >= 0 && selectedDetailRowIndex < detailData[currentEmpId].length
                  ? "border-purple-500/30 bg-purple-950/80 text-purple-400 hover:bg-purple-900/50 hover:text-purple-300 hover:shadow-[0_0_8px_rgba(168,85,247,0.4)] cursor-pointer"
                  : "border-slate-900 bg-slate-950 text-slate-700 cursor-not-allowed"
              }`}
              title={t.tooltipDetailDelete}
            >
              {t.btnDetailDelete}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-auto border border-pink-950/30 rounded-xl max-h-[200px] scrollbar-thin">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#120712] text-pink-500 font-bold sticky top-0 border-b border-pink-950/40 z-10">
              <tr>
                <th className="p-2.5 text-center font-mono" style={{ width: "80px" }}>{t.detailSeq}</th>
                <th className="p-2.5 font-mono">{t.detailRelation}</th>
                <th className="p-2.5 font-mono">{t.detailName}</th>
                <th className="p-2.5 font-mono">{t.detailBirth}</th>
                <th className="p-2.5 font-mono">{t.detailNote}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pink-950/20 text-slate-300 bg-slate-950/40">
              {!currentEmpId ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500 italic">
                    {t.detailSelectRow}
                  </td>
                </tr>
              ) : !detailData[currentEmpId] || detailData[currentEmpId].length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500 italic">
                    {t.detailNoData}
                  </td>
                </tr>
              ) : (
                detailData[currentEmpId].map((detRow, dIdx) => {
                  const isDetSelected = selectedDetailRowIndex === dIdx;
                  const detRowBg = isDetSelected 
                    ? "bg-pink-600/10 border-y border-pink-500/20 font-bold" 
                    : "hover:bg-pink-950/5";

                  return (
                    <tr
                      key={detRow.seq}
                      onClick={() => setSelectedDetailRowIndex(dIdx)}
                      className={`transition-all font-mono cursor-pointer ${detRowBg}`}
                    >
                      <td className="p-2 text-center text-pink-400/80 font-bold" style={{ width: "80px" }}>{detRow.seq}</td>
                      <td className="p-1">
                        <input
                          type="text"
                          value={detRow.relation}
                          onChange={(e) => handleDetailCellChange(detRow.seq, "relation", e.target.value)}
                          className="w-full bg-transparent px-2 py-1 text-xs border-0 text-white focus:outline-none focus:ring-1 focus:ring-pink-500 rounded"
                          placeholder={t.relationPlaceholder}
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="text"
                          value={detRow.name}
                          onChange={(e) => handleDetailCellChange(detRow.seq, "name", e.target.value)}
                          className="w-full bg-transparent px-2 py-1 text-xs border-0 text-white focus:outline-none focus:ring-1 focus:ring-pink-500 rounded"
                          placeholder={t.namePlaceholder}
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="date"
                          value={detRow.birth}
                          onChange={(e) => handleDetailCellChange(detRow.seq, "birth", e.target.value)}
                          onClick={(e) => {
                            try { e.currentTarget.showPicker(); } catch (err) {}
                          }}
                          onFocus={(e) => {
                            try { e.currentTarget.showPicker(); } catch (err) {}
                          }}
                          className="w-full bg-transparent px-2 py-1 text-xs border-0 text-white focus:outline-none focus:ring-1 focus:ring-pink-500 rounded"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="text"
                          value={detRow.note}
                          onChange={(e) => handleDetailCellChange(detRow.seq, "note", e.target.value)}
                          className="w-full bg-transparent px-2 py-1 text-xs border-0 text-white focus:outline-none focus:ring-1 focus:ring-pink-500 rounded"
                          placeholder={t.notePlaceholder}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* TRANSACTION DATA DUMP 로그 터미널 레이어 */}
      {dumpOutput && (
        <div className={`mt-4 bg-black border rounded-xl p-4 font-mono text-xs flex flex-col gap-2 relative shadow-2xl transition-all print:hidden ${
          dumpOutput.includes("[VALIDATION ERROR]")
            ? "border-red-900/50 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.15)]"
            : "border-emerald-900/50 text-emerald-400"
        }`}>
          {copied && (
            <div className="absolute top-12 right-4 bg-emerald-950 text-emerald-300 border border-emerald-400/50 px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-bounce z-10 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              <span>{t.copiedToast}</span>
            </div>
          )}
          <div className={`flex items-center justify-between border-b pb-2 ${
            dumpOutput.includes("[VALIDATION ERROR]") ? "border-red-900/30" : "border-emerald-900/30"
          }`}>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${
                dumpOutput.includes("[VALIDATION ERROR]") ? "bg-red-500" : "bg-emerald-500"
              }`}></span>
              <span className={`font-bold ${
                dumpOutput.includes("[VALIDATION ERROR]") ? "text-red-300" : "text-emerald-300"
              }`}>
                {dumpOutput.includes("[VALIDATION ERROR]")
                  ? t.valErrTitle
                  : t.txDumpTitle}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {!dumpOutput.includes("[VALIDATION ERROR]") && (
                <>
                  <button
                    onClick={handleCopyToClipboard}
                    className="text-emerald-400 hover:text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/50 px-2.5 py-1 rounded border border-emerald-500/30 text-[10px] font-bold cursor-pointer transition-all flex items-center gap-1 hover:shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                    title={t.tooltipCopy}
                  >
                    {t.btnCopy}
                  </button>
                  <button
                    onClick={handleDownloadJSON}
                    className="text-cyan-400 hover:text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/50 px-2.5 py-1 rounded border border-cyan-500/30 text-[10px] font-bold cursor-pointer transition-all flex items-center gap-1 hover:shadow-[0_0_8px_rgba(34,211,238,0.4)]"
                    title={t.tooltipDownload}
                  >
                    {t.btnDownload}
                  </button>
                </>
              )}
              <button
                onClick={() => setDumpOutput(null)}
                className={`px-2.5 py-1 rounded border text-[10px] font-bold cursor-pointer transition-all ${
                  dumpOutput.includes("[VALIDATION ERROR]")
                    ? "text-red-400 hover:text-red-300 bg-red-950/40 hover:bg-red-900/50 border-red-500/20"
                    : "text-emerald-500 hover:text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900/50 border-emerald-500/20"
                }`}
              >
                {t.btnClose}
              </button>
            </div>
          </div>
          <pre className="overflow-auto max-h-48 scrollbar-thin whitespace-pre-wrap select-all">
            {dumpOutput}
          </pre>
        </div>
      )}

      {/* [Day 45 작업] 저장되지 않은 변경 사항 이탈 경고 커스텀 다이얼로그 모달 */}
      {interceptModal.isOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 animate-fade-in print:hidden">
          <div className="bg-[#0b0f19] border border-pink-500/30 rounded-2xl p-6 max-w-sm w-full shadow-[0_0_30px_rgba(244,63,94,0.3)] flex flex-col gap-4 text-center relative overflow-hidden">
            <div className="absolute -top-10 -left-10 w-20 h-20 bg-pink-500/5 rounded-full blur-2xl pointer-events-none"></div>
            <div className="flex items-center justify-center text-pink-500 text-4xl animate-pulse">
              ⚠️
            </div>
            <h4 className="text-white text-base font-extrabold tracking-tight">저장되지 않은 변경 사항</h4>
            <p className="text-slate-300 text-xs leading-relaxed font-medium">
              {interceptModal.message}
            </p>
            <div className="flex justify-center gap-3 mt-2">
              <button
                onClick={() => {
                  setInterceptModal({ isOpen: false, onConfirm: () => {}, message: "" });
                }}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white text-xs font-bold transition-all cursor-pointer"
              >
                취소
              </button>
              <button
                onClick={() => {
                  interceptModal.onConfirm();
                  setInterceptModal({ isOpen: false, onConfirm: () => {}, message: "" });
                }}
                className="px-4 py-2 rounded-lg bg-pink-950/80 hover:bg-pink-900 border border-pink-500/40 hover:border-pink-500 text-pink-400 hover:text-pink-300 text-xs font-bold transition-all shadow-[0_0_12px_rgba(244,63,94,0.3)] cursor-pointer"
              >
                계속
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
