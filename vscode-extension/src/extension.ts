import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel('Mastermind');
  context.subscriptions.push(output);

  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 200);
  statusBar.text = 'Mastermind';
  statusBar.tooltip = 'Compile .mmi files to Brainfuck.';
  statusBar.command = 'mastermind.readMmi';
  statusBar.show();
  context.subscriptions.push(statusBar);

  const readMmiCmd = vscode.commands.registerCommand('mastermind.readMmi', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found.');
      return;
    }

    const document = editor.document;
    if (!document.fileName.toLowerCase().endsWith('.mmi')) {
      vscode.window.showWarningMessage('This extension only accepts `.mmi` files.');
      return;
    }
    
    const fileName = basename(document.fileName);

    output.clear();
    output.show(true);
    output.appendLine(`Successfully read ${fileName}`);
  });

  context.subscriptions.push(readMmiCmd);
}

export function deactivate() {
}

function basename(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const lastSlash = normalized.lastIndexOf('/');
  return lastSlash >= 0 ? normalized.slice(lastSlash + 1) : normalized;
}

