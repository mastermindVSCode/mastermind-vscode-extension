import { TextDocument } from "vscode-languageserver-textdocument";
import { parse } from "./parser";

type ParsedDocument = ReturnType<typeof parse>;

const cache = new Map<string, { version: number; result: ParsedDocument }>();

export function parseDocument(doc: TextDocument): ParsedDocument {
  const cached = cache.get(doc.uri);
  if (cached && cached.version === doc.version) {
    return cached.result;
  }

  const result = parse(doc.getText());
  cache.set(doc.uri, { version: doc.version, result });
  return result;
}

export function clearParseCache(uri: string): void {
  cache.delete(uri);
}
