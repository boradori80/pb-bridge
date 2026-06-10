// [Day 15 작업] 파워빌더 소스 분석 및 파싱 유틸리티
// 초보자를 위한 설명: 파워빌더 소스 파일(.srd, .srw 등)을 읽어 구조적 정보와 속성들을 추출해내는 파싱 로직 모음입니다.

import { ParsedPB } from "../types";

/**
 * 헥사 인코딩된 문자열($$HEX...$$ENDHEX$$)을 한글/유니코드 텍스트로 복원하는 함수
 * @param str 원본 문자열
 * @returns 디코딩 완료된 텍스트
 */
export const decodePBHexString = (str: string): string => {
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

/**
 * 연산 필드(compute) 내의 expression 및 기타 속성들을 파싱하는 보조 함수
 * @param content 연산 필드 내용 텍스트
 * @returns 파싱된 속성들의 Key-Value 맵
 */
export const getComputeProperties = (content: string): { [key: string]: string } => {
  const props: { [key: string]: string } = {};
  try {
    const exprMatch = content.match(/expression\s*=\s*"((?:[^"~]|~[\s\S])*)"/i);
    if (exprMatch) {
      props["expression"] = exprMatch[1].replace(/~"/g, '"');
    }
    const propRegex = /([\w.]+)\s*=\s*(?:"((?:[^"~]|~[\s\S])*)"|'([^']*)'|((?:[^()\s]|\([^()]*\))+))/g;
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

/**
 * 파워빌더 소스 원문을 분석하여 사양서 객체로 반환하는 메인 엔진 함수
 * @param originalText 파워빌더 파일 원문 텍스트
 * @param fileName 파워빌더 파일 이름 (확장자 분석에 사용)
 * @returns 구조화되어 분석된 ParsedPB 객체
 */
export const parsePBFile = (originalText: string, fileName: string): ParsedPB => {
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
      const propRegex = /([\w.]+)\s*=\s*(?:"((?:[^"~]|~[\s\S])*)"|'([^']*)'|((?:[^()\s]|\([^()]*\))+))/g;
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
        const propRegex = /([\w.]+)\s*=\s*(?:"((?:[^"~]|~[\s\S])*)"|'([^']*)'|((?:[^()\s]|\([^()]*\))+))/g;
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
    const columnTabsequences: { [key: string]: string } = {};
    const columnProtects: { [key: string]: string } = {};

    const layoutColRegex = /column\s*\(((?:[^()]+|\([^()]*\))*)\)/gi;
    let layoutColMatch;
    while ((layoutColMatch = layoutColRegex.exec(text)) !== null) {
      const colContent = layoutColMatch[1];
      const props: { [key: string]: string } = {};
      const propRegex = /([\w.]+)\s*=\s*(?:"((?:[^"~]|~[\s\S])*)"|'([^']*)'|((?:[^()\s]|\([^()]*\))+))/g;
      let pMatch;
      while ((pMatch = propRegex.exec(colContent)) !== null) {
        props[pMatch[1]] = pMatch[2] || pMatch[3] || pMatch[4] || "";
      }
      if (props.name) {
        const name = props.name.replace(/['"]/g, "");
        if (props.alignment) columnAlignments[name] = props.alignment.replace(/['"]/g, "");
        if (props.tabsequence) columnTabsequences[name] = props.tabsequence.replace(/['"]/g, "");
        if (props.protect) columnProtects[name] = props.protect.replace(/['"]/g, "");
      }
    }

    // 헤더 한글 라벨 매핑 파싱
    const textControlRegex = /text\s*\(((?:[^()]+|\([^()]*\))*)\)/gi;
    let textMatch;
    while ((textMatch = textControlRegex.exec(text)) !== null) {
      const txtContent = textMatch[1];
      const props: { [key: string]: string } = {};
      const propRegex = /([\w.]+)\s*=\s*(?:"((?:[^"~]|~[\s\S])*)"|'([^']*)'|((?:[^()\s]|\([^()]*\))+))/g;
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
      alignment: columnAlignments[col.name] || "0",
      tabsequence: columnTabsequences[col.name] || undefined,
      protect: columnProtects[col.name] || undefined
    }));

  } catch (err: any) {
    result.parseError = (result.parseError ? result.parseError + "\n" : "") + `[테이블 컬럼 명세 분석 예외] ${err.message}`;
  }

  // 4. SQL Retrieve 구문 파싱 (Try-Catch 격리)
  try {
    const retrieveMatch = text.match(/retrieve\s*=\s*"((?:[^"~]|~[\s\S])*)"/i);
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
