import { ExtensionContext } from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from "vscode-languageclient/node";

let client: LanguageClient;

export function startClient(context: ExtensionContext) {
  const serverModule = context.asAbsolutePath(
    "lsp/server.js"
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
    ]
  };

  client = new LanguageClient(
    "mastermindLSP",
    "Mastermind Language Server",
    serverOptions,
    clientOptions
  );

  client.start();
}