"use client";

import { useState } from "react";

import { Badge } from "@/components/common/Badge";
import type { TestCaseResult } from "@/lib/types/session";

interface Props {
  result: TestCaseResult;
}

/**
 * 한 테스트 케이스 결과 카드.
 * - 헤더: testName + 배지 + duration
 * - 본문 (FAIL 만): 핵심 메시지 (첫 'at ' 이전) + 스택 트레이스 펼침
 * - PASS 는 헤더 한 줄만
 */
export function TestResultRow({ result }: Props) {
  const isFail = result.status !== "PASS";
  const detail = result.detail ?? "";

  // " at " 또는 "\n\tat " 같은 형태로 stack frame 시작. 그 이전까지가 핵심 메시지.
  const splitIndex = (() => {
    const candidates = [detail.indexOf("\n\tat "), detail.indexOf("\n at "), detail.indexOf(" at ")];
    const valid = candidates.filter((i) => i > 0);
    return valid.length ? Math.min(...valid) : -1;
  })();

  const headline = splitIndex > 0 ? detail.slice(0, splitIndex).trim() : detail.trim();
  const trace = splitIndex > 0 ? detail.slice(splitIndex).trim() : null;

  return (
    <div className={`test-result-card test-result-card--${isFail ? "fail" : "pass"}`}>
      <div className="test-result-card__head">
        <span className="test-result-card__name" title={result.name}>
          {result.name}
        </span>
        <Badge tone={isFail ? "red" : "green"}>{result.status}</Badge>
        <span className="test-result-card__time">{result.time}</span>
      </div>

      {isFail && headline ? (
        <div className="test-result-card__body">
          <pre className="test-result-card__headline">{headline}</pre>
          {trace ? <TraceDetails trace={trace} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function TraceDetails({ trace }: { trace: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="test-result-card__trace">
      <button
        type="button"
        className="test-result-card__trace-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? "▾ 스택 트레이스 접기" : "▸ 스택 트레이스 펼치기"}
      </button>
      {open ? <pre className="test-result-card__trace-body">{trace}</pre> : null}
    </div>
  );
}
