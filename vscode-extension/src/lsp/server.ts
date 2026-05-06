import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  TextDocumentSyncKind
} from "vscode-languageserver/node";

import { TextDocument } from "vscode-languageserver-textdocument";
import { parse } from "./parser";
import { DiagnosticSeverity } from "vscode-languageserver/node";

console.log("Mastermind LSP server initizliazing");
const connection = createConnection(ProposedFeatures.all);
console.log("Connection was made");
const documents = new TextDocuments(TextDocument);

connection.onInitialize(() => {
console.log("LSP initialized");
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,

    }
  };
});

function offsetToPosition(text: string, offset: number) {
  const lines = text.slice(0, offset).split("\n");

  return {
    line: lines.length - 1,
    character: lines[lines.length - 1].length
  };
}

documents.onDidChangeContent((change) => { 
    const text = change.document.getText();

    const result = parse(text);

  const diagnostics = result.errors.map((e) => ({
    severity: DiagnosticSeverity.Error,
    message: e.message,
    range: {
        start: change.document.positionAt(Math.max(0, e.from - 1)),
        end: change.document.positionAt(e.to)
    }
    
  }));

  connection.sendDiagnostics({
    uri: change.document.uri,
    diagnostics
  });
});

connection.onRequest(
  "textDocument/semanticTokens/full",
  (params: any) => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc) return { data: [] };

    const text = doc.getText();
    const lines = text.split("\n");

    const tokens: number[] = [];

    let prevLine = 0;
    let prevChar = 0;

    const tokenTypeMap: Record<string, number> = {
      keyword: 0,
      number: 1,
      string: 2,
      operator: 3,
      comment: 4,
      variable: 5
    };

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];

      const regex = /[+\-<>.,\[\]]|[a-zA-Z_][a-zA-Z0-9_]*/g;

      let match: RegExpExecArray | null;

      while ((match = regex.exec(line)) !== null) {
        const value = match[0];
        const startChar = match.index;

        let type = "variable";

        if ("+-<>.,[]".includes(value)) {
          type = "operator";
        } else if (/^[0-9]+$/.test(value)) {
          type = "number";
        } else if (/^".*"$/.test(value)) {
          type = "string";
        }

        const tokenType = tokenTypeMap[type];

        const deltaLine = lineIndex - prevLine;
        const deltaStart =
          deltaLine === 0 ? startChar - prevChar : startChar;

        tokens.push(deltaLine);
        tokens.push(deltaStart);
        tokens.push(value.length);
        tokens.push(tokenType);
        tokens.push(0);

        prevLine = lineIndex;
        prevChar = startChar;
      }
    }

    return { data: tokens };
  }
);

documents.listen(connection);
connection.listen();