// [Day 55 작업] MDI 다중 탭(Tab [tæb]) 워크스페이스 구축 및 탭 스택 상태 관리, 뷰포트 스위칭 파이프라인
// 파워빌더 레거시 MDI Frame 윈도우의 OpenSheet()/CloseSheet() 동기식 시트 제어 방식을 현대 웹 표준 React 아키텍처로 개편합니다.

"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ParsedPB } from "./types";
import { parsePBFile } from "./utils/parser";

// 4대 핵심 독립 컴포넌트 모듈 임포트
import TreeView, { TreeNodeData } from "./components/TreeView";
import GridPreview from "./components/GridPreview";
import DualListbox from "./components/DualListbox";
import ColorPicker from "./components/ColorPicker";

// 보조 샌드박스 및 지원 컴포넌트
import SourceEditor from "./components/SourceEditor";
import ParsingSummary from "./components/ParsingSummary";
import SqlEditor from "./components/SqlEditor";
import FormPreview from "./components/FormPreview";

/**
 * [Day 55 작업] 파워빌더 레거시 MDI 시트 제어 vs 현대 웹 React 상태 스택 아키텍처 구조적 비교 해설
 *
 * 1. 레거시 파워빌더 (동기식 프레임 시트 포인터 조작):
 *    - 파워빌더 MDI (Multiple Document Interface [ˈem.diː.aɪ]) 환경에서는 메인 프레임 윈도우(Frame Window [ˈwɪndoʊ])가
 *      `OpenSheet(w_sheet, m_frame, 0, Original!)` 또는 `OpenSheetWithParm()` 함수를 실행하여 가상 윈도우 스풀러 상에
 *      하위 시트 윈도우(Sheet Window [ʃiːt])를 하드웨어 그래픽 포인터 기반으로 동기 생성(Instantiate)했습니다.
 *    - 윈도우 시트를 닫을 때는 `CloseSheet(w_sheet)` 명령을 날려 메모리 포인터 주소를 직접 파기했습니다.
 *    - 개발자가 활성 시트 포커스를 재조정하기 위해 `w_frame.GetActiveSheet()` 또는 `w_sheet.SetFocus()`와 같은
 *      절차적 조작 스크립트를 수동 작성해야 했고, 자식 시트 간 메모리 참조 오류가 빈번히 발생했습니다.
 *
 * 2. 현대 웹 표준 React 아키텍처 (선언형 탭 스택 배열 관리, 불변성 스냅샷 및 뷰포트 스위칭):
 *    - 현대 React MDI 환경에서는 가상 윈도우 포인터 대신 컴포넌트 상태(State [steɪt]) 내의 탭 스택(Tab Stack [tæb] [stæk]) 배열(`openTabs`)과
 *      활성 탭 ID 포커스 상태(`activeTabId`)를 통해 선언적으로 렌더링합니다.
 *    - 탭 추가(`OpenSheet` 대치)는 `setOpenTabs(prev => [...prev, newTab])`의 불변성 스냅샷 전이 기술을 사용하며,
 *      탭 제거(`CloseSheet` 대치)는 `filter()` 배열 메서드로 원본 손상 없이 상태를 불변하게 업데이트합니다.
 *    - 활성 탭 닫힘 발생 시 배열 인덱스 기반 포커스 자동 이전 알고리즘이 동작하여 인접 이전 탭으로 `activeTabId`가 부드럽게 복구됩니다.
 *    - 뷰포트(Viewport [vjuːpɔːrt]) 메인 영역은 활성화된 탭의 식별값(`viewType`)에 따라 조건부 가상 DOM(Virtual DOM) 알고리즘으로
 *      최소 리렌더링 비용 스위칭(Switching [ˈswɪtʃɪŋ])을 수행합니다.
 *
 * 표준 IPA 발음 기호 준수 가이드:
 *  - MDI ➔ [ˈem.diː.aɪ]
 *  - Tab / Tabs ➔ [tæb] / [tæbz]
 *  - Sheet / Sheets ➔ [ʃiːt] / [ʃiːts]
 *  - Viewport ➔ [vjuːpɔːrt]
 *  - Stack ➔ [stæk]
 *  - Switching ➔ [ˈswɪtʃɪŋ]
 *  - Window ➔ [ˈwɪndoʊ]
 *  - Frame ➔ [freɪm]
 *  - Workspace ➔ [ˈwɜːrkspeɪs]
 *  - Single Source of Truth ➔ [ˈsɪŋɡl sɔːrs əv truːθ]
 *  - Unidirectional Data Flow ➔ [ˌjuːnɪdəˈrekʃənl ˈdeɪtə floʊ]
 */

// MDI 탭 항목 데이터 구조 정의
export interface TabItem {
  id: string;
  title: string;
  viewType: "all" | "grid" | "permission" | "theme" | "sandbox";
  iconType?: string;
  description?: string;
  closable?: boolean;
}

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

// 초기 기본 탭 (Tabs [tæbz]) 목록 정의
const INITIAL_TABS: TabItem[] = [
  {
    id: "tab-master-all",
    title: "통합 ERP 대시보드 뷰",
    viewType: "all",
    iconType: "dashboard",
    description: "4대 핵심 컴포넌트 전체 오케스트레이션 뷰",
    closable: true
  },
  {
    id: "tab-emp-grid",
    title: "사원 명부 데이터윈도우",
    viewType: "grid",
    iconType: "grid",
    description: "사원 원장 마스터 그리드 뷰 [ɡrɪd]",
    closable: true
  },
  {
    id: "tab-dept-permission",
    title: "조직 권한 관리",
    viewType: "permission",
    iconType: "lock",
    description: "사원별 직무 권한 듀얼 리스트박스 뷰 [ˈlɪstbɑːks]",
    closable: true
  },
  {
    id: "tab-system-theme",
    title: "시스템 테마 설정",
    viewType: "theme",
    iconType: "palette",
    description: "글로벌 Accent 테마 선택기 뷰 [ˈpɪkər]",
    closable: true
  }
];

export default function PBBridgeDashboard() {
  // =========================================================================
  // [Day 55 작업] MDI 탭 상태 정의 및 OpenSheet/CloseSheet 대치 파이프라인
  // =========================================================================
  
  // 1. 열려있는 MDI 작업 탭 스택 배열 상태 (`openTabs`) [stæk]
  const [openTabs, setOpenTabs] = useState<TabItem[]>(INITIAL_TABS);
  
  // 2. 현재 활성화된 Active 탭 ID 포커스 상태 (`activeTabId`) [ˈfoʊkəs]
  const [activeTabId, setActiveTabId] = useState<string | null>("tab-master-all");

  // 3. 파일 파싱 및 데이터윈도우 정의 상태 [steɪt]
  const [history, setHistory] = useState(INITIAL_HISTORY);
  const [activeFileName, setActiveFileName] = useState<string>("dw_sales_summary.srd");
  const [activeFileSize, setActiveFileSize] = useState<string>("1.3 KB");
  const [activeFileContent, setActiveFileContent] = useState<string>(INITIAL_HISTORY[0].sourceCode);
  const [activeFileType, setActiveFileType] = useState<string>("DataWindow (.srd)");
  const [parsedData, setParsedData] = useState<ParsedPB>(parsePBFile(INITIAL_HISTORY[0].sourceCode, "dw_sales_summary.srd"));

  // 4. 실시간 이벤팅 동기화 파이프라인: 트리 뷰 ➔ 그리드 부서 필터 연동 상태
  const [selectedDept, setSelectedDept] = useState<string>("전체 부서");
  const [selectedTreeNodeLabel, setSelectedTreeNodeLabel] = useState<string>("전체 부서원 마스터");

  // 5. 마스터 그리드 데이터 및 행 선택 상태 [ɡrɪd]
  const [masterEmployees, setMasterEmployees] = useState<Array<{ [key: string]: string }>>(MOCK_MASTER_EMPLOYEES);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(0);

  // 6. 실시간 이벤팅 동기화 파이프라인: 그리드 선택 사원 ➔ 듀얼 리스트박스 타이틀 및 권한 매핑 연동
  const currentSelectedEmployee = useMemo(() => {
    const filtered = masterEmployees.filter((emp) => {
      if (selectedDept === "전체 부서" || !selectedDept) return true;
      return emp.dept === selectedDept || emp.region === selectedDept;
    });
    return filtered[selectedRowIndex] || filtered[0] || masterEmployees[0];
  }, [masterEmployees, selectedDept, selectedRowIndex]);

  // 7. 실시간 이벤팅 동기화 파이프라인: 색상 선택기 ➔ 글로벌 ERP 대시보드 Accent Theme 테마 연동
  const [themeHex, setThemeHex] = useState<string>("#00f0ff");
  const [themeRgba, setThemeRgba] = useState<string>("rgba(0, 240, 255, 1.00)");
  const [themeAlpha, setThemeAlpha] = useState<number>(100);

  // 8. Retrieval Arguments & 검색 파라미터 상태
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
  // [Day 55 작업] 파워빌더 OpenSheet() 함수 대치 탭 생성 및 포커스 전환 파이프라인
  // =========================================================================
  const handleOpenTab = (node: TreeNodeData) => {
    // 트리 노드의 성격에 맞춰 뷰포트(Viewport [vjuːpɔːrt]) 타겟 유형 자동 판별
    let targetViewType: TabItem["viewType"] = "all";
    const labelLower = node.label.toLowerCase();

    if (labelLower.includes("권한") || labelLower.includes("사용자")) {
      targetViewType = "permission";
    } else if (labelLower.includes("설정") || labelLower.includes("테마") || labelLower.includes("코드") || labelLower.includes("감사")) {
      targetViewType = "theme";
    } else if (labelLower.includes("전표") || labelLower.includes("결산") || labelLower.includes("자산") || labelLower.includes("정원") || labelLower.includes("연말정산") || labelLower.includes("명부")) {
      targetViewType = "grid";
    } else {
      targetViewType = "all";
    }

    const tabId = `tab-node-${node.id}`;

    // 조건 1 (탭 생성 및 스위칭): 이미 열려 있는 탭인지 검사
    const existingTab = openTabs.find((t) => t.id === tabId);
    if (existingTab) {
      // 열려 있는 탭이면 Active 포커스[ˈfoʊkəs]만 즉시 전환
      setActiveTabId(existingTab.id);
    } else {
      // 미열림 탭이면 불변성 스냅샷 전이 기술로 신규 탭 생성 후 탭 스택[stæk]에 수록
      const newTab: TabItem = {
        id: tabId,
        title: node.label,
        viewType: targetViewType,
        iconType: node.type === "folder" ? "folder" : "file",
        description: `메뉴 노드 [${node.id}] 화면 시트 [ʃiːt]`,
        closable: true
      };
      setOpenTabs((prev) => [...prev, newTab]);
      setActiveTabId(newTab.id);
    }
  };

  // =========================================================================
  // [Day 55 작업] 파워빌더 CloseSheet() 함수 대치 탭 제거 및 포커스 자동 복구 파이프라인
  // =========================================================================
  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // 탭 선택 클릭 이벤트 전파 중단

    setOpenTabs((prevTabs) => {
      const closedIndex = prevTabs.findIndex((t) => t.id === tabId);
      if (closedIndex === -1) return prevTabs;

      const updatedTabs = prevTabs.filter((t) => t.id !== tabId);

      // 조건 2 (탭 삭제 및 포커스 복구): 활성화 상태였던 탭이 닫힌 경우
      if (activeTabId === tabId) {
        if (updatedTabs.length > 0) {
          // 인접한 이전 탭 선택 (이전 탭이 없으면 0번째 탭)
          const nextActiveIndex = Math.max(0, closedIndex - 1);
          setActiveTabId(updatedTabs[nextActiveIndex].id);
        } else {
          // 모든 탭이 닫혔을 경우 null 처리하여 안내 뷰포트 노출
          setActiveTabId(null);
        }
      }

      return updatedTabs;
    });
  };

  // =========================================================================
  // [Day 54/55 연동] TreeView 노드 선택 콜백 [ˈkɔːlbæk] (부서 필터링 + 탭 Open/Switch)
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

    // [Day 55] MDI 탭 생성 및 포커스 스위칭 파이프라인 트리거
    handleOpenTab(node);
  };

  // 부서 선택 조건에 맞춰 그리드 데이터셋을 유연하게 산출하는 파생 데이터
  const displayGridData = useMemo(() => {
    if (selectedDept === "전체 부서" || !selectedDept) {
      return masterEmployees;
    }
    return masterEmployees.filter(
      (emp) => emp.dept === selectedDept || emp.region === selectedDept
    );
  }, [masterEmployees, selectedDept]);

  // 그리드 행 선택 핸들러
  const handleSelectRow = (rIdx: number) => {
    setSelectedRowIndex(rIdx);
  };

  // 폼 입력 데이터 실시간 역바인딩 핸들러
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

  // ColorPicker 테마 변경 콜백
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

  // 현재 활성화된 Active Tab 객체
  const activeTab = useMemo(() => {
    return openTabs.find((t) => t.id === activeTabId) || null;
  }, [openTabs, activeTabId]);

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
      <header className="border-b border-slate-900 bg-[#080d1a]/95 backdrop-blur-xl sticky top-0 z-40 px-6 py-3.5 flex items-center justify-between shadow-[0_4px_25px_rgba(0,0,0,0.6)]">
        <div className="flex items-center gap-4">
          <div
            style={{
              backgroundColor: themeHex,
              boxShadow: `0 0 20px ${themeRgba}`,
            }}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 font-black text-slate-950 text-base"
          >
            MDI
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-white tracking-tight">
                통합 ERP MDI 마스터 워크스페이스 (Workspace [ˈwɜːrkspeɪs])
              </h1>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/50">
                Day 55 Dynamic MDI Tab Stack
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              파워빌더 OpenSheet()/CloseSheet() 동기식 프레임 윈도우 ➔ 현대 웹 React 탭 스택 상태 및 뷰포트 스위칭 대치
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
            <span className="text-slate-400">열린 탭:</span>
            <span className="px-2 py-0.5 rounded bg-indigo-950 text-cyan-300 border border-indigo-800 font-bold text-[11px]">
              {openTabs.length}개
            </span>
          </div>
        </div>
      </header>

      {/* =========================================================================
          2. [Day 55 작업] 다크 네온 스타일 [MDI 탭 바] 레이아웃 (MDI Tab Bar [tæb])
         ========================================================================= */}
      <section className="bg-[#0b1021] border-b border-slate-800/80 px-6 py-2 sticky top-[65px] z-30 flex items-center justify-between gap-4 overflow-x-auto scrollbar-none shadow-md">
        <div className="flex items-center gap-2 overflow-x-auto py-1">
          {/* MDI 탭 바 타이틀 뱃지 */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-400 mr-1 shrink-0">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(0,240,255,0.8)]"></span>
            <span className="font-bold text-slate-300">[MDI 탭 바]</span>
          </div>

          {/* 선언형 openTabs 상태 배열 렌더링 */}
          {openTabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                style={
                  isActive
                    ? {
                        borderColor: themeHex,
                        boxShadow: `0 0 12px ${themeHex}35`,
                        backgroundColor: "rgba(15, 23, 42, 0.95)",
                      }
                    : {}
                }
                className={`group relative flex items-center gap-2.5 px-3.5 py-1.5 rounded-lg border text-xs font-mono transition-all duration-200 cursor-pointer shrink-0 select-none ${
                  isActive
                    ? "text-cyan-300 font-bold border-cyan-400"
                    : "bg-slate-950/70 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700 hover:bg-slate-900"
                }`}
              >
                {/* Active 탭 인디케이터 점 */}
                <span
                  style={isActive ? { backgroundColor: themeHex } : {}}
                  className={`w-1.5 h-1.5 rounded-full ${
                    isActive ? "shadow-[0_0_8px_rgba(0,240,255,1)] animate-pulse" : "bg-slate-600"
                  }`}
                />

                {/* 탭 타이틀 */}
                <span className="truncate max-w-[160px] tracking-wide">{tab.title}</span>

                {/* 조건 2 (탭 삭제 및 포커스 복구): 탭 오른쪽 ✕ 버튼 */}
                {tab.closable !== false && (
                  <button
                    onClick={(e) => handleCloseTab(tab.id, e)}
                    title="시트 [ʃiːt] 닫기"
                    className="p-0.5 rounded hover:bg-slate-800 hover:text-pink-400 text-slate-500 transition-colors cursor-pointer"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* 탭 스택 제어 유틸리티 버튼 */}
        <div className="flex items-center gap-2 shrink-0">
          {openTabs.length < INITIAL_TABS.length && (
            <button
              onClick={() => {
                setOpenTabs(INITIAL_TABS);
                setActiveTabId("tab-master-all");
              }}
              className="text-[10px] font-mono px-2.5 py-1 rounded bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-800 transition-all cursor-pointer"
            >
              🔄 기본 탭 복원
            </button>
          )}
        </div>
      </section>

      {/* =========================================================================
          3. 대시보드 메인 레이아웃 & 뷰포트 (Viewport [vjuːpɔːrt]) 조건부 스위칭
         ========================================================================= */}
      <main className="flex-1 max-w-[1750px] w-full mx-auto p-4 md:p-6 flex flex-col gap-6">

        {/* 조건 2 예외 처리: 모든 탭이 닫혔을 경우 안내 뷰포트 노출 */}
        {(!activeTab || openTabs.length === 0) ? (
          <section className="flex-1 flex flex-col items-center justify-center min-h-[480px] p-12 rounded-2xl bg-slate-950/80 border border-dashed border-slate-800 text-center shadow-2xl animate-fade-in">
            <div
              style={{ backgroundColor: `${themeHex}20`, borderColor: themeHex }}
              className="w-16 h-16 rounded-2xl border flex items-center justify-center mb-5 text-cyan-400 shadow-[0_0_20px_rgba(0,240,255,0.2)]"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-100 mb-2 tracking-tight">
              현재 열려있는 작업 화면이 없습니다. 좌측 메뉴에서 선택해 주세요.
            </h2>
            <p className="text-xs text-slate-400 font-mono max-w-lg leading-relaxed mb-6">
              [MDI 탭 스택[stæk] 상태: 0개] 파워빌더 CloseSheet() 호출로 모든 하위 시트[ʃiːt] 윈도우가 파기된 상태입니다.
              좌측 다차원 조직도 메뉴 트리를 클릭하여 새로운 작업 화면 시트[ʃiːt]를 열어주세요.
            </p>
            <button
              onClick={() => {
                setOpenTabs(INITIAL_TABS);
                setActiveTabId("tab-master-all");
              }}
              style={{ backgroundColor: themeHex }}
              className="px-5 py-2.5 rounded-xl font-mono text-xs font-bold text-slate-950 hover:brightness-110 transition-all shadow-lg cursor-pointer"
            >
              기본 4대 작업 시트 [ʃiːt] 전체 열기
            </button>
          </section>
        ) : (
          /* ================= 활성화 탭 뷰포트 (Viewport [vjuːpɔːrt]) 메인 레이아웃 ================= */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* 좌측 사이드바: 조직도 및 다차원 메뉴 트리 (TreeView) - 네비게이션은 고정 노출 */}
            <section className="lg:col-span-3 flex flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-bold uppercase text-slate-300 tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                  조직도 & 메뉴 네비게이션 (Tree [ˈtriːvjuː])
                </h3>
                <span className="text-[10px] font-mono text-slate-500">uo_tree</span>
              </div>

              {/* TreeView 컴포넌트 마운트 (노드 선택 시 handleTreeNodeSelect ➔ OpenSheet/Switch 실행) */}
              <TreeView onNodeSelect={handleTreeNodeSelect} />

              {/* Day 55 MDI 탭 상태 파이프라인 피드백 카드 */}
              <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-900 text-xs font-mono space-y-2 shadow-lg">
                <span className="text-cyan-400 font-bold block text-[11px]">
                  ⚡ [Day 55 MDI 스택] OpenSheet/CloseSheet 연동
                </span>
                <p className="text-slate-400 text-[10.5px] leading-relaxed">
                  트리 노드 선택 ➔ <code className="text-cyan-300">openTabs</code> 배열 갱신 ➔ 활성 탭 포커스 복구 & 뷰포트 스위칭
                </p>
                <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-[10px]">
                  <span className="text-slate-500">Active View:</span>
                  <span className="text-cyan-300 font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    {activeTab?.viewType.toUpperCase()}
                  </span>
                </div>
              </div>
            </section>

            {/* ================= 우측 메인 영역: activeTab.viewType에 따른 조건부 뷰포트 렌더링 ================= */}
            <section className="lg:col-span-9 flex flex-col gap-6">

              {/* Active Tab 헤더 안내 뷰포트 바 */}
              <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-900 flex items-center justify-between shadow-md font-mono text-xs">
                <div className="flex items-center gap-3">
                  <span
                    style={{ backgroundColor: themeHex }}
                    className="w-3 h-3 rounded-full shadow-[0_0_10px_rgba(0,240,255,0.8)] animate-pulse"
                  />
                  <div>
                    <span className="text-slate-400 text-[11px] block">현재 활성화된 작업 시트 [ʃiːt]:</span>
                    <h2 className="text-sm font-bold text-slate-100">{activeTab?.title}</h2>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block">Viewport [vjuːpɔːrt] Type</span>
                  <span className="text-cyan-300 font-bold text-[11px] bg-slate-900 px-2.5 py-0.5 rounded border border-slate-800">
                    {activeTab?.description || activeTab?.viewType}
                  </span>
                </div>
              </div>

              {/* ViewType 1: "all" (통합 4대 컴포넌트 마스터 뷰) */}
              {(activeTab?.viewType === "all") && (
                <div className="space-y-6">
                  {/* GridPreview 컴포넌트 영역 */}
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

                  {/* 하단 2분할 (DualListbox / ColorPicker) */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <DualListbox
                      titleLeft={`미배정 권한 목록 [대상: ${currentSelectedEmployee ? currentSelectedEmployee.name + ' (' + currentSelectedEmployee.emp_id + ')' : '사원 미선택'}]`}
                      titleRight={`배정된 권한 목록 [대상: ${currentSelectedEmployee ? currentSelectedEmployee.name + ' (' + currentSelectedEmployee.emp_id + ')' : '사원 미선택'}]`}
                      onChange={(assigned) => {
                        console.log(`[Day 55 MDI] 권한 변경:`, assigned);
                      }}
                    />

                    <div className="flex flex-col justify-between">
                      <ColorPicker
                        initialHex={themeHex}
                        initialAlpha={themeAlpha}
                        onChange={handleColorChange}
                      />
                      <div className="mt-4 p-4 rounded-xl bg-slate-950/90 border border-slate-900 font-mono text-xs space-y-2 shadow-lg">
                        <div className="flex items-center justify-between">
                          <span className="text-indigo-400 font-bold text-[11px]">
                            🎨 대시보드 Accent 테마 실시간 적용
                          </span>
                          <span
                            style={{ backgroundColor: themeHex }}
                            className="px-2 py-0.5 rounded text-[10px] font-bold text-slate-950"
                          >
                            {themeHex}
                          </span>
                        </div>
                        <p className="text-slate-400 text-[10.5px]">
                          ColorPicker 체인지 ➔ CSS 커스텀 변수(<code className="text-pink-300">--accent-color</code>) 바인딩
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ViewType 2: "grid" (사원 명부 그리드 단독 전면 뷰포트) */}
              {activeTab?.viewType === "grid" && (
                <div
                  style={{
                    borderColor: `${themeHex}40`,
                    boxShadow: `0 0 25px ${themeHex}10`,
                  }}
                  className="rounded-2xl overflow-hidden border transition-all duration-300 bg-slate-950 p-2"
                >
                  <div className="p-3 bg-slate-900/60 rounded-xl mb-3 border border-slate-800 flex items-center justify-between text-xs font-mono">
                    <span className="text-cyan-300 font-bold">📊 단독 시트 [ʃiːt] 뷰: 사원 명부 마스터 그리드</span>
                    <span className="text-slate-400">조회 건수: {displayGridData.length}건</span>
                  </div>
                  <GridPreview
                    parsedData={parsedData}
                    gridData={displayGridData}
                    setGridData={setMasterEmployees as any}
                    argValues={argValues}
                    selectedRowIndex={selectedRowIndex}
                    onSelectRow={handleSelectRow}
                  />
                </div>
              )}

              {/* ViewType 3: "permission" (조직 권한 관리 단독 전면 뷰포트) */}
              {activeTab?.viewType === "permission" && (
                <div className="p-6 rounded-2xl bg-slate-950 border border-slate-900 shadow-2xl space-y-4">
                  <div className="p-3.5 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center justify-between text-xs font-mono">
                    <span className="text-purple-300 font-bold">🔐 단독 시트 [ʃiːt] 뷰: 사원별 직무 권한 관리</span>
                    <span className="text-slate-400">선택 사원: {currentSelectedEmployee?.name}</span>
                  </div>
                  <DualListbox
                    titleLeft={`미배정 권한 목록 [대상: ${currentSelectedEmployee ? currentSelectedEmployee.name + ' (' + currentSelectedEmployee.emp_id + ')' : '사원 미선택'}]`}
                    titleRight={`배정된 권한 목록 [대상: ${currentSelectedEmployee ? currentSelectedEmployee.name + ' (' + currentSelectedEmployee.emp_id + ')' : '사원 미선택'}]`}
                    onChange={(assigned) => {
                      console.log(`[Day 55 MDI] 권한 변경:`, assigned);
                    }}
                  />
                </div>
              )}

              {/* ViewType 4: "theme" (시스템 테마 설정 단독 전면 뷰포트) */}
              {activeTab?.viewType === "theme" && (
                <div className="p-6 rounded-2xl bg-slate-950 border border-slate-900 shadow-2xl space-y-6 max-w-3xl">
                  <div className="p-3.5 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center justify-between text-xs font-mono">
                    <span className="text-pink-300 font-bold">🎨 단독 시트 [ʃiːt] 뷰: 시스템 글로벌 Accent 테마 설정</span>
                    <span className="text-slate-400">Hex: {themeHex}</span>
                  </div>
                  <ColorPicker
                    initialHex={themeHex}
                    initialAlpha={themeAlpha}
                    onChange={handleColorChange}
                  />
                </div>
              )}

            </section>
          </div>
        )}

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
              DataWindow File Parser Sandbox v1.55
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