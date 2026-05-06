import { ExtensionContext } from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from "vscode-languageclient/node";
import * as vscode from "vscode";

let client: LanguageClient;

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
      { scheme: "file", language: "mastermind" }
    ],

    synchronize: {
      fileEvents: vscode.workspace.createFileSystemWatcher("**/*.mmi")
    }
  };

  client = new LanguageClient(
    "mastermindLSP",
    "Mastermind Language Server",
    serverOptions,
    clientOptions
  );

  client.start();
}