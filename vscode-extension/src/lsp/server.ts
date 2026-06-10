import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  TextDocumentSyncKind,
  Hover,
  MarkupKind,
  DiagnosticSeverity,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import {
  findBfOperatorHover,
  findKeywordHover,
  getCompletions,
  setConfiguredStdPath,
} from "./completion";
import { clearParseCache, parseDocument } from "./documentParse";

const DIAGNOSTIC_DELAY_MS = 300;

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

let workspaceRoots: string[] = [];
const diagnosticTimers = new Map<string, NodeJS.Timeout>();

connection.onInitialize((params) => {
  const initStd = (params.initializationOptions as { stdPath?: string } | undefined)?.stdPath;
  if (initStd) {
    setConfiguredStdPath(initStd);
  }

  if (params.workspaceFolders?.length) {
    workspaceRoots = params.workspaceFolders.map((f) => f.uri.replace(/^file:\/\//, ""));
    workspaceRoots = workspaceRoots.map((u) => {
      try {
        return decodeURIComponent(u);
      } catch {
        return u;
      }
    });
  }

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      hoverProvider: true,
      completionProvider: {
        triggerCharacters: ["#", ".", "<"],
      },
    },
  };
});

connection.onDidChangeConfiguration(async () => {
  const [config] = await connection.workspace.getConfiguration([
    { section: "mastermind" },
  ]);
  const stdPath = config?.stdPath as string | undefined;
  if (stdPath !== undefined) {
    setConfiguredStdPath(stdPath);
  }
});

try {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  connection.workspace.onDidChangeWorkspaceFolders((event) => {
    for (const folder of event.added) {
      const root = folder.uri.replace(/^file:\/\//, "");
      try {
        workspaceRoots.push(decodeURIComponent(root));
      } catch {
        workspaceRoots.push(root);
      }
    }
    for (const folder of event.removed) {
      const root = folder.uri.replace(/^file:\/\//, "");
      try {
        workspaceRoots = workspaceRoots.filter((r) => r !== decodeURIComponent(root));
      } catch {
        workspaceRoots = workspaceRoots.filter((r) => r !== root);
      }
    }
  });
} catch {
  // Client doesn't support workspace folder change events.
}

function getWordAt(doc: TextDocument, line: number, character: number): string | undefined {
  const text = doc.getText();
  const offset = doc.offsetAt({ line, character });
  const isWordChar = (ch: string) => /[A-Za-z0-9_#]/.test(ch);

  let start = offset;
  while (start > 0 && isWordChar(text[start - 1] ?? "")) start--;

  let end = offset;
  while (end < text.length && isWordChar(text[end] ?? "")) end++;

  const word = text.slice(start, end);
  return word.length ? word : undefined;
}

function isMastermindDocument(doc: TextDocument): boolean {
  return doc.languageId === "mastermind" || doc.uri.toLowerCase().endsWith(".mmi");
}

function getCharAt(doc: TextDocument, line: number, character: number): string | undefined {
  const lineText = doc.getText({
    start: { line, character: 0 },
    end: { line: line + 1, character: 0 },
  });
  if (character < 0 || character >= lineText.length) return undefined;
  return lineText[character];
}

function publishDiagnostics(doc: TextDocument): void {
  if (!isMastermindDocument(doc)) {
    return;
  }

  const rawErrors = parseDocument(doc).errors.map((e) => ({
    severity: DiagnosticSeverity.Error,
    message: e.message,
    from: e.from,
    to: e.to,
  }));

  connection.sendDiagnostics({
    uri: doc.uri,
    diagnostics: rawErrors.map((e) => ({
      severity: e.severity,
      message: e.message,
      range: {
        start: doc.positionAt(e.from),
        end: doc.positionAt(Math.max(e.from + 1, e.to)),
      },
    })),
  });
}

function scheduleDiagnostics(doc: TextDocument, immediate = false): void {
  if (!isMastermindDocument(doc)) {
    return;
  }

  const key = doc.uri;
  const existing = diagnosticTimers.get(key);
  if (existing) {
    clearTimeout(existing);
  }

  if (immediate) {
    diagnosticTimers.delete(key);
    publishDiagnostics(doc);
    return;
  }

  diagnosticTimers.set(
    key,
    setTimeout(() => {
      diagnosticTimers.delete(key);
      publishDiagnostics(doc);
    }, DIAGNOSTIC_DELAY_MS),
  );
}

documents.onDidChangeContent((change) => {
  scheduleDiagnostics(change.document);
});

documents.onDidOpen((event) => {
  scheduleDiagnostics(event.document, true);
});

documents.onDidClose((event) => {
  const key = event.document.uri;
  const existing = diagnosticTimers.get(key);
  if (existing) {
    clearTimeout(existing);
    diagnosticTimers.delete(key);
  }
  clearParseCache(key);
  connection.sendDiagnostics({ uri: key, diagnostics: [] });
});

connection.onHover((params): Hover | null => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc || !isMastermindDocument(doc)) return null;

  const word = getWordAt(doc, params.position.line, params.position.character);
  if (word) {
    const kw = findKeywordHover(word);
    if (kw) {
      const value = [`**${kw.label}**`, kw.detail ? `_${kw.detail}_` : undefined, kw.doc]
        .filter(Boolean)
        .join("\n\n");
      return { contents: { kind: MarkupKind.Markdown, value } };
    }
  }

  const ch = getCharAt(doc, params.position.line, params.position.character);
  if (ch) {
    const bf = findBfOperatorHover(ch);
    if (bf) {
      return {
        contents: {
          kind: MarkupKind.Markdown,
          value: `**${bf.label}** (brainfuck)\n\n${bf.doc}`,
        },
      };
    }
  }

  return null;
});

connection.onCompletion((params) => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc || !isMastermindDocument(doc)) return [];

  const offset = doc.offsetAt(params.position);
  return getCompletions(doc, offset, workspaceRoots);
});

documents.listen(connection);
connection.listen();
