"""
git-filter-repo message callback.
Claude의 Co-Authored-By 트레일러 줄을 커밋 메시지에서 삭제.
"""
import re

# Claude Sonnet / Opus / Haiku 등 모든 Claude Co-Authored-By 줄 제거
CLAUDE_TRAILER = re.compile(
    rb"(?im)^[ \t]*Co-Authored-By:\s*Claude\b[^\r\n]*\r?\n?"
)

# 과도한 빈 줄 정리 (3개 이상 → 2개로)
EXTRA_BLANK = re.compile(rb"\n{3,}")

message = CLAUDE_TRAILER.sub(b"", message)
message = EXTRA_BLANK.sub(b"\n\n", message)
message = message.rstrip() + b"\n"
return message
