"use client";

// ---------------------------------------------------------------------------------------------------------
// [Day 14 작업] React Hooks 및 라이브러리 임포트
// ---------------------------------------------------------------------------------------------------------
// - useState, useEffect, useRef를 활용하여 동적 데이터와 에러 상태를 유기적으로 제어합니다.
// ---------------------------------------------------------------------------------------------------------
import React, { useState, useEffect, useRef } from "react";

// 파워빌더 구조 명세용 타입 선언
interface ComputedFieldInfo {
  name: string;
  expression: string;
  alignment: string;
  band: string;
  label: string;
}

interface ArgumentInfo {
  name: string;
  type: string;
}

interface ColumnInfo {
  name: string;
  type: string;
  dbname: string;
  label?: string;
  alignment?: string;
  [key: string]: string | undefined;
}

interface ParsedPB {
  release: string;
  fileType: string;
  datawindowProps: { [key: string]: string };
  columns: ColumnInfo[];
  computedFields: ComputedFieldInfo[];
  retrieveQuery: string;
  bands: { [key: string]: number };
  controls: Array<{ name: string; type: string }>;
  arguments: ArgumentInfo[];
  parseError?: string; // [Day 14 작업] 구조 분석 중 발생한 예외 저장소
  sqlError?: string;   // [Day 14 작업] SQL 분석 중 발생한 예외 저장소
}

// [Day 11 작업] 헥사 디코더
const decodePBHexString = (str: string): string => {
  if (!str) return "";
  return str.replace(/\$\$HEX\d+\$\$(.*?)\$\$ENDHEX\$\$/gi, (match, hexContent) => {
    let decoded = "";
    for (let i = 0; i < hexContent.length; i += 4) {
      const chunk = hexContent.substring(i, i + 4);
      if (chunk.length === 4) {
        const byte1 = chunk.substring(0, 2);
        const byte2 = chunk.substring(2, 4);
        const swappedHex = byte2 + byte1;
        const codePoint = parseInt(swappedHex, 16);
        decoded += String.fromCharCode(codePoint);
      }
    }
    return decoded;
  });
};

// [Day 13 작업] 연산 필드 속성 파싱 헬퍼 함수
const getComputeProperties = (content: string): { [key: string]: string } => {
  const props: { [key: string]: string } = {};
  try {
    const exprMatch = content.match(/expression\s*=\s*"((?:[^"]|~")*)"/i);
    if (exprMatch) {
      props["expression"] = exprMatch[1].replace(/~"/g, '"');
    }
    const propRegex = /([\w.]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|((?:[^()\s]|\([^()]*\))+))/g;
    let match;
    while ((match = propRegex.exec(content)) !== null) {
      const key = match[1].toLowerCase();
      if (key !== "expression") {
        props[key] = match[2] || match[3] || match[4] || "";
      }
    }
  } catch (e) {
    // 예외 방어
  }
  return props;
};

// ---------------------------------------------------------------------------------------------------------
// [Day 14 작업] 파워빌더 소스 파싱 엔진 (안정성 강화 버전)
// ---------------------------------------------------------------------------------------------------------
const parsePBFile = (originalText: string, fileName: string): ParsedPB => {
  const text = decodePBHexString(originalText);
  const result: ParsedPB = {
    release: "", fileType: "Unknown", datawindowProps: {}, columns: [],
    computedFields: [], retrieveQuery: "", bands: {}, controls: [], arguments: []
  };

  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "srd") result.fileType = "DataWindow (.srd)";
  else if (ext === "srw") result.fileType = "Window (.srw)";
  else if (ext === "sru") result.fileType = "UserObject (.sru)";
  else if (ext === "srp") result.fileType = "Structure (.srp)";

  if (!text) return result;

  // 1. PB Release 버전 파싱
  try {
    const releaseMatch = text.match(/release\s+([\d.]+);?/i);
    if (releaseMatch) result.release = releaseMatch[1];
  } catch (err: any) {
    result.parseError = `[Release 버전 파싱 에러] ${err.message}`;
  }

  // 2. DataWindow 공통 속성 블록 파싱 (Try-Catch 격리)
  try {
    const dwMatch = text.match(/datawindow\s*\(([\s\S]*?)\)/i);
    if (dwMatch) {
      const dwContent = dwMatch[1];
      const propRegex = /([\w.]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|((?:[^()\s]|\([^()]*\))+))/g;
      let match;
      while ((match = propRegex.exec(dwContent)) !== null) {
        result.datawindowProps[match[1]] = match[2] || match[3] || match[4] || "";
      }
      if (!result.release && result.datawindowProps["release"]) {
        result.release = result.datawindowProps["release"];
      }
    }
  } catch (err: any) {
    result.parseError = (result.parseError ? result.parseError + "\n" : "") + `[DataWindow 공통 속성 예외] ${err.message}`;
  }

  // 3. 테이블 컬럼 정의 사양 및 라벨 파싱 (Try-Catch 격리)
  const columnAlignments: { [key: string]: string } = {};
  const columnLabels: { [key: string]: string } = {};

  try {
    let tableContent = "";
    const tableMatch = text.match(/table\s*\(([\s\S]*?)\r?\n\s*\)/i);
    if (tableMatch) {
      tableContent = tableMatch[1];
    } else {
      const tableIndex = text.toLowerCase().indexOf("table(");
      if (tableIndex !== -1) {
        let depth = 1, i = tableIndex + 6;
        while (i < text.length && depth > 0) {
          if (text[i] === '(') depth++;
          else if (text[i] === ')') depth--;
          i++;
        }
        tableContent = text.substring(tableIndex + 6, i - 1);
      }
    }

    if (tableContent) {
      const colRegex = /column\s*=\s*\(((?:[^()]+|\([^()]*\))*)\)/gi;
      let colMatch;
      while ((colMatch = colRegex.exec(tableContent)) !== null) {
        const colContent = colMatch[1];
        const props: { [key: string]: string } = {};
        const propRegex = /([\w.]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|((?:[^()\s]|\([^()]*\))+))/g;
        let pMatch;
        while ((pMatch = propRegex.exec(colContent)) !== null) {
          props[pMatch[1]] = pMatch[2] || pMatch[3] || pMatch[4] || "";
        }
        if (props.name) {
          result.columns.push({
            name: props.name.replace(/['"]/g, ""),
            type: props.type || "char",
            dbname: props.dbname || props.name
          });
        }
      }
    }

    // [Day 11 작업] 디자인 영역 정렬 매핑 파싱
    const layoutColRegex = /column\s*\(((?:[^()]+|\([^()]*\))*)\)/gi;
    let layoutColMatch;
    while ((layoutColMatch = layoutColRegex.exec(text)) !== null) {
      const colContent = layoutColMatch[1];
      const props: { [key: string]: string } = {};
      const propRegex = /([\w.]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|((?:[^()\s]|\([^()]*\))+))/g;
      let pMatch;
      while ((pMatch = propRegex.exec(colContent)) !== null) {
        props[pMatch[1]] = pMatch[2] || pMatch[3] || pMatch[4] || "";
      }
      if (props.name) {
        const name = props.name.replace(/['"]/g, "");
        if (props.alignment) columnAlignments[name] = props.alignment.replace(/['"]/g, "");
      }
    }

    // 헤더 한글 라벨 매핑 파싱
    const textControlRegex = /text\s*\(((?:[^()]+|\([^()]*\))*)\)/gi;
    let textMatch;
    while ((textMatch = textControlRegex.exec(text)) !== null) {
      const txtContent = textMatch[1];
      const props: { [key: string]: string } = {};
      const propRegex = /([\w.]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|((?:[^()\s]|\([^()]*\))+))/g;
      let pMatch;
      while ((pMatch = propRegex.exec(txtContent)) !== null) {
        props[pMatch[1]] = pMatch[2] || pMatch[3] || pMatch[4] || "";
      }
      if (props.name && props.text) {
        const name = props.name.replace(/['"]/g, "");
        if (name.endsWith("_t")) {
          const colKey = name.substring(0, name.length - 2);
          columnLabels[colKey] = props.text.replace(/~"/g, '"').replace(/['"]/g, "");
        }
      }
    }

    result.columns = result.columns.map(col => ({
      ...col,
      label: columnLabels[col.name] || undefined,
      alignment: columnAlignments[col.name] || "0"
    }));

  } catch (err: any) {
    result.parseError = (result.parseError ? result.parseError + "\n" : "") + `[테이블 컬럼 명세 분석 예외] ${err.message}`;
  }

  // 4. SQL Retrieve 구문 파싱 (Try-Catch 격리)
  try {
    const retrieveMatch = text.match(/retrieve\s*=\s*"([\s\S]*?)"/i);
    if (retrieveMatch) {
      result.retrieveQuery = retrieveMatch[1].replace(/~"/g, '"');
    }
  } catch (err: any) {
    result.sqlError = `[SQL 조회 쿼리 분석 예외] ${err.message}`;
  }

  // 5. 조회 인자(Arguments) 파싱 (Try-Catch 격리)
  try {
    const argsMatch = text.match(/arguments\s*=\s*\(((?:[^()]+|\([^()]*\))*)\)/i);
    if (argsMatch) {
      const argsContent = argsMatch[1];
      const argRegex = /\(\s*"([^"]+)"\s*,\s*(\w+)\s*\)/g;
      let argMatch;
      while ((argMatch = argRegex.exec(argsContent)) !== null) {
        result.arguments.push({ name: argMatch[1], type: argMatch[2] });
      }
    }
  } catch (err: any) {
    result.parseError = (result.parseError ? result.parseError + "\n" : "") + `[조회 인자 Arguments 예외] ${err.message}`;
  }

  // 6. [Day 13 작업] Computed Field 연산 필드 파싱 (Try-Catch 격리)
  try {
    const computeRegex = /compute\s*\(((?:[^()]+|\([^()]*\))*)\)/gi;
    let computeMatch;
    while ((computeMatch = computeRegex.exec(text)) !== null) {
      const compContent = computeMatch[1];
      const props = getComputeProperties(compContent);
      if (props.name) {
        const name = props.name.replace(/['"]/g, "");
        result.computedFields.push({
          name,
          expression: props.expression || "",
          alignment: props.alignment ? props.alignment.replace(/['"]/g, "") : "0",
          band: props.band ? props.band.replace(/['"]/g, "") : "detail",
          label: props.text ? props.text.replace(/~"/g, '"').replace(/['"]/g, "") : name
        });
      }
    }
  } catch (err: any) {
    result.parseError = (result.parseError ? result.parseError + "\n" : "") + `[연산 필드 Compute 예외] ${err.message}`;
  }

  // 7. 레이아웃 밴드 높이 파싱
  try {
    const bands = ["header", "detail", "summary", "footer"];
    bands.forEach((band) => {
      const bandRegex = new RegExp(`${band}\\s*\\(([\\s\\S]*?)\\)`, "i");
      const bandMatch = text.match(bandRegex);
      if (bandMatch) {
        const heightMatch = bandMatch[1].match(/height\s*=\s*(\d+)/i);
        if (heightMatch) result.bands[band] = parseInt(heightMatch[1], 10);
      }
    });
  } catch (e) { }

  // 8. Window 컨트롤 파싱
  try {
    const typeRegex = /type\s+(\w+)\s+from\s+(\w+)/gi;
    let typeMatch;
    while ((typeMatch = typeRegex.exec(text)) !== null) {
      const name = typeMatch[1];
      const type = typeMatch[2];
      if (!["window", "userobject", "application", "structure"].includes(type.toLowerCase())) {
        result.controls.push({ name, type });
      }
    }
  } catch (err: any) {
    result.parseError = (result.parseError ? result.parseError + "\n" : "") + `[컨트롤 구조 파싱 예외] ${err.message}`;
  }

  return result;
};

// 정렬용 CSS 매핑 함수
const ALIGN_MAP: { [key: string]: string } = { "0": "text-left", "1": "text-right", "2": "text-center" };
const getAlignClass = (alignCode: string | undefined): string => {
  if (!alignCode) return "text-left";
  return ALIGN_MAP[alignCode.replace(/[^0-9]/g, "")] || "text-left";
};
const getFlexAlignClass = (alignCode: string | undefined): string => {
  if (!alignCode) return "items-start text-left";
  const clean = alignCode.replace(/[^0-9]/g, "");
  if (clean === "1") return "items-end text-right";
  if (clean === "2") return "items-center text-center";
  return "items-start text-left";
};

const isNumericColumn = (type: string | undefined): boolean => {
  if (!type) return false;
  const t = type.toLowerCase();
  return ["number", "long", "decimal", "numeric", "real", "int", "double", "float"].some(kw => t.includes(kw));
};

const formatNumberWithCommas = (val: any): string => {
  if (val === undefined || val === null || val === "") return "";
  let clean = String(val).replace(/[^0-9.]/g, "");
  const parts = clean.split(".");
  if (parts.length > 2) clean = parts[0] + "." + parts.slice(1).join("");
  const integerPart = parts[0];
  const decimalPart = parts[1] !== undefined ? "." + parts[1] : "";
  if (integerPart === "") return decimalPart;
  const num = parseInt(integerPart, 10);
  return isNaN(num) ? val : num.toLocaleString() + decimalPart;
};

const parseToNumeric = (val: any): number => {
  if (val === undefined || val === null) return 0;
  if (typeof val === "number") return val;
  const parsed = parseFloat(String(val).replace(/,/g, "").trim());
  return isNaN(parsed) ? 0 : parsed;
};

const evaluateDWExpression = (expression: string, variables: { [key: string]: any }, columns: ColumnInfo[]): string | number => {
  if (!expression) return "";
  try {
    let expr = expression.toLowerCase();
    const colTypeMap: { [key: string]: string } = {};
    if (columns) columns.forEach(c => { colTypeMap[c.name.toLowerCase()] = (c.type || "").toLowerCase(); });

    const sortedKeys = Object.keys(variables).sort((a, b) => b.length - a.length);
    sortedKeys.forEach((key) => {
      const rawVal = variables[key];
      const isNumeric = isNumericColumn(colTypeMap[key.toLowerCase()]) || !isNaN(parseFloat(String(rawVal).replace(/,/g, "").trim()));
      const replacement = isNumeric ? String(parseToNumeric(rawVal)) : `"${String(rawVal).replace(/"/g, '\\"')}"`;
      expr = expr.replace(new RegExp(`\\b${key.toLowerCase()}\\b`, "g"), replacement);
    });

    let prevExpr;
    do {
      prevExpr = expr;
      expr = expr.replace(/if\s*\(([^,]+),([^,]+),([^)]+)\)/g, "($1 ? $2 : $3)");
    } while (expr !== prevExpr);

    const evalFn = new Function(`return (${expr});`);
    const result = evalFn();
    return typeof result === "number" ? (isNaN(result) ? 0 : Number(result.toFixed(2))) : result ?? "";
  } catch (err) {
    return "연산 오류";
  }
};

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

  const renderDynamicInputField = (column: ColumnInfo) => {
    const colName = column.name;
    const type = (column.type || "").toLowerCase();
    const value = formData[colName] || "";
    const baseInputClass = "w-full px-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all";

    if (type.includes("date") || type.includes("time") || type.includes("timestamp")) {
      return <input type="date" className={baseInputClass} value={value} onChange={(e) => handleFormInputChange(colName, e.target.value)} />;
    }
    if (isNumericColumn(type)) {
      return <input type="text" className={baseInputClass} placeholder="숫자 입력" value={formatNumberWithCommas(value)} onChange={(e) => handleFormInputChange(colName, formatNumberWithCommas(e.target.value))} />;
    }
    return <input type="text" className={baseInputClass} placeholder="텍스트 입력" value={value} onChange={(e) => handleFormInputChange(colName, e.target.value)} />;
  };

  const [columnSearch, setColumnSearch] = useState<string>("");
  const [isSqlFormatted, setIsSqlFormatted] = useState(false);
  const [sqlExecuteLog, setSqlExecuteLog] = useState<string | null>(null);
  const [isExecutingSql, setIsExecutingSql] = useState(false);

  const getSampleValueForColumn = (column: ColumnInfo, rowIndex: number): string => {
    const r = rowIndex + 1;
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

  const highlightSQL = (sql: string): string => {
    if (!sql) return "";
    let escaped = sql.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
      setSqlExecuteLog(`▶ SQL 실행 완료 (성공)\n- 바인딩 변수: ${parsedData.arguments.map(a => `:${a.name}`).join(", ") || "없음"}`);
    }, 800);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const data = parsePBFile(activeFileContent, activeFileName);
    setParsedData(data);
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
            <p className="text-[10px] text-slate-500">Day 14 Stable - Safe Exception Handling Mode</p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 flex flex-col gap-6">
        {/* [Day 14 작업] 프리미엄 예외 피드백 UI 레이어 구역 */}
        {parsedData.parseError && (
          <div className="p-4 bg-rose-950/20 border border-rose-900/40 rounded-xl text-rose-300 text-xs font-mono backdrop-blur-sm shadow-xl flex items-start gap-3">
            <span className="text-base">⚠️</span>
            <div className="space-y-1">
              <strong className="text-rose-400 font-bold block">[Day 14] 파워빌더 구조 분석 중 예외(Exception) 감지됨:</strong>
              <p className="whitespace-pre-wrap leading-relaxed text-rose-200/80">{parsedData.parseError}</p>
            </div>
          </div>
        )}
        {parsedData.sqlError && (
          <div className="p-4 bg-amber-950/20 border border-amber-900/40 rounded-xl text-amber-300 text-xs font-mono backdrop-blur-sm shadow-xl flex items-start gap-3">
            <span className="text-base">💥</span>
            <div className="space-y-1">
              <strong className="text-amber-400 font-bold block">[Day 14] SQL Retrieve 구문 분석 중 문법 예외 격리됨:</strong>
              <p className="whitespace-pre-wrap leading-relaxed text-amber-200/80">{parsedData.sqlError}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
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

          {/* 우측 분석 명세서 */}
          <section className="lg:col-span-7 flex flex-col bg-slate-900/40 border border-slate-900 rounded-2xl p-5 gap-4">
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
              <span className="text-rose-500 italic">-- ⚠️ [Day 14 예외 격리됨] Retrieve 구문이 심각하게 파손되어 SQL을 분리하지 못했습니다. 상단 에러 상세 로그를 확인하세요.</span>
            ) : parsedData.retrieveQuery ? (
              <pre className="text-emerald-400 whitespace-pre-wrap leading-relaxed"><code dangerouslySetInnerHTML={{ __html: highlightSQL(isSqlFormatted ? formatSQL(parsedData.retrieveQuery) : parsedData.retrieveQuery) }} /></pre>
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
                <tr>
                  <th className="p-3 text-center w-12">No.</th>
                  {parsedData.columns.map((c, i) => <th key={i} className={`p-3 font-mono text-slate-300 ${getAlignClass(c.alignment)}`}>{c.label || c.name}</th>)}
                  {parsedData.computedFields.map((comp, i) => <th key={i} className="p-3 text-amber-400 bg-indigo-950/20">🧮 {comp.label || comp.name}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900 text-slate-300">
                {gridData.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-800 transition-all font-mono">
                    <td className="p-3 text-center text-slate-600">{rIdx + 1}</td>
                    {parsedData.columns.map((col, cIdx) => (
                      <td key={cIdx} className="p-1">
                        <input
                          type="text"
                          value={isNumericColumn(col.type) ? formatNumberWithCommas(row[col.name] ?? "") : (row[col.name] ?? "")}
                          onChange={(e) => {
                            const val = e.target.value;
                            setGridData(prev => { const next = [...prev]; if (next[rIdx]) next[rIdx][col.name] = val; return next; });
                          }}
                          className={`w-full bg-transparent px-2 py-1 text-xs text-white border-0 focus:ring-1 focus:ring-indigo-500 rounded ${getAlignClass(col.alignment)}`}
                        />
                      </td>
                    ))}
                    {parsedData.computedFields.map((comp, cpIdx) => {
                      const res = evaluateDWExpression(comp.expression, row, parsedData.columns);
                      return <td key={cpIdx} className={`p-3 text-amber-400 font-bold bg-indigo-950/10 ${getAlignClass(comp.alignment)}`}>{typeof res === "number" ? res.toLocaleString() : res}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 웹 폼 프리뷰 */}
        <section className="bg-slate-950/80 border border-slate-900 rounded-2xl overflow-hidden p-5 flex flex-col gap-4">
          <h3 className="text-sm font-bold text-white">📋 웹 등록 폼 화면 프리뷰 (Form Preview)</h3>
          {parsedData.columns.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/60 p-5 border border-slate-900 rounded-xl max-w-4xl mx-auto w-full">
              {parsedData.columns.map((col, idx) => (
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
            <span className="text-[10px] font-mono text-slate-500">Day 14 Verified Item List</span>
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
// ---------------------------------------------------------------------------------------------------------
// 🌟 [Day 14 주석 마킹 확인 코드 가이드 완료] - 복사 시 반드시 이 주석 하단 중괄호 끝까지 다 긁어가셔야 빌드가 성공합니다!
// ---------------------------------------------------------------------------------------------------------