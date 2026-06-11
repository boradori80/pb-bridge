// [Day 21 작업] 파워빌더 브릿지 메인 대시보드 - Thin Controller 패턴 조립화 리팩토링
"use client";

import React, { useState, useEffect } from "react";
import { ParsedPB } from "./types";
import { parsePBFile } from "./utils/parser";

import SourceEditor from "./components/SourceEditor";
import ParsingSummary from "./components/ParsingSummary";
import SqlEditor from "./components/SqlEditor";
import GridPreview from "./components/GridPreview";
import FormPreview from "./components/FormPreview";

// 초기 히스토리 더미 데이터 (구조 유지를 위해 보관)
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
  },
  {
    id: "3",
    fileName: "uo_db_connector.sru",
    fileType: "UserObject (.sru)",
    targetType: "React Context / API",
    size: "0.6 KB",
    date: "2026-05-21 16:30",
    status: "Failed",
    sourceCode: `release 10.5;\nglobal type uo_db_connector from userobject\nend type`,
    code: `[ERROR] Failed to compile uo_db_connector.sru`
  },
  {
    id: "4",
    fileName: "dw_corrupt_test.srd",
    fileType: "DataWindow (.srd)",
    targetType: "React Table (Corrupted Spec)",
    size: "0.9 KB",
    date: "2026-06-04 13:00",
    status: "Completed",
    sourceCode: `$PBExportHeader$dw_corrupt_test.srd\nrelease 11.5;\ndatawindow(release=11.5 processing=1\nheader(height=50\ntable(column=(type=char(10) name=emp_id\n column=(type=number name=salary \n column=(broken_format_without_close_bracket=\n retrieve="SELECT emp_id, salary FROM employee WHERE (💥BROKEN_SYNTAX_ERROR!!"\n arguments=(("as_emp", string)\n)\ntext(band=header text="사원명_오류" name=emp_id_t )\ncompute(band=detail expression="salary * 💥FATAL_COMPUTE_ERROR" name=broken_calc )`,
    code: `// 파싱 예외 복구 시뮬레이션 코드`
  }
];

export default function PBBridgeDashboard() {
  const [history, setHistory] = useState(INITIAL_HISTORY);
  const [activeFileName, setActiveFileName] = useState<string>("dw_sales_summary.srd");
  const [activeFileSize, setActiveFileSize] = useState<string>("1.3 KB");
  const [activeFileContent, setActiveFileContent] = useState<string>(INITIAL_HISTORY[0].sourceCode);
  const [activeFileType, setActiveFileType] = useState<string>("DataWindow (.srd)");

  const [parsedData, setParsedData] = useState<ParsedPB>(parsePBFile(INITIAL_HISTORY[0].sourceCode, "dw_sales_summary.srd"));
  const [formData, setFormData] = useState<{ [key: string]: string }>({});
  const [gridData, setGridData] = useState<Array<{ [key: string]: string }>>([]);

  // [Day 16 작업] Retrieval Arguments 실시간 바인딩 관련 React 상태 관리
  const [argValues, setArgValues] = useState<{ [key: string]: string }>({});

  const handleArgChange = (argName: string, value: string) => {
    setArgValues((prev) => ({ ...prev, [argName]: value }));
  };

  useEffect(() => {
    if (parsedData?.arguments?.length > 0) {
      const initialArgs: { [key: string]: string } = {};
      parsedData.arguments.forEach((arg) => {
        if (activeFileName === "dw_sales_summary.srd") {
          if (arg.name === "as_status") initialArgs[arg.name] = "Closed";
          else if (arg.name === "an_sales") initialArgs[arg.name] = "50000";
          else initialArgs[arg.name] = "";
        } else {
          initialArgs[arg.name] = "";
        }
      });
      setArgValues(initialArgs);
    } else {
      setArgValues({});
    }
  }, [parsedData.arguments, activeFileName]);

  useEffect(() => {
    if (parsedData?.columns?.length > 0) {
      const initialFormState: { [key: string]: string } = {};
      parsedData.columns.forEach((col) => {
        initialFormState[col.name] = "";
      });
      setFormData(initialFormState);
    } else {
      setFormData({});
    }
  }, [parsedData.columns]);

  const handleFormInputChange = (colName: string, value: string) => {
    setFormData((prev) => ({ ...prev, [colName]: value }));
  };

  const [columnSearch, setColumnSearch] = useState<string>("");
  const [isSqlFormatted, setIsSqlFormatted] = useState(false);
  const [sqlExecuteLog, setSqlExecuteLog] = useState<string | null>(null);
  const [isExecutingSql, setIsExecutingSql] = useState(false);

  const getSampleValueForColumn = (column: any, rowIndex: number): string => {
    const r = rowIndex + 1;
    const colType = (column.type || "").toLowerCase();
    if (
      colType.includes("date") ||
      colType.includes("time") ||
      colType.includes("timestamp")
    ) {
      return `2026-06-${String(10 + rowIndex).padStart(2, "0")}`;
    }
    const numTypes = [
      "number",
      "decimal",
      "numeric",
      "double",
      "real",
      "float",
      "integer",
      "int",
      "long",
      "ulong",
    ];
    const isNum = numTypes.some((t) => colType.includes(t));
    if (isNum) return (r * 12500).toLocaleString();
    if (column.name.toLowerCase().includes("status")) return "Closed";
    return `${column.name} ${r}`;
  };

  useEffect(() => {
    if (parsedData?.columns?.length > 0) {
      const rows = [0, 1, 2].map((rowIndex) => {
        const row: { [key: string]: string } = {};
        parsedData.columns.forEach((col) => {
          row[col.name] = getSampleValueForColumn(col, rowIndex);
        });
        return row;
      });
      setGridData(rows);
    } else {
      setGridData([]);
    }
  }, [parsedData.columns]);

  const handleExecuteSql = () => {
    if (!parsedData.retrieveQuery) return;
    setIsExecutingSql(true);
    setSqlExecuteLog("Executing SQL query against simulated database...");
    setTimeout(() => {
      setIsExecutingSql(false);
      const bindDetails =
        parsedData.arguments
          .map((a) => {
            const val = argValues[a.name];
            return `:${a.name} = ${
              val !== undefined && val !== "" ? `'${val}'` : "(NULL)"
            }`;
          })
          .join(", ") || "없음";
      setSqlExecuteLog(`▶ SQL 실행 완료 (성공)\n- 바인딩 변수 값: ${bindDetails}`);
    }, 800);
  };

  useEffect(() => {
    const data = parsePBFile(activeFileContent, activeFileName);
    setParsedData(data);
    setActiveFileType(data.fileType);
    setColumnSearch("");
    setSqlExecuteLog(null);
    setIsSqlFormatted(false);
  }, [activeFileContent, activeFileName]);

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

  const handleSelectHistoryItem = (item: any) => {
    setActiveFileName(item.fileName);
    setActiveFileSize(item.size);
    setActiveFileContent(item.sourceCode || "");
    setActiveFileType(item.fileType);
  };

  return (
    <div className="min-h-screen bg-[#070b13] text-slate-100 font-sans flex flex-col antialiased">
      <header className="border-b border-slate-900 bg-[#070b13]/80 backdrop-blur-md sticky top-0 z-10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg">
            <span className="text-white font-bold">PB</span>
          </div>
          <div>
            <h1 className="text-xl font-black text-white">
              PB-Bridge Dashboard 🚀
            </h1>
            <p className="text-[10px] text-slate-500">
              Day 21 Refactored - Component Split
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 flex flex-col gap-6">
        {/* [Day 14 작업] 프리미엄 예외 피드백 UI 레이어 구역 */}
        {parsedData.parseError && (
          <div className="p-4 bg-rose-950/20 border border-rose-900/40 rounded-xl text-rose-300 text-xs font-mono backdrop-blur-sm shadow-xl flex items-start gap-3">
            <span className="text-base">⚠️</span>
            <div className="space-y-1">
              <strong className="text-rose-400 font-bold block">
                [Day 15] 구조 분석 예외 실시간 가둠 로그:
              </strong>
              <p className="whitespace-pre-wrap leading-relaxed text-rose-200/80">
                {parsedData.parseError}
              </p>
            </div>
          </div>
        )}
        {parsedData.sqlError && (
          <div className="p-4 bg-amber-950/20 border border-amber-900/40 rounded-xl text-amber-300 text-xs font-mono backdrop-blur-sm shadow-xl flex items-start gap-3">
            <span className="text-base">💥</span>
            <div className="space-y-1">
              <strong className="text-amber-400 font-bold block">
                [Day 15] SQL 구문 분석 예외 격리 로그:
              </strong>
              <p className="whitespace-pre-wrap leading-relaxed text-amber-200/80">
                {parsedData.sqlError}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-strong">
          {/* 소스 코드 에디터 */}
          <SourceEditor
            activeFileName={activeFileName}
            activeFileSize={activeFileSize}
            activeFileContent={activeFileContent}
            onFileChange={handleFileChange}
          />

          {/* 파싱 정보 요약 보고서 & Retrieval Arguments */}
          <ParsingSummary
            activeFileType={activeFileType}
            parsedData={parsedData}
            columnSearch={columnSearch}
            onColumnSearchChange={setColumnSearch}
            argValues={argValues}
            onArgChange={handleArgChange}
          />
        </div>

        {/* SQL 에디터 섹션 */}
        <SqlEditor
          parsedData={parsedData}
          argValues={argValues}
          isSqlFormatted={isSqlFormatted}
          onSqlFormatChange={setIsSqlFormatted}
          sqlExecuteLog={sqlExecuteLog}
          isExecutingSql={isExecutingSql}
          onExecuteSql={handleExecuteSql}
        />

        {/* 웹 그리드 프리뷰 */}
        <GridPreview
          parsedData={parsedData}
          gridData={gridData}
          setGridData={setGridData}
          argValues={argValues}
        />

        {/* 웹 등록 폼 프리뷰 */}
        <FormPreview
          parsedData={parsedData}
          formData={formData}
          onFormInputChange={handleFormInputChange}
        />

        {/* 히스토리 및 데모 샌드박스 */}
        <section className="bg-slate-900/40 border border-slate-900 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-900 bg-slate-950/40 flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">
              전체 파일 변환 히스토리 및 데모 샌드박스
            </h3>
            <span className="text-[10px] font-mono text-slate-500">
              Day 15 Clean Scaled Architecture
            </span>
          </div>
          <div className="overflow-x-auto font-mono text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-950 text-slate-500">
                <tr className="border-b border-slate-900">
                  <th className="p-3 pl-6">파일명</th>
                  <th className="p-3">종류</th>
                  <th className="p-3">타겟 컴포넌트</th>
                  <th className="p-3">크기</th>
                  <th className="p-3 text-center">결과</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900 bg-slate-950/10 text-slate-300">
                {history.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => handleSelectHistoryItem(item)}
                    className={`hover:bg-slate-900/40 cursor-pointer ${
                      item.fileName === activeFileName
                        ? "bg-indigo-600/10 font-bold"
                        : ""
                    }`}
                  >
                    <td className="p-3 pl-6 text-white font-semibold">
                      {item.fileName}
                    </td>
                    <td className="p-3 text-slate-400">{item.fileType}</td>
                    <td className="p-3 text-slate-300">{item.targetType}</td>
                    <td className="p-3 text-slate-500">{item.size}</td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.id === "4"
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : item.status === "Completed"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-red-500/10 text-red-400"
                        }`}
                      >
                        {item.id === "4"
                          ? "Corrupted"
                          : item.status === "Completed"
                          ? "Success"
                          : "Failed"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}