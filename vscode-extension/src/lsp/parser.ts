import { parser } from "./mastermind_parser";

export type ParseError = {
  message: string;
  from: number;
  to: number;
};

export function parse(text: string) {
  const tree = parser.parse(text);

  const errors: ParseError[] = [];


  const cursor = tree.cursor();

  // Walk the syntax tree
  do {
    // Lezer marks errors like this:
    if (cursor.type.isError) {
      errors.push({
        message: "Syntax error",
        from: cursor.from,
        to: cursor.to
      });
    }
  } while (cursor.next());

  return {
    tree,
    errors
  };
}