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
      textDocumentSync: TextDocumentSyncKind.Incremental
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
        start: offsetToPosition(text, e.from),
        end: offsetToPosition(text, e.to)
    }
    
  }));

  connection.sendDiagnostics({
    uri: change.document.uri,
    diagnostics
  });
});

documents.listen(connection);
connection.listen();