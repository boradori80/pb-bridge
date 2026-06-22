// [Day 21 작업] 데이터윈도우 웹 변환 그리드 프리뷰 컴포넌트
// [Day 32 작업] 상단 Retrieval Argument 조회 바 및 동적 데이터 바인딩 고도화
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

export default function GridPreview({
  parsedData,
  gridData,
  setGridData,
  argValues,
  selectedRowIndex,
  onSelectRow,
}: GridPreviewProps) {
  // [Day 32 작업] 동적 조회(Retrieve) 및 필터링 관련 React 로컬 상태 관리
  const [selectedDept, setSelectedDept] = React.useState<string>("전체");
  const [searchKeyword, setSearchKeyword] = React.useState<string>("김개발"); // 사용성 향상을 위한 초기 기본값 지정
  const [isLoading, setIsLoading] = React.useState<boolean>(false);

  // [Day 24 작업] 초기 gridData 백업 및 비교를 위한 레퍼런스
  const snapshotRef = React.useRef<Array<{ [key: string]: string }>>([]);
  const initialGridDataRef = React.useRef<Array<{ [key: string]: string }>>([]);
  const prevParsedDataRef = React.useRef<any>(null);

  // [Day 29 작업] 추출된 JSON 마스터 패킷 저장용 상태
  const [dumpOutput, setDumpOutput] = React.useState<string | null>(null);
  // [Day 30 작업] 클립보드 복사 완료 상태 관리용 토스트 플래그
  const [copied, setCopied] = React.useState<boolean>(false);

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

  // // [Day 32 작업] dw_1.Retrieve(as_dept) 대응 조회 이벤트 핸들러
  /*
   * 파워빌더 dw_1.Retrieve(as_dept)와 현대 웹 React의 State 단방향 데이터 흐름 비교 (교육용 설명)
   * 
   * 1. 파워빌더(레거시 C/S)의 Retrieve 아규먼트 바인딩 방식:
   *    과거 C/S 환경인 파워빌더에서는 dw_1.Retrieve("개발팀")과 같이 데이터 아규먼트(Retrieval Arguments)를 주입하면
   *    내부 DataWindow Engine이 DB 접속 커넥션을 점유한 상태로 `SELECT ... WHERE dept = :as_dept` 구문의 
   *    플레이스홀더(:as_dept)에 매개변수를 직접 바인딩하여 쿼리를 수행하고 결과 레코드를 1:1로 클라이언트 메모리 버퍼에 적재했습니다.
   *    이 방식은 DB 의존적이며 동기식 처리가 일반적이어서, 조회 연산 중 화면이 먹통이 되거나 동시성 제어가 어려웠습니다.
   * 
   * 2. 현대 웹 표준 React 아키텍처의 클라이언트 사이드 State 필터링 및 단방향 데이터 흐름:
   *    현대적인 웹 브라우저 환경에서는 DB에 직접 질의하지 않고 백엔드 API 서버를 비동기로 호출(Asynchronous fetch)하거나,
   *    클라이언트 사이드에서 불변 상태 객체(Immutable State)를 가공 및 필터링하여 UI를 동적으로 리렌더링하는 
   *    선언형 데이터 제어 패러다임을 따릅니다.
   *    본 컴포넌트에서는 파워빌더 개발자들의 직관적인 이해를 돕기 위해 아래와 같은 구조로 대치 구현되었습니다:
   *    
   *    - 비동기 로딩 시뮬레이션 (0.3초):
   *      실제 네트워크 통신에 따른 응답 지연을 재현하고자 `isLoading` 상태를 활성화하고 `setTimeout`을 통해 
   *      0.3초간 그리드 뷰포트에 '데이터 조회 중...' 스피너 오버레이를 표출하여 웹 ERP 사양의 UX를 보장합니다.
   * 
   *    - 클라이언트 사이드 불변 상태 필터링 (State Filtering):
   *      Dropdown 및 Input 상태(selectedDept, searchKeyword)를 단방향 데이터 바인딩 형태로 참조하여 
   *      `MOCK_MASTER_DATA` 배열 내에서 원하는 조건의 행들만 신속하게 필터링합니다.
   * 
   *    - 버퍼 기준점 동화(Snapshot Synchronization):
   *      필터링된 새로운 데이터셋을 상위 Props 콜백인 `setGridData`를 통해 변경(Mutation)해준 뒤,
   *      기존의 수정 변동 여부 감지 로직이 오차 없이 작동하도록 복원/비교용 버퍼 레퍼런스(`snapshotRef.current`, `initialGridDataRef.current`)를
   *      새로 조회된 결과 데이터셋의 복제본(Deep Copy)으로 즉시 덮어씌워 동기화합니다.
   */
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

      const updatedRows = filteredMock.map((mockItem) => generateRowData(mockItem, parsedData.columns || []));
      
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

  React.useEffect(() => {
    // 컴포넌트가 처음 로드될 때 gridData의 최초 상태를 딥 카피하여 저장합니다.
    if (snapshotRef.current.length === 0 && gridData.length > 0) {
      snapshotRef.current = JSON.parse(JSON.stringify(gridData));
    }
  }, [gridData]);

  React.useEffect(() => {
    // parsedData가 변경되었거나, 상위에서 gridData의 로드/리셋으로 길이가 달라진 경우 초기 캡처를 수행합니다.
    if (
      prevParsedDataRef.current !== parsedData ||
      initialGridDataRef.current.length !== gridData.length ||
      initialGridDataRef.current.length === 0
    ) {
      initialGridDataRef.current = JSON.parse(JSON.stringify(gridData));
      prevParsedDataRef.current = parsedData;
    }
  }, [parsedData, gridData]);

  // [Day 25 작업] 전체 초기화(Reset) 핸들러
  const handleResetAll = () => {
    if (snapshotRef.current.length > 0) {
      const resetSnapshot = JSON.parse(JSON.stringify(snapshotRef.current));
      setGridData(resetSnapshot);
      // 비교용 reference 데이터 또한 초기 원본 상태로 동기화하여 변경 감지 카운터를 리셋합니다.
      initialGridDataRef.current = JSON.parse(JSON.stringify(snapshotRef.current));
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

  // [Day 29 작업] 데이터 추출 핸들러 및 파워빌더 dw_1.Update() 메커니즘 연동
  const handleSaveAndExtract = () => {
    const modifiedRows = gridData
      .map((row, rIdx) => {
        const originalRow = initialGridDataRef.current[rIdx];
        if (!originalRow) return null;
        
        const isModified = (parsedData.columns || []).some((col) => {
          const currentVal = row[col.name] ?? "";
          const originalVal = originalRow[col.name] ?? "";
          return currentVal !== originalVal;
        });

        if (isModified) {
          return {
            row_no: rIdx + 1,
            data: row,
          };
        }
        return null;
      })
      .filter((item): item is { row_no: number; data: { [key: string]: string } } => item !== null);

    if (modifiedRows.length === 0) {
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
      setDumpOutput(JSON.stringify(modifiedRows, null, 2));
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

  // [Day 24 작업] 실시간 변경된 행의 총 개수 계산
  const modifiedRowsCount = gridData.reduce((count, row, rIdx) => {
    return count + (isRowModified(row, rIdx) ? 1 : 0);
  }, 0);

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

        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-900 text-slate-400 font-bold sticky top-0 border-b border-slate-900 z-10">
            <tr
              style={{
                height: parsedData?.bands?.header
                  ? `${parsedData.bands.header / 2}px`
                  : "44px",
              }}
            >
              <th className="p-3 text-center w-12 bg-slate-900">No.</th>
              {(parsedData.columns || []).map((c, i) => (
                <th
                  key={i}
                  className={`p-3 font-mono text-slate-300 bg-slate-900 ${getAlignClass(
                    c.alignment
                  )}`}
                >
                  {c.label || c.name}
                </th>
              ))}
              {(parsedData.computedFields || []).map((comp, i) => (
                <th key={i} className="p-3 text-amber-400 bg-indigo-950/20">
                  🧮 {comp.label || comp.name}
                </th>
              ))}
              {/* 제어 열 헤더 추가 */}
              <th className="p-3 text-center w-20 text-slate-400 font-bold border-l border-slate-900/40 bg-slate-900">
                제어
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-900 text-slate-300">
            {gridData.length === 0 ? (
              <tr>
                <td colSpan={(parsedData.columns?.length || 0) + (parsedData.computedFields?.length || 0) + 2} className="p-8 text-center text-slate-500 italic">
                  조회 결과 데이터가 존재하지 않습니다. 상단 조건바에서 조회해 주십시오.
                </td>
              </tr>
            ) : (
              gridData.map((row, rIdx) => {
                const isModified = isRowModified(row, rIdx);
                const isSelected = selectedRowIndex === rIdx;
                const rowBgClass = isSelected
                  ? "bg-indigo-600/10 border-y border-indigo-500/30 font-bold"
                  : isModified
                  ? "bg-emerald-950/10 hover:bg-emerald-950/20"
                  : "hover:bg-slate-800/40";

                return (
                  <tr
                    key={rIdx}
                    style={{
                      height: parsedData?.bands?.detail
                        ? `${parsedData.bands.detail / 2}px`
                        : "40px",
                    }}
                    onClick={() => onSelectRow(rIdx)}
                    className={`transition-all font-mono cursor-pointer ${rowBgClass}`}
                  >
                    <td className={`p-3 text-center transition-all ${
                      isModified 
                        ? "border-l-4 border-l-emerald-500 bg-emerald-950/20 text-emerald-400 font-bold" 
                        : "text-slate-600"
                    }`}>
                      {rIdx + 1}
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
                          const rowsCount = gridData.length;

                          if (e.key === "ArrowDown") {
                            e.preventDefault();
                            let nextRow = rIdx + 1;
                            while (nextRow < rowsCount) {
                              const target = document.querySelector(
                                `input[data-row="${nextRow}"][data-col="${col.name}"]`
                              ) as HTMLInputElement | null;
                              if (target && !target.readOnly && target.tabIndex !== -1) {
                                target.focus();
                                onSelectRow(nextRow);
                                break;
                              }
                              nextRow++;
                            }
                          } else if (e.key === "ArrowUp") {
                            e.preventDefault();
                            let prevRow = rIdx - 1;
                            while (prevRow >= 0) {
                              const target = document.querySelector(
                                `input[data-row="${prevRow}"][data-col="${col.name}"]`
                              ) as HTMLInputElement | null;
                              if (target && !target.readOnly && target.tabIndex !== -1) {
                                target.focus();
                                onSelectRow(prevRow);
                                break;
                              }
                              prevRow--;
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
                            let targetFound = false;

                            let nextRow = rIdx + 1;
                            while (nextRow < rowsCount) {
                              const target = document.querySelector(
                                `input[data-row="${nextRow}"][data-col="${col.name}"]`
                              ) as HTMLInputElement | null;
                              if (target && !target.readOnly && target.tabIndex !== -1) {
                                target.focus();
                                targetFound = true;
                                break;
                              }
                              nextRow++;
                            }

                            if (!targetFound) {
                              let startRow = rIdx;
                              let startCol = cIdx + 1;
                              for (let r = startRow; r < rowsCount; r++) {
                                const startC = (r === startRow) ? startCol : 0;
                                for (let c = startC; c < columnsCount; c++) {
                                  const targetCol = parsedData.columns[c];
                                  const target = document.querySelector(
                                    `input[data-row="${r}"][data-col="${targetCol.name}"]`
                                  ) as HTMLInputElement | null;
                                  if (target && !target.readOnly && target.tabIndex !== -1) {
                                    target.focus();
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
                                  if (next[rIdx]) next[rIdx][col.name] = e.target.value;
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
                                  if (next[rIdx]) next[rIdx][col.name] = val;
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
                                  if (next[rIdx]) next[rIdx][col.name] = e.target.value;
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
                        <td key={cIdx} className="p-1 border-r border-slate-900/40">
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
                        >
                          {typeof res === "number" ? res.toLocaleString() : res}
                        </td>
                      );
                    })}
                    {/* 행 단위 개별 Undo 버튼 분기 구역 */}
                    <td className="p-1 border-l border-slate-900/40 text-center w-20">
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

      {/* TRANSACTION DATA DUMP 로그 터미널 레이어 */}
      {dumpOutput && (
        <div className="mt-4 bg-black border border-emerald-900/50 rounded-xl p-4 font-mono text-xs text-emerald-400 flex flex-col gap-2 relative shadow-2xl transition-all">
          {/* 복사 완료 알림 레이아웃 */}
          {copied && (
            <div className="absolute top-12 right-4 bg-emerald-950 text-emerald-300 border border-emerald-400/50 px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-bounce z-10 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              <span>복사 완료! 📋</span>
            </div>
          )}
          <div className="flex items-center justify-between border-b border-emerald-900/30 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-bold text-emerald-300">
                [TRANSACTION DATA DUMP] - dw_1.Update() Buffer JSON Output
              </span>
            </div>
            <div className="flex items-center gap-2">
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
              <button
                onClick={() => setDumpOutput(null)}
                className="text-emerald-500 hover:text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900/50 px-2.5 py-1 rounded border border-emerald-500/20 text-[10px] font-bold cursor-pointer transition-all"
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
