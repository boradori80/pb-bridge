// [Day 54 작업] 통합 ERP 마스터 대시보드 구축 및 컴포넌트 간 실시간 이벤팅 동기화 파이프라인
// 파워빌더 레거시 메인 윈도우(Window)와 가상 유저오브젝트(UserObject) 간 이벤팅 교신 방식을 현대 웹 표준 React 아키텍처로 전면 개편합니다.

"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ParsedPB } from "./types";
import { parsePBFile } from "./utils/parser";

// 4대 핵심 독립 컴포넌트 모듈 임포트
import TreeView, { TreeNodeData } from "./components/TreeView";
import GridPreview from "./components/GridPreview";
import DualListbox, { DualListboxItem } from "./components/DualListbox";
import ColorPicker from "./components/ColorPicker";

// 보조 샌드박스 및 지원 컴포넌트
import SourceEditor from "./components/SourceEditor";
import ParsingSummary from "./components/ParsingSummary";
import SqlEditor from "./components/SqlEditor";
import FormPreview from "./components/FormPreview";

/**
 * [Day 54 작업] 레거시 파워빌더 vs 현대 React 이벤팅 오케스트레이션 아키텍처 비교 해설
 *
 * 1. 레거시 파워빌더 (윈도우 ↔ 유저오브젝트 간 절차적 이벤트 버스 스크립트):
 *    - 파워빌더 C/S 환경에서는 메인 윈도우(`w_master`) 위에 여러 유저 오브젝트(`uo_tree`, `uo_grid`, `uo_detail`)를 배치한 후,
 *      자식 컨트롤 내부에서 `w_master.TriggerEvent("ue_dept_changed")` 또는 `uo_grid.Retrieve(ls_dept)`와 같이
 *      글로벌 이벤트 버스 및 동기식 함수 호출 스크립트를 직접 교차 실행(Cross-Calling)했습니다.
 *    - 데이터와 UI 컨트롤 간의 결합도가 매우 높아 상호 참조(Circular Reference) 오류 및 널 포인터 예외가 자주 발생했으며,
 *      윈도우 메세지 큐(Message Queue) 조작 시 예기치 못한 스크립트 실행 순서 꼬임으로 인한 버그 추적이 극도로 까다로웠습니다.
 *
 * 2. 현대 웹 표준 React 아키텍처 (단방향 데이터 흐름, 상태 끌어올리기 및 콜백 프로퍼티 바인딩):
 *    - 현대적인 React 기반 ERP 아키텍처에서는 중앙 상위 컴포넌트(`PBBridgeDashboard`)가 단일 진실 공급원(Single Source of Truth)으로서
 *      전체 워크스페이스의 도메인 상태(`selectedDept`, `selectedRowIndex`, `themeHex` 등)를 총괄 관리합니다 (Lifting State Up).
 *    - 데이터는 언제나 상위에서 하위 컴포넌트로 단방향(Unidirectional Data Flow)으로만 흐르며,
 *      자식 컴포넌트에서의 상태 변경 요청은 전달받은 콜백 프로퍼티(Callback Props: `onNodeSelect`, `onSelectRow`, `onChange`)를 통해 상위로 전출됩니다.
 *    - 상위 상태가 업데이트되면 가상 DOM(Virtual DOM) 알고리즘이 전체 4대 컴포넌트의 연동 영역을 실시간으로 감지하여
 *      최소 비용으로 즉각 동기화(Re-rendering)합니다.
 *
 * 표준 IPA 발음 기호 준수 가이드:
 *  - 대시보드 ➔ [ˈdæʃbɔːrd]
 *  - 아키텍처 ➔ [ˈɑːrkɪtektʃər]
 *  - 이벤팅 ➔ [ɪˈventɪŋ]
 *  - 파이프라인 ➔ [ˈpaɪplaɪn]
 *  - 컴포넌트 ➔ [kəmˈpoʊnənt]
 *  - 프론트엔드 ➔ [ˈfrʌntend]
 *  - 콜백 ➔ [ˈkɔːlbæk]
 *  - 프로퍼티 ➔ [ˈprɑːpərti]
 *  - 데이터 ➔ [ˈdeɪtə]
 *  - 포커스 ➔ [ˈfoʊkəs]
 *  - 상태 ➔ [steɪt]
 *  - 트리 뷰 ➔ [ˈtriːvjuː]
 *  - 그리드 ➔ [ɡrɪd]
 *  - 리스트박스 ➔ [ˈlɪstbɑːks]
 *  - 선택기 ➔ [ˈpɪkər]
 */

// 초기 데모 마스터 데이터셋 (10명 사원 원장)
const MOCK_MASTER_EMPLOYEES = [
  { id: "1001", emp_id: "1001", name: "김개발", rep: "김개발", region: "개발팀", dept: "개발팀", sales: "150000", status: "Closed" },
  { id: "1002", emp_id: "1002", name: "이영업", rep: "이영업", region: "영업팀", dept: "영업팀", sales: "250000", status: "Open" },
  { id: "1003", emp_id: "1003", name: "박인사", rep: "박인사", region: "인사팀", dept: "인사팀", sales: "80000", status: "Closed" },
  { id: "1004", emp_id: "1004", name: "최기술", rep: "최기술", region: "개발팀", dept: "개발팀", sales: "120000", status: "Open" },
  { id: "1005", emp_id: "1005", name: "정실적", rep: "정실적", region: "영업팀", dept: "영업팀", sales: "300000", status: "Closed" },
  { id: "1006", emp_id: "1006", name: "조인사", rep: "조인사", region: "인사팀", dept: "인사팀", sales: "90000", status: "Open" },
  { id: "1007", emp_id: "1007", name: "한코딩", rep: "한코딩", region: "개발팀", dept: "개발팀", sales: "180000", status: "Closed" },
  { id: "1008", emp_id: "1008", name: "강판매", rep: "강판매", region: "영업팀", dept: "영업팀", sales: "220000", status: "Open" },
  { id: "1009", emp_id: "1009", name: "황관리", rep: "황관리", region: "인사팀", dept: "인사팀", sales: "95000", status: "Closed" },
  { id: "1010", emp_id: "1010", name: "백엔드", rep: "백엔드", region: "개발팀", dept: "개발팀", sales: "160000", status: "Open" }
];

// 초기 파일 히스토리 데모 데이터
const INITIAL_HISTORY = [
  {
    id: "1",
    fileName: "dw_sales_summary.srd",
    fileType: "DataWindow (.srd)",
    targetType: "React Table + Tailwind",
    size: "1.3 KB",
    date: "2026-05-22 10:14",
    status: "Completed",
    sourceCode: `$PBExportHeader$dw_sales_summary.srd\nrelease 10.5;\ndatawindow(release=10.5 processing=0 font.face="Pretendard" font.height="-10" font.weight="400" background.mode="1" background.color="553648127" )\nheader(height=72 color="33554432" )\ndetail(height=84 color="33554432" )\ntable(column=(type=char(10) updatewhereclause=yes name=id dbname="employee.id" )\n column=(type=char(20) updatewhereclause=yes name=region dbname="employee.region" )\n column=(type=char(20) updatewhereclause=yes name=rep dbname="employee.rep" )\n column=(type=number updatewhereclause=yes name=sales dbname="employee.sales" )\n column=(type=char(10) updatewhereclause=yes name=status dbname="employee.status" )\n retrieve="SELECT employee.id, employee.region, employee.rep, employee.sales, employee.status FROM employee WHERE employee.status = :as_status AND employee.sales > :an_sales"\n arguments=(("as_status", string), ("an_sales", number))\n)\ntext(band=header alignment="2" text="사원번호" name=id_t )\ntext(band=header alignment="0" text="지역" name=region_t )\ntext(band=header alignment="0" text="담당자" name=rep_t )\ntext(band=header alignment="1" text="실적" name=sales_t )\ntext(band=header alignment="2" text="상태" name=status_t )\ncolumn(band=detail id=1 alignment="2" name=id )\ncolumn(band=detail id=2 alignment="0" name=region )\ncolumn(band=detail id=3 alignment="0" name=rep )\ncolumn(band=detail id=4 alignment="1" name=sales )\ncolumn(band=detail id=5 alignment="2" name=status )\ncompute(band=detail alignment="1" expression="sales * 1.1" name=incentive_calc text="인센티브(sales*1.1)" )`,
    code: `// Converted Successfully`
  },
  {
    id: "2",
    fileName: "w_order_entry.srw",
    fileType: "Window (.srw)",
    targetType: "React Form + State",
    size: "0.8 KB",
    date: "2026-05-22 09:45",
    status: "Completed",
    sourceCode: `$PBExportHeader$w_order_entry.srw\nrelease 12.5;\nglobal type w_order_entry from window\nstring title = "Order Entry Form"\nend type`,
    code: `// Converted Successfully`
  }
];

export default function PBBridgeDashboard() {
  // [Day 54 작업] 상위 상태 정의 (Lifting State Up) 및 이벤팅 동기화 파이프라인 구역

  // 1. 파일 파싱 및 데이터윈도우 정의 상태 [steɪt]
  const [history, setHistory] = useState(INITIAL_HISTORY);
  const [activeFileName, setActiveFileName] = useState<string>("dw_sales_summary.srd");
  const [activeFileSize, setActiveFileSize] = useState<string>("1.3 KB");
  const [activeFileContent, setActiveFileContent] = useState<string>(INITIAL_HISTORY[0].sourceCode);
  const [activeFileType, setActiveFileType] = useState<string>("DataWindow (.srd)");
  const [parsedData, setParsedData] = useState<ParsedPB>(parsePBFile(INITIAL_HISTORY[0].sourceCode, "dw_sales_summary.srd"));

  // 2. [Day 54 작업] 실시간 이벤팅 동기화 파이프라인 1: 트리 뷰 ➔ 그리드 부서 필터 연동 상태
  const [selectedDept, setSelectedDept] = useState<string>("전체 부서");
  const [selectedTreeNodeLabel, setSelectedTreeNodeLabel] = useState<string>("전체 부서원 마스터");

  // 3. 마스터 그리드 데이터 및 행 선택 상태 [ɡrɪd]
  const [masterEmployees, setMasterEmployees] = useState<Array<{ [key: string]: string }>>(MOCK_MASTER_EMPLOYEES);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(0);

  // 4. [Day 54 작업] 실시간 이벤팅 동기화 파이프라인 2: 그리드 선택 사원 ➔ 듀얼 리스트박스 타이틀 및 권한 매핑 연동
  const currentSelectedEmployee = useMemo(() => {
    // 부서 필터링된 결과 내에서 선택된 사원 행 탐색
    const filtered = masterEmployees.filter((emp) => {
      if (selectedDept === "전체 부서" || !selectedDept) return true;
      return emp.dept === selectedDept || emp.region === selectedDept;
    });
    return filtered[selectedRowIndex] || filtered[0] || masterEmployees[0];
  }, [masterEmployees, selectedDept, selectedRowIndex]);

  // 5. [Day 54 작업] 실시간 이벤팅 동기화 파이프라인 3: 색상 선택기 ➔ 글로벌 ERP 대시보드 Accent Theme 테마 연동
  const [themeHex, setThemeHex] = useState<string>("#00f0ff");
  const [themeRgba, setThemeRgba] = useState<string>("rgba(0, 240, 255, 1.00)");
  const [themeAlpha, setThemeAlpha] = useState<number>(100);

  // 6. Retrieval Arguments & 검색 파라미터 상태
  const [argValues, setArgValues] = useState<{ [key: string]: string }>({
    as_dept: "전체 부서",
    as_status: "Closed",
    an_sales: "50000"
  });

  // 기타 보조 에디터 상태
  const [columnSearch, setColumnSearch] = useState<string>("");
  const [isSqlFormatted, setIsSqlFormatted] = useState(false);
  const [sqlExecuteLog, setSqlExecuteLog] = useState<string | null>(null);
  const [isExecutingSql, setIsExecutingSql] = useState(false);
  const [showSandboxControls, setShowSandboxControls] = useState<boolean>(false);

  // =========================================================================
  // [Day 54 작업] 이벤팅 파이프라인 1: TreeView 노드 선택 이벤트 핸들러 콜백 [ˈkɔːlbæk]
  // 파워빌더 레거시: uo_tree.Event ue_select() ➔ uo_grid.Retrieve(ls_dept) 호출 방식 대체
  // =========================================================================
  const handleTreeNodeSelect = (node: TreeNodeData) => {
    setSelectedTreeNodeLabel(node.label);

    // 트리 노드의 라벨 및 타입에 따른 실시간 부서 필터링 매핑 규칙
    let targetDept = "전체 부서";
    const labelLower = node.label.toLowerCase();

    if (labelLower.includes("인사") || labelLower.includes("급여") || labelLower.includes("정원") || labelLower.includes("연말정산")) {
      targetDept = "인사팀";
    } else if (labelLower.includes("재무") || labelLower.includes("회계") || labelLower.includes("전표") || labelLower.includes("자금")) {
      targetDept = "영업팀";
    } else if (labelLower.includes("erp") || labelLower.includes("권한") || labelLower.includes("시스템") || labelLower.includes("코드")) {
      targetDept = "개발팀";
    } else {
      targetDept = "전체 부서";
    }

    setSelectedDept(targetDept);
    setSelectedRowIndex(0); // 부서 변경 시 그리드 포커스 0번 행 초기화

    // 상단 Retrieval Argument 바에 선택된 부서 정보 실시간 동기화
    setArgValues((prev) => ({
      ...prev,
      as_dept: targetDept,
    }));
  };

  // 부서 선택 조건에 맞춰 그리드 데이터셋을 유연하게 산출하는 파생 데이터 (Derived State)
  const displayGridData = useMemo(() => {
    if (selectedDept === "전체 부서" || !selectedDept) {
      return masterEmployees;
    }
    return masterEmployees.filter(
      (emp) => emp.dept === selectedDept || emp.region === selectedDept
    );
  }, [masterEmployees, selectedDept]);

  // =========================================================================
  // [Day 54 작업] 이벤팅 파이프라인 2: GridPreview RowFocusChanged 이벤트 핸들러 [ˈfoʊkəs]
  // 파워빌더 레거시: dw_1.Event rowfocuschanged() ➔ dw_detail.Retrieve(ls_emp_id) 방식 대체
  // =========================================================================
  const handleSelectRow = (rIdx: number) => {
    setSelectedRowIndex(rIdx);
  };

  // 폼 입력 데이터 실시간 역바인딩 (양방향 상태 유지 파이프라인)
  const handleFormInputChange = (colName: string, value: string) => {
    setMasterEmployees((prev) => {
      const next = [...prev];
      const targetEmp = currentSelectedEmployee;
      if (!targetEmp) return prev;

      const masterIdx = next.findIndex((e) => e.emp_id === targetEmp.emp_id || e.id === targetEmp.id);
      if (masterIdx !== -1) {
        next[masterIdx] = {
          ...next[masterIdx],
          [colName]: value,
          ...(colName === "name" ? { rep: value } : {}),
          ...(colName === "dept" ? { region: value } : {})
        };
      }
      return next;
    });
  };

  // =========================================================================
  // [Day 54 작업] 이벤팅 파이프라인 3: ColorPicker 색상 체인지 콜백 [ˈpɪkər]
  // 파워빌더 레거시: ChooseColor() ➔ dw_1.Modify("column.Color=...") 방식 대체
  // 현대 React: 글로벌 CSS 변수(--accent-color, --accent-rgba) 및 인라인 테마 바인딩
  // =========================================================================
  const handleColorChange = (rgbaString: string, hex: string, alpha: number) => {
    setThemeHex(hex);
    setThemeRgba(rgbaString);
    setThemeAlpha(alpha);
  };

  // Retrieval Arguments 변경 핸들러
  const handleArgChange = (argName: string, value: string) => {
    setArgValues((prev) => ({ ...prev, [argName]: value }));
    if (argName === "as_dept") {
      setSelectedDept(value);
    }
  };

  // SQL 모의 실행
  const handleExecuteSql = () => {
    if (!parsedData.retrieveQuery) return;
    setIsExecutingSql(true);
    setSqlExecuteLog("Executing SQL query against simulated database...");
    setTimeout(() => {
      setIsExecutingSql(false);
      setSqlExecuteLog(
        `▶ SQL 실행 완료 (성공)\n- 조회 조건: 부서[${selectedDept}], 상태[${argValues.as_status || "Closed"}]`
      );
    }, 600);
  };

  // 파일 업로드 핸들러
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = (event.target?.result as string) || "";
        setActiveFileName(file.name);
        setActiveFileSize(`${(file.size / 1024).toFixed(1)} KB`);
        setActiveFileContent(text);
        setActiveFileType("PowerBuilder Source");
      };
      reader.readAsText(file);
    }
  };

  // 파싱 데이터 동기화
  useEffect(() => {
    const data = parsePBFile(activeFileContent, activeFileName);
    setParsedData(data);
    setActiveFileType(data.fileType);
  }, [activeFileContent, activeFileName]);

  return (
    <div
      style={
        {
          "--accent-color": themeHex,
          "--accent-rgba": themeRgba,
        } as React.CSSProperties
      }
      className="min-h-screen bg-[#060912] text-slate-100 font-sans flex flex-col antialiased selection:bg-cyan-500/30 selection:text-cyan-200 transition-colors duration-300"
    >
      {/* =========================================================================
          1. 통합 ERP 마스터 대시보드 상단 웅장한 네온 헤더 (Header Bar)
         ========================================================================= */}
      <header className="border-b border-slate-900 bg-[#080d1a]/90 backdrop-blur-xl sticky top-0 z-40 px-6 py-3.5 flex items-center justify-between shadow-[0_4px_25px_rgba(0,0,0,0.6)]">
        <div className="flex items-center gap-4">
          <div
            style={{
              backgroundColor: themeHex,
              boxShadow: `0 0 20px ${themeRgba}`,
            }}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 font-black text-slate-950 text-base"
          >
            ERP
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-white tracking-tight">
                통합 ERP 마스터 대시보드 (Master [ˈdæʃbɔːrd])
              </h1>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-950/80 text-cyan-400 border border-indigo-800/50">
                Day 54 State Orchestration
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              파워빌더 메인 윈도우/UserObject 이벤팅 ➔ 현대 웹 표준 단방향 데이터 흐름 & 상태 끌어올리기 대치
            </p>
          </div>
        </div>

        {/* 대시보드 실시간 파이프라인 런타임 인디케이터 바 */}
        <div className="hidden lg:flex items-center gap-3 bg-slate-950/80 px-4 py-2 rounded-xl border border-slate-900 text-xs font-mono">
          <div className="flex items-center gap-1.5 border-r border-slate-800 pr-3">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            <span className="text-slate-400">선택 부서:</span>
            <span className="text-cyan-300 font-bold">{selectedDept}</span>
          </div>

          <div className="flex items-center gap-1.5 border-r border-slate-800 pr-3">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></span>
            <span className="text-slate-400">선택 사원:</span>
            <span className="text-purple-300 font-bold">
              {currentSelectedEmployee ? `${currentSelectedEmployee.name} (${currentSelectedEmployee.emp_id})` : "없음"}
            </span>
          </div>

          <div className="flex items-center gap-2 pl-1">
            <span className="text-slate-400">글로벌 Accent:</span>
            <div
              style={{ backgroundColor: themeHex, boxShadow: `0 0 10px ${themeRgba}` }}
              className="w-3.5 h-3.5 rounded-full border border-white/20 transition-all duration-300"
            />
            <span className="text-[11px] font-bold text-slate-200">{themeHex}</span>
          </div>
        </div>
      </header>

      {/* =========================================================================
          2. 대시보드 메인 레이아웃 (좌측 Tree + 중앙 Grid 2단 다크 네온 구성)
         ========================================================================= */}
      <main className="flex-1 max-w-[1750px] w-full mx-auto p-4 md:p-6 flex flex-col gap-6">
        
        {/* 상단 2분할 메인 워크스페이스 레이아웃 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* ================= 좌측 사이드바: 조직도 및 다차원 메뉴 트리 (TreeView) ================= */}
          <section className="lg:col-span-3 flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-bold uppercase text-slate-300 tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                조직도 & 메뉴 네비게이션 (Tree [ˈtriːvjuː])
              </h3>
              <span className="text-[10px] font-mono text-slate-500">uo_tree</span>
            </div>

            {/* TreeView 컴포넌트 마운트 (콜백 프로퍼티 전달) */}
            <TreeView onNodeSelect={handleTreeNodeSelect} />

            {/* 파이프라인 1 실시간 피드백 카드 */}
            <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-900 text-xs font-mono space-y-1.5 shadow-lg">
              <span className="text-cyan-400 font-bold block text-[11px]">
                🔗 [파이프라인 1] 실시간 이벤팅 동기화
              </span>
              <p className="text-slate-400 text-[10.5px] leading-relaxed">
                트리 노드 선택 ➔ 상위 State(<code className="text-cyan-300">selectedDept</code>) 갱신 ➔ 그리드 dataset 실시간 필터링
              </p>
              <div className="pt-1.5 border-t border-slate-900/80 flex items-center justify-between text-[10px]">
                <span className="text-slate-500">선택된 노드:</span>
                <span className="text-slate-200 font-bold bg-slate-900 px-2 py-0.5 rounded">
                  {selectedTreeNodeLabel}
                </span>
              </div>
            </div>
          </section>

          {/* ================= 중앙 메인 영역: 통합 데이터윈도우 그리드 (GridPreview) ================= */}
          <section className="lg:col-span-9 flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-bold uppercase text-slate-300 tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                통합 데이터윈도우 그리드 (Grid [ɡrɪd] Master)
              </h3>
              <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
                <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-cyan-400 font-bold">
                  조회 건수: {displayGridData.length}건
                </span>
                <span>uo_grid</span>
              </div>
            </div>

            {/* GridPreview 컴포넌트 마운트 */}
            <div
              style={{
                borderColor: `${themeHex}40`,
                boxShadow: `0 0 25px ${themeHex}10`,
              }}
              className="rounded-2xl overflow-hidden border transition-all duration-300 bg-slate-950"
            >
              <GridPreview
                parsedData={parsedData}
                gridData={displayGridData}
                setGridData={setMasterEmployees as any}
                argValues={argValues}
                selectedRowIndex={selectedRowIndex}
                onSelectRow={handleSelectRow}
              />
            </div>
          </section>
        </div>

        {/* =========================================================================
            3. 하단 서브 패널 2분할 (좌측: DualListbox / 우측: ColorPicker)
           ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          
          {/* ================= 하단 좌측: 직무 권한 배정 (DualListbox) ================= */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-bold uppercase text-slate-300 tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                사원 직무 권한 배정 모듈 (Dual [ˈlɪstbɑːks])
              </h3>
              <span className="text-[10px] font-mono text-slate-500">uo_detail_permission</span>
            </div>

            {/* 그리드 사원 선택 연동 동적 타이틀과 함께 DualListbox 마운트 */}
            <DualListbox
              titleLeft={`미배정 권한 목록 [대상: ${currentSelectedEmployee ? currentSelectedEmployee.name + ' (' + currentSelectedEmployee.emp_id + ')' : '사원 미선택'}]`}
              titleRight={`배정된 권한 목록 [대상: ${currentSelectedEmployee ? currentSelectedEmployee.name + ' (' + currentSelectedEmployee.emp_id + ')' : '사원 미선택'}]`}
              onChange={(assigned, unassigned) => {
                console.log(`[Day 54] 사원(${currentSelectedEmployee?.name}) 권한 변경:`, assigned);
              }}
            />
          </section>

          {/* ================= 하단 우측: 그리드 테마 선택기 (ColorPicker) ================= */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-bold uppercase text-slate-300 tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-pink-400"></span>
                대시보드 Accent 테마 선택기 (Color [ˈpɪkər])
              </h3>
              <span className="text-[10px] font-mono text-slate-500">uo_theme_picker</span>
            </div>

            {/* ColorPicker 마운트 및 대시보드 Accent Theme 실시간 수신 */}
            <div className="h-full flex flex-col justify-between">
              <ColorPicker
                initialHex={themeHex}
                initialAlpha={themeAlpha}
                onChange={handleColorChange}
              />

              {/* 파이프라인 3 테마 피드백 및 상태 카드 */}
              <div className="mt-4 p-4 rounded-xl bg-slate-950/90 border border-slate-900 font-mono text-xs space-y-2 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-indigo-400 font-bold text-[11px]">
                    🎨 [파이프라인 3] 대시보드 테마 실시간 바인딩
                  </span>
                  <span
                    style={{ backgroundColor: themeHex, boxShadow: `0 0 10px ${themeRgba}` }}
                    className="px-2.5 py-0.5 rounded text-[10px] font-bold text-slate-950"
                  >
                    Active Accent
                  </span>
                </div>
                <p className="text-slate-400 text-[10.5px] leading-relaxed">
                  ColorPicker 체인지 ➔ 상위 State(<code className="text-indigo-300">themeHex</code>) 갱신 ➔ 대시보드 CSS 커스텀 변수(<code className="text-pink-300">--accent-color</code>) 바인딩
                </p>
                <div className="grid grid-cols-3 gap-2 pt-1 text-[10px] text-center">
                  <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800">
                    <span className="text-slate-500 block">Hex</span>
                    <span className="text-cyan-300 font-bold">{themeHex}</span>
                  </div>
                  <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800">
                    <span className="text-slate-500 block">Alpha</span>
                    <span className="text-purple-300 font-bold">{themeAlpha}%</span>
                  </div>
                  <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800 truncate">
                    <span className="text-slate-500 block">RGBA</span>
                    <span className="text-pink-300 font-bold text-[9px]">{themeRgba}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* =========================================================================
            4. 보조 샌드박스 및 소스코드 토글 제어 섹션
           ========================================================================= */}
        <section className="mt-4 pt-4 border-t border-slate-900">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setShowSandboxControls(!showSandboxControls)}
              className="text-xs font-bold px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-all flex items-center gap-2 cursor-pointer font-mono"
            >
              <span>{showSandboxControls ? "▼" : "▶"}</span>
              <span>개발자 전용 파싱 샌드박스 & SQL 에디터 {showSandboxControls ? "접기" : "열기"}</span>
            </button>
            <span className="text-[10px] font-mono text-slate-500">
              DataWindow File Parser Sandbox v1.54
            </span>
          </div>

          {showSandboxControls && (
            <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <SourceEditor
                  activeFileName={activeFileName}
                  activeFileSize={activeFileSize}
                  activeFileContent={activeFileContent}
                  onFileChange={handleFileChange}
                />
                <ParsingSummary
                  activeFileType={activeFileType}
                  parsedData={parsedData}
                  columnSearch={columnSearch}
                  onColumnSearchChange={setColumnSearch}
                  argValues={argValues}
                  onArgChange={handleArgChange}
                />
              </div>

              <SqlEditor
                parsedData={parsedData}
                argValues={argValues}
                isSqlFormatted={isSqlFormatted}
                onSqlFormatChange={setIsSqlFormatted}
                sqlExecuteLog={sqlExecuteLog}
                isExecutingSql={isExecutingSql}
                onExecuteSql={handleExecuteSql}
              />

              <FormPreview
                parsedData={parsedData}
                formData={currentSelectedEmployee || {}}
                onFormInputChange={handleFormInputChange}
              />
            </div>
          )}
        </section>

      </main>
    </div>
  );
}