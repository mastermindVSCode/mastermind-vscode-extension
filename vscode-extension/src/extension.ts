import * as vscode from 'vscode';

import {
  registerBlockingInputToggle,
  setBlockingInputEnabled,
  toggleBlockingInputEnabled,
} from './blockingInputToggle';
import { registerBrainfuckDiagnostics } from './bfDiagnostics';
import { registerDocumentLanguage } from './documentLanguage';
import { registerLazyLanguageClient, stopLanguageClient } from './lazyClient';

import { execFile, spawn, type ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import {
  pickBrainfuckInputFile,
  readBlockingInput,
  readProgramInputText,
  writeProgramInputText,
} from './programInput';
import { feedStdinSeed } from './runtime/inputBuffer';

export function activate(context: vscode.ExtensionContext) {
  registerDocumentLanguage(context);
  registerBrainfuckDiagnostics(context);
  registerLazyLanguageClient(context);
  registerBlockingInputToggle(context);

  const runtimeLog = vscode.window.createOutputChannel('Mastermind');
  const programOut = vscode.window.createOutputChannel('Mastermind Program');
  context.subscriptions.push(runtimeLog, programOut);

  let cancelRun: (() => void) | undefined;
  let activeMmiChild: ChildProcess | undefined;

  context.subscriptions.push(
    vscode.commands.registerCommand('mastermind.toggleBlockingInput', async () => {
      await toggleBlockingInputEnabled(context);
    }),

    vscode.commands.registerCommand('mastermind.blockingInput.enable', async () => {
      await setBlockingInputEnabled(context, true);
    }),

    vscode.commands.registerCommand('mastermind.blockingInput.disable', async () => {
      await setBlockingInputEnabled(context, false);
    }),

    vscode.commands.registerCommand('mastermind.editProgramInput', async () => {
      const current = await readProgramInputText(context);
      const value = await vscode.window.showInputBox({
        title: 'Program input',
        prompt: 'Default for the next Run on a .bf that needs input (mmi -i when blocking input is off)',
        value: current,
        ignoreFocusOut: true,
      });
      if (value !== undefined) {
        await writeProgramInputText(context, value);
      }
    }),

    vscode.commands.registerCommand('mastermind.cancelRun', async () => {
      cancelRun?.();
      activeMmiChild?.kill();
    }),

    vscode.commands.registerCommand('mastermind.compile', async () => {
      const doc = await getActiveSavedDocument();
      if (!doc) return;

      const filePath = doc.fileName;
      if (!filePath.toLowerCase().endsWith('.mmi')) {
        vscode.window.showWarningMessage('Compile is only available for `.mmi` files.');
        return;
      }

      try {
        const { bfPath, compilerStderr } = await buildMmiToBfFile(filePath);
        runtimeLog.show(true);
        runtimeLog.appendLine(`Built ${basename(bfPath)} next to ${basename(filePath)}.`);
        if (compilerStderr.trim()) {
          runtimeLog.appendLine(compilerStderr.trimEnd());
        }

        const bfDoc = await vscode.workspace.openTextDocument(vscode.Uri.file(bfPath));
        await vscode.window.showTextDocument(bfDoc, { preview: true });
      } catch (e) {
        runtimeLog.show(true);
        runtimeLog.appendLine(String(e));
        vscode.window.showErrorMessage('Failed to compile with `mmi`. See Output > Mastermind for details.');
      }
    }),

    vscode.commands.registerCommand('mastermind.run', async () => {
      const doc = await getActiveSavedDocument();
      if (!doc) return;

      const filePath = doc.fileName;
      const blockingInput = await readBlockingInput(context);

      let runInput: RunInputPlan;
      try {
        runInput = await planRunInput(context, filePath, blockingInput);
      } catch (e) {
        if (String(e).includes('cancelled')) {
          return;
        }
        throw e;
      }

      try {
        programOut.clear();

        const stdout = await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Mastermind: Running ${basename(filePath)}`,
            cancellable: true,
          },
          async (_progress, token) => {
            cancelRun = () => {
              activeMmiChild?.kill();
            };
            token.onCancellationRequested(() => cancelRun?.());

            return runViaMmi(filePath, runInput, {
              runtimeLog,
              setActiveChild: (child) => {
                activeMmiChild = child;
              },
            });
          },
        );

        if (stdout.length > 0) {
          programOut.append(stdout.endsWith('\n') ? stdout : `${stdout}\n`);
        } else {
          programOut.appendLine('(no program output)');
        }
        programOut.show(true);

        runtimeLog.appendLine('Program finished.');
      } catch (e) {
        runtimeLog.show(true);
        runtimeLog.appendLine(String(e));
        vscode.window.showErrorMessage('Failed to run. See Output > Mastermind for details.');
      } finally {
        cancelRun = undefined;
        activeMmiChild = undefined;
      }
    }),
  );
}

export function deactivate(): Thenable<void> | undefined {
  return stopLanguageClient();
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

  return { mmiPath: 'mmi', env };
}

function execFileCapture(
  file: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  cwd?: string,
): Promise<{ stdout: string; stderr: string }> {
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
        resolve({
          stdout: (stdout || '').toString(),
          stderr: (stderr || '').toString(),
        });
      },
    );
  });
}

async function buildMmiToBfFile(mmiFilePath: string): Promise<{ bfPath: string; compilerStderr: string }> {
  const { mmiPath, env } = getMmiInvocation();
  const bfPath = replaceExtension(mmiFilePath, '.bf');

  const { stderr } = await execFileCapture(
    mmiPath,
    ['-f', mmiFilePath, '-b'],
    env,
    path.dirname(mmiFilePath),
  );

  return { bfPath, compilerStderr: stderr };
}

function replaceExtension(filePath: string, newExt: string): string {
  const parsed = path.parse(filePath);
  return path.join(parsed.dir, `${parsed.name}${newExt}`);
}

type RunInputPlan = {
  upfrontInput?: string;
  stdinSeed: string;
  useStdinPipe: boolean;
};

type RunViaMmiOptions = {
  runtimeLog: vscode.OutputChannel;
  setActiveChild: (child: ChildProcess | undefined) => void;
};

async function planRunInput(
  context: vscode.ExtensionContext,
  filePath: string,
  blockingInput: boolean,
): Promise<RunInputPlan> {
  const needsInput = fileMayNeedInput(filePath);
  if (!needsInput) {
    return { stdinSeed: '', useStdinPipe: false };
  }

  if (blockingInput) {
    return {
      stdinSeed: await resolveBlockingStdinSeed(context, filePath),
      useStdinPipe: true,
    };
  }

  return {
    upfrontInput: await resolveProgramInputUpfront(context, filePath),
    stdinSeed: '',
    useStdinPipe: false,
  };
}

function stripMmiComments(source: string): string {
  return source.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

function fileMayNeedInput(filePath: string): boolean {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lower = filePath.toLowerCase();
    if (lower.endsWith('.bf')) {
      return content.replace(/[^+\-<>.,\[\]]/g, '').includes(',');
    }
    if (lower.endsWith('.mmi')) {
      return /\binput\s+[A-Za-z_]\w*/.test(stripMmiComments(content));
    }
    return false;
  } catch {
    return false;
  }
}

function mmiRunArgs(filePath: string, input?: string): string[] {
  const isBf = filePath.toLowerCase().endsWith('.bf');
  const args = ['-f', filePath];
  if (isBf) {
    args.push('-r');
  } else {
    args.push('-b', '-r');
  }
  if (input !== undefined && input.length > 0) {
    args.push('-i', input);
  }
  return args;
}

function isBrainfuckInterpreterFile(filePath: string): boolean {
  return basename(filePath).toLowerCase() === 'brainfuck.bf';
}

async function resolveProgramInputUpfront(
  context: vscode.ExtensionContext,
  filePath: string,
): Promise<string | undefined> {
  if (!fileMayNeedInput(filePath)) {
    return undefined;
  }

  if (isBrainfuckInterpreterFile(filePath)) {
    const fromFile = await pickBrainfuckInputFile(context, filePath);
    if (fromFile === undefined) {
      throw new Error('Run cancelled (no .bf file selected).');
    }
    return fromFile;
  }

  const current = await readProgramInputText(context);
  const value = await vscode.window.showInputBox({
    title: `Program input: ${basename(filePath)}`,
    prompt: 'Passed to mmi as -i',
    placeHolder: 'e.g. 1+2 for basic_calculator.bf',
    value: current,
    ignoreFocusOut: true,
  });

  if (value === undefined) {
    throw new Error('Run cancelled.');
  }

  await writeProgramInputText(context, value);
  return value;
}

async function resolveBlockingStdinSeed(
  context: vscode.ExtensionContext,
  filePath: string,
): Promise<string> {
  if (isBrainfuckInterpreterFile(filePath)) {
    const fromFile = await pickBrainfuckInputFile(context, filePath);
    if (fromFile === undefined) {
      throw new Error('Run cancelled (no .bf file selected).');
    }
    return fromFile;
  }

  return readProgramInputText(context);
}

async function runViaMmi(
  filePath: string,
  runInput: RunInputPlan,
  opts: RunViaMmiOptions,
): Promise<string> {
  const { mmiPath, env } = getMmiInvocation();
  const cwd = path.dirname(filePath);

  const args = mmiRunArgs(filePath, runInput.upfrontInput);

  opts.runtimeLog.appendLine(`mmi ${args.map((a) => (a.includes(' ') ? `"${a}"` : a)).join(' ')}`);
  if (runInput.useStdinPipe) {
    opts.runtimeLog.appendLine('(blocking input: stdin; null bytes after buffer is used)');
  }

  return new Promise((resolve, reject) => {
    const child = spawn(mmiPath, args, {
      env,
      cwd,
      windowsHide: true,
      stdio: [runInput.useStdinPipe ? 'pipe' : 'ignore', 'pipe', 'pipe'],
    });

    opts.setActiveChild(child);

    let stdout = '';

    const stdoutStream = child.stdout;
    const stderrStream = child.stderr;

    if (stdoutStream) {
      stdoutStream.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8');
      });
    }

    if (stderrStream) {
      stderrStream.on('data', (chunk: Buffer) => {
        opts.runtimeLog.append(chunk.toString('utf8'));
      });
    }

    if (runInput.useStdinPipe && child.stdin) {
      feedStdinSeed(child.stdin, runInput.stdinSeed);
    }

    child.on('error', (err) => {
      reject(err);
    });

    child.on('close', (code) => {
      opts.setActiveChild(undefined);

      if (code !== 0 && code !== null) {
        reject(new Error(`mmi exited with code ${code}`));
        return;
      }

      resolve(stdout);
    });
  });
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
