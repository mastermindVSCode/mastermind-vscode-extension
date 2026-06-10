import * as vscode from 'vscode';
import { readBlockingInput, writeBlockingInput } from './programInput';

const CONTEXT_KEY = 'mastermind.blockingInputEnabled';

export async function syncBlockingInputContext(context: vscode.ExtensionContext): Promise<boolean> {
  const enabled = await readBlockingInput(context);
  await vscode.commands.executeCommand('setContext', CONTEXT_KEY, enabled);
  return enabled;
}

export async function setBlockingInputEnabled(
  context: vscode.ExtensionContext,
  enabled: boolean,
): Promise<void> {
  await writeBlockingInput(context, enabled);
  await syncBlockingInputContext(context);
}

export async function toggleBlockingInputEnabled(context: vscode.ExtensionContext): Promise<boolean> {
  const enabled = !(await readBlockingInput(context));
  await setBlockingInputEnabled(context, enabled);
  return enabled;
}

export function registerBlockingInputToggle(context: vscode.ExtensionContext): void {
  void syncBlockingInputContext(context);

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('mastermind.blockingInput')) {
        void syncBlockingInputContext(context);
      }
    }),
  );
}
