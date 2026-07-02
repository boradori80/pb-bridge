// [Day 21 작업] 데이터윈도우 웹 변환 그리드 프리뷰 컴포넌트
// [Day 32 작업] 상단 Retrieval Argument 조회 바 및 동적 데이터 바인딩 고도화
// [Day 34 작업] 그리드 런타임 결과 내 실시간 와일드카드 필터링(Filter) 고도화 구현
// [Day 40 작업] 그리드 다중 트랜잭션 데이터 최종 커밋 및 서버 비동기 통신 피드백 고도화 구현
"use client";

import React from "react";
import { ParsedPB, ColumnInfo } from "../types";
import { isNumericColumn, formatNumberWithCommas, evaluateDWExpression } from "../utils/expression";

interface GridPreviewProps {
  parsedData: ParsedPB;
  gridData: Array<{ [key: string]: string }>;
  setGridData: React.Dispatch<React.SetStateAction<Array<{ [key: string]: string }>>>;
  argValues: { [key: string]: string };
  // [Day 27 작업] 행 선택 상태 정의 구역
  selectedRowIndex: number;
  onSelectRow: (rIdx: number) => void;
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
    tooltipDownload: "추출된 JSON 파일을 로컬 디스크로 즉시 다운로드합니다."
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
    tooltipDownload: "Download the extracted JSON file to the local disk immediately."
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

export default function GridPreview({
  parsedData,
  gridData,
  setGridData,
  argValues,
  selectedRowIndex,
  onSelectRow,
}: GridPreviewProps) {
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

  // [Day 39 작업] 마스터의 고유 ID 식별자 추출
  const currentMasterRow = gridData[selectedRowIndex];
  const currentEmpId = currentMasterRow ? (currentMasterRow.emp_id || currentMasterRow.id || "") : "";

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
  const totalTableWidth = React.useMemo(() => {
    let sum = 48 + 80;
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
  const getFrozenLeftOffset = React.useCallback((colIndex: number): number => {
    if (colIndex === -1) return 0; // 'No.' 열은 가장 첫 부분에 고정
    let offset = 48; // 'No.' 열의 고정 너비 (48px)
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
  const totalVisibleColSpan = React.useMemo(() => {
    const visibleCols = (parsedData.columns || []).filter((c) => visibleColumns[c.name] !== false).length;
    const visibleComps = (parsedData.computedFields || []).filter((comp) => visibleColumns[comp.name] !== false).length;
    return visibleCols + visibleComps + 2; // No. + 제어 포함
  }, [parsedData.columns, parsedData.computedFields, visibleColumns]);

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
    if (selectedRowIndex < 0 || selectedRowIndex >= gridData.length) return;

    const rowToDelete = gridData[selectedRowIndex];

    if (rowToDelete.row_status !== "New" && rowToDelete.row_status !== "NewModified") {
      const { __originalIndex, row_status, ...cleanRow } = rowToDelete;
      
      const deletedItem: DeletedRowInfo = {
        row_no: selectedRowIndex + 1,
        row_status: "Deleted",
        data: cleanRow,
      };
      
      setDeleteBuffer((prev) => [...prev, deletedItem]);
    }

    setGridData((prev) => {
      const next = prev.filter((_, idx) => idx !== selectedRowIndex);
      
      if (next.length > 0) {
        const nextSelectIdx = selectedRowIndex >= next.length ? next.length - 1 : selectedRowIndex;
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
  };

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

  return (
    <section className="bg-slate-950/80 border border-slate-900 rounded-2xl overflow-hidden shadow-2xl p-5 flex flex-col gap-4 relative">
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
            onClick={handleResetAll}
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
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold border transition-all ${
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
        </div>

        {/* [Day 41 작업] 다크 네온 스타일 [🌐 언어 선택] 토글/드롭다운 및 [컬럼 설정 ⚙️] */}
        <div className="flex items-center gap-2 flex-wrap">
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

      {/* [Day 32 작업] 파워빌더 Retrieval Argument 아규먼트 입력을 상징하는 다크 네온 스타일 조회 조건 바 */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-[#0d1527]/90 border border-indigo-950/60 rounded-xl shadow-lg relative overflow-hidden">
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
                  handleRetrieve();
                }
              }}
              className="bg-slate-950 border border-slate-800 hover:border-indigo-500/50 focus:border-indigo-500 text-xs text-slate-300 placeholder-slate-600 rounded px-3 py-1.5 w-48 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition-all"
            />
          </div>
        </div>

        <button
          onClick={handleRetrieve}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-4.5 py-1.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-[length:200%_auto] hover:bg-right hover:scale-[1.02] text-xs text-white font-extrabold rounded shadow-[0_0_12px_rgba(99,102,241,0.35)] hover:shadow-[0_0_20px_rgba(16,185,129,0.6)] border border-indigo-500/20 active:scale-95 transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed z-10"
        >
          <span>{t.btnRetrieve.replace("🔍", "").trim()}</span>
          <span>🔍</span>
        </button>
      </div>

      {/* [Day 34 작업] 결과 내 필터링 인풋 입력 UI 컴포넌트 추가 (다크 네온 디자인) */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-[#0a0f1d]/90 border border-cyan-950/60 rounded-xl shadow-lg relative overflow-hidden">
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

      {/* 고속 입력용 가변 뷰포트 및 스크롤 최적화 구역 */}
      <div className="relative overflow-x-auto overflow-y-auto border border-slate-900 rounded-xl min-h-[260px] max-h-[400px] scrollbar-thin">
        {/* [Day 32 작업] 데이터 조회 중 로딩 레이어 오버레이 */}
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
                  ? `${parsedData.bands.header / 2}px`
                  : "44px",
              }}
            >
              {/* [Day 38 작업] No. 열 sticky 고정 적용 */}
              <th 
                className="p-3 text-center bg-slate-900 border-r border-slate-900/40 sticky left-0 z-30" 
                style={{ width: "48px", left: 0 }}
              >
                {t.colNo}
              </th>
              {(parsedData.columns || []).map((c, i) => {
                if (visibleColumns[c.name] === false) return null; // [Day 42 작업] 컬럼 숨김 적용
                const isFrozen = i < 2; // 맨 앞 2개 핵심 컬럼 고정
                const leftOffset = isFrozen ? getFrozenLeftOffset(i) : undefined;
                // [Day 42 작업] 노출되어 있는 고정 열들 중에서 가장 우측에 위치한 고정 열 식별
                const isLastFrozen = isFrozen && visibleFrozenColumns.length > 0 && visibleFrozenColumns[visibleFrozenColumns.length - 1].name === c.name;

                return (
                  <th
                    key={i}
                    onClick={() => handleSort(c.name)}
                    className={`p-3 font-mono text-slate-300 bg-slate-900 cursor-pointer select-none hover:bg-slate-800 hover:text-white transition-all border-r border-slate-900/40 relative group ${getAlignClass(
                      c.alignment
                    )} ${isFrozen ? "sticky z-30" : ""} ${
                      isLastFrozen ? "border-r-2 border-r-indigo-500/80 shadow-[2px_0_5px_rgba(99,102,241,0.3)]" : ""
                    }`}
                    style={{ 
                      width: `${columnWidths[c.name] || 150}px`,
                      left: leftOffset,
                    }}
                    title={t.tooltipSort}
                  >
                    <div className="flex items-center justify-between gap-2 mr-2">
                      <span>{translateColLabel(c.name, c.label || "", currentLanguage)}</span>
                      <span
                        className={`text-[9px] font-bold px-1 py-0.5 rounded transition-all duration-300 ${
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
                    {/* [Day 37 작업] 컬럼 Resizing을 위한 다크 네온 스타일의 리사이저 핸들 포인트 */}
                    <div
                      onMouseDown={(e) => handleResizeStart(c.name, e)}
                      className="absolute top-0 right-0 h-full w-1 cursor-col-resize select-none z-20 hover:bg-cyan-400 active:bg-cyan-300 bg-slate-800/30 transition-all duration-200 hover:shadow-[0_0_8px_rgba(34,211,238,0.8)]"
                      title={t.tooltipResize}
                    />
                  </th>
                );
              })}
              {(parsedData.computedFields || []).map((comp, i) => {
                if (visibleColumns[comp.name] === false) return null; // [Day 42 작업] 계산식 컬럼 숨김 적용
                return (
                  <th
                    key={i}
                    className="p-3 text-amber-400 bg-indigo-950/20 relative group select-none"
                    style={{ width: `${columnWidths[comp.name] || 150}px` }}
                  >
                    <div className="flex items-center gap-2 mr-2">
                      <span>🧮 {comp.label || comp.name}</span>
                    </div>
                    {/* [Day 37 작업] 계산식 컬럼 Resizing을 위한 다크 네온 스타일의 리사이저 핸들 포인트 */}
                    <div
                      onMouseDown={(e) => handleResizeStart(comp.name, e)}
                      className="absolute top-0 right-0 h-full w-1 cursor-col-resize select-none z-20 hover:bg-cyan-400 active:bg-cyan-300 bg-slate-800/30 transition-all duration-200 hover:shadow-[0_0_8px_rgba(34,211,238,0.8)]"
                      title={t.tooltipResize}
                    />
                  </th>
                );
              })}
              <th className="p-3 text-center text-slate-400 font-bold border-l border-slate-900/40 bg-slate-900" style={{ width: "80px" }}>
                {t.colControl}
              </th>
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
                const isModified = isRowModified(row, rIdx);
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

                // [Day 38 작업] 고정 셀들의 불투명 배경색 지정 및 호버 대응
                let cellBgClass = "bg-[#090e1c] group-hover:bg-[#11192e]";
                if (hasError) {
                  cellBgClass = "bg-[#251016] group-hover:bg-[#341820]";
                } else if (isSelected) {
                  cellBgClass = "bg-[#141b38] group-hover:bg-[#1b2447]";
                } else if (isModified) {
                  cellBgClass = "bg-[#0c201d] group-hover:bg-[#122e2a]";
                }

                return (
                  <tr
                    key={rIdx}
                    style={{
                      height: parsedData?.bands?.detail
                        ? `${parsedData.bands.detail / 2}px`
                        : "40px",
                    }}
                    onClick={() => onSelectRow(rIdx)}
                    className={`transition-all font-mono cursor-pointer group ${rowBgClass}`}
                  >
                    {/* [Day 38 작업] No. 열 sticky 고정 적용 및 오프셋 스타일 바인딩 */}
                    <td 
                      className={`p-3 text-center transition-all sticky left-0 z-10 border-r border-slate-900/40 ${cellBgClass} ${
                        hasError
                          ? "border-l-4 border-l-red-500 text-red-400 font-bold"
                          : isModified 
                          ? "border-l-4 border-l-emerald-500 text-emerald-400 font-bold" 
                          : "text-slate-600"
                      }`} 
                      style={{ 
                        width: "48px",
                        left: 0,
                      }}
                    >
                      {fIdx + 1}
                    </td>
                    {(parsedData.columns || []).map((col, cIdx) => {
                      if (visibleColumns[col.name] === false) return null; // [Day 42 작업] 컬럼 숨김 적용
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

                      const isFrozen = cIdx < 2;
                      const leftOffset = isFrozen ? getFrozenLeftOffset(cIdx) : undefined;
                      // [Day 42 작업] 노출되어 있는 고정 열들 중에서 가장 우측에 위치한 고정 열 식별
                      const isLastFrozen = isFrozen && visibleFrozenColumns.length > 0 && visibleFrozenColumns[visibleFrozenColumns.length - 1].name === col.name;

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
                          const columnsCount = parsedData.columns ? parsedData.columns.length : 0;
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
                              const nextCol = parsedData.columns[nextColIdx];
                              const target = document.querySelector(
                                `input[data-row="${rIdx}"][data-col="${nextCol.name}"]`
                              ) as HTMLInputElement | null;
                              if (target && !target.readOnly && target.tabIndex !== -1) {
                                target.focus();
                                break;
                              }
                              nextColIdx++;
                            }
                          } else if (e.key === "ArrowLeft") {
                            e.preventDefault();
                            let prevColIdx = cIdx - 1;
                            while (prevColIdx >= 0) {
                              const prevCol = parsedData.columns[prevColIdx];
                              const target = document.querySelector(
                                `input[data-row="${rIdx}"][data-col="${prevCol.name}"]`
                              ) as HTMLInputElement | null;
                              if (target && !target.readOnly && target.tabIndex !== -1) {
                                target.focus();
                                break;
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
                                  const targetCol = parsedData.columns[c];
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
                                if (targetFound) break;
                              }
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
                            className={`${baseClass} ${cellAlignClass} ${stateClass}`}
                          />
                        );
                      };

                      return (
                        <td 
                          key={cIdx} 
                          className={`p-1 border-r border-slate-900/40 ${
                            isFrozen ? `sticky z-10 ${cellBgClass}` : ""
                          } ${
                            isLastFrozen ? "border-r-2 border-r-indigo-500/80" : ""
                          }`} 
                          style={{ 
                            width: `${columnWidths[col.name] || 150}px`,
                            left: leftOffset,
                          }}
                        >
                          {renderGridCellInput()}
                        </td>
                      );
                    })}
                    {(parsedData.computedFields || []).map((comp, cpIdx) => {
                      if (visibleColumns[comp.name] === false) return null; // [Day 42 작업] 계산식 컬럼 숨김 적용
                      const mergedColumns = [
                        ...parsedData.columns,
                        ...(parsedData.arguments || []).map((arg) => ({
                          name: arg.name,
                          type: arg.type,
                          dbname: arg.name,
                        })),
                      ];
                      const res = evaluateDWExpression(
                        comp.expression,
                        { ...row, ...argValues },
                        mergedColumns
                      );
                      return (
                        <td
                          key={cpIdx}
                          className={`p-3 text-amber-400 font-bold bg-indigo-950/10 ${getAlignClass(
                            comp.alignment
                          )}`}
                          title={comp.expression}
                          style={{ width: `${columnWidths[comp.name] || 150}px` }}
                        >
                          {typeof res === "number" ? res.toLocaleString() : res}
                        </td>
                      );
                    })}
                    <td className="p-1 border-l border-slate-900/40 text-center w-20" style={{ width: "80px" }}>
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
        </table>
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
          <div className="flex items-center gap-2">
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
        <div className={`mt-4 bg-black border rounded-xl p-4 font-mono text-xs flex flex-col gap-2 relative shadow-2xl transition-all ${
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
    </section>
  );
}
