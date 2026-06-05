// [Day 15 작업] 파워빌더 수식 계산기 유틸리티
// 초보자를 위한 설명: 데이터윈도우 연산 필드(Compute Field)의 PowerBuilder 식(Expression)을 웹에서 모조로 연산하고, 숫자 형식 포맷팅을 지원하는 연산 유틸리티입니다.

import { ColumnInfo } from "../types";

/**
 * 주어진 데이터 컬럼 타입이 숫자형인지 확인하는 함수
 * @param type 컬럼의 데이터 타입 문자열 (예: number, int, decimal)
 * @returns 숫자형이면 true, 아니면 false
 */
export const isNumericColumn = (type: string | undefined): boolean => {
  if (!type) return false;
  const t = type.toLowerCase();
  return ["number", "long", "decimal", "numeric", "real", "int", "double", "float"].some(kw => t.includes(kw));
};

/**
 * 숫자에 쉼표(천 단위 구분자)를 포맷팅하고 소수점을 유지하는 함수
 * @param val 입력 값
 * @returns 3자리 단위 쉼표가 찍힌 포맷 문자열
 */
export const formatNumberWithCommas = (val: any): string => {
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

/**
 * 콤마(,) 등 서식 문자가 섞인 값을 순수한 float형 숫자로 변환하는 함수
 * @param val 입력 값 (문자열 또는 숫자)
 * @returns 변환된 숫자 (실패 시 0 반환)
 */
export const parseToNumeric = (val: any): number => {
  if (val === undefined || val === null) return 0;
  if (typeof val === "number") return val;
  const parsed = parseFloat(String(val).replace(/,/g, "").trim());
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * 파워빌더 식(Expression)을 자바스크립트 엔진(Function)을 활용해 계산하는 수식 해석기
 * @param expression 파워빌더 연산식 (예: "sales * 1.1" 또는 "if(sales > 1000, 'A', 'B')")
 * @param variables 현재 레코드(행)의 컬럼 데이터 맵 (Key-Value)
 * @param columns 컬럼 명세 정보 배열 (타입 매핑 판별에 사용)
 * @returns 수식 연산 결과 값 (숫자 또는 문자열)
 */
export const evaluateDWExpression = (
  expression: string,
  variables: { [key: string]: any },
  columns: ColumnInfo[]
): string | number => {
  if (!expression) return "";
  try {
    let expr = expression.toLowerCase();
    const colTypeMap: { [key: string]: string } = {};
    if (columns) {
      columns.forEach(c => {
        colTypeMap[c.name.toLowerCase()] = (c.type || "").toLowerCase();
      });
    }

    // 변수 크기별로 내림차순 정렬하여, 중복 치환 방지 (예: sales_rep와 sales가 있으면 sales_rep를 먼저 치환해야 함)
    const sortedKeys = Object.keys(variables).sort((a, b) => b.length - a.length);
    sortedKeys.forEach((key) => {
      const rawVal = variables[key];
      const isNumeric = isNumericColumn(colTypeMap[key.toLowerCase()]) || !isNaN(parseFloat(String(rawVal).replace(/,/g, "").trim()));
      const replacement = isNumeric ? String(parseToNumeric(rawVal)) : `"${String(rawVal).replace(/"/g, '\\"')}"`;
      expr = expr.replace(new RegExp(`\\b${key.toLowerCase()}\\b`, "g"), replacement);
    });

    // 파워빌더의 if 함수 패턴을 자바스크립트의 삼항연산자(condition ? trueVal : falseVal)로 변환
    let prevExpr;
    do {
      prevExpr = expr;
      expr = expr.replace(/if\s*\(([^,]+),([^,]+),([^)]+)\)/g, "($1 ? $2 : $3)");
    } while (expr !== prevExpr);

    // 동적으로 코드 평가 실행
    const evalFn = new Function(`return (${expr});`);
    const result = evalFn();
    return typeof result === "number" ? (isNaN(result) ? 0 : Number(result.toFixed(2))) : result ?? "";
  } catch (err) {
    return "연산 오류";
  }
};
