import * as vscode from 'vscode';

function languageForPath(fsPath: string): string | undefined {
  const lower = fsPath.toLowerCase();
  if (lower.endsWith('.mmi')) return 'mastermind';
  if (lower.endsWith('.bf')) return 'brainfuck';
  return undefined;
}

async function ensureDocumentLanguage(doc: vscode.TextDocument): Promise<void> {
  if (doc.uri.scheme !== 'file' && doc.uri.scheme !== 'untitled') return;

  const expected = languageForPath(doc.uri.fsPath);
  if (!expected || doc.languageId === expected) return;

  try {
    await vscode.languages.setTextDocumentLanguage(doc, expected);
  } catch {
    // Document may have closed or be read-only.
  }
}

/** Assign Mastermind/Brainfuck when VS Code opens .mmi/.bf as Plain Text. */
export function registerDocumentLanguage(context: vscode.ExtensionContext): void {
  for (const doc of vscode.workspace.textDocuments) {
    void ensureDocumentLanguage(doc);
  }

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc) => void ensureDocumentLanguage(doc)),
  );
}
