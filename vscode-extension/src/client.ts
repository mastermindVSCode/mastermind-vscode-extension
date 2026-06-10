import { ExtensionContext } from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from "vscode-languageclient/node";
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

let client: LanguageClient;

function resolveStdPath(): string {
  const cfg = vscode.workspace.getConfiguration("mastermind");
  const configured = cfg.get<string>("stdPath")?.trim();
  if (configured) return configured;

  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) return "";
  const candidate = path.join(folders[0].uri.fsPath, "compiler", "std");
  try {
    return fs.existsSync(candidate) ? candidate : "";
  } catch {
    return "";
  }
}

export function startClient(context: ExtensionContext) {
  const serverModule = context.asAbsolutePath(
    "dist/lsp/server.js"
  );

  const serverOptions: ServerOptions = {
    run: {
      module: serverModule,
      transport: TransportKind.ipc
    },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc
    }
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: "file", language: "mastermind" },
      { scheme: "file", pattern: "**/*.mmi" },
    ],

    initializationOptions: {
      stdPath: resolveStdPath(),
    },

    synchronize: {
      fileEvents: vscode.workspace.createFileSystemWatcher("**/*.mmi"),
      configurationSection: "mastermind",
    },
  };

  client = new LanguageClient(
    "mastermindLSP",
    "Mastermind Language Server",
    serverOptions,
    clientOptions
  );

  client.start();
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}