// [Day 52 작업] 사내 전용 커스텀 색상 선택기(Color Picker) 독립 컴포넌트
// 레거시 파워빌더의 ChooseColor() 및 RGB() 함수 연동 시스템 다이어로그를 현대 React 선언형 UI 및 CSS Variables 상태 제어로 전환합니다.

"use client";

import React, { useState, useEffect } from "react";

/**
 * [레거시 파워빌더와 현대 React의 색상 선택 및 바인딩 아키텍처 비교]
 *
 * 1. 레거시 파워빌더 (윈도우 API 디펜던시 및 ChooseColor() 제어):
 *    - 파워빌더에서는 시스템 색상 팔레트 모달을 호출하기 위해 `ChooseColor(li_color, dw_1)` 형태의
 *      OS 운영체제 종속적인 Win32 API 호출형 함수를 가동했습니다.
 *    - 반환된 색상값은 R, G, B가 각각 0~255 범위의 정수(Integer) 형태로 256진법 연산식에 의해 하나의 `Long` 정수로 합산되었습니다.
 *      (공식: ColorLong = Red + (Green * 256) + (Blue * 65536))
 *    - 이 `Long` 타입 데이터를 데이터윈도우의 컬럼([ˈkɑːləm]) 속성(`dw_1.Modify("emp_name.Color = '" + String(ColorLong) + "'")`)에 
 *      절차적 스크립트로 직접 주입해야 했습니다.
 *    - 투명도 조절은 기본 Win32 공통 다이얼로그에서 자체 지원하지 않아, 별도의 윈도우 스타일 확장이나 커스텀 슬라이더 제어가 극히 까다로웠습니다.
 *
 * 2. 현대 웹 표준 React 아키텍처 (선언형 가상 DOM 인라인 스타일 및 CSS 변수 바인딩):
 *    - React 환경에서는 OS 디펜던시 없이 가상 DOM(Virtual DOM) 환경에서 완벽히 독립적으로 동작하는 선언형 상태(State) 기반 색상 선택기([ˈpɪkər])를 구현합니다.
 *    - RGB 색상과 투명도([oʊˈpæsəti]) 상태(State)가 변경되면 컴포넌트가 자동으로 다시 그려지며(Re-rendering),
 *      CSS 커스텀 속성(CSS Variables, 예: `--selected-color`) 또는 HTML 인라인 스타일에 실시간 바인딩됩니다.
 *    - 런타임에 정규식을 통과한 유효한 Hex 문자열만을 필터링하고 슬라이더를 통해 알파([ˈælfə]) 투명도 값을 퍼센트 단위로 입력받아
 *      최종 `rgba(r, g, b, a)` 포맷 데이터를 동적으로 방출(Emit)합니다.
 *
 * 발음 가이드 (표준 IPA 발음 기호 준수):
 *  - 선택기 ➔ [ˈpɪkər]
 *  - 색상 ➔ [ˈkʌlər]
 *  - 컬럼 ➔ [ˈkɑːləm]
 *  - 불투명도 ➔ [oʊˈpæsəti]
 *  - 알파 ➔ [ˈælfə]
 *  - 프리셋 ➔ [ˈpriːset]
 */

// 사내 다크 네온 프리셋 색상 8개 리스트 (프리셋: [ˈpriːset])
const NEON_PRESETS = [
  "#00f0ff", // 시안 네온
  "#bd00ff", // 퍼플 네온
  "#ff007f", // 핑크 네온
  "#3b82f6", // 블루 네온
  "#00ff66", // 그린 네온
  "#ffea00", // 옐로우 네온
  "#ff6c00", // 오렌지 네온
  "#ff003c", // 레드 네온
];

export interface ColorPickerProps {
  /** 초기 Hex 색상값 (예: #00f0ff) */
  initialHex?: string;
  /** 초기 투명도 값 (0 ~ 100) */
  initialAlpha?: number;
  /** 색상 및 투명도가 최종 업데이트될 때 호출되는 이벤트 콜백 */
  onChange?: (rgbaString: string, hex: string, alpha: number) => void;
}

// Hex 코드를 R, G, B 객체로 파싱하는 유틸리티
const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const match = hex.match(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/);
  if (!match) return null;

  let hexVal = match[1];
  if (hexVal.length === 3) {
    hexVal = hexVal[0] + hexVal[0] + hexVal[1] + hexVal[1] + hexVal[2] + hexVal[2];
  }

  const r = parseInt(hexVal.substring(0, 2), 16);
  const g = parseInt(hexVal.substring(2, 4), 16);
  const b = parseInt(hexVal.substring(4, 6), 16);

  return { r, g, b };
};

export default function ColorPicker({
  initialHex = "#00f0ff",
  initialAlpha = 100,
  onChange,
}: ColorPickerProps) {
  // 1. 상태(State) 정의
  const [hexInput, setHexInput] = useState<string>(initialHex);
  const [validHex, setValidHex] = useState<string>(initialHex);
  const [alpha, setAlpha] = useState<number>(initialAlpha); // 0 ~ 100
  const [isValid, setIsValid] = useState<boolean>(true);

  // Hex 입력 유효성 검사 매커니즘
  useEffect(() => {
    // [Day 52 작업] Hex 입력값 런타임 정규식 유효성 검증 블록
    // 유효 규격: ^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$
    const pattern = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    const isValidFormat = pattern.test(hexInput);
    setIsValid(isValidFormat);

    if (isValidFormat) {
      setValidHex(hexInput);
    }
  }, [hexInput]);

  // 최종 RGBA 문자열 연산
  const rgbaString = React.useMemo(() => {
    const rgb = hexToRgb(validHex);
    if (!rgb) return "rgba(0, 240, 255, 1)";
    const a = (alpha / 100).toFixed(2);
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
  }, [validHex, alpha]);

  // 최종 상태 전이 데이터 외부 방출 트리거
  useEffect(() => {
    if (onChange && isValid) {
      onChange(rgbaString, validHex, alpha);
    }
  }, [rgbaString, validHex, alpha, isValid, onChange]);

  // [Day 52 작업] 프리셋 컬러칩 클릭 이벤트 핸들러 [ˈpriːset]
  const handlePresetClick = (presetHex: string) => {
    setHexInput(presetHex);
  };

  // [Day 52 작업] 알파 투명도 슬라이더 체인지 이벤트 핸들러 [ˈælfə]
  const handleAlphaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAlpha(Number(e.target.value));
  };

  return (
    <div className="w-full max-w-md p-5 rounded-xl bg-slate-950 border border-slate-900 shadow-[0_4px_30px_rgba(0,0,0,0.5)] backdrop-blur-md">
      {/* 컴포넌트 헤더 */}
      <div className="flex items-center justify-between border-b border-indigo-950/40 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.8)]"></span>
          <h2 className="text-sm font-bold text-slate-100 tracking-wider">
            사내 ERP 커스텀 색상 선택기 (Color [ˈpɪkər])
          </h2>
        </div>
        <div className="text-[10px] font-mono text-slate-500">
          <span>PB Web-Bridge Modernization v1.52</span>
        </div>
      </div>

      {/* 좌우 대칭 구도의 메인 레이아웃 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">
        {/* ================= 좌측: 프리셋 컬러칩 8개 격자 그리드 ================= */}
        <div className="flex flex-col justify-center">
          <span className="text-[11px] font-bold text-indigo-400 tracking-wide uppercase mb-2">
            사내 프리셋 팔레트 ([ˈpriːset])
          </span>
          <div className="grid grid-cols-4 gap-2.5 bg-slate-900/40 p-3 rounded-lg border border-indigo-950/30">
            {NEON_PRESETS.map((presetHex) => (
              <button
                key={presetHex}
                onClick={() => handlePresetClick(presetHex)}
                style={{ backgroundColor: presetHex }}
                className={`w-full aspect-square rounded transition-all duration-200 cursor-pointer border ${
                  validHex.toLowerCase() === presetHex.toLowerCase()
                    ? "border-slate-100 scale-110 shadow-[0_0_12px_rgba(255,255,255,0.4)]"
                    : "border-slate-800 hover:scale-105 hover:border-slate-400"
                }`}
                title={`프리셋 색상: ${presetHex}`}
              />
            ))}
          </div>
        </div>

        {/* ================= 우측: 실시간 프리뷰 영역 & 투명도 슬라이더 ================= */}
        <div className="flex flex-col gap-3 justify-between">
          <div>
            <span className="text-[11px] font-bold text-cyan-400 tracking-wide uppercase mb-1 block">
              💡 실시간 프리뷰 영역
            </span>
            {/* 체커보드 배경 패턴과 함께 현재 투명도가 투영되는 프리뷰 박스 */}
            <div className="relative w-full h-16 rounded-lg overflow-hidden border border-slate-800 bg-[linear-gradient(45deg,#121829_25%,transparent_25%),linear-gradient(-45deg,#121829_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#121829_75%),linear-gradient(-45deg,transparent_75%,#121829_75%)] bg-[size:10px_10px] bg-[position:0_0,0_5px,5px_-5px,-5px_0] bg-slate-950">
              <div
                className="absolute inset-0 transition-colors duration-150"
                style={{ backgroundColor: rgbaString }}
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                <span className="text-[10px] font-mono font-bold text-slate-100 tracking-wide bg-slate-950/60 px-2 py-0.5 rounded border border-slate-800/40">
                  {rgbaString}
                </span>
              </div>
            </div>
          </div>

          {/* 투명도 (Alpha) 슬라이더 */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10.5px] font-bold text-slate-400 font-mono">
                투명도 (Alpha [ˈælfə])
              </span>
              <span className="text-[11px] font-mono font-bold text-indigo-400">
                {alpha}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={alpha}
              onChange={handleAlphaChange}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {/* Hex 텍스트박스 및 유효성 경고 영역 */}
      <div className="mt-4 pt-3 border-t border-indigo-950/20">
        <label className="text-[10.5px] font-bold text-slate-400 font-mono mb-1.5 block">
          Hex 색상 코드 입력 (반드시 # 포함)
        </label>
        <div className="relative">
          <input
            type="text"
            value={hexInput}
            onChange={(e) => setHexInput(e.target.value)}
            placeholder="#00f0ff"
            className={`w-full text-xs font-mono bg-slate-900/60 text-slate-200 border rounded px-3 py-2 focus:outline-none transition-all ${
              isValid
                ? "border-slate-800 focus:border-indigo-500/60 focus:shadow-[0_0_8px_rgba(99,102,241,0.2)]"
                : "border-amber-500 focus:border-amber-500 focus:shadow-[0_0_10px_rgba(245,158,11,0.3)]"
            }`}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
            {isValid ? (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.8)]" />
            )}
          </div>
        </div>

        {/* 유효성 경고 문구 출력 (네온 오렌지색 연출) */}
        {!isValid && (
          <p className="text-[10px] text-amber-500 font-bold font-mono mt-1.5 tracking-wider animate-pulse drop-shadow-[0_0_5px_rgba(245,158,11,0.2)]">
            ⚠️ 부적합한 색상 코드 (올바른 규격 예시: #00f0ff, #fff)
          </p>
        )}
      </div>

      {/* 하단 설명 가이드 */}
      <div className="mt-4 bg-slate-900/30 border border-indigo-950/20 rounded-md p-3 text-[10px] leading-relaxed text-slate-400 font-mono">
        <p className="text-cyan-400 font-bold mb-1">💡 레거시 RGB() 연산 vs 선언형 RGBA 대치</p>
        <p>
          파워빌더의 `RGB(0, 240, 255)` 연산 결과값 `16773120` (Long 정수형) 대신, React의 State 동적 갱신을 통해 실시간으로 변환된 `rgba(0, 240, 255, 1.00)` 문자열을 HTML 인라인 스타일 및 CSS 커스텀 속성에 주입하여 렌더링을 제어합니다.
        </p>
      </div>
    </div>
  );
}
