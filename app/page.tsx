"use client";

// ---------------------------------------------------------------------------------------------------------
// [Day 15 작업] 외부로 분리한 핵심 부품 모듈들을 Import(가져오기)하여 조립
// ---------------------------------------------------------------------------------------------------------
// - 내부 구조체와 파서, 계산기 로직을 외부 파일에서 쏙쏙 뽑아와 가볍고 영리하게 UI만 구동합니다.
// ---------------------------------------------------------------------------------------------------------
import React, { useState, useEffect, useRef } from "react";
import { ColumnInfo, ParsedPB, ArgumentInfo } from "./types";
import { parsePBFile } from "./utils/parser";
import { isNumericColumn, formatNumberWithCommas, evaluateDWExpression } from "./utils/expression";

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

const ALIGN_MAP: { [key: string]: string } = { "0": "text-left", "1": "text-right", "2": "text-center" };
const getAlignClass = (alignCode: string | undefined): string => {
    if (!alignCode) return "text-left";
    return ALIGN_MAP[alignCode.replace(/[^0-9]/g, "")] || "text-left";
};

export default function PBBridgeDashboard() {
    const [history, setHistory] = useState(INITIAL_HISTORY);
    const [activeFileName, setActiveFileName] = useState<string>("dw_sales_summary.srd");
    const [activeFileSize, setActiveFileSize] = useState<string>("1.3 KB");
    const [activeFileContent, setActiveFileContent] = useState<string>(INITIAL_HISTORY[0].sourceCode);
    const [activeFileType, setActiveFileType] = useState<string>("DataWindow (.srd)");

    const [parsedData, setParsedData] = useState<ParsedPB>(parsePBFile(INITIAL_HISTORY[0].sourceCode, "dw_sales_summary.srd"));
    const [formData, setFormData] = useState<{ [key: string]: string }>({});
    const [gridData, setGridData] = useState<Array<{ [key: string]: string }>>([]);

    // [Day 16 작업] 조회 인자(Retrieval Arguments) 실시간 바인딩 관련 React 상태 관리
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
            parsedData.columns.forEach((col) => { initialFormState[col.name] = ""; });
            setFormData(initialFormState);
        } else {
            setFormData({});
        }
    }, [parsedData.columns]);

    const handleFormInputChange = (colName: string, value: string) => {
        setFormData((prev) => ({ ...prev, [colName]: value }));
    };

    // [Day 18 작업] 파워빌더의 tabsequence 및 protect 속성을 분석하여 웹 표준 접근성 속성으로 동적 매핑하는 함수
    const renderDynamicInputField = (column: ColumnInfo) => {
        const colName = column.name;
        const type = (column.type || "").toLowerCase();
        const value = formData[colName] || "";

        const isReadOnly = column.tabsequence === "0" || column.protect === "1";
        const currentTabIndex = isReadOnly ? -1 : parseInt(column.tabsequence || "0", 10);

        const baseInputClass = `w-full px-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all ${isReadOnly ? "opacity-60 cursor-not-allowed select-none bg-slate-950" : ""
            }`;

        if (type.includes("date") || type.includes("time") || type.includes("timestamp")) {
            return (
                <input
                    type="date"
                    className={baseInputClass}
                    value={value}
                    onChange={(e) => !isReadOnly && handleFormInputChange(colName, e.target.value)}
                    readOnly={isReadOnly}
                    tabIndex={currentTabIndex}
                />
            );
        }
        if (isNumericColumn(type)) {
            return (
                <input
                    type="text"
                    className={baseInputClass}
                    placeholder={isReadOnly ? "보호된 필드" : "숫자 입력"}
                    value={formatNumberWithCommas(value)}
                    onChange={(e) => !isReadOnly && handleFormInputChange(colName, formatNumberWithCommas(e.target.value))}
                    readOnly={isReadOnly}
                    tabIndex={currentTabIndex}
                />
            );
        }
        return (
            <input
                type="text"
                className={baseInputClass}
                placeholder={isReadOnly ? "보호된 필드" : "텍스트 입력"}
                value={value}
                onChange={(e) => !isReadOnly && handleFormInputChange(colName, e.target.value)}
                readOnly={isReadOnly}
                tabIndex={currentTabIndex}
            />
        );
    };

    const [columnSearch, setColumnSearch] = useState<string>("");
    const [isSqlFormatted, setIsSqlFormatted] = useState(false);
    const [sqlExecuteLog, setSqlExecuteLog] = useState<string | null>(null);
    const [isExecutingSql, setIsExecutingSql] = useState(false);

    const getSampleValueForColumn = (column: ColumnInfo, rowIndex: number): string => {
        const r = rowIndex + 1;
        const colType = (column.type || "").toLowerCase();
        if (colType.includes("date") || colType.includes("time") || colType.includes("timestamp")) {
            return `2026-06-${String(10 + rowIndex).padStart(2, "0")}`;
        }
        if (isNumericColumn(column.type)) return (r * 12500).toLocaleString();
        if (column.name.toLowerCase().includes("status")) return "Closed";
        return `${column.name} ${r}`;
    };

    useEffect(() => {
        if (parsedData?.columns?.length > 0) {
            const rows = [0, 1, 2].map((rowIndex) => {
                const row: { [key: string]: string } = {};
                parsedData.columns.forEach((col) => { row[col.name] = getSampleValueForColumn(col, rowIndex); });
                return row;
            });
            setGridData(rows);
        } else {
            setGridData([]);
        }
    }, [parsedData.columns]);

    const formatSQL = (sql: string): string => {
        if (!sql) return "";
        const cleaned = sql.replace(/\s+/g, " ").trim();
        let formatted = cleaned.replace(/\b(SELECT|FROM|WHERE|AND|OR)\b/gi, "\n$1\n    ");
        return formatted.split("\n").map(line => line.trim() ? (["SELECT", "FROM", "WHERE", "AND", "OR"].some(kw => new RegExp(`^${kw}$`, "i").test(line.trim())) ? line.trim().toUpperCase() : "    " + line.trim()) : "").filter(Boolean).join("\n");
    };

    // [Day 16 작업] SQL 바인딩 변환부 및 하이라이터
    const highlightSQL = (sql: string, args: { [key: string]: string }, argDefs: ArgumentInfo[]): string => {
        if (!sql) return "";
        let escaped = sql.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

        argDefs.forEach((arg) => {
            const val = args[arg.name] !== undefined ? args[arg.name] : "";
            const isString = arg.type.toLowerCase() === "string" || arg.type.toLowerCase() === "char";

            let displayVal = "";
            let isPlaceholder = false;
            if (val === "") {
                displayVal = `:${arg.name}`;
                isPlaceholder = true;
            } else {
                displayVal = isString ? `'${val}'` : val;
            }

            const escapedVal = displayVal.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

            const spanClass = isPlaceholder
                ? "text-amber-500/70 italic underline decoration-dotted"
                : "text-amber-300 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 shadow-sm transition-all";

            escaped = escaped.replace(
                new RegExp(`:${arg.name}\\b`, "g"),
                `<span class="${spanClass}">${escapedVal}</span>`
            );
        });

        const keywords = ["SELECT", "FROM", "WHERE", "AND", "OR", "INSERT", "UPDATE", "DELETE", "JOIN"];
        keywords.forEach((keyword) => {
            escaped = escaped.replace(new RegExp(`\\b${keyword}\\b`, "gi"), `<span class="text-blue-400 font-bold">${keyword.toUpperCase()}</span>`);
        });

        return escaped;
    };

    const handleExecuteSql = () => {
        if (!parsedData.retrieveQuery) return;
        setIsExecutingSql(true);
        setSqlExecuteLog("Executing SQL query against simulated database...");
        setTimeout(() => {
            setIsExecutingSql(false);
            const bindDetails = parsedData.arguments.map(a => {
                const val = argValues[a.name];
                return `:${a.name} = ${val !== undefined && val !== "" ? `'${val}'` : "(NULL)"}`;
            }).join(", ") || "없음";
            setSqlExecuteLog(`▶ SQL 실행 완료 (성공)\n- 바인딩 변수 값: ${bindDetails}`);
        }, 800);
    };

    const fileInputRef = useRef<HTMLInputElement>(null);

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

    const filteredColumns = (parsedData.columns || []).filter(col => col.name.toLowerCase().includes(columnSearch.toLowerCase()));

    return (
        <div className="min-h-screen bg-[#070b13] text-slate-100 font-sans flex flex-col antialiased">
            <header className="border-b border-slate-900 bg-[#070b13]/80 backdrop-blur-md sticky top-0 z-10 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg">
                        <span className="text-white font-bold">PB</span>
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-white">PB-Bridge Dashboard 🚀</h1>
                        <p className="text-[10px] text-slate-500">Day 20 Stable - Form Key Warning Fixed</p>
                    </div>
                </div>
            </header>

            <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 flex flex-col gap-6">
                {/* [Day 14 작업] 프리미엄 예외 피드백 UI 레이어 구역 */}
                {parsedData.parseError && (
                    <div className="p-4 bg-rose-950/20 border border-rose-900/40 rounded-xl text-rose-300 text-xs font-mono backdrop-blur-sm shadow-xl flex items-start gap-3">
                        <span className="text-base">⚠️</span>
                        <div className="space-y-1">
                            <strong className="text-rose-400 font-bold block">[Day 15] 구조 분석 예외 실시간 가둠 로그:</strong>
                            <p className="whitespace-pre-wrap leading-relaxed text-rose-200/80">{parsedData.parseError}</p>
                        </div>
                    </div>
                )}
                {parsedData.sqlError && (
                    <div className="p-4 bg-amber-950/20 border border-amber-900/40 rounded-xl text-amber-300 text-xs font-mono backdrop-blur-sm shadow-xl flex items-start gap-3">
                        <span className="text-base">💥</span>
                        <div className="space-y-1">
                            <strong className="text-amber-400 font-bold block">[Day 15] SQL 구문 분석 예외 격리 로그:</strong>
                            <p className="whitespace-pre-wrap leading-relaxed text-amber-200/80">{parsedData.sqlError}</p>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-strong">
                    {/* 좌측 소스 에디터 */}
                    <section className="lg:col-span-5 flex flex-col bg-slate-950/80 border border-slate-900 rounded-2xl overflow-hidden shadow-xl">
                        <div className="p-4 border-b border-slate-900 bg-slate-900/30 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-white">📄 소스 코드 에디터</h3>
                            <button onClick={() => fileInputRef.current?.click()} className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-xs font-bold text-white transition-all">업로드</button>
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".srd,.srw,.sru,.srp" />
                        </div>
                        <div className="px-4 py-2 bg-slate-900/50 border-b border-slate-900 text-xs font-mono text-slate-400 flex justify-between">
                            <span>{activeFileName}</span><span>{activeFileSize}</span>
                        </div>
                        <pre className="p-4 font-mono text-xs text-indigo-300 bg-[#05080f]/90 overflow-x-auto max-h-[400px] whitespace-pre">{activeFileContent}</pre>
                    </section>

                    {/* 우측 분석 명세 및 바인딩 입력란 컨테이너 */}
                    <div className="lg:col-span-7 flex flex-col gap-6">
                        {/* 파싱 정보 요약 보고서 */}
                        <section className="flex flex-col bg-slate-900/40 border border-slate-900 rounded-2xl p-5 gap-4">
                            <h3 className="text-sm font-bold text-white">🔍 파싱 정보 요약 보고서</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                                <div className="bg-slate-950 p-3 rounded-xl border border-slate-850">
                                    <span className="text-[10px] text-slate-500 block uppercase">타입</span>
                                    <span className="text-xs font-bold text-emerald-400 font-mono mt-1 block">{activeFileType}</span>
                                </div>
                                <div className="bg-slate-950 p-3 rounded-xl border border-slate-850">
                                    <span className="text-[10px] text-slate-500 block uppercase">PB Release</span>
                                    <span className="text-xs font-bold text-yellow-400 font-mono mt-1 block">{parsedData.release ? `v${parsedData.release}` : "미감지"}</span>
                                </div>
                                <div className="bg-slate-950 p-3 rounded-xl border border-slate-850">
                                    <span className="text-[10px] text-slate-500 block uppercase font-mono">Columns</span>
                                    <span className="text-xs font-bold text-indigo-400 font-mono mt-1 block">{parsedData.columns?.length || 0} EA</span>
                                </div>
                                <div className="bg-slate-950 p-3 rounded-xl border border-slate-850">
                                    <span className="text-[10px] text-slate-500 block uppercase font-mono">Computed</span>
                                    <span className="text-xs font-bold text-amber-400 font-mono mt-1 block">{parsedData.computedFields?.length || 0} EA</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">분석된 컬럼 명세서</span>
                                    <input type="text" placeholder="컬럼 필터링..." value={columnSearch} onChange={(e) => setColumnSearch(e.target.value)} className="px-2.5 py-1 bg-slate-950 border border-slate-850 rounded text-xs text-white" />
                                </div>
                                <div className="max-h-40 overflow-y-auto border border-slate-950 rounded-xl bg-slate-950/40 text-xs font-mono scrollbar-thin">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-950 text-slate-400 sticky top-0 font-bold">
                                            <tr><th className="p-2 pl-4">No.</th><th className="p-2">컬럼명</th><th className="p-2">타입</th><th className="p-2">정렬</th></tr>
                                        </thead>
                                        <tbody>
                                            {filteredColumns.map((c, i) => (
                                                <tr key={i} className="border-b border-slate-900/60 hover:bg-slate-800/40 text-slate-300">
                                                    <td className="p-2 pl-4 text-slate-500">{i + 1}</td>
                                                    <td className="p-2 font-bold text-indigo-300">{c.name}</td>
                                                    <td className="p-2 text-slate-400">{c.type}</td>
                                                    <td className="p-2 text-slate-400">{c.alignment === "1" ? "우측" : c.alignment === "2" ? "중앙" : "좌측"}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </section>

                        {/* [Day 16 작업] Retrieval Arguments 실시간 바인딩 입력란 */}
                        <section className="flex flex-col bg-slate-900/40 border border-slate-900 rounded-2xl p-5 gap-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                    <span>🔑 Retrieval Arguments 실시간 바인딩 입력란</span>
                                </h3>
                                <span className="px-2 py-0.5 text-[10px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded">
                                    실시간 SQL & 연산 필드 바인딩 중
                                </span>
                            </div>

                            {parsedData.arguments && parsedData.arguments.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {parsedData.arguments.map((arg, idx) => (
                                        <div key={idx} className="flex flex-col gap-1.5 bg-slate-950/40 p-3 rounded-xl border border-slate-900/60">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-indigo-300 font-mono flex items-center gap-1">
                                                    <span className="text-indigo-500 text-[10px]">:</span>{arg.name}
                                                </span>
                                                <span className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-slate-900 text-slate-400 border border-slate-800">
                                                    {arg.type}
                                                </span>
                                            </div>
                                            <input
                                                type="text"
                                                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg text-xs font-mono text-white placeholder-slate-600 transition-all shadow-inner"
                                                placeholder={`${arg.type.toLowerCase() === 'number' ? '예: 50000 (숫자)' : '예: Closed (문자열)'}`}
                                                value={argValues[arg.name] || ""}
                                                onChange={(e) => handleArgChange(arg.name, e.target.value)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-6 text-slate-500 text-xs italic bg-slate-950/20 rounded-xl border border-dashed border-slate-900">
                                    탐지된 조회용 인자(Retrieval Arguments)가 존재하지 않습니다.
                                </div>
                            )}
                        </section>
                    </div>
                </div>

                {/* SQL 에디터 섹션 */}
                <section className="bg-black border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
                    <div className="bg-zinc-950 px-4 py-2 border-b border-zinc-900 flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-500">SQL Editor (SCOTT@xe)</span>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setIsSqlFormatted(true)} className={`px-2 py-1 rounded text-xs font-semibold ${isSqlFormatted ? "bg-indigo-600 text-white" : "bg-zinc-900 text-zinc-400"}`}>정렬</button>
                            <button onClick={() => setIsSqlFormatted(false)} className={`px-2 py-1 rounded text-xs font-semibold ${!isSqlFormatted ? "bg-indigo-600 text-white" : "bg-zinc-900 text-zinc-400"}`}>원문</button>
                            <button onClick={handleExecuteSql} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded">Run</button>
                        </div>
                    </div>
                    <div className="flex bg-black min-h-[120px] font-mono text-xs p-4 overflow-x-auto">
                        {parsedData.sqlError ? (
                            <span className="text-rose-500 italic">-- ⚠️ Retrieve 구문이 심각하게 파손되어 SQL을 분리하지 못했습니다. 상단 에러 상세 로그를 확인하세요.</span>
                        ) : parsedData.retrieveQuery ? (
                            <pre className="text-emerald-400 whitespace-pre-wrap leading-relaxed"><code dangerouslySetInnerHTML={{ __html: highlightSQL(isSqlFormatted ? formatSQL(parsedData.retrieveQuery) : parsedData.retrieveQuery, argValues, parsedData.arguments) }} /></pre>
                        ) : (
                            <span className="text-zinc-600 italic">-- 파싱된 조회용 SQL 구문이 없습니다.</span>
                        )}
                    </div>
                    {sqlExecuteLog && <div className="bg-zinc-950 border-t border-zinc-900 p-3 font-mono text-[11px] text-zinc-400 whitespace-pre-wrap">{sqlExecuteLog}</div>}
                </section>

                {/* 웹 그리드 프리뷰 */}
                <section className="bg-slate-950/80 border border-slate-900 rounded-2xl overflow-hidden shadow-2xl p-5 flex flex-col gap-4">
                    <h3 className="text-sm font-bold text-white">💻 웹 변환 화면 프리뷰 (Grid Preview)</h3>
                    <div className="overflow-x-auto border border-slate-900 rounded-xl max-h-48 scrollbar-thin">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-900 text-slate-400 font-bold sticky top-0 border-b border-slate-900">
                                <tr style={{ height: parsedData?.bands?.header ? `${parsedData.bands.header / 2}px` : "44px" }}>
                                    <th className="p-3 text-center w-12">No.</th>
                                    {parsedData.columns.map((c, i) => <th key={i} className={`p-3 font-mono text-slate-300 ${getAlignClass(c.alignment)}`}>{c.label || c.name}</th>)}
                                    {parsedData.computedFields.map((comp, i) => <th key={i} className="p-3 text-amber-400 bg-indigo-950/20">🧮 {comp.label || comp.name}</th>)}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-900 text-slate-300">
                                {gridData.map((row, rIdx) => (
                                    <tr
                                        key={rIdx}
                                        style={{ height: parsedData?.bands?.detail ? `${parsedData.bands.detail / 2}px` : "40px" }}
                                        className="hover:bg-slate-800 transition-all font-mono"
                                    >
                                        <td className="p-3 text-center text-slate-600">{rIdx + 1}</td>
                                        {parsedData.columns.map((col, cIdx) => {
                                            const isCellReadOnly = col.tabsequence === "0" || col.protect === "1";
                                            const cellAlignClass = getAlignClass(col.alignment);
                                            const colType = (col.type || "").toLowerCase();

                                            // ---------------------------------------------------------------------------------------------------------
                                            // [Day 20 작업] 데이터 타입별 동적 switch-case 조건부 렌더링 부품 배치 구역
                                            // ---------------------------------------------------------------------------------------------------------
                                            const renderGridCellInput = () => {
                                                const baseClass = "w-full bg-transparent px-2 py-1 text-xs border-0 focus:outline-none rounded transition-all";
                                                const stateClass = isCellReadOnly
                                                    ? "bg-slate-950/60 text-slate-500 cursor-not-allowed italic"
                                                    : "text-white focus:ring-1 focus:ring-indigo-500";
                                                const tabIndexValue = isCellReadOnly ? -1 : 0;

                                                if (colType.includes("date") || colType.includes("time") || colType.includes("timestamp")) {
                                                    return (
                                                        <input
                                                            type="date"
                                                            value={row[col.name] ?? ""}
                                                            readOnly={isCellReadOnly}
                                                            tabIndex={tabIndexValue}
                                                            onChange={(e) => {
                                                                if (isCellReadOnly) return;
                                                                setGridData(prev => {
                                                                    const next = [...prev];
                                                                    if (next[rIdx]) next[rIdx][col.name] = e.target.value;
                                                                    return next;
                                                                });
                                                            }}
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
                                                            onChange={(e) => {
                                                                if (isCellReadOnly) return;
                                                                const val = formatNumberWithCommas(e.target.value);
                                                                setGridData(prev => {
                                                                    const next = [...prev];
                                                                    if (next[rIdx]) next[rIdx][col.name] = val;
                                                                    return next;
                                                                });
                                                            }}
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
                                                        onChange={(e) => {
                                                            if (isCellReadOnly) return;
                                                            setGridData(prev => {
                                                                const next = [...prev];
                                                                if (next[rIdx]) next[rIdx][col.name] = e.target.value;
                                                                return next;
                                                            });
                                                        }}
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
                                        {parsedData.computedFields.map((comp, cpIdx) => {
                                            const mergedColumns = [
                                                ...parsedData.columns,
                                                ...parsedData.arguments.map(arg => ({
                                                    name: arg.name,
                                                    type: arg.type,
                                                    dbname: arg.name
                                                }))
                                            ];
                                            const res = evaluateDWExpression(comp.expression, { ...row, ...argValues }, mergedColumns);
                                            return <td key={cpIdx} className={`p-3 text-amber-400 font-bold bg-indigo-950/10 ${getAlignClass(comp.alignment)}`} title={comp.expression}>{typeof res === "number" ? res.toLocaleString() : res}</td>;
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* 📋 웹 등록 폼 화면 프리뷰 (Form Preview) */}
                <section className="bg-slate-950/80 border border-slate-900 rounded-2xl overflow-hidden p-5 flex flex-col gap-4">
                    <h3 className="text-sm font-bold text-white">📋 웹 등록 폼 화면 프리뷰 (Form Preview)</h3>
                    {parsedData.columns.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/60 p-5 border border-slate-900 rounded-xl max-w-4xl mx-auto w-full">
                            {parsedData.columns.map((col, idx) => (
                                // 📌 [Day 20 최적화] 개별 바구니 엘리먼트에 고유 식별 명찰(key={idx})을 명시하여 React 렌더링 경고를 소멸시킵니다.
                                <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-900/40">
                                    <label className="sm:w-1/3 text-xs font-bold text-slate-300">{col.label || col.name}</label>
                                    <div className="sm:w-2/3">{renderDynamicInputField(col)}</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-6 text-slate-500 text-xs italic">프리뷰를 표시할 수 있는 유효한 데이터윈도우 사양이 존재하지 않습니다.</div>
                    )}
                </section>

                {/* 히스토리 및 데모 샌드박스 */}
                <section className="bg-slate-900/40 border border-slate-900 rounded-2xl overflow-hidden shadow-xl">
                    <div className="p-4 border-b border-slate-900 bg-slate-950/40 flex justify-between items-center">
                        <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">전체 파일 변환 히스토리 및 데모 샌드박스</h3>
                        <span className="text-[10px] font-mono text-slate-500">Day 15 Clean Scaled Architecture</span>
                    </div>
                    <div className="overflow-x-auto font-mono text-xs">
                        <table className="w-full text-left">
                            <thead className="bg-slate-950 text-slate-500">
                                <tr className="border-b border-slate-900"><th className="p-3 pl-6">파일명</th><th className="p-3">종류</th><th className="p-3">타겟 컴포넌트</th><th className="p-3">크기</th><th className="p-3 text-center">결과</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-900 bg-slate-950/10 text-slate-300">
                                {history.map((item) => (
                                    <tr key={item.id} onClick={() => handleSelectHistoryItem(item)} className={`hover:bg-slate-900/40 cursor-pointer ${item.fileName === activeFileName ? "bg-indigo-600/10 font-bold" : ""}`}>
                                        <td className="p-3 pl-6 text-white font-semibold">{item.fileName}</td>
                                        <td className="p-3 text-slate-400">{item.fileType}</td>
                                        <td className="p-3 text-slate-300">{item.targetType}</td>
                                        <td className="p-3 text-slate-500">{item.size}</td>
                                        <td className="p-3 text-center">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.id === "4" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : item.status === "Completed" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                                                {item.id === "4" ? "Corrupted" : item.status === "Completed" ? "Success" : "Failed"}
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