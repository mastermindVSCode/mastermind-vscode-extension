import * as vscode from "vscode";

function getActiveMmiEditor(): vscode.TextEditor | undefined {
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    vscode.window.showWarningMessage("Open a .mmi file first.");
    return undefined;
  }

  if (!editor.document.fileName.endsWith(".mmi")) {
    vscode.window.showWarningMessage("Active file is not a Mastermind (.mmi) file.");
    return undefined;
  }

  return editor;
}

export function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel("Mastermind");

  const compileCommand = vscode.commands.registerCommand(
    "mastermind.compileCurrentFile",
    async () => {
      const editor = getActiveMmiEditor();
      if (!editor) return;

      await editor.document.save();

      output.show(true);
      output.appendLine("=== Mastermind Compile ===");
      output.appendLine(`File: ${editor.document.fileName}`);
      output.appendLine("Starter scaffold is working. Next step is wiring this to the Rust compiler.");
      vscode.window.showInformationMessage("Mastermind compile command triggered.");
    }
  );

  const runCommand = vscode.commands.registerCommand(
    "mastermind.runCurrentFile",
    async () => {
      const editor = getActiveMmiEditor();
      if (!editor) return;

      await editor.document.save();

      output.show(true);
      output.appendLine("=== Mastermind Run ===");
      output.appendLine(`File: ${editor.document.fileName}`);
      output.appendLine("Starter scaffold is working. Next step is wiring execution to the compiler/VM.");
      vscode.window.showInformationMessage("Mastermind run command triggered.");
    }
  );

  const showBrainfuckCommand = vscode.commands.registerCommand(
    "mastermind.showGeneratedBrainfuck",
    async () => {
      const editor = getActiveMmiEditor();
      if (!editor) return;

      const doc = await vscode.workspace.openTextDocument({
        language: "brainfuck",
        content:
`// Placeholder Brainfuck output for:
${editor.document.fileName}

[ generated Brainfuck will appear here once compiler integration is added ]
`
      });

      await vscode.window.showTextDocument(doc, { preview: false });
      vscode.window.showInformationMessage("Opened placeholder Brainfuck output.");
    }
  );

  context.subscriptions.push(
    output,
    compileCommand,
    runCommand,
    showBrainfuckCommand
  );
}

export function deactivate() {}
