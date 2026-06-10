import * as vscode from 'vscode';
import * as path from 'path';

const PROGRAM_INPUT_KEY = 'mastermind.programInput';
const BRAINFUCK_INPUT_FILE_KEY = 'mastermind.brainfuckInputFile';
const BLOCKING_INPUT_KEY = 'mastermind.blockingInput';

export async function readProgramInputText(context: vscode.ExtensionContext): Promise<string> {
  const fromState = context.globalState.get<string>(PROGRAM_INPUT_KEY);
  if (fromState !== undefined) {
    return fromState;
  }
  return vscode.workspace.getConfiguration('mastermind').get<string>('programInput') ?? '';
}

export async function writeProgramInputText(
  context: vscode.ExtensionContext,
  text: string,
): Promise<void> {
  await context.globalState.update(PROGRAM_INPUT_KEY, text);
}

export async function readBlockingInput(context: vscode.ExtensionContext): Promise<boolean> {
  const fromState = context.globalState.get<boolean>(BLOCKING_INPUT_KEY);
  if (fromState !== undefined) {
    return fromState;
  }
  return vscode.workspace.getConfiguration('mastermind').get<boolean>('blockingInput') ?? false;
}

export async function writeBlockingInput(
  context: vscode.ExtensionContext,
  enabled: boolean,
): Promise<void> {
  await context.globalState.update(BLOCKING_INPUT_KEY, enabled);
}

export async function pickBrainfuckInputFile(
  context: vscode.ExtensionContext,
  runFilePath: string,
): Promise<string | undefined> {
  const lastPath = context.globalState.get<string>(BRAINFUCK_INPUT_FILE_KEY);
  const defaultUri = lastPath
    ? vscode.Uri.file(path.dirname(lastPath))
    : vscode.Uri.file(path.dirname(runFilePath));

  const picks = await vscode.window.showOpenDialog({
    canSelectMany: false,
    canSelectFiles: true,
    canSelectFolders: false,
    defaultUri,
    openLabel: 'Use as program input',
    title: 'Select a .bf file for brainfuck.bf to interpret',
    filters: { Brainfuck: ['bf'] },
  });

  if (!picks?.length) {
    return undefined;
  }

  const picked = picks[0];
  await context.globalState.update(BRAINFUCK_INPUT_FILE_KEY, picked.fsPath);
  const bytes = await vscode.workspace.fs.readFile(picked);
  return Buffer.from(bytes).toString('utf8');
}
