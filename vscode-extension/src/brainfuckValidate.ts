export type BfDiagnostic = {
  message: string;
  from: number;
  to: number;
};

const BF_OPS = new Set(["+", "-", "<", ">", "[", "]", ",", "."]);

export function validateBrainfuck(text: string): BfDiagnostic[] {
  const diagnostics: BfDiagnostic[] = [];
  const stack: number[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === undefined) break;

    if (ch === "#") {
      const nl = text.indexOf("\n", i);
      i = nl === -1 ? text.length - 1 : nl;
      continue;
    }

    if (/\s/.test(ch)) {
      continue;
    }

    if (BF_OPS.has(ch)) {
      if (ch === "[") {
        stack.push(i);
      } else if (ch === "]") {
        if (stack.length === 0) {
          diagnostics.push({
            message: "Unmatched ']'",
            from: i,
            to: i + 1,
          });
        } else {
          stack.pop();
        }
      }
      continue;
    }

    diagnostics.push({
      message: `Invalid brainfuck character '${ch}' (expected one of + - < > [ ] , .)`,
      from: i,
      to: i + 1,
    });
  }

  for (const from of stack) {
    diagnostics.push({
      message: "Unmatched '['",
      from,
      to: from + 1,
    });
  }

  return diagnostics;
}
