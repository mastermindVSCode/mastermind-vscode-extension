import * as vscode from "vscode";
import type { ExtensionContext } from "vscode";

function isMmiDocument(doc: vscode.TextDocument): boolean {
  return doc.languageId === "mastermind" || doc.uri.fsPath.toLowerCase().endsWith(".mmi");
}

let started = false;

/** Start the language server only when a Mastermind (.mmi) file is opened. */
export function registerLazyLanguageClient(context: ExtensionContext): void {
  const start = () => {
    if (started) return;
    started = true;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { startClient } = require("./client") as typeof import("./client");
    startClient(context);
  };

  const maybeStart = (doc: vscode.TextDocument) => {
    if (isMmiDocument(doc)) start();
  };

  for (const doc of vscode.workspace.textDocuments) {
    maybeStart(doc);
  }

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(maybeStart),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) maybeStart(editor.document);
    }),
  );
}

export function stopLanguageClient(): Thenable<void> | undefined {
  if (!started) return undefined;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { deactivate } = require("./client") as typeof import("./client");
  return deactivate?.();
}
