// [Day 21 작업] 데이터윈도우 웹 변환 그리드 프리뷰 컴포넌트
// [Day 32 작업] 상단 Retrieval Argument 조회 바 및 동적 데이터 바인딩 고도화
// [Day 34 작업] 그리드 런타임 결과 내 실시간 와일드카드 필터링(Filter) 고도화 구현
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

// [Day 32 작업] 레거시 DB 조회를 시뮬레이션하기 위한 10개 행 규모의 가상 직원/실적 마스터 데이터셋
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
  // key: 정렬 대상 컬럼명, direction: 정렬 방향 (asc: 오름차순, desc: 내림차순, none: 정렬 안 함)
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

  // [Day 37 작업] 마우스 드래그를 통한 컬럼 너비 리사이징 이벤트 훅 및 제어 로직
  /*
   * 파워빌더 레거시 윈도우 캡처 vs 현대 웹 표준 브라우저 이벤트 모델 비교 (교육용 주석)
   *
   * 1. 파워빌더 (레거시 C/S 환경):
   *    - 파워빌더의 Grid 스타일 데이터윈도우에서는 사용자가 헤더 컬럼 경계선에 마우스 왼쪽 버튼을 클릭하는 순간,
   *      네이티브 윈도우 커널 API인 `SetCapture(hWnd)`가 명시적/암시적으로 트리거됩니다.
   *      이를 통해 마우스 포인터가 윈도우 제어 영역(Client Area)을 이탈하더라도 드래그 해제 전까지 모든 마우스 메시지(WM_MOUSEMOVE, WM_LBUTTONUP)가
   *      해당 데이터윈도우 컨트롤로 독점 전송됩니다.
   *    - 이후 마우스 버튼을 놓으면 `ReleaseCapture()`를 호출하여 마우스 캡처를 운영체제 시스템에 반환하고 처리를 종료했습니다.
   *
   * 2. 현대 웹 표준 브라우저 및 React 선언형 환경:
   *    - 브라우저 환경에서는 단일 윈도우 스레드가 아니며 뷰포트 내의 다양한 요소들이 이벤트를 수신하므로, 단순히 특정 요소에 이벤트를 바인딩하면
   *      마우스가 요소를 빠르게 이탈할 때 이벤트 흐름이 끊기거나 드롭이 정상적으로 감지되지 않는 '드래그 끊김(Mouse Evading)' 현상이 발생합니다.
   *    - 이를 극복하기 위해 사용자가 헤더의 리사이저 영역을 `onMouseDown`으로 클릭했을 때,
   *      전역 `document` 객체에 직접 `mousemove`와 `mouseup` 이벤트 리스너를 동적으로 부착합니다. (브라우저 수준의 이벤트 캡처링 시뮬레이션)
   *    - 드래그 동작 중에는 마우스의 실시간 픽셀 변화량 `deltaX`를 측정하고, React의 불변 상태(State)인 `columnWidths`를 갱신합니다.
   *    - `mouseup` 시점에 `document`에 결합된 리스너들을 동적으로 해제하여 메모리 누수를 방지합니다.
   *    - 최종 렌더링 시에는 React의 가상 돔(Virtual DOM)과 선언형 인라인 스타일 `style={{ width: columnWidths[colName] }}`이 결합되어,
   *      실시간 너비 조정이 전체 그리드의 헤더(`<th>`)와 바디 데이터 셀(`<td>`)에 동일 폭으로 즉시 반영됩니다.
   */
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
  const totalTableWidth = React.useMemo(() => {
    // No(48px) + 제어(80px) + 각 컬럼들의 너비 합
    let sum = 48 + 80;
    (parsedData.columns || []).forEach((c) => {
      sum += columnWidths[c.name] || 150;
    });
    (parsedData.computedFields || []).forEach((comp) => {
      sum += columnWidths[comp.name] || 150;
    });
    return sum;
  }, [parsedData, columnWidths]);

  // [Day 38 작업] 파워빌더 고정 열(Fixed Columns) vs 웹 표준 CSS Sticky 및 React 동적 오프셋 비교 (교육용 주석)
  /*
   * 1. 파워빌더 (레거시 C/S 환경):
   *    - 파워빌더 Grid 스타일 데이터윈도우에서는 사용자가 가로 스크롤(ScrollHorizontal)을 할 때
   *      특정 컬럼들을 화면 좌측에 항상 고정시키기 위해 데이터윈도우 오브젝트의 HorizontalScrollSplit 속성
   *      혹은 dw_1.Object.DataWindow.HorizontalScrollSplit API를 설정하여 뷰포트를 좌우 두 개의 레이어로 분할했습니다.
   *      운영체제 커널의 분할 스크롤 뷰 메커니즘을 이용하므로 렌더링 경계면이 딱딱하고 너비 조정 시 리드로우(Redraw) 부하가 존재했습니다.
   * 
   * 2. 현대 웹 표준 브라우저 및 React 선언형 환경:
   *    - CSS `position: sticky` 속성을 활용하면 복잡한 화면 분할 없이도 스크롤 컨테이너 내에서 특정 요소를 고정 레이어로 띄울 수 있습니다.
   *    - 하지만 고정된 열이 여러 개일 때, 각각의 열이 고정되어야 할 좌측 오프셋(`left`) 값은 각 컬럼들의 너비에 맞춰 동적으로 계산되어야 합니다.
   *    - React의 상태로 관리되는 `columnWidths`를 추적하여, 고정할 각 컬럼들의 이전 너비 누적 합산을 구하는 `getFrozenLeftOffset` 함수를 가동합니다.
   *    - 사용자가 마우스로 드래그하여 임의의 컬럼 너비를 늘리거나 줄이면(Resizing), React의 Reactive 단방향 데이터 흐름에 의해
   *      누적 오프셋 `left`가 실시간으로 재계산되어 인라인 스타일로 바인딩됩니다.
   *    - 결과적으로 가로 스크롤 및 마우스 리사이징 중에도 픽셀 오차 없이 부드럽고 완벽하게 컬럼 틀고정 위치가 동기화됩니다.
   */
  const getFrozenLeftOffset = React.useCallback((colIndex: number): number => {
    if (colIndex === -1) return 0; // 'No.' 열은 가장 첫 부분에 고정
    let offset = 48; // 'No.' 열의 고정 너비 (48px)
    for (let i = 0; i < colIndex; i++) {
      const colName = parsedData.columns[i]?.name;
      if (colName) {
        offset += columnWidths[colName] || 150;
      }
    }
    return offset;
  }, [parsedData.columns, columnWidths]);

  // [Day 35 작업] 실시간 유효성 검증(Validation) 및 레거시 ItemChanged / dw_1.Find() 대치 로직
  /*
   * 파워빌더 레거시 메커니즘 vs 현대 리액트 선언형 아키텍처 비교 설명 (교육용 주석)
   * 
   * 1. 파워빌더 (레거시 C/S 환경):
   *    - 파워빌더에서는 사용자가 셀(Column) 값을 수정하고 포커스를 잃을 때 `ItemChanged` 이벤트가 동기적으로 발생합니다.
   *    - 이 이벤트 내에서 입력된 신규 값(data)의 유효성을 검증하며, 유효하지 않은 경우 Action Code를 반환하여 포커스 아웃을 막거나 입력을 거부합니다.
   *    - 최종적으로 모든 수정이 끝난 후 `dw_1.AcceptText()`를 호출하여 화면의 버퍼 값을 데이터윈도우의 Primary Buffer로 강제 승인합니다.
   *    - 특정 조건의 잘못된 로우를 찾아내기 위해서는 `dw_1.Find("IsNull(emp_name) or emp_name = ''", 1, dw_1.RowCount())`와 같이
   *      C++ 내장 탐색 엔진을 명시적 루프로 호출하여 에러 행의 포인터를 역추적해 이동해야 했습니다.
   * 
   * 2. 현대 React 아키텍처 (선언형/실시간 환경):
   *    - React 환경에서는 사용자의 키 입력이 일어날 때마다 `onChange` 핸들러가 트리거되어 단일 상태 원천(Single Source of Truth)인 `gridData`를 즉시 업데이트합니다.
   *    - 별도의 `AcceptText()` 호출 없이도 데이터의 변경은 즉시 선언형 데이터 흐름에 반영됩니다.
   *    - 본 컴포넌트에서는 `gridData` 상태가 변경될 때마다 `useEffect` 훅을 통해 전체 행을 스캔하는 `validateGridData` 함수를 자동으로 트리거합니다.
   *    - JavaScript의 고차 함수(`reduce`, `forEach`)를 활용한 선언형 배열 탐색 알고리즘을 활용하여, 특정 컬럼(사원명, 부서명, 사번 등)의
   *      필수값 누락 여부 및 형식 오류(예: 실적 필드의 숫자 형식 위반)를 O(N) 복잡도로 초고속 전수 스캔합니다.
   *    - 감지된 검증 에러는 `validationErrors` 상태로 기록되며, 이 상태와 렌더링 파이프라인이 즉각 연동되어 해당 행의 배경색(다크 레드/주황 네온)을 변경하고,
   *      하단 터미널 로그창에 빨간색 에러 텍스트(`[VALIDATION ERROR]`)를 실시간으로 스트리밍 출력하게 됩니다.
   */
  const [validationErrors, setValidationErrors] = React.useState<{ [rowIndex: number]: string }>({});

  const validateGridData = React.useCallback((data: Array<{ [key: string]: string }>) => {
    const errors: { [rowIndex: number]: string } = {};
    
    data.forEach((row, idx) => {
      // [Day 36 작업] 아직 편집하지 않은 순수 신규 행(New)은 필수값 실시간 검증 대상에서 제외
      if (row.row_status === "New") {
        return;
      }

      // 1. 필수값 누락 검증 (사원명: rep/name, 부서명: dept/region, 사번: emp_id/id)
      const empName = row.rep ?? row.name ?? "";
      const deptName = row.dept ?? row.region ?? "";
      const empId = row.emp_id ?? row.id ?? "";

      if (!empId.trim()) {
        errors[idx] = `[VALIDATION ERROR] ${idx + 1}번째 행의 필수 항목인 '사번'이 누락되었습니다.`;
        return;
      }
      if (!empName.trim()) {
        errors[idx] = `[VALIDATION ERROR] ${idx + 1}번째 행의 필수 항목인 '사원명'이 누락되었습니다.`;
        return;
      }
      if (!deptName.trim()) {
        errors[idx] = `[VALIDATION ERROR] ${idx + 1}번째 행의 필수 항목인 '부서명'이 누락되었습니다.`;
        return;
      }

      // 2. 형식 검증 (실적/sales가 비어있지 않은 경우 숫자 형식인지 체크)
      const salesVal = row.sales ?? "";
      if (salesVal.trim()) {
        const cleanSales = salesVal.replace(/,/g, "");
        if (isNaN(Number(cleanSales))) {
          errors[idx] = `[VALIDATION ERROR] ${idx + 1}번째 행의 실적(Sales) 필드가 올바른 숫자 형식이 아닙니다.`;
          return;
        }
      }
    });

    setValidationErrors(errors);
  }, []);

  // gridData의 변경을 실시간으로 감시하여 유효성 검증 수행
  React.useEffect(() => {
    validateGridData(gridData);
  }, [gridData, validateGridData]);

  // 실시간 에러 발생 시 하단 터미널에 에러 문구를 실시간 스트리밍 출력
  React.useEffect(() => {
    const errorKeys = Object.keys(validationErrors);
    if (errorKeys.length > 0) {
      const errorMsg = errorKeys
        .map((k) => validationErrors[Number(k)])
        .join("\n");
      setDumpOutput(errorMsg);
    } else {
      // 에러가 없고 기존 dumpOutput이 에러 메시지 형식을 띠고 있다면(즉, "[VALIDATION ERROR]"를 포함하고 있다면) 지워주거나 초기화
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
  /*
   * 파워빌더 dw_1.SetFilter() / Filter() 와 현대 React 파생 상태(Derived State) 기반 필터링 비교 (교육용 설명)
   * 
   * 1. 파워빌더(레거시 C/S)의 필터링 메커니즘:
   *    파워빌더에서는 `dw_1.SetFilter("emp_name like '%홍%'")`와 같이 조건식 문자열을 설정한 후,
   *    `dw_1.Filter()`를 호출하면 C++ 데이터윈도우 엔진이 프라이머리 버퍼(Primary Buffer)에 적재된 로우 중에서
   *    조건식을 불충족하는 로우들을 필터 버퍼(Filter Buffer)로 직접 강제 격리시킵니다.
   *    화면에는 프라이머리 버퍼에 잔류한 가시 행들만 리렌더링되며, 이후 정렬이나 갱신 시 버퍼 간의 로우 포인터가 직접 교환됩니다.
   *    이 방식은 원본 상태(메모리 데이터)를 물리적으로 나누고 상태를 분할 관리하므로 복원(Undo)이나 다차원 연동이 비직관적이었습니다.
   * 
   * 2. 현대 React 아키텍처의 파생 상태(Derived State) 및 선언형(Declarative) 필터링:
   *    React 환경에서는 단일 진실 공급원(Single Source of Truth) 원칙 하에, 원본 데이터 상태인 `gridData`를 절대로 훼손하지 않습니다.
   *    사용자가 필터 인풋을 입력할 때마다 `filterKeyword` 로컬 상태(State)만 변경해 주고,
   *    화면을 렌더링하기 직전에 원본 `gridData`를 스캔하여 조건에 맞는 행만 가공해서 생성하는 '파생 상태(Derived State)' 구조로 평가합니다.
   *    - `useMemo` 훅을 활용하여 `gridData`나 `filterKeyword`가 변하지 않았다면 이전 가공 데이터를 재사용(Memoization)해 렌더링 부하를 최소화합니다.
   *    - 데이터의 원본이 훼손되지 않으므로, 필터를 끄거나 키워드를 지우면 별도의 쿼리나 백업 복구 없이도 즉시 원본 전체 화면으로 복원됩니다.
   * 
   * 3. 인덱스 매핑의 해결:
   *    파워빌더 버퍼 필터링 시에는 `GetRow()`나 `rIdx` 등이 화면 가시 기준 인덱스로 고정되지만, 
   *    리액트에서는 `{ row, index }` 구조로 원본 `gridData` 내에서의 절대 인덱스(`index`)를 항상 내장하여 전달함으로써,
   *    필터링 작동 중에 데이터를 수정하고, 개별 복구(Undo)를 가동하고, 변경 카운팅을 유지하는 동작들이 인덱스 꼬임 현상 없이 100% 무결하게 작동합니다.
   */
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

  // // [Day 32 작업] dw_1.Retrieve(as_dept) 대응 조회 이벤트 핸들러
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

      // [Day 33 작업] 새로운 데이터를 조회할 때 각 행에 __originalIndex 고유 키를 순차 부여
      const updatedRows = filteredMock.map((mockItem, idx) => {
        const row = generateRowData(mockItem, parsedData.columns || []);
        row.__originalIndex = String(idx);
        return row;
      });
      
      // 조회 결과 반환 시 정렬 상태도 초기 상태('none')로 리셋하여 정렬 정합성 보장
      setSortConfig({ key: "", direction: "none" });
      // 필터 키워드 또한 조회 시 함께 리셋하여 데이터가 가려지지 않도록 보장
      setFilterKeyword("");
      
      // [Day 36 작업] 신규 조회 시 기존의 삭제 트랜잭션 버퍼 일괄 초기화
      setDeleteBuffer([]);

      // [Day 39 작업] 신규 조회 시 디테일 버퍼 및 변경사항 일괄 초기화
      setDetailData(JSON.parse(JSON.stringify(MOCK_DETAIL_DATA)));
      setDetailDeleteBuffer([]);
      setSelectedDetailRowIndex(0);
      initialDetailDataRef.current = JSON.parse(JSON.stringify(MOCK_DETAIL_DATA));

      setGridData(updatedRows);
      setIsLoading(false);
      onSelectRow(0); // 첫 번째 행 자동 선택

      // 조회 완료된 데이터셋 상태를 기준으로 변동 감지 버퍼 기준점 재초기화
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
    // 1. 순환 정렬 방향 설정: none -> asc -> desc -> none
    let nextDirection: "asc" | "desc" | "none" = "asc";
    if (sortConfig.key === colName) {
      if (sortConfig.direction === "asc") nextDirection = "desc";
      else if (sortConfig.direction === "desc") nextDirection = "none";
      else nextDirection = "asc";
    }

    setSortConfig({ key: colName, direction: nextDirection });

    // 2. 정렬 비교 함수(Comparator) 정의
    const compareFn = (a: { [key: string]: string }, b: { [key: string]: string }) => {
      // 정렬이 해제된 경우 원래 순서(__originalIndex) 기준으로 복구
      if (nextDirection === "none") {
        const idxA = parseInt(a.__originalIndex || "0", 10);
        const idxB = parseInt(b.__originalIndex || "0", 10);
        return idxA - idxB;
      }

      const valA = a[colName] ?? "";
      const valB = b[colName] ?? "";

      // 숫자형 컬럼인지 판별하여 값 기반 정렬 수행
      const isNum = isNumericColumn(parsedData.columns?.find((c) => c.name === colName)?.type || "");
      if (isNum) {
        const numA = parseFloat(valA.replace(/,/g, "")) || 0;
        const numB = parseFloat(valB.replace(/,/g, "")) || 0;
        return nextDirection === "asc" ? numA - numB : numB - numA;
      }

      // 문자열 컬럼의 경우 한국어 가나다 및 대소문자 구분 로캘(Locale) 정렬 대응
      return nextDirection === "asc"
        ? valA.localeCompare(valB, "ko", { numeric: true })
        : valB.localeCompare(valA, "ko", { numeric: true });
    };

    // 3. 삼중 버퍼 동시 정렬을 수행하여 인덱스 참조 정합성 보장
    const sortedGridData = [...gridData].sort(compareFn);
    const sortedInitial = [...initialGridDataRef.current].sort(compareFn);
    const sortedSnapshot = [...snapshotRef.current].sort(compareFn);

    setGridData(sortedGridData);
    initialGridDataRef.current = sortedInitial;
    snapshotRef.current = sortedSnapshot;

    // 첫 행 자동 선택으로 부드러운 전환 효과 제공
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
    // __originalIndex가 정상 주입된 상태에서만 snapshot 및 initial 상태 백업을 수행합니다.
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
      setFilterKeyword(""); // 리셋 시 필터 또한 리셋
      // [Day 36 작업] 전체 원복 시 삭제 버퍼도 비움으로써 트랜잭션 원복 보장
      setDeleteBuffer([]);
      // 비교용 reference 데이터 또한 초기 원본 상태로 동기화하여 변경 감지 카운터를 리셋합니다.
      initialGridDataRef.current = JSON.parse(JSON.stringify(snapshotRef.current));

      // [Day 39 작업] 전체 초기화 시 디테일 상태도 초기 원본 상태로 롤백
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
    // 비교용 reference의 해당 행 데이터 또한 원본 상태로 복구해 줍니다.
    if (initialGridDataRef.current[rIdx]) {
      initialGridDataRef.current[rIdx] = JSON.parse(JSON.stringify(originalRow));
    }
  };

  // [Day 36 작업] 파워빌더 dw_1.InsertRow 및 DeleteRow 버퍼 트랜잭션 메커니즘 React 포팅
  /*
   * 파워빌더 DWItemStatus 버퍼 트랜잭션 vs React 불변 상태 관리 대치 설명 (교육용 주석)
   * 
   * 1. 파워빌더 (레거시 C/S 아키텍처):
   *    - 파워빌더 데이터윈도우(DataWindow)는 내부적으로 4개의 버퍼(Primary!, Filter!, Delete!, Original!)를 관리합니다.
   *    - dw_1.InsertRow(0)를 수행하면 Primary! 버퍼에 새 행이 생성되고 상태는 New!가 되며, 이 행의 필드를 수정하면 NewModified!가 됩니다.
   *    - dw_1.DeleteRow(row)를 수행하면 Primary! 버퍼의 행이 Delete! 버퍼로 이동합니다. 단, 상태가 New! 또는 NewModified!였던 행은 DB 저장 대상이 아니므로 Delete! 버퍼로 가지 않고 소멸합니다.
   *    - dw_1.Update()가 트리거되면, Primary! 버퍼 내의 NewModified! 행은 INSERT 문을, DataModified! 행은 UPDATE 문을 생성하며, Delete! 버퍼 내의 행들은 DELETE 문을 생성하여 하나의 트랜잭션으로 DB에 일괄 전송됩니다.
   * 
   * 2. 현대 웹 React 아키텍처 (선언형/불변성 상태 추적):
   *    - 리액트는 상태의 불변성(Immutability)을 엄격히 준수하므로 메모리 주소를 직접 수정하지 않고, 상태 복사본을 만들어 교체하는 방식으로 UI를 업데이트합니다.
   *    - 파워빌더의 Primary! 버퍼는 리액트의 `gridData` 상태 배열로 매핑됩니다.
   *    - 파워빌더의 Delete! 버퍼는 리액트의 `deleteBuffer` 상태 배열로 명시적 분리되어 관리됩니다.
   *    - New! 및 NewModified! 상태 전이는 리액트 내부 행 객체의 `row_status` 프로퍼티("New" -> "NewModified")를 직접 제어하여 실시간 추적합니다.
   *    - dw_1.Update()에 해당하는 저장 기능(`handleSaveAndExtract`)은 이 두 개의 상태(`gridData`와 `deleteBuffer`)를 결합(Join/Reduce)하여
   *      최종 트랜잭션 JSON 데이터 패킷(Inserted/Updated/Deleted 플래그 포함)을 동적으로 재조합(Derived Data Structure)해 냅니다.
   *    - 이 방식은 메모리 버퍼 상태의 부수 효과(Side-Effect) 없이, 선언형 데이터 흐름을 통해 데이터 무결성을 100% 보장하는 현대 웹 아키텍처 표준입니다.
   */
  const handleInsertRow = () => {
    // 1. 파티셔닝된 컬럼 스펙에 의거해 기본 공백 값을 갖는 새 로우 객체 동적 빌드
    const newRow: { [key: string]: string } = {};
    (parsedData.columns || []).forEach((col) => {
      if (isNumericColumn(col.type)) {
        newRow[col.name] = "0";
      } else {
        newRow[col.name] = "";
      }
    });

    // 2. 파워빌더의 dw_1.InsertRow() 후 New! 상태를 부여하듯 초기 상태 'New' 명시
    newRow.row_status = "New";
    
    // 순서 정렬 복구 및 리액트 가상 돔(Virtual DOM) 렌더링 키값 매핑용 고유 original 인덱스 계산
    const maxOrgIdx = gridData.reduce((max, r) => {
      const idx = parseInt(r.__originalIndex || "0", 10);
      return idx > max ? idx : max;
    }, 0);
    newRow.__originalIndex = String(maxOrgIdx + 1);

    // 3. 현재 선택된 행 바로 아래에 신규 행을 밀어 넣고 즉각 포커스 이동 수행
    setGridData((prev) => {
      const next = [...prev];
      const insertIdx = selectedRowIndex >= 0 && selectedRowIndex <= prev.length 
        ? selectedRowIndex + 1 
        : prev.length;
      
      next.splice(insertIdx, 0, newRow);
      
      // 상태 갱신 마이크로태스크 완료 후 뷰포트 행 선택 동기화
      setTimeout(() => {
        onSelectRow(insertIdx);
      }, 0);
      
      return next;
    });
  };

  const handleDeleteRow = () => {
    if (selectedRowIndex < 0 || selectedRowIndex >= gridData.length) return;

    const rowToDelete = gridData[selectedRowIndex];

    // 1. 파워빌더 Delete! 버퍼 복제 알고리즘:
    // 신규 생성 후 커밋된 적 없는 New / NewModified 행은 삭제 시 DB 롤백 대상이 아니므로 버퍼에서 아예 제거하고,
    // 기존에 DB로부터 로드되었던 행들만 deleteBuffer 상태에 쌓아 Deleted 트랜잭션을 예약합니다.
    if (rowToDelete.row_status !== "New" && rowToDelete.row_status !== "NewModified") {
      const { __originalIndex, row_status, ...cleanRow } = rowToDelete;
      
      const deletedItem: DeletedRowInfo = {
        row_no: selectedRowIndex + 1,
        row_status: "Deleted",
        data: cleanRow,
      };
      
      setDeleteBuffer((prev) => [...prev, deletedItem]);
    }

    // 2. 화면 가시 뷰포트(Primary Buffer 역할)에서 해당 행 제거
    setGridData((prev) => {
      const next = prev.filter((_, idx) => idx !== selectedRowIndex);
      
      // 3. 인접 행으로의 포커스 전환 보정
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
  /*
   * 파워빌더 레거시 RowFocusChanged & ShareData vs 현대 웹 React 선언형 상태 매핑 비교 (교육용 주석)
   *
   * 1. 파워빌더 (레거시 C/S 아키텍처):
   *    - 파워빌더에서는 dw_master의 RowFocusChanged 이벤트가 발생할 때, 현재 선택된 행의 Key(예: emp_id)를 읽어
   *      dw_detail.Retrieve(ll_id)를 호출하여 데이터베이스로부터 상세 테이블을 매번 조회했습니다.
   *    - 혹은 메모리 상의 공유 버퍼를 사용하기 위해 dw_master.ShareData(dw_detail)을 선언하여
   *      동일한 데이터 소스를 필터링 규칙만 달리하여 마스터와 디테일 뷰포트에 각각 분리 매핑했습니다.
   *    - 이 방식은 명령형(Imperative) 흐름을 따라 개발자가 명시적으로 이벤트를 잡아서 UI 컴포넌트의 API를 직접 제어해야 했으므로,
   *      상태 변화의 시점이나 버퍼의 동기화 실수가 발생할 여지가 높았습니다.
   *
   * 2. 현대 웹 React 아키텍처 (선언형/Reactive 아키텍처):
   *    - React 환경에서는 상태(State)의 선언적 흐름을 따릅니다.
   *      부모 컴포넌트나 상위 상태에 존재하는 `selectedRowIndex` 상태값이 키보드/마우스 동작으로 변화되면,
   *      이를 감지하여 렌더링 파이프라인에서 자동으로 마스터의 ID(`currentEmpId`)에 해당하는 디테일 데이터(`detailData[currentEmpId]`)를 매핑합니다.
   *      즉, 리액트에서는 상태 변화에 따른 하위 상태 필터링 연산 및 계층 구조 불변성 객체 그래프(State Graph) 제어 기술로 완벽히 상호 대치됩니다.
   *    - 개발자가 "선택된 행이 바뀌었으니 디테일 뷰를 갱신하라"고 dw_detail.Retrieve()처럼 명령할 필요 없이,
   *      단지 "현재 디테일 뷰는 currentEmpId에 종속된 detailData 상태를 그린다"라고 선언해 두면 리액트 엔진이 알아서 화면을 동기화합니다.
   *    - 또한 디테일 버퍼의 데이터 수정 내역도 React의 단방향 데이터 흐름을 따르므로 상태 복사를 통해 불변성이 유지되며,
   *      최종 저장 버튼 시점에 전체 계층 그래프(State Graph)를 조립하는 것으로 마스터와 디테일의 상태가 무결하게 통합됩니다.
   */

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

    // 기존에 DB/Mock에 존재하던 데이터만 삭제 버퍼에 추가
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

  // [Day 39 작업] 마스터-디테일 계층형 트랜잭션 빌더 (dw_master & dw_detail Update)
  const handleSaveAndExtract = () => {
    // [Day 35 작업] 저장 및 추출 시점에 최종적으로 에러 상태를 점검하여 추출을 제한합니다.
    const errorKeys = Object.keys(validationErrors);
    if (errorKeys.length > 0) {
      const errorMsg = errorKeys
        .map((k) => validationErrors[Number(k)])
        .join("\n");
      setDumpOutput(errorMsg);
      return;
    }

    const hierarchyPacket: any[] = [];

    // 1. 마스터 데이터 기준 스캔
    gridData.forEach((masterRow, rIdx) => {
      const masterEmpId = masterRow.emp_id || masterRow.id || "";
      const { __originalIndex, row_status, ...cleanMasterRow } = masterRow;
      
      const isMasterMod = isRowModified(masterRow, rIdx);
      const isNewMasterMod = masterRow.row_status === "NewModified";

      // 디테일 변경사항(추가, 수정, 삭제) 수집
      const currentDetails = detailData[masterEmpId] || [];
      const initialDetails = initialDetailDataRef.current[masterEmpId] || [];
      const detailChanges: any[] = [];

      // 추가 및 수정된 디테일 감지
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

      // 삭제된 디테일 감지 (현재 마스터에 종속된 것만 수집)
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

      // 마스터가 변경되었거나, 디테일이 변경된 경우 계층형 패킷에 추가
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
      // 삭제된 마스터에 종속되어 삭제된 디테일이 있다면 함께 수집
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

    if (hierarchyPacket.length === 0) {
      setDumpOutput(
        JSON.stringify(
          {
            message: "변경사항이 존재하지 않습니다.",
            status: "NO_CHANGES",
            timestamp: new Date().toISOString(),
          },
          null,
          2
        )
      );
    } else {
      // 행 번호(row_no) 기준으로 정렬하여 가독성 높은 순차 구조로 덤프 출력
      const sortedPacket = [...hierarchyPacket].sort((a, b) => a.row_no - b.row_no);
      setDumpOutput(JSON.stringify(sortedPacket, null, 2));
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
    return editCount + deleteBuffer.length;
  }, [gridData, deleteBuffer]);

  return (
    <section className="bg-slate-950/80 border border-slate-900 rounded-2xl overflow-hidden shadow-2xl p-5 flex flex-col gap-4">
      {/* 타이틀 구역 및 수정 카운터 뱃지 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-white">
            💻 웹 변환 화면 프리뷰 (Grid Preview)
          </h3>
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border transition-all ${
              modifiedRowsCount > 0
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.2)] animate-pulse"
                : "bg-slate-900/60 text-slate-500 border-slate-800"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${modifiedRowsCount > 0 ? "bg-emerald-400" : "bg-slate-600"}`}></span>
            수정 중인 행: {modifiedRowsCount}건
          </span>
          {/* [Day 36 작업] 다크 네온 스타일 행 추가 및 행 삭제 버튼 */}
          <button
            onClick={handleInsertRow}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold border border-cyan-500/30 bg-cyan-950/80 text-cyan-400 hover:bg-cyan-900/50 hover:text-cyan-300 hover:shadow-[0_0_8px_rgba(34,211,238,0.4)] transition-all cursor-pointer"
            title="새 공백 데이터 행을 추가합니다 (dw_1.InsertRow)."
          >
            행 추가 ➕
          </button>
          <button
            onClick={handleDeleteRow}
            disabled={gridData.length === 0 || selectedRowIndex < 0 || selectedRowIndex >= gridData.length}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold border transition-all ${
              gridData.length > 0 && selectedRowIndex >= 0 && selectedRowIndex < gridData.length
                ? "border-pink-500/30 bg-pink-950/80 text-pink-400 hover:bg-pink-900/50 hover:text-pink-300 hover:shadow-[0_0_8px_rgba(244,63,94,0.4)] cursor-pointer"
                : "border-slate-900 bg-slate-950 text-slate-700 cursor-not-allowed"
            }`}
            title="현재 선택된 행을 즉시 삭제합니다 (dw_1.DeleteRow)."
          >
            행 삭제 ➖
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
            title="모든 변경 사항을 최초 데모 데이터 상태로 초기화합니다."
          >
            전체 초기화 ↺
          </button>
          {/* 저장 및 데이터 추출 버튼 */}
          <button
            onClick={handleSaveAndExtract}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold border border-emerald-500/30 bg-emerald-950/80 text-emerald-400 hover:bg-emerald-900/50 hover:text-emerald-300 transition-all cursor-pointer"
            title="변경된 데이터셋을 JSON 패킷으로 추출합니다."
          >
            저장 및 데이터 추출 💾
          </button>
        </div>
      </div>

      {/* [Day 32 작업] 파워빌더 Retrieval Argument 아규먼트 입력을 상징하는 다크 네온 스타일 조회 조건 바 */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-[#0d1527]/90 border border-indigo-950/60 rounded-xl shadow-lg relative overflow-hidden">
        {/* 네온 백그라운드 빛 효과 */}
        <div className="absolute -top-10 -left-10 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none"></div>
        <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl pointer-events-none"></div>

        <div className="flex items-center gap-4 flex-wrap z-10">
          {/* 부서선택 드롭다운 */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase tracking-wider">as_dept</span>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="bg-slate-950 border border-slate-800 hover:border-indigo-500/50 focus:border-indigo-500 text-xs text-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition-all cursor-pointer"
            >
              <option value="전체">전체 부서</option>
              <option value="개발팀">개발팀 (R&D)</option>
              <option value="영업팀">영업팀 (Sales)</option>
              <option value="인사팀">인사팀 (HR)</option>
            </select>
          </div>

          {/* 검색어 입력창 */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase tracking-wider">as_keyword</span>
            <input
              type="text"
              placeholder="사원명 또는 사번 입력..."
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

        {/* 다크 네온 스타일 조회 버튼 */}
        <button
          onClick={handleRetrieve}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-4.5 py-1.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-[length:200%_auto] hover:bg-right hover:scale-[1.02] text-xs text-white font-extrabold rounded shadow-[0_0_12px_rgba(99,102,241,0.35)] hover:shadow-[0_0_20px_rgba(168,85,247,0.6)] border border-indigo-500/20 active:scale-95 transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed z-10"
        >
          <span>조회</span>
          <span>🔍</span>
        </button>
      </div>

      {/* [Day 34 작업] 결과 내 필터링 인풋 입력 UI 컴포넌트 추가 (다크 네온 디자인) */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-[#0a0f1d]/90 border border-cyan-950/60 rounded-xl shadow-lg relative overflow-hidden">
        {/* 네온 백그라운드 빛 효과 */}
        <div className="absolute -top-10 -left-10 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none"></div>
        <div className="flex items-center gap-2 z-10">
          <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider">dw_1.Filter()</span>
          <span className="text-xs text-slate-300 font-bold">결과 내 실시간 필터링 🔍</span>
        </div>
        <div className="relative flex items-center z-10 w-full sm:w-72">
          <input
            type="text"
            placeholder="필터 키워드 입력 (전체 컬럼 검색)..."
            value={filterKeyword}
            onChange={(e) => setFilterKeyword(e.target.value)}
            className="bg-slate-950 border border-slate-800 hover:border-cyan-500/50 focus:border-cyan-500 text-xs text-slate-300 placeholder-slate-600 rounded px-3 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all pl-8 shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]"
          />
          <span className="absolute left-2.5 text-xs text-cyan-500 pointer-events-none">🔍</span>
          {filterKeyword && (
            <button
              onClick={() => setFilterKeyword("")}
              className="absolute right-2 text-xs text-slate-500 hover:text-slate-300 focus:outline-none cursor-pointer"
              title="필터 키워드 초기화"
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
            {/* 회전하는 다크 네온 링 */}
            <div className="w-9 h-9 rounded-full border-[3px] border-indigo-500/10 border-t-indigo-500 animate-spin shadow-[0_0_15px_rgba(99,102,241,0.4)]"></div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-xs font-bold text-indigo-400 tracking-wide animate-pulse">데이터 조회 중...</span>
              <span className="text-[9px] font-mono text-slate-500">Retrieving...</span>
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
                No.
              </th>
              {(parsedData.columns || []).map((c, i) => {
                const isFrozen = i < 2; // 맨 앞 2개 핵심 컬럼 고정
                const leftOffset = isFrozen ? getFrozenLeftOffset(i) : undefined;
                const isLastFrozen = i === 1; // 마지막 고정 열 우측 경계선 처리

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
                    title="클릭하여 순환 정렬 (기본값 ➔ 오름차순 ➔ 내림차순)"
                  >
                    <div className="flex items-center justify-between gap-2 mr-2">
                      <span>{c.label || c.name}</span>
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
                      title="드래그하여 너비 조절"
                    />
                  </th>
                );
              })}
              {(parsedData.computedFields || []).map((comp, i) => (
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
                    title="드래그하여 너비 조절"
                  />
                </th>
              ))}
              {/* 제어 열 헤더 추가 */}
              <th className="p-3 text-center text-slate-400 font-bold border-l border-slate-900/40 bg-slate-900" style={{ width: "80px" }}>
                제어
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-900 text-slate-300">
            {/* [Day 34 작업] 실시간 필터링 결과 및 원본 부재 시의 조건부 렌더링 대응 */}
            {gridData.length === 0 ? (
              <tr>
                <td colSpan={(parsedData.columns?.length || 0) + (parsedData.computedFields?.length || 0) + 2} className="p-8 text-center text-slate-500 italic">
                  조회 결과 데이터가 존재하지 않습니다. 상단 조건바에서 조회해 주십시오.
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={(parsedData.columns?.length || 0) + (parsedData.computedFields?.length || 0) + 2} className="p-8 text-center text-cyan-400 bg-slate-950/80 border border-cyan-900/30 font-medium italic">
                  🔍 필터링 조건에 부합하는 데이터가 존재하지 않습니다. (검색어: &quot;{filterKeyword}&quot;)
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

                      // [Day 38 작업] 0, 1번째 핵심 데이터 컬럼 sticky 고정 연동
                      const isFrozen = cIdx < 2;
                      const leftOffset = isFrozen ? getFrozenLeftOffset(cIdx) : undefined;
                      const isLastFrozen = cIdx === 1;

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

                        // [Day 34 작업] 필터링 조건에서도 정합성을 잃지 않는 4방향 키보드 이동 및 엔터 핸들러
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
                                    // [Day 36 작업] 신규 행 수정 시 상태를 NewModified로 변경
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
                                    // [Day 36 작업] 신규 행 수정 시 상태를 NewModified로 변경
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
                                  // [Day 36 작업] 신규 행 수정 시 상태를 NewModified로 변경
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
                    {/* 행 단위 개별 Undo 버튼 분기 구역 */}
                    <td className="p-1 border-l border-slate-900/40 text-center w-20" style={{ width: "80px" }}>
                      {isModified && (
                        <button
                          onClick={() => handleUndoRow(rIdx)}
                          className="px-2 py-0.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 hover:text-amber-400 border border-amber-500/20 rounded text-[10px] font-bold transition-all opacity-70 animate-pulse cursor-pointer"
                          title="이 행의 수정을 취소하고 원래 상태로 되돌립니다."
                        >
                          원복
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

      {/* [Day 39 작업] 다크 네온 스타일 [상세 내역 (Detail View)] 서브 뷰포트 레이아웃 */}
      <div className="mt-4 p-5 bg-slate-950/90 border border-pink-950/60 rounded-2xl shadow-2xl relative overflow-hidden flex flex-col gap-3">
        {/* 다크 네온 핑크 장식 효과 */}
        <div className="absolute -top-10 -right-10 w-24 h-24 bg-pink-500/5 rounded-full blur-2xl pointer-events-none"></div>
        
        <div className="flex items-center justify-between border-b border-pink-900/20 pb-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse"></span>
            <h4 className="text-xs font-bold text-pink-400 font-mono tracking-wide">
              [상세 내역 (Detail View) - 사원번호: {currentEmpId || "선택 없음"}]
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
              title="현재 마스터에 예속된 새로운 상세 데이터 행을 추가합니다 (dw_detail.InsertRow)."
            >
              상세 추가 ➕
            </button>
            <button
              onClick={handleDeleteDetailRow}
              disabled={!currentEmpId || !detailData[currentEmpId] || detailData[currentEmpId].length === 0 || selectedDetailRowIndex < 0 || selectedDetailRowIndex >= (detailData[currentEmpId]?.length || 0)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold border transition-all ${
                currentEmpId && detailData[currentEmpId] && detailData[currentEmpId].length > 0 && selectedDetailRowIndex >= 0 && selectedDetailRowIndex < detailData[currentEmpId].length
                  ? "border-purple-500/30 bg-purple-950/80 text-purple-400 hover:bg-purple-900/50 hover:text-purple-300 hover:shadow-[0_0_8px_rgba(168,85,247,0.4)] cursor-pointer"
                  : "border-slate-900 bg-slate-950 text-slate-700 cursor-not-allowed"
              }`}
              title="선택된 상세 데이터를 삭제합니다 (dw_detail.DeleteRow)."
            >
              상세 삭제 ➖
            </button>
          </div>
        </div>

        {/* 디테일 테이블 */}
        <div className="overflow-x-auto overflow-y-auto border border-pink-950/30 rounded-xl max-h-[200px] scrollbar-thin">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#120712] text-pink-500 font-bold sticky top-0 border-b border-pink-950/40 z-10">
              <tr>
                <th className="p-2.5 text-center font-mono" style={{ width: "80px" }}>일련번호</th>
                <th className="p-2.5 font-mono">관계</th>
                <th className="p-2.5 font-mono">이름</th>
                <th className="p-2.5 font-mono">생년월일</th>
                <th className="p-2.5 font-mono">비고</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pink-950/20 text-slate-300 bg-slate-950/40">
              {!currentEmpId ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500 italic">
                    마스터 그리드에서 직원을 선택해 주십시오.
                  </td>
                </tr>
              ) : !detailData[currentEmpId] || detailData[currentEmpId].length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500 italic">
                    등록된 상세 내역이 없습니다. [상세 추가] 버튼으로 등록해 주십시오.
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
                          placeholder="예: 배우자, 자녀"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="text"
                          value={detRow.name}
                          onChange={(e) => handleDetailCellChange(detRow.seq, "name", e.target.value)}
                          className="w-full bg-transparent px-2 py-1 text-xs border-0 text-white focus:outline-none focus:ring-1 focus:ring-pink-500 rounded"
                          placeholder="이름 입력"
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
                          placeholder="비고 입력"
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
          {/* 복사 완료 알림 레이아웃 */}
          {copied && (
            <div className="absolute top-12 right-4 bg-emerald-950 text-emerald-300 border border-emerald-400/50 px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-bounce z-10 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              <span>복사 완료! 📋</span>
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
                  ? "[VALIDATION ERROR LOG] - 실시간 데이터 유효성 검증 오류"
                  : "[TRANSACTION DATA DUMP] - dw_1.Update() Buffer JSON Output"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {!dumpOutput.includes("[VALIDATION ERROR]") && (
                <>
                  <button
                    onClick={handleCopyToClipboard}
                    className="text-emerald-400 hover:text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/50 px-2.5 py-1 rounded border border-emerald-500/30 text-[10px] font-bold cursor-pointer transition-all flex items-center gap-1 hover:shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                    title="추출된 JSON 문자열을 클립보드에 원클릭 복사합니다."
                  >
                    클립보드 복사 📋
                  </button>
                  <button
                    onClick={handleDownloadJSON}
                    className="text-cyan-400 hover:text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/50 px-2.5 py-1 rounded border border-cyan-500/30 text-[10px] font-bold cursor-pointer transition-all flex items-center gap-1 hover:shadow-[0_0_8px_rgba(34,211,238,0.4)]"
                    title="추출된 JSON 파일을 로컬 디스크로 즉시 다운로드합니다."
                  >
                    JSON 다운로드 💾
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
                닫기 ✕
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
