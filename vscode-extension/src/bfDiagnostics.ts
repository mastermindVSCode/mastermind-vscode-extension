import * as vscode from "vscode";
import { validateBrainfuck } from "./brainfuckValidate";

const VALIDATE_DELAY_MS = 400;

function isBrainfuckDocument(doc: vscode.TextDocument): boolean {
  return doc.languageId === "brainfuck" || doc.uri.fsPath.toLowerCase().endsWith(".bf");
}

export function registerBrainfuckDiagnostics(context: vscode.ExtensionContext): void {
  const collection = vscode.languages.createDiagnosticCollection("mastermind-brainfuck");
  context.subscriptions.push(collection);

  const timers = new Map<string, NodeJS.Timeout>();

  const publish = (doc: vscode.TextDocument) => {
    if (!isBrainfuckDocument(doc)) return;

    const diagnostics = validateBrainfuck(doc.getText()).map(
      (e) =>
        new vscode.Diagnostic(
          new vscode.Range(
            doc.positionAt(e.from),
            doc.positionAt(Math.max(e.from + 1, e.to)),
          ),
          e.message,
          vscode.DiagnosticSeverity.Error,
        ),
    );
    collection.set(doc.uri, diagnostics);
  };

  const schedule = (doc: vscode.TextDocument, immediate = false) => {
    if (!isBrainfuckDocument(doc)) return;

    const visible = vscode.window.visibleTextEditors.some(
      (editor) => editor.document.uri.toString() === doc.uri.toString(),
    );
    if (!visible && !immediate) {
      return;
    }

    if (immediate) {
      publish(doc);
      return;
    }

    const key = doc.uri.toString();
    const existing = timers.get(key);
    if (existing) clearTimeout(existing);
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        publish(doc);
      }, VALIDATE_DELAY_MS),
    );
  };

  for (const doc of vscode.workspace.textDocuments) {
    schedule(doc, true);
  }

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc) => schedule(doc, true)),
    vscode.workspace.onDidChangeTextDocument((e) => schedule(e.document)),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        schedule(editor.document, true);
      }
    }),
    vscode.workspace.onDidCloseTextDocument((doc) => {
      collection.delete(doc.uri);
      const key = doc.uri.toString();
      const existing = timers.get(key);
      if (existing) clearTimeout(existing);
      timers.delete(key);
    }),
  );
}
