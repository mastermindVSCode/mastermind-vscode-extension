import * as vscode from 'vscode';
import { startClient} from "./client";
import { execFile } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
  startClient(context);
  const output = vscode.window.createOutputChannel('Mastermind');
  context.subscriptions.push(output);

  context.subscriptions.push(
    vscode.commands.registerCommand('mastermind.compile', async () => {
      const doc = await getActiveSavedDocument();
      if (!doc) return;

      const filePath = doc.fileName;
      if (!filePath.toLowerCase().endsWith('.mmi')) {
        vscode.window.showWarningMessage('Compile is only available for `.mmi` files.');
        return;
      }

      try {
        const { bfPath } = await buildMmiToBfFile(filePath);
        output.show(true);
        output.appendLine(`Built ${basename(bfPath)} next to ${basename(filePath)}.`);

        // Open the generated BF file for easy editing if desired.
        const bfDoc = await vscode.workspace.openTextDocument(vscode.Uri.file(bfPath));
        await vscode.window.showTextDocument(bfDoc, { preview: true });
      } catch (e) {
        output.show(true);
        output.appendLine(String(e));
        vscode.window.showErrorMessage('Failed to compile with `mmi`. See Output > Mastermind for details.');
      }
    }),

    vscode.commands.registerCommand('mastermind.run', async () => {
      const doc = await getActiveSavedDocument();
      if (!doc) return;

      const filePath = doc.fileName;
      const lower = filePath.toLowerCase();

      try {
        if (lower.endsWith('.mmi')) {
          // Deterministic flow: always build a .bf next to the .mmi, then run that file.
          const { bfPath } = await buildMmiToBfFile(filePath);
          runFileInTerminal(context, bfPath);
          return;
        }

        if (lower.endsWith('.bf')) {
          runFileInTerminal(context, filePath);
          return;
        }

        vscode.window.showWarningMessage('Run is available for `.mmi` and `.bf` files.');
      } catch (e) {
        output.show(true);
        output.appendLine(String(e));
        vscode.window.showErrorMessage('Failed to run with `mmi`. See Output > Mastermind for details.');
      }
    }),
  );
}

export function deactivate() {
}

function basename(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const lastSlash = normalized.lastIndexOf('/');
  return lastSlash >= 0 ? normalized.slice(lastSlash + 1) : normalized;
}

function getMmiInvocation(): { mmiPath: string; env: NodeJS.ProcessEnv } {
  const cfg = vscode.workspace.getConfiguration('mastermind');
  const configuredStdPath = cfg.get<string>('stdPath')?.trim();

  const env: NodeJS.ProcessEnv = { ...process.env };

  // If the user didn’t configure stdPath, auto-detect the repo’s stdlib (common in this project).
  // This fixes includes like `#include <u8>` when compiling files outside `compiler/`.
  const detectedStdPath = (() => {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) return undefined;
    const root = folders[0].uri.fsPath;
    const candidate = path.join(root, 'compiler', 'std');
    try {
      return fs.existsSync(candidate) ? candidate : undefined;
    } catch {
      return undefined;
    }
  })();

  const stdPath = configuredStdPath || detectedStdPath;
  if (stdPath) {
    env.MMI_STD_PATH = stdPath;
  }

  // We intentionally do not try to locate `mmi` here. It must be on PATH.
  return { mmiPath: 'mmi', env };
}

function execFileText(file: string, args: string[], env: NodeJS.ProcessEnv, cwd?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      file,
      args,
      { env, cwd, windowsHide: true, maxBuffer: 20 * 1024 * 1024 },
      (err, stdout: string | Buffer, stderr: string | Buffer) => {
      if (err) {
        const msg = (stderr || stdout || err.message || String(err)).toString();
        reject(new Error(msg.trim()));
        return;
      }
      resolve((stdout || stderr || '').toString());
      },
    );
  });
}

function quoteArg(s: string): string {
  // Simple cross-shell quoting for paths with spaces. Works for PowerShell/cmd/bash enough for our use.
  if (!s.includes(' ') && !s.includes('"')) return s;
  return `"${s.replace(/"/g, '\\"')}"`;
}

async function buildMmiToBfFile(mmiFilePath: string): Promise<{ bf: string; bfPath: string }> {
  const { mmiPath, env } = getMmiInvocation();
  const bf = await execFileText(mmiPath, ['--file', mmiFilePath, '--compile'], env, path.dirname(mmiFilePath));
  const bfPath = replaceExtension(mmiFilePath, '.bf');
  await vscode.workspace.fs.writeFile(vscode.Uri.file(bfPath), Buffer.from(bf, 'utf8'));
  return { bf, bfPath };
}

function replaceExtension(filePath: string, newExt: string): string {
  const parsed = path.parse(filePath);
  return path.join(parsed.dir, `${parsed.name}${newExt}`);
}

function runFileInTerminal(context: vscode.ExtensionContext, filePath: string) {
  const { mmiPath, env } = getMmiInvocation();

  // Create a terminal with the right env so stdlib works consistently.
  // We recreate if needed rather than caching to ensure deterministic env behavior.
  const terminal = vscode.window.createTerminal({
    name: 'Mastermind',
    env: env as Record<string, string | null | undefined>,
    cwd: path.dirname(filePath),
  });
  context.subscriptions.push(terminal);
  terminal.show(true);

  // Make stdin expectations clear in-terminal (works in cmd/pwsh/bash).
  terminal.sendText('echo "Mastermind: If this program requests input, type it in this terminal and press Enter."', true);

  const cmd = `${quoteArg(mmiPath)} --file ${quoteArg(filePath)} --run`;
  terminal.sendText(cmd, true);
}

async function getActiveSavedDocument(): Promise<vscode.TextDocument | undefined> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('No active editor found.');
    return;
  }

  const doc = editor.document;
  if (doc.isUntitled) {
    vscode.window.showWarningMessage('Please save the file before running.');
    return;
  }

  if (doc.isDirty) {
    await doc.save();
  }

  return doc;
}

