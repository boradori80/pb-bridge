"use client";

// ---------------------------------------------------------------------------------------------------------
// [교육용 주석 - React Hooks 및 라이브러리 임포트]
// ---------------------------------------------------------------------------------------------------------
// - useState, useEffect, useRef는 React에서 제공하는 'Hooks(훅)'라는 특별한 함수들입니다.
// - 파워빌더에서 Window 오브젝트를 만들고 그 안에 인스턴스 변수 선언, open 이벤트 작성, 컨트롤 제어하는 것과 대응됩니다.
// - React에서는 클래스 기반이 아닌 '함수 컴포넌트'를 주로 사용하며, 훅을 사용하여 상태와 라이프사이클을 처리합니다.
// ---------------------------------------------------------------------------------------------------------
import React, { useState, useEffect, useRef } from "react";

// ---------------------------------------------------------------------------------------------------------
// [교육용 주석 - 파워빌더 파일의 파싱 결과를 담을 타입 선언 (TypeScript)]
// ---------------------------------------------------------------------------------------------------------
// - C++이나 파워빌더의 Structure(구조체)처럼 데이터의 구조를 정의합니다.
// - TypeScript를 사용하여 데이터의 필드 타입(string, array 등)을 명확하게 규정하여 버그를 사전에 방지합니다.
// ---------------------------------------------------------------------------------------------------------
interface ArgumentInfo {
  name: string;
  type: string;
}

interface ColumnInfo {
  name: string;
  type: string;
  dbname: string;
  [key: string]: string; // 추가적인 속성들을 유연하게 담을 수 있도록 선언
}

interface ParsedPB {
  release: string; // release 뒤의 파워빌더 버전 숫자
  fileType: string; // DataWindow (.srd), Window (.srw) 등 파일 형식
  datawindowProps: { [key: string]: string }; // datawindow() 내부의 키-값 속성들
  columns: ColumnInfo[]; // 컬럼 리스트
  retrieveQuery: string; // SQL SELECT 쿼리문
  bands: { [key: string]: number }; // 각 밴드(header, detail 등)의 높이 정보
  controls: Array<{ name: string; type: string }>; // Window/UserObject의 컨트롤 목록
  arguments: ArgumentInfo[]; // 조회 인자(Retrieval Arguments) 리스트
}

// ---------------------------------------------------------------------------------------------------------
// [교육용 주석 - 정규표현식을 이용한 파싱 엔진 (Parsing Engine)]
// ---------------------------------------------------------------------------------------------------------
// - 사용자로부터 입력받은 파워빌더 원본 소스 코드(Text)를 정규표현식(Regex)으로 탐색하여 메타데이터를 추출합니다.
// - 파워빌더의 String 처리 함수나 SQL Substring 추출 작업과 매핑되는 로직입니다.
// ---------------------------------------------------------------------------------------------------------
const parsePBFile = (text: string, fileName: string): ParsedPB => {
  const result: ParsedPB = {
    release: "",
    fileType: "Unknown",
    datawindowProps: {},
    columns: [],
    retrieveQuery: "",
    bands: {},
    controls: [],
    arguments: []
  };

  // 확장자를 통해 파일 타입을 판별합니다.
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "srd") {
    result.fileType = "DataWindow (.srd)";
  } else if (ext === "srw") {
    result.fileType = "Window (.srw)";
  } else if (ext === "sru") {
    result.fileType = "UserObject (.sru)";
  } else if (ext === "srp") {
    result.fileType = "Structure (.srp)";
  }

  if (!text) return result;

  // ---------------------------------------------------------------------------------------------------------
  // [교육용 주석 - match() 함수]
  // - match()는 자바스크립트의 문자열(String) 객체가 제공하는 함수로, 정규표현식을 사용하여 매칭되는 부분을 찾습니다.
  // - 파워빌더의 `Match(string, regex)` 함수와 용도는 비슷하지만,
  //   파워빌더는 패턴 존재 여부(True/False)만 반환하는 반면, 자바스크립트의 match()는 검색 결과를 배열 형태로 반환하여 매칭된 텍스트 그룹을 직접 뽑아내 줍니다.
  // - regex 패턴 설명: /release\s+([\d.]+)/i
  //   - release: 'release' 문자열을 매칭
  //   - \s+: 하나 이상의 공백 문자(스페이스, 탭 등)
  //   - ([\d.]+): 숫자(\d)와 마침표(.)가 1번 이상 반복되는 것을 그룹화해 추출
  //   - /i: 대소문자 구분 없음 (Release, RELEASE 모두 매칭)
  // ---------------------------------------------------------------------------------------------------------
  const releaseMatch = text.match(/release\s+([\d.]+);?/i);
  if (releaseMatch) {
    result.release = releaseMatch[1]; // 첫 번째 괄호에서 추출된 버전을 저장 (예: "10.5")
  }

  // 1. DataWindow 속성 블록 추출 (datawindow( ... ) 영역 탐색)
  // - regex 패턴 설명: /datawindow\s*\(([\s\S]*?)\)/i
  //   - \s*: 0개 이상의 공백
  //   - \(: 여는 괄호
  //   - ([\s\S]*?): 줄바꿈(\s)과 줄바꿈이 아닌 것(\S)을 포함한 모든 문자(즉 개행 포함 전체 텍스트)를 최소한으로 매칭
  //   - \): 닫는 괄호
  const dwMatch = text.match(/datawindow\s*\(([\s\S]*?)\)/i);
  if (dwMatch) {
    const dwContent = dwMatch[1];
    
    // datawindow 내부의 key=value 쌍들을 모두 추출합니다.
    // 예: processing=0, font.face="Arial", background.color="553648127"
    // regex 패턴 설명: /([\w.]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|((?:[^()\s]|\([^()]*\))+))/g
    //   - ([\w.]+): 영문자, 숫자, 언더바, 마침표로 이루어진 키 이름 (예: background.color)
    //   - = : 등호 매칭
    //   - "(.*?)" | '(.*?)' | ([^()\s]|\([^()]*\))+: 큰따옴표 안, 작은따옴표 안, 혹은 공백/괄호가 섞이지 않은 값(중첩 괄호 1단계 포함)
    //   - /g: 문서 전체에서 매칭되는 모든 건을 찾는 글로벌 플래그
    const propRegex = /([\w.]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|((?:[^()\s]|\([^()]*\))+))/g;
    let match;
    while ((match = propRegex.exec(dwContent)) !== null) {
      const key = match[1];
      const value = match[2] || match[3] || match[4] || "";
      result.datawindowProps[key] = value;
    }

    // 만약 상단에 release 선언이 없고 datawindow 선언 내부에 release=10.5 가 있다면 이를 버전으로 채택합니다.
    if (!result.release && result.datawindowProps["release"]) {
      result.release = result.datawindowProps["release"];
    }
  }

  // ---------------------------------------------------------------------------------------------------------
  // [교육용 주석 - 정규표현식(Regex)을 이용한 다중 매칭(Multiple Matching)의 원리]
  // ---------------------------------------------------------------------------------------------------------
  // 1. **패턴 분리 검색**:
  //    - 파워빌더 .srd 파일은 테이블 정의를 `table(column=(...) column=(...) ...)` 형태로 가지고 있습니다.
  //    - 전체 텍스트에서 무작정 `column`만 검색하면 원치 않는 다른 영역의 텍스트가 섞일 수 있으므로,
  //      먼저 `table(...)` 블록을 정규표현식 또는 괄호 쌍 매칭을 통해 격리합니다.
  // 2. **Global Flag (/g) 와 exec() 반복 실행**:
  //    - 자바스크립트 정규표현식 끝에 붙는 `g` 플래그는 'Global(전역)'을 의미하여, 매칭되는 모든 텍스트를 찾을 수 있게 해줍니다.
  //    - `colRegex.exec(tableContent)`를 `while` 루프 안에서 호출하면, 자바스크립트 엔진은 내부적으로 `lastIndex` (직전 매칭이 끝난 위치)를
  //      기억하고 있다가 다음 매칭을 그 뒤부터 이어서 검색합니다. 더 이상 일치하는 패턴이 없으면 `null`을 반환하여 루프가 종료됩니다.
  // 3. **중첩 괄호 대응 Regex 패턴**:
  //    - 패턴: `column\s*=\s*\(((?:[^()]+|\([^()]*\))*)\)`
  //    - `column\s*=\s*`: 'column=' 구문을 찾고 공백을 유연하게 처리합니다.
  //    - `\(`와 `\)`: column 속성값을 감싸는 바깥쪽 괄호를 찾습니다.
  //    - `((?:[^()]+|\([^()]*\))*)`: 내부 캡처 그룹입니다.
  //      - `[^()]+`: 괄호가 아닌 문자들이 반복해서 나오는 구문을 처리합니다.
  //      - `\([^()]*\)`: 데이터타입 정의 중 `char(10)`이나 `decimal(4)`처럼 내부에 한 겹 더 존재하는 괄호 쌍을 안전하게 매치합니다.
  //      - `(?:...)*`: 이 두 패턴의 조합이 여러 번 반복될 수 있음을 나타내어 중첩 괄호 전체를 잘림 없이 완벽히 추출합니다.
  // ---------------------------------------------------------------------------------------------------------
  let tableContent = "";
  // table( ... ) 블록을 개행과 공백 포함하여 추출합니다.
  const tableMatch = text.match(/table\s*\(([\s\S]*?)\r?\n\s*\)/i);
  if (tableMatch) {
    tableContent = tableMatch[1];
  } else {
    // 예외적인 단일행 배치나 특이 케이스에 대비한 Parentheses depth-counting 폴백 로직
    const tableIndex = text.toLowerCase().indexOf("table(");
    if (tableIndex !== -1) {
      let depth = 1;
      let i = tableIndex + 6;
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
      const colProps: { [key: string]: string } = {};
      
      // 속성 내의 key=value 쌍 추출 (예: type=char(10) name=id 등)
      // 데이터타입 내의 괄호(예: char(10))가 끊기지 않도록 중첩 괄호 대응 패턴을 세 번째 옵션에 적용합니다.
      const propRegex = /([\w.]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|((?:[^()\s]|\([^()]*\))+))/g;
      let propMatch;
      while ((propMatch = propRegex.exec(colContent)) !== null) {
        const key = propMatch[1];
        const value = propMatch[2] || propMatch[3] || propMatch[4] || "";
        colProps[key] = value;
      }
      
      if (colProps.name) {
        result.columns.push({
          name: colProps.name,
          type: colProps.type || "unknown",
          dbname: colProps.dbname || colProps.name,
          ...colProps
        });
      }
    }
  }

  // 3. SQL Retrieve(조회) 쿼리 추출
  // - 예: retrieve="SELECT employee.id FROM employee"
  const retrieveMatch = text.match(/retrieve\s*=\s*"([\s\S]*?)"/i);
  if (retrieveMatch) {
    // 파워빌더는 문자열 내부의 큰따옴표를 탈출(Escape)시키기 위해 ~" 문법을 사용합니다.
    // 이를 웹에서 깔끔하게 보여주기 위해 정규식으로 ~"를 일반 큰따옴표 "로 치환합니다.
    result.retrieveQuery = retrieveMatch[1].replace(/~"/g, '"');
  }

  // ---------------------------------------------------------------------------------------------------------
  // [교육용 주석 - 중첩 괄호 및 복잡한 패턴 매칭을 위한 정규표현식(Regex)의 원리]
  // ---------------------------------------------------------------------------------------------------------
  // 1. **중첩 괄호가 포함된 문자열의 정규표현식 파싱 원리**:
  //    - 파워빌더 `.srd` 파일에서 조회 인자는 `arguments=(("인자명1", 타입1), ("인자명2", 타입2), ...)` 형태를 가집니다.
  //    - 단순하게 `\((.*?)\)`처럼 정규식을 사용하면 안쪽의 첫 번째 닫는 괄호 `)`를 만나자마자 매칭이 중단됩니다.
  //      즉, `(("an_order", number)` 까지만 잘려서 올바르지 않은 데이터를 얻게 됩니다.
  //    - 이를 해결하기 위해 중첩 괄호를 처리할 수 있는 재귀적 성격의 패턴을 설계합니다:
  //      `/arguments\s*=\s*\(((?:[^()]+|\([^()]*\))*)\)/i`
  //      - `arguments\s*=\s*\(`: 'arguments=' 부분과 시작하는 바깥쪽 여는 괄호 `(`를 매칭합니다.
  //      - `((?:[^()]+|\([^()]*\))*)`: 바깥쪽 괄호 내부에 있는 데이터를 캡처(그룹 1)합니다.
  //        - `[^()]+`: 괄호가 아닌 문자가 1개 이상 연속해서 나타나는 경우를 매칭합니다.
  //        - `|`: '또는'의 논리 합입니다.
  //        - `\([^()]*\)`: 괄호 안에 괄호가 더이상 존재하지 않는 단일 괄호 쌍 (예: `("an_order", number)`)을 매칭합니다.
  //        - `(?:...)*`: 이 두 패턴의 조합이 0번 이상 반복될 수 있음을 나타내어, 중첩된 한 단계의 괄호들을 완벽하게 묶어서 추출합니다.
  //      - `\)`: 바깥쪽의 마지막 닫는 괄호 `)`를 매칭합니다.
  // 2. **개별 인자 쌍 분리 추출**:
  //    - 1단계에서 추출된 전체 인자 문자열 (예: `("as_status", string), ("an_sales", number)`)에서 개별 인자 쌍들을 각각 쪼갭니다.
  //    - 패턴: `/\(\s*"([^"]+)"\s*,\s*(\w+)\s*\)/g`
  //      - `\(` 와 `\)`: 개별 인자를 감싸는 소괄호 `(`와 `)`를 매칭합니다.
  //      - `\s*`: 공백이 있을 수도 없을 수도 있는 상황을 유연하게 처리합니다.
  //      - `"([^"]+)"`: 큰따옴표로 둘러싸인 '인자명'을 매칭하여 첫 번째 캡처 그룹으로 저장합니다.
  //      - `,\s*`: 쉼표와 그 뒤의 공백을 매칭합니다.
  //      - `(\w+)`: 영어 단어로 된 '데이터타입'(예: string, number, datetime)을 매칭하여 두 번째 캡처 그룹으로 저장합니다.
  //      - `/g` 플래그: `exec()` 함수를 `while` 루프와 함께 반복 호출함으로써, 문자열 끝까지 탐색하며 매치되는 모든 인자를 순차적으로 추출합니다.
  // ---------------------------------------------------------------------------------------------------------
  const argsMatch = text.match(/arguments\s*=\s*\(((?:[^()]+|\([^()]*\))*)\)/i);
  if (argsMatch) {
    const argsContent = argsMatch[1];
    const argRegex = /\(\s*"([^"]+)"\s*,\s*(\w+)\s*\)/g;
    let argMatch;
    while ((argMatch = argRegex.exec(argsContent)) !== null) {
      result.arguments.push({
        name: argMatch[1],
        type: argMatch[2]
      });
    }
  }

  // 4. 레이아웃 밴드(Band) 높이 추출 (header, detail, summary, footer)
  const bands = ["header", "detail", "summary", "footer"];
  bands.forEach((band) => {
    const bandRegex = new RegExp(`${band}\\s*\\(([\\s\\S]*?)\\)`, "i");
    const bandMatch = text.match(bandRegex);
    if (bandMatch) {
      const heightMatch = bandMatch[1].match(/height\s*=\s*(\d+)/i);
      if (heightMatch) {
        result.bands[band] = parseInt(heightMatch[1], 10);
      }
    }
  });

  // 5. Window/UserObject 컨트롤 파싱
  // - 파워빌더 Window나 UserObject의 소스 파일(.srw, .sru)은 `type cb_ok from commandbutton` 형태로 상속과 선언을 정의합니다.
  const typeRegex = /type\s+(\w+)\s+from\s+(\w+)/gi;
  let typeMatch;
  while ((typeMatch = typeRegex.exec(text)) !== null) {
    const name = typeMatch[1];
    const type = typeMatch[2];
    // window, userobject, application 같은 시스템 최상위 타입은 제외하고 내부 컨트롤만 리스트에 넣습니다.
    if (!["window", "userobject", "application", "structure"].includes(type.toLowerCase())) {
      result.controls.push({ name, type });
    }
  }

  return result;
};

// ---------------------------------------------------------------------------------------------------------
// [교육용 주석 - INITIAL_HISTORY Mock Data]
// - 테스트 및 시연용 초기 기록 데이터를 담은 배열입니다.
// - 각 파일의 원본 파워빌더 소스 코드(`sourceCode`)와 변환 완료된 React 코드(`code`)를 모두 수록하여 즉각 분석이 작동하도록 합니다.
// ---------------------------------------------------------------------------------------------------------
const INITIAL_HISTORY = [
  {
    id: "1",
    fileName: "dw_sales_summary.srd",
    fileType: "DataWindow (.srd)",
    targetType: "React Table + Tailwind",
    size: "1.3 KB",
    date: "2026-05-22 10:14",
    status: "Completed",
    sourceCode: `$PBExportHeader$dw_sales_summary.srd
release 10.5;
datawindow(release=10.5 processing=0 font.face="Pretendard" font.height="-10" font.weight="400" background.mode="1" background.color="553648127" )
header(height=72 color="33554432" )
summary(height=24 color="33554432" )
footer(height=36 color="33554432" )
detail(height=84 color="33554432" )
table(column=(type=char(10) updatewhereclause=yes name=id dbname="employee.id" )
 column=(type=char(20) updatewhereclause=yes name=region dbname="employee.region" )
 column=(type=char(20) updatewhereclause=yes name=rep dbname="employee.rep" )
 column=(type=number updatewhereclause=yes name=sales dbname="employee.sales" )
 column=(type=char(10) updatewhereclause=yes name=status dbname="employee.status" )
 retrieve="SELECT employee.id, employee.region, employee.rep, employee.sales, employee.status FROM employee WHERE employee.status = :as_status AND employee.sales > :an_sales"
 arguments=(("as_status", string), ("an_sales", number))
)`,
    code: `import React, { useState } from 'react';

export default function SalesSummaryTable() {
  const [filter, setFilter] = useState('');
  const data = [
    { id: 1, region: 'East', rep: 'Alice', sales: 15200, status: 'Closed' },
    { id: 2, region: 'West', rep: 'Bob', sales: 9800, status: 'Pending' },
    { id: 3, region: 'North', rep: 'Charlie', sales: 22000, status: 'Closed' },
    { id: 4, region: 'South', rep: 'Diana', sales: 14300, status: 'Closed' },
  ];

  const filteredData = data.filter(item => 
    item.rep.toLowerCase().includes(filter.toLowerCase()) ||
    item.region.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="w-full p-6 bg-slate-900 border border-slate-800 rounded-xl text-slate-100">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">Sales Summary</h2>
          <p className="text-sm text-slate-400">Migrated from dw_sales_summary.srd</p>
        </div>
        <input 
          type="text" 
          placeholder="Filter by Rep..." 
          className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      <table className="w-full text-left text-sm border-collapse">
        <thead>
          <tr className="border-b border-slate-800 text-slate-400 font-medium">
            <th className="py-3 px-4">Region</th>
            <th className="py-3 px-4">Sales Rep</th>
            <th className="py-3 px-4 text-right">Sales Amount</th>
            <th className="py-3 px-4 text-center">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50">
          {filteredData.map(item => (
            <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
              <td className="py-3 px-4 text-white font-medium">{item.region}</td>
              <td className="py-3 px-4">{item.rep}</td>
              <td className="py-3 px-4 text-right text-indigo-400 font-mono">\${item.sales.toLocaleString()}</td>
              <td className="py-3 px-4 text-center">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {item.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}`
  },
  {
    id: "2",
    fileName: "w_order_entry.srw",
    fileType: "Window (.srw)",
    targetType: "React Form + State",
    size: "0.8 KB",
    date: "2026-05-22 09:45",
    status: "Completed",
    sourceCode: `$PBExportHeader$w_order_entry.srw
release 12.5;
global type w_order_entry from window
integer width = 2500
integer height = 1500
string title = "Order Entry Form"
boolean controlmenu = true
boolean minbox = true
boolean maxbox = true
end type
global w_order_entry w_order_entry

on w_order_entry.create
this.cb_ok=create cb_ok
this.sle_input=create sle_input
this.dw_1=create dw_1
end on

type cb_ok from commandbutton within w_order_entry
integer x = 1000
integer y = 1200
integer width = 400
integer height = 100
string text = "OK"
end type

type sle_input from singlelineedit within w_order_entry
integer x = 200
integer y = 200
integer width = 800
integer height = 100
end type`,
    code: `import React, { useState } from 'react';

export default function OrderEntryForm() {
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    alert('OK Clicked! Input value: ' + inputValue);
  };

  return (
    <div className="max-w-xl mx-auto p-6 bg-slate-900 border border-slate-800 rounded-xl text-slate-100">
      <h2 className="text-xl font-bold text-white mb-1">Order Entry Form (w_order_entry)</h2>
      <p className="text-sm text-slate-400 mb-6">Converted from Window (.srw)</p>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">sle_input (단일 에디트)</label>
          <input 
            type="text" 
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            placeholder="텍스트를 입력하세요..."
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
          />
        </div>
        
        <button 
          type="submit"
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium text-sm transition-all"
        >
          OK (cb_ok)
        </button>
      </form>
    </div>
  );
}`
  },
  {
    id: "3",
    fileName: "uo_db_connector.sru",
    fileType: "UserObject (.sru)",
    targetType: "React Context / API",
    size: "0.6 KB",
    date: "2026-05-21 16:30",
    status: "Failed",
    sourceCode: `$PBExportHeader$uo_db_connector.sru
release 10.5;
global type uo_db_connector from userobject
end type
global uo_db_connector uo_db_connector

on uo_db_connector.create
call super::create
TriggerEvent( this, "constructor" )
end on`,
    code: `// PB-Bridge Compiler Error Log
// File: uo_db_connector.sru
// Timestamp: 2026-05-21 16:30

[ERROR] Failed to compile uo_db_connector.sru:
Line 42: SQLCA.DBMS = "ODBC" is using a dynamic driver binding that is not supported.
PB-Bridge recommendation: Use a centralized Next.js API route or Prisma Client.
Please check connection strings and rewrite DB connection routines manually.`
  }
];

export default function PBBridgeDashboard() {
  // ---------------------------------------------------------------------------------------------------------
  // [교육용 주석 - useState 선언]
  // - useState는 상태값과 이를 수정하는 함수를 반환합니다.
  // - 예: `const [history, setHistory] = useState(INITIAL_HISTORY);`
  //   - `history`: 파워빌더의 인스턴스 변수(Instance Variable) 배열 역할을 합니다.
  //   - `setHistory`: 이 배열을 갱신하는 전용 수정 메소드입니다. 이 함수가 호출되면 화면(UI)이 새 정보로 자동 갱신됩니다.
  // ---------------------------------------------------------------------------------------------------------
  const [history, setHistory] = useState(INITIAL_HISTORY);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 현재 활성화되어 분석 중인 파워빌더 소스 정보 상태들
  const [activeFileName, setActiveFileName] = useState<string>("dw_sales_summary.srd");
  const [activeFileSize, setActiveFileSize] = useState<string>("1.2 KB");
  const [activeFileContent, setActiveFileContent] = useState<string>(INITIAL_HISTORY[0].sourceCode);
  const [activeFileType, setActiveFileType] = useState<string>("DataWindow (.srd)");

  // 정규표현식 파서로 분석 완료된 객체 상태
  const [parsedData, setParsedData] = useState<ParsedPB>(
    parsePBFile(INITIAL_HISTORY[0].sourceCode, "dw_sales_summary.srd")
  );

  // 컬럼 리스트 필터용 텍스트 상태
  const [columnSearch, setColumnSearch] = useState<string>("");

  // 컴파일/변환 시뮬레이션 관련 상태
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [copiedCodeText, setCopiedCodeText] = useState(false);

  // 모달 제어용 상태
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ---------------------------------------------------------------------------------------------------------
  // [교육용 주석 - useRef 선언]
  // - useRef는 HTML 요소의 포인터를 담기 위해 사용합니다. (화면 렌더링에 영향 없이 객체 주소를 보관)
  // - 파워빌더에서 `Window Controls` 나 `Object Pointer`를 변수에 할당하여 관리하는 기법과 일치합니다.
  // - `fileInputRef`는 보이지 않게 숨겨둔 파일 선택 태그(<input type="file" />)의 컨트롤 포인터를 담습니다.
  // - `terminalEndRef`는 컴파일 로그창 스크롤 제어를 위해 터미널 하단 스크롤 영역 포인터를 보관합니다.
  // ---------------------------------------------------------------------------------------------------------
  const fileInputRef = useRef<HTMLInputElement>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // ---------------------------------------------------------------------------------------------------------
  // [교육용 주석 - useEffect 선언]
  // - useEffect는 컴포넌트의 특정 생명주기(이벤트) 시점에 특정 작업을 자동으로 수행할 때 씁니다.
  // - 아래의 첫 번째 useEffect는 `logs` 상태 배열의 길이가 바뀔 때마다(새 컴파일 로그가 찍힐 때마다),
  //   터미널 창을 아래로 자동 스크롤해 줍니다. 파워빌더의 특정 이벤트 끝에 `ScrollToRow()`를 부르는 것과 같습니다.
  // ---------------------------------------------------------------------------------------------------------
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  // ---------------------------------------------------------------------------------------------------------
  // [교육용 주석 - 의존성 배열이 있는 useEffect]
  // - 아래 useEffect는 `activeFileContent`나 `activeFileName` 상태가 변할 때(즉, 분석 대상 파일이 바뀔 때)
  //   정규표현식 파싱 엔진(`parsePBFile`)을 돌려 화면 우측의 `parsedData`를 즉각 갱신해 줍니다.
  // - 파워빌더의 `dw_1.Retrieve()`나 윈도우의 속성값 변경 이벤트에 해당합니다.
  // ---------------------------------------------------------------------------------------------------------
  useEffect(() => {
    const data = parsePBFile(activeFileContent, activeFileName);
    setParsedData(data);
    // 파일이 바뀔 때 컬럼 검색어도 초기화해 줍니다.
    setColumnSearch("");
  }, [activeFileContent, activeFileName]);

  // 파일 업로드 처리 및 실제 분석 엔진 가동 함수
  // ---------------------------------------------------------------------------------------------------------
  // [교육용 주석 - FileReader 파일 리더]
  // - 자바스크립트는 브라우저의 보안 정책상 사용자가 명시적으로 업로드한 파일만 읽을 수 있습니다.
  // - `FileReader` 객체는 파워빌더의 `FileOpen` 및 `FileReadEx` 역할을 수행하며,
  //   파일 전체가 비동기로 다 읽히면 `onload` 콜백 이벤트를 발생시켜 텍스트를 메모리에 적재(set)합니다.
  // ---------------------------------------------------------------------------------------------------------
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      const extension = file.name.split(".").pop()?.toLowerCase();
      if (!["srd", "srw", "sru", "srp"].includes(extension || "")) {
        alert("파워빌더 소스 파일 (.srd, .srw, .sru, .srp)만 분석할 수 있습니다.");
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = (event.target?.result as string) || "";
        
        // 업로드한 원본 텍스트를 즉각 화면 상태로 설정합니다. (좌측 뷰어에 반영)
        setActiveFileName(file.name);
        setActiveFileSize(`${(file.size / 1024).toFixed(1)} KB`);
        setActiveFileContent(text);
        setActiveFileType(
          extension === "srd"
            ? "DataWindow (.srd)"
            : extension === "srw"
            ? "Window (.srw)"
            : extension === "sru"
            ? "UserObject (.sru)"
            : "Structure (.srp)"
        );

        // 시뮬레이션 컴파일 모드 실행
        triggerCompileSimulation(file.name, text, extension || "");
      };
      reader.readAsText(file);
    }
  };

  // 컴파일 진행률 시뮬레이션 연출 함수 (구현 계획서 승인 반영)
  const triggerCompileSimulation = (fileName: string, content: string, extension: string) => {
    setIsConverting(true);
    setProgress(0);
    setLogs([]);

    const steps = [
      { text: "🚀 파워빌더 AST 파서 v0.1.0 초기화 중...", delay: 200, progress: 10 },
      { text: `📂 소스 파일 읽기 완료: ${fileName}...`, delay: 400, progress: 25 },
      { text: "🔍 정규표현식 파싱 엔진 가동...", delay: 600, progress: 45 },
      { 
        text: extension === "srd" 
          ? "📊 DataWindow 구조 분석 완료: 컬럼 및 SQL 쿼리 매핑 중..." 
          : "⚙️ Window 디자인 분석 완료: 상속 계층 및 컨트롤 매핑 중...", 
        delay: 850, 
        progress: 70 
      },
      { text: "🎨 React 컴포넌트 템플릿 코드 매칭 중...", delay: 1100, progress: 90 },
      { text: "✨ Tailwind CSS 스타일링 최적화 및 링킹 완료!", delay: 1300, progress: 100 }
    ];

    steps.forEach((step, index) => {
      setTimeout(() => {
        setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${step.text}`]);
        setProgress(step.progress);

        if (index === steps.length - 1) {
          // 최종 컴파일 완료 시 히스토리에 새 기록 추가
          setTimeout(() => {
            const parsed = parsePBFile(content, fileName);
            const targetName = fileName.replace(/\.[^/.]+$/, "") + (extension === "srd" ? "Table" : "Form");
            
            // 리액트 컴포넌트 자동 생성 (가짜 코드가 아닌 분석된 컬럼과 SQL 쿼리를 동적으로 엮어서 생성)
            const generatedReactCode = generateReactComponentCode(parsed, targetName);

            const newHistoryItem = {
              id: Date.now().toString(),
              fileName: fileName,
              fileType: extension === "srd" ? "DataWindow (.srd)" : extension === "srw" ? "Window (.srw)" : "Object",
              targetType: extension === "srd" ? "React Table + Tailwind" : "React Form + State",
              size: `${(content.length / 1024).toFixed(1)} KB`,
              date: new Date().toISOString().replace("T", " ").substring(0, 16),
              status: "Completed",
              sourceCode: content,
              code: generatedReactCode
            };

            setHistory((prev) => [newHistoryItem, ...prev]);
            setIsConverting(false);
          }, 300);
        }
      }, step.delay);
    });
  };

  // 분석된 메타데이터를 사용하여 실제로 작동할 것처럼 보이는 React 코드를 생성합니다.
  const generateReactComponentCode = (parsed: ParsedPB, componentName: string): string => {
    if (parsed.fileType.includes("DataWindow")) {
      const colNames = parsed.columns.map(c => `'${c.name}'`).join(", ");
      const sampleRows = parsed.columns.length > 0 
        ? `    { id: 1, ${parsed.columns.map(c => `${c.name}: ${c.type.startsWith("num") ? "100" : "'샘플값'"}`).join(", ")} }`
        : `    { id: 1, name: '샘플데이터' }`;

      const argComments = parsed.arguments && parsed.arguments.length > 0
        ? `\n// Retrieval Arguments:\n${parsed.arguments.map(a => `//   - :${a.name} (${a.type})`).join("\n")}`
        : '';

      return `import React, { useState } from 'react';

// PB-Bridge 자동 변환 컴포넌트
// 소스: ${activeFileName} (PB 버전: ${parsed.release})${argComments}
export default function ${componentName}() {
  const [searchQuery, setSearchQuery] = useState('');
  const columns = [${colNames}];
  const data = [
${sampleRows}
  ];

  return (
    <div className="w-full p-6 bg-slate-900 border border-slate-800 rounded-xl text-slate-100">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-white">${componentName}</h3>
        <p className="text-xs text-slate-400">데이터 조회를 위해 변환된 SQL: ${parsed.retrieveQuery ? parsed.retrieveQuery.slice(0, 60) + '...' : '없음'}</p>
      </div>
      <div className="overflow-x-auto border border-slate-800 rounded-lg">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-800 text-slate-300 font-semibold">
            <tr>
              {columns.map(col => <th key={col} className="p-3 uppercase">{col}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/20">
            {data.map((row, idx) => (
              <tr key={idx} className="hover:bg-slate-850">
                {columns.map(col => (
                  <td key={col} className="p-3 font-mono text-slate-300">{String(row[col])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}`;
    } else {
      const controlsList = parsed.controls.map(c => `            <div className="bg-slate-800 p-2 rounded">${c.name} (${c.type})</div>`).join("\n");
      return `import React, { useState } from 'react';

// PB-Bridge 자동 변환 컴포넌트
// 윈도우 명: ${componentName} (PB 버전: ${parsed.release})
export default function ${componentName}() {
  return (
    <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl text-slate-200">
      <h3 className="text-lg font-bold text-white mb-2">${componentName}</h3>
      <p className="text-xs text-slate-400 mb-6">변환된 윈도우 레이아웃</p>
      
      <div className="space-y-4">
        <div className="p-4 bg-slate-950/50 border border-slate-800 rounded-lg">
          <p className="text-xs text-slate-400 mb-2">탐지된 파워빌더 컨트롤 맵</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
${controlsList || '            <div className="text-slate-500">탐지된 컨트롤이 없습니다.</div>'}
          </div>
        </div>
      </div>
    </div>
  );
}`;
    }
  };

  // 소스 복사 함수
  const handleCopyText = (text: string, type: "source" | "react") => {
    navigator.clipboard.writeText(text);
    if (type === "source") {
      setCopiedCodeText(true);
      setTimeout(() => setCopiedCodeText(false), 2000);
    }
  };

  // 역사 리스트에서 항목 클릭 시 바로 파서로 넘겨 분석 화면을 갱신하는 기능
  const handleSelectHistoryItem = (item: any) => {
    setActiveFileName(item.fileName);
    setActiveFileSize(item.size);
    setActiveFileContent(item.sourceCode || "");
    setActiveFileType(item.fileType);
  };

  // 컬럼 리스트 필터링 로직
  // ---------------------------------------------------------------------------------------------------------
  // [교육용 주석 - filter() 및 map() 연계 사용]
  // - filter()는 조건에 맞는 행만 쏙 골라내어 새로운 배열을 만듭니다. (PB의 SetFilter() 및 Filter() 함수 대응)
  // - 골라낸 배열을 바로 뒤의 map() 함수로 보내 화면에 뿌려줄 카드나 행(HTML/React Tag)으로 변환시킵니다.
  // ---------------------------------------------------------------------------------------------------------
  const filteredColumns = parsedData.columns.filter((col) => {
    const search = columnSearch.toLowerCase();
    return (
      col.name.toLowerCase().includes(search) ||
      col.type.toLowerCase().includes(search) ||
      col.dbname.toLowerCase().includes(search)
    );
  });

  return (
    <div className="min-h-screen bg-[#070b13] text-slate-100 font-sans flex flex-col antialiased selection:bg-indigo-500 selection:text-white">
      {/* 상단 네비게이션 바 */}
      <header className="border-b border-slate-900 bg-[#070b13]/80 backdrop-blur-md sticky top-0 z-10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-400 bg-clip-text text-transparent flex items-center gap-2">
              PB-Bridge
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                v0.1.0 Beta
              </span>
            </h1>
            <p className="text-[10px] text-slate-500 font-medium">PowerBuilder Source Parser & Migrator</p>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
          <span className="text-indigo-400 border-b-2 border-indigo-500 pb-1 cursor-pointer">분석 대시보드</span>
          <span className="hover:text-white transition-colors cursor-pointer">마이그레이션 규칙</span>
          <span className="hover:text-white transition-colors cursor-pointer">사용 가이드</span>
        </nav>

        <div className="flex items-center gap-3 bg-slate-950 px-3.5 py-1.5 rounded-full border border-slate-900">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-xs text-slate-400 font-mono">Parsing Engine Active</span>
        </div>
      </header>

      {/* 메인 콘텐트 영역 (2단 Grid 레이아웃) */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 flex flex-col gap-6">
        
        {/* 가로 2단 그리드 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* 왼쪽 단: 원본 소스 코드 뷰어 (5/12 비율) */}
          <section className="lg:col-span-5 flex flex-col bg-slate-950/80 border border-slate-900 rounded-2xl overflow-hidden shadow-xl backdrop-blur-sm">
            <div className="p-4 border-b border-slate-900 bg-slate-900/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                <h3 className="text-sm font-bold text-white tracking-wide">원본 소스 코드 (PB Source)</h3>
              </div>
              <div className="flex items-center gap-2">
                {/* 복사 버튼 */}
                <button
                  onClick={() => handleCopyText(activeFileContent, "source")}
                  className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs font-semibold text-slate-400 hover:text-white transition-all flex items-center gap-1.5"
                  title="소스 복사"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  {copiedCodeText ? "복사됨!" : "복사"}
                </button>
                {/* 
                  [교육용 주석 - useRef를 통한 파일 태그 트리거]
                  - 실제 HTML `<input type="file" />`은 디자인이 매우 투박하여 css로 완전히 숨겨둡니다 (hidden).
                  - 대신 아주 이쁜 디자인의 `<button>`을 만들고, 이를 클릭할 때
                    숨겨진 파일 인풋 포인터(`fileInputRef.current`)의 `.click()` 함수를 강제로 구동시켜 창이 열리도록 설계합니다.
                  - 이는 파워빌더에서 버튼 클릭 이벤트에서 다른 보이지 않는 컨트롤의 사용자 정의 이벤트를 `TriggerEvent`로 호출하는 메커니즘과 유사합니다.
                */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-xs font-bold text-white transition-all flex items-center gap-1.5 active:scale-95 shadow-md shadow-indigo-500/10"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  업로드
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept=".srd,.srw,.sru,.srp"
                />
              </div>
            </div>

            {/* 파일 이름 및 크기 정보 헤더 */}
            <div className="px-4 py-2 bg-slate-900/50 border-b border-slate-900/60 flex items-center justify-between text-xs font-mono text-slate-400">
              <span className="truncate max-w-[200px]" title={activeFileName}>📄 {activeFileName}</span>
              <span>💾 {activeFileSize}</span>
            </div>

            {/* 소스 코드 스크롤 및 라인넘버 뷰어 */}
            <div className="flex-1 font-mono text-xs overflow-y-auto max-h-[600px] flex bg-[#05080f]/90 leading-relaxed scrollbar-thin">
              {/* 왼쪽 회색 줄번호 컬럼 */}
              <div className="bg-[#05080f] text-slate-600 text-right select-none pr-3 pl-4 py-4 border-r border-slate-900/80 font-semibold min-w-[3.5rem]">
                {activeFileContent.split("\n").map((_, idx) => (
                  <div key={idx}>{idx + 1}</div>
                ))}
              </div>
              {/* 오른쪽 코드 텍스트 본문 */}
              <pre className="p-4 text-indigo-200 overflow-x-auto select-text whitespace-pre flex-1">
                <code>{activeFileContent}</code>
              </pre>
            </div>
          </section>

          {/* 오른쪽 단: 분석 결과 및 메타데이터 카드 (7/12 비율) */}
          <section className="lg:col-span-7 flex flex-col gap-6">
            <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2 bg-gradient-to-r from-white via-indigo-200 to-indigo-500 bg-clip-text text-transparent px-1">
              <span>⚡ 분석 결과 (Analysis Results)</span>
            </h2>

            {/* 1. 기본 분석 메타 정보 카드 */}
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-md relative overflow-hidden shadow-lg group">
              <div className="absolute -right-16 -top-16 w-36 h-36 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-all"></div>
              
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-4">파싱 엔진 탐지 정보</h4>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-950/60 border border-slate-900 p-3.5 rounded-xl">
                  <span className="block text-[10px] text-slate-500 font-semibold mb-1 uppercase">파일명</span>
                  <span className="text-xs font-bold text-white font-mono truncate block" title={activeFileName}>{activeFileName}</span>
                </div>
                <div className="bg-slate-950/60 border border-slate-900 p-3.5 rounded-xl">
                  <span className="block text-[10px] text-slate-500 font-semibold mb-1 uppercase">파일 타입</span>
                  <span className="text-xs font-bold text-emerald-400 block">{activeFileType}</span>
                </div>
                <div className="bg-slate-950/60 border border-slate-900 p-3.5 rounded-xl">
                  <span className="block text-[10px] text-slate-500 font-semibold mb-1 uppercase">PB Release</span>
                  <span className="text-xs font-bold text-indigo-300 block font-mono">
                    {parsedData.release ? `Version ${parsedData.release}` : "미감지"}
                  </span>
                </div>
                <div className="bg-slate-950/60 border border-slate-900 p-3.5 rounded-xl">
                  <span className="block text-[10px] text-slate-500 font-semibold mb-1 uppercase">추출 요약</span>
                  <span className="text-xs font-bold text-purple-400 block font-mono">
                    {parsedData.fileType.includes("DataWindow") 
                      ? `${parsedData.columns.length} Columns` 
                      : `${parsedData.controls.length} Controls`}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. (DataWindow 전용) 밴드 높이 시각화 카드 */}
            {parsedData.fileType.includes("DataWindow") && Object.keys(parsedData.bands).length > 0 && (
              <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-md shadow-lg">
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-4">레이아웃 밴드 높이 시각화 (Heights)</h4>
                <div className="space-y-3.5">
                  {Object.entries(parsedData.bands).map(([bandName, heightValue]) => {
                    // 최대 높이를 대략 200으로 보고 퍼센트 게이지 계산
                    const pct = Math.min((heightValue / 200) * 100, 100);
                    return (
                      <div key={bandName} className="space-y-1.5">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-slate-300 font-bold capitalize">{bandName}</span>
                          <span className="text-slate-500">{heightValue} px</span>
                        </div>
                        <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-900">
                          <div 
                            className="bg-gradient-to-r from-indigo-500 to-purple-600 h-full rounded-full transition-all duration-500" 
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. (DataWindow 전용) 컬럼 명세서 테이블 */}
            {parsedData.fileType.includes("DataWindow") && parsedData.columns.length > 0 && (
              <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-md shadow-lg flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                      <span>📋 컬럼 명세서 (Column Specification)</span>
                    </h4>
                    <p className="text-[10px] text-slate-500 mt-1">
                      table(...) 내의 column=(...) 데이터를 정규표현식으로 자동 분석하여 정렬한 사양 테이블입니다.
                    </p>
                  </div>
                  {/* 검색 필터 */}
                  <input
                    type="text"
                    placeholder="이름/타입/DB명 필터..."
                    value={columnSearch}
                    onChange={(e) => setColumnSearch(e.target.value)}
                    className="px-3 py-1.5 bg-slate-950 border border-slate-850 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full sm:w-48 transition-all"
                  />
                </div>

                <div className="overflow-hidden border border-slate-950 rounded-xl max-h-60 overflow-y-auto scrollbar-thin">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-950 text-slate-400 font-bold uppercase sticky top-0">
                      <tr className="border-b border-slate-900">
                        <th className="py-2.5 px-4 text-center w-16">번호</th>
                        <th className="py-2.5 px-4 text-left">컬럼명</th>
                        <th className="py-2.5 px-4 text-left font-mono">데이터타입 (Type)</th>
                        <th className="py-2.5 px-4 text-left font-mono">DB 바인딩명 (dbname)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900 bg-slate-950/20 text-slate-300">
                      {/* 
                        [교육용 주석 - JavaScript의 Array.prototype.map()과 파워빌더 렌더링 방식의 매핑]
                        -------------------------------------------------------------------------------------
                        1. **자바스크립트의 .map() 함수 작동 원리**:
                           - `.map()`은 배열(Array) 데이터의 각 요소(예: 개별 컬럼 정보)를 하나씩 순회(Loop)하면서,
                             그 데이터를 가공한 새로운 결과물(여기선 React 컴포넌트인 HTML `<tr>` 요소)로 1:1 변환(Mapping)하여 새 배열을 만듭니다.
                        2. **파워빌더와의 비교**:
                           - **파워빌더 (명령형 FOR-Loop)**:
                             ```powerbuilder
                             LONG ll_row, ll_total
                             ll_total = dw_1.RowCount()
                             FOR ll_row = 1 TO ll_total
                                 // 직접 Row를 접근해 화면의 특정 Cell 값을 그리거나 처리
                                 string ls_name = dw_1.GetItemString(ll_row, "name")
                                 // 임의로 UI 컨트롤 속성을 조작하거나 추가 코딩 필요
                             NEXT
                             ```
                           - **웹/React (선언적 .map() 매핑)**:
                             - 복잡하게 루프 인덱스를 관리하고, 그리기를 명령하는 코드를 일일이 짤 필요가 없습니다!
                             - "이 데이터 배열의 각 항목들을 이렇게 생긴 표(Table Row)의 형태로 출력하겠다"라고 '선언'만 하면,
                               React 엔진이 내부적으로 데이터 개수만큼 루프를 돌아 브라우저 화면에 깨끗하게 그려냅니다.
                           - **'번호(idx + 1)' 생성**:
                             - 파워빌더 루프의 인덱스 변수(`ll_row`)처럼, `.map((col, idx) => ...)`에서 두 번째 파라미터 `idx`가
                               0부터 시작하는 인덱스를 전달받으므로 여기에 1을 더해 편리하게 '행 번호'를 1, 2, 3 순서로 출력할 수 있습니다.
                      */}
                      {filteredColumns.length > 0 ? (
                        filteredColumns.map((col, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/20 transition-all font-mono">
                            <td className="py-2.5 px-4 text-center text-slate-500 font-medium">{idx + 1}</td>
                            <td className="py-2.5 px-4 text-indigo-300 font-semibold font-sans">{col.name}</td>
                            <td className="py-2.5 px-4 text-slate-400">{col.type}</td>
                            <td className="py-2.5 px-4 text-slate-400 text-[11px]">{col.dbname}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-slate-500 font-sans">
                            검색 조건에 부합하는 컬럼이 없습니다.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 3.5 (DataWindow 전용) 조회 인자 카드 */}
            {/* 
              [교육용 주석 - React의 동적 배열 렌더링 (.map)의 원리]
              -------------------------------------------------------------------------------------
              1. **조건부 렌더링 (Conditional Rendering)**:
                 - `parsedData.fileType.includes("DataWindow") && parsedData.arguments && parsedData.arguments.length > 0 && (...)`
                 - 자바스크립트의 단락 평가(Short-circuit evaluation) 논리곱(`&&`) 연산자를 활용합니다.
                 - 파일 형식이 DataWindow이고, 파싱된 조회 인자 배열(`arguments`)이 존재하며 그 개수가 0개보다 많을 때만 우측 괄호 안의 HTML/UI 코드가 화면에 출력됩니다.
                 - 인자가 아예 없는 srd 파일일 경우에는 해당 카드 영역 전체가 DOM(화면구조)에 렌더링되지 않고 완전히 보이지 않게 처리됩니다.

              2. **배열 순회 렌더링 (.map) 과 Key Property**:
                 - `parsedData.arguments.map((arg, idx) => ( ... ))`
                 - 파워빌더에서 행 개수만큼 Loop를 돌면서 UI 필드를 인스턴스화하여 배치하듯이, React에서는 배열 데이터의 개수만큼 자동으로 UI 템플릿(JSX)을 반복하여 출력합니다.
                 - `key={idx}`: React는 화면을 업데이트(Re-render)할 때 변경된 부분만 빠르게 갈아끼우기 위해 각 반복 요소마다 고유한 주민등록번호 같은 식별자(`key`)를 요구합니다. 여기선 배열의 순서인 `idx`를 키값으로 지정하여 React가 개별 인자 카드를 안전하고 최적화된 성능으로 추적하게 돕습니다.
                 - `{arg.name}`과 `{arg.type}`: 중괄호 `{}`를 사용해 JavaScript 객체에 담긴 데이터값(인자명과 타입)을 HTML 디자인 구조에 동적으로 주입하여(데이터 바인딩) 화면에 렌더링합니다.
              -------------------------------------------------------------------------------------
            */}
            {parsedData.fileType.includes("DataWindow") && parsedData.arguments && parsedData.arguments.length > 0 && (
              <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-md shadow-lg flex flex-col gap-4">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                    <span>🔑 조회 인자 (Retrieval Arguments)</span>
                  </h4>
                  <p className="text-[10px] text-slate-500 mt-1">
                    table(...) 내의 arguments=(...) 데이터를 정규표현식으로 추출해 구조화한 조회용 매개변수 리스트입니다.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {parsedData.arguments.map((arg, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-slate-950/60 border border-slate-900 p-3.5 rounded-xl">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500/80"></span>
                        <span className="text-xs font-bold text-indigo-300 font-mono truncate" title={arg.name}>
                          :{arg.name}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        {arg.type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. (DataWindow 전용) SQL Retrieve 쿼리 카드 */}
            {parsedData.fileType.includes("DataWindow") && parsedData.retrieveQuery && (
              <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-md shadow-lg flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400">조회 SQL 쿼리 (SQL Statement)</h4>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(parsedData.retrieveQuery);
                      alert("SQL 쿼리가 클립보드에 복사되었습니다.");
                    }}
                    className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    SQL 복사
                  </button>
                </div>
                <div className="bg-[#05080f] p-4 rounded-xl border border-slate-950 font-mono text-[11px] text-slate-300 overflow-x-auto whitespace-pre-wrap leading-relaxed select-text">
                  {parsedData.retrieveQuery}
                </div>
              </div>
            )}

            {/* 5. (Window/UserObject 전용) 컨트롤 리스트 카드 */}
            {!parsedData.fileType.includes("DataWindow") && parsedData.controls.length > 0 && (
              <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-md shadow-lg">
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-4">탐지된 UI 컨트롤 목록 (Controls)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {parsedData.controls.map((ctrl, idx) => (
                    <div key={idx} className="flex items-center gap-3 bg-slate-950/60 border border-slate-900 p-3 rounded-xl">
                      <span className="w-2.5 h-2.5 rounded bg-indigo-500/70 border border-indigo-400 flex-shrink-0"></span>
                      <div className="min-w-0">
                        <span className="block text-xs font-mono font-bold text-white truncate">{ctrl.name}</span>
                        <span className="block text-[10px] text-slate-500 font-mono font-semibold uppercase">{ctrl.type}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 6. (공통) DataWindow/Object 추가 속성 테이블 */}
            {parsedData.fileType.includes("DataWindow") && Object.keys(parsedData.datawindowProps).length > 0 && (
              <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-md shadow-lg">
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-3.5">상세 메타데이터 속성 (Attributes)</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Object.entries(parsedData.datawindowProps).slice(0, 12).map(([key, val]) => (
                    <div key={key} className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-900/80">
                      <span className="block text-[9px] font-bold text-slate-500 font-mono truncate">{key}</span>
                      <span className="block text-xs font-mono text-slate-200 mt-0.5 truncate" title={val}>{val}</span>
                    </div>
                  ))}
                  {Object.keys(parsedData.datawindowProps).length > 12 && (
                    <div className="bg-slate-950/20 p-2.5 rounded-lg border border-dashed border-slate-900/80 flex items-center justify-center">
                      <span className="text-[10px] text-slate-500 font-medium">외 {Object.keys(parsedData.datawindowProps).length - 12}개 더 있음...</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 7. (교육용 섹션) 웹 개발 매핑 핵심 브릿지 가이드 */}
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-md shadow-lg border-l-4 border-l-indigo-500">
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-3 flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                초보자를 위한 PowerBuilder ↔ React 개념 매핑 가이드
              </h4>
              <div className="space-y-3.5 text-xs text-slate-300 leading-relaxed font-sans">
                <div className="border-b border-slate-850 pb-2">
                  <span className="inline-block bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded text-[10px] font-bold font-mono mb-1">useState</span>
                  <p className="text-[11px] text-slate-400">
                    파워빌더의 <b>인스턴스 변수(Instance Variable)</b>와 매칭됩니다. 파워빌더는 변수 변경 후 컨트롤을 직접 다시 그려야 하지만, React는 <code>useState</code>의 수정 함수를 호출하면 화면이 <b>자동으로 다시 렌더링</b>(자동 Redraw)됩니다.
                  </p>
                </div>
                <div className="border-b border-slate-850 pb-2">
                  <span className="inline-block bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded text-[10px] font-bold font-mono mb-1">useEffect</span>
                  <p className="text-[11px] text-slate-400">
                    윈도우의 <b>open 이벤트</b> 혹은 컨트롤의 <b>constructor 이벤트</b>와 비슷합니다. 컴포넌트가 처음 로드되거나, 연결된 상태값이 변할 때 부가 이벤트(스크롤 제어, 데이터 로드)를 동작시킵니다.
                  </p>
                </div>
                <div className="border-b border-slate-850 pb-2">
                  <span className="inline-block bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded text-[10px] font-bold font-mono mb-1">useRef</span>
                  <p className="text-[11px] text-slate-400">
                    특정 윈도우 컨트롤의 <b>Handle pointer(컨트롤 인스턴스 참조)</b>입니다. 렌더링을 유발하지 않고 파일 태그 클릭처럼 브라우저 DOM 요소를 강제로 직접 제어할 때 주소를 쥐고 있습니다.
                  </p>
                </div>
                <div className="border-b border-slate-850 pb-2">
                  <span className="inline-block bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded text-[10px] font-bold font-mono mb-1">Regex exec() &amp; .map()</span>
                  <p className="text-[11px] text-slate-400">
                    <b>정규표현식 다중 매칭:</b> JavaScript에서는 <code>/g</code> 플래그를 정규식에 붙이고 <code>exec()</code> 메서드를 반복문(while)으로 실행하여 텍스트 전체에서 일치하는 모든 구문을 순차적으로 찾아낼 수 있습니다. <br />
                    <b>.map()과 FOR-Loop:</b> <code>.map()</code>은 파워빌더의 <code>FOR i = 1 TO RowCount()</code>와 매핑됩니다. 직접 Row 단위로 순회하여 화면을 그리는 명령을 작성하는 파워빌더와 달리, React의 <code>.map()</code>은 배열 속 데이터를 HTML 요소 배열로 선언적 1:1 변환하여 자동으로 렌더링되게 만듭니다.
                  </p>
                </div>
                <div>
                  <span className="inline-block bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded text-[10px] font-bold font-mono mb-1">Retrieval Arguments &amp; Nested Regex</span>
                  <p className="text-[11px] text-slate-400">
                    <b>조회 인자(Arguments):</b> 파워빌더 DataWindow에서 SQL 조회 시 파라미터 역할을 하는 입력 변수 목록입니다. <br />
                    <b>중첩 괄호 파싱:</b> <code>arguments=(("a", string), ("b", number))</code> 같은 복잡한 중첩 괄호 구조는 탐욕적(Greedy) 매칭을 방지하기 위해 <code>(?:[^()]+|\([^()]*\))</code> 패턴을 활용하여 가장 바깥쪽 괄호 영역을 격리한 후, 그 안에서 개별 인자 매칭 패턴 <code>("인자명", 타입)</code>을 글로벌하게 재루프하면서 개별 변수들을 완전하게 발라낼 수 있습니다.
                  </p>
                </div>
              </div>
            </div>
          </section>

        </div>

        {/* 컴파일러 로그 패널 (임시 파일 변환 활성화 시) */}
        {isConverting && (
          <section className="bg-slate-950 border border-slate-900 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-350">
            <div className="px-5 py-3.5 border-b border-slate-900 bg-slate-900/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex gap-1.5 animate-pulse">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                </div>
                <span className="text-[10px] font-bold text-slate-400 font-mono">
                  compiler-terminal://{activeFileName}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 font-mono font-semibold">{progress}%</span>
                <div className="w-20 bg-slate-900 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            </div>
            <div className="p-5 font-mono text-xs text-slate-300 space-y-2 bg-[#05070d] max-h-56 overflow-y-auto scrollbar-thin">
              {logs.map((log, idx) => (
                <div key={idx} className="leading-relaxed whitespace-pre-wrap animate-in fade-in duration-200">
                  {log.includes("Success") || log.includes("완료") ? (
                    <span className="text-emerald-400 font-semibold">{log}</span>
                  ) : log.includes("🚀") ? (
                    <span className="text-indigo-400 font-bold">{log}</span>
                  ) : (
                    log
                  )}
                </div>
              ))}
              <div ref={terminalEndRef} />
            </div>
          </section>
        )}

        {/* 변환 히스토리 섹션 */}
        <section className="bg-slate-900/40 border border-slate-900 rounded-2xl overflow-hidden backdrop-blur-md shadow-xl">
          <div className="p-5 border-b border-slate-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-md font-bold text-white tracking-tight">전체 파일 변환 히스토리 (History)</h3>
              <p className="text-slate-500 text-xs mt-1">항목을 누르면 즉시 좌측 소스 코드 뷰어와 우측 정규표현식 분석 결과가 갱신됩니다.</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400 font-mono font-bold">
              총 {history.length}개의 모듈 목록
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-900 text-slate-500 font-semibold text-xs tracking-wider uppercase bg-slate-950/40">
                  <th className="py-3 px-6">파일명 (File Name)</th>
                  <th className="py-3 px-6">종류 (Type)</th>
                  <th className="py-3 px-6">타겟 리액트 컴포넌트</th>
                  <th className="py-3 px-6">크기</th>
                  <th className="py-3 px-6">날짜</th>
                  <th className="py-3 px-6 text-center">컴파일 결과</th>
                  <th className="py-3 px-6 text-right">상세조회</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900 bg-slate-950/10 text-slate-300">
                {/* 
                  [교육용 주석 - .map() 함수 활용]
                  - 파워빌더에서 DataWindow Rows를 하나씩 Loop 돌면서 `dw_1.InsertRow()` 나 화면을 세팅하는 것처럼,
                  - React/자바스크립트에서는 변환 히스토리 배열(`history`) 뒤에 `.map()`을 붙여
                    배열 내의 각 요소(item)를 HTML 테이블 행(`<tr>`)으로 즉시 생성 및 반환합니다.
                */}
                {history.map((item) => {
                  const isCurrentActive = item.fileName === activeFileName;
                  return (
                    <tr 
                      key={item.id} 
                      onClick={() => handleSelectHistoryItem(item)}
                      className={`hover:bg-slate-900/40 cursor-pointer transition-colors group ${
                        isCurrentActive ? "bg-indigo-600/5 border-l-2 border-l-indigo-500" : ""
                      }`}
                    >
                      <td className="py-3.5 px-6">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${
                            item.status === 'Failed' 
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                              : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                          }`}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <span className={`font-semibold transition-colors ${
                            isCurrentActive ? "text-indigo-400 font-bold" : "text-white group-hover:text-indigo-400"
                          }`}>
                            {item.fileName}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-6 text-slate-400 text-xs font-mono">{item.fileType}</td>
                      <td className="py-3.5 px-6 text-slate-300 font-medium text-xs font-mono">{item.targetType}</td>
                      <td className="py-3.5 px-6 text-slate-400 text-xs font-mono">{item.size}</td>
                      <td className="py-3.5 px-6 text-slate-400 text-xs font-mono">{item.date}</td>
                      <td className="py-3.5 px-6 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          item.status === "Completed"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-red-500/10 text-red-400 border-red-500/20"
                        }`}>
                          {item.status === "Completed" ? "Success" : "Failed"}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <div className="flex items-center justify-end gap-2.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation(); // 행 클릭 이벤트가 중복 트리거되지 않도록 방지 (파워빌더의 return 1; 과 같이 버블링 제한)
                              setSelectedHistoryItem(item);
                              setIsModalOpen(true);
                            }}
                            className={`p-1.5 rounded transition-all text-xs font-bold flex items-center gap-1.5 ${
                              item.status === "Completed"
                                ? "bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white"
                                : "bg-red-950/20 border border-red-900/30 text-red-400 hover:bg-red-900/30"
                            }`}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                            </svg>
                            {item.status === "Completed" ? "코드 보기" : "로그 보기"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* 모달 윈도우 (변환 완료 코드 / 에러 로그 조회용) */}
      {isModalOpen && selectedHistoryItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] animate-in scale-in duration-250">
            {/* 모달 헤더 */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>
                    {selectedHistoryItem.status === 'Failed' 
                      ? '컴파일 컴파일러 에러 로그 (Compiler Error)' 
                      : '생성된 리액트 코드 (Next.js & Tailwind)'}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    selectedHistoryItem.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}>
                    {selectedHistoryItem.fileName}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">PB-Bridge가 자동으로 생성한 웹 타겟 컴포넌트 정보</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 모달 본문 (코드 뷰어) */}
            <div className="flex-1 overflow-y-auto p-6 bg-[#04060b] text-indigo-100 font-mono text-xs leading-relaxed max-h-[60vh] scrollbar-thin select-text">
              <pre className="whitespace-pre-wrap">{selectedHistoryItem.code}</pre>
            </div>

            {/* 모달 푸터 */}
            <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/40">
              <span className="text-[10px] text-slate-500 font-mono">
                PB-Bridge Engine v0.1.0 • React 19 Core
              </span>
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white transition-colors"
                >
                  닫기
                </button>
                {selectedHistoryItem.status === "Completed" && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedHistoryItem.code);
                      setCopiedId(selectedHistoryItem.id);
                      setTimeout(() => setCopiedId(null), 2000);
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-md shadow-indigo-500/10"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    {copiedId === selectedHistoryItem.id ? "복사됨!" : "React 코드 복사"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
