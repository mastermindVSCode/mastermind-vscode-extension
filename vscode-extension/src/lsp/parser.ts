import { parser } from "./mastermind_parser";

export type ParseError = {
  message: string;
  from: number;
  to: number;
};

function lineColumnAt(text: string, offset: number): { line: number; column: number } {
  const before = text.slice(0, Math.max(0, offset));
  const lines = before.split("\n");
  const line = lines.length;
  const column = (lines[lines.length - 1] ?? "").length + 1;
  return { line, column };
}

function snippetAt(text: string, from: number, to: number): string {
  const raw = text.slice(from, to);
  const compact = raw.replace(/\s+/g, " ").trim();
  if (!compact) {
    return "(empty)";
  }
  if (compact.length > 40) {
    return `${compact.slice(0, 37)}...`;
  }
  return compact;
}

function messageForErrorNode(text: string, from: number, to: number, nodeName: string): string {
  const { line, column } = lineColumnAt(text, from);
  const snippet = snippetAt(text, from, to);
  const loc = `line ${line}, column ${column}`;

  if (nodeName.includes("String") || nodeName.includes("Character")) {
    return `Unterminated or invalid string/character literal at ${loc}`;
  }
  if (nodeName.includes("Include")) {
    return `Invalid #include directive at ${loc}`;
  }
  if (nodeName.includes("⚠") || nodeName === "error") {
    return `Unexpected input '${snippet}' at ${loc}`;
  }
  return `Syntax error near '${snippet}' at ${loc}`;
}

function mergeAdjacentErrors(errors: ParseError[]): ParseError[] {
  if (errors.length === 0) {
    return errors;
  }
  const sorted = [...errors].sort((a, b) => a.from - b.from);
  const merged: ParseError[] = [sorted[0]!];

  for (let i = 1; i < sorted.length; i++) {
    const prev = merged[merged.length - 1]!;
    const cur = sorted[i]!;
    if (cur.from <= prev.to + 2) {
      prev.to = Math.max(prev.to, cur.to);
      if (cur.message.length > prev.message.length) {
        prev.message = cur.message;
      }
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

export function parse(text: string) {
  const tree = parser.parse(text);
  const errors: ParseError[] = [];
  const cursor = tree.cursor();

  do {
    if (cursor.type.isError) {
      const from = cursor.from;
      const to = Math.max(cursor.to, from + 1);
      errors.push({
        message: messageForErrorNode(text, from, to, cursor.type.name),
        from,
        to,
      });
    }
  } while (cursor.next());

  return {
    tree,
    errors: mergeAdjacentErrors(errors),
  };
}
