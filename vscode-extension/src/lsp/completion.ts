import * as fs from "fs";
import * as path from "path";
import { TextDocument } from "vscode-languageserver-textdocument";
import {
  CompletionItem,
  CompletionItemKind,
  MarkupKind,
} from "vscode-languageserver/node";
import { parseDocument } from "./documentParse";

type TreeNode = ReturnType<ReturnType<typeof parseDocument>["tree"]["resolve"]>;

export const KEYWORDS: Array<{
  label: string;
  detail?: string;
  doc?: string;
}> = [
  { label: "cell", detail: "type", doc: "Declares a cell variable/type." },
  { label: "extern", detail: "type", doc: "Declares an external value type (provided by the runtime/host)." },
  { label: "struct", detail: "declaration", doc: "Declares a struct type." },
  { label: "fn", detail: "declaration", doc: "Declares a function." },
  { label: "if", detail: "control flow", doc: "Conditional execution." },
  { label: "else", detail: "control flow", doc: "Alternative branch for `if`." },
  { label: "while", detail: "control flow", doc: "Loop while a condition holds." },
  { label: "input", detail: "io", doc: "Reads input into a target." },
  { label: "output", detail: "io", doc: "Outputs an expression." },
  { label: "assert", detail: "debug", doc: "Asserts a condition about a variable." },
  { label: "drain", detail: "operation", doc: "Drains a source expression (optionally into targets)." },
  { label: "copy", detail: "operation", doc: "Copies a source expression (optionally into targets)." },
  { label: "bf", detail: "inline brainfuck", doc: "Embeds Brainfuck with optional location/clobbers." },
  { label: "clobbers", detail: "bf clause", doc: "Declares variables clobbered by `bf { ... }`." },
  { label: "into", detail: "drain/copy", doc: "Specifies targets for `drain`/`copy`." },
  { label: "not", detail: "operator", doc: "Negates an `if` condition." },
  { label: "equals", detail: "assert", doc: "Asserts equality against a constant." },
  { label: "unknown", detail: "assert", doc: "Asserts an unknown value." },
  { label: "true", detail: "boolean", doc: "Boolean literal." },
  { label: "false", detail: "boolean", doc: "Boolean literal." },
  { label: "#include", detail: "preprocessor", doc: "Includes a stdlib or file path." },
  { label: "#define", detail: "preprocessor", doc: "Defines a preprocessor symbol." },
  { label: "#ifdef", detail: "preprocessor", doc: "Conditional compilation if a symbol is defined." },
  { label: "#ifndef", detail: "preprocessor", doc: "Conditional compilation if a symbol is not defined." },
  { label: "#endif", detail: "preprocessor", doc: "Ends a conditional compilation block." },
];

const BF_OPERATORS: Array<{ label: string; doc: string }> = [
  { label: "+", doc: "Increment cell (BF+)." },
  { label: "-", doc: "Decrement cell (BF-)." },
  { label: ">", doc: "Move pointer right." },
  { label: "<", doc: "Move pointer left." },
  { label: "^", doc: "Move pointer up (tape row)." },
  { label: "v", doc: "Move pointer down (tape row)." },
  { label: "[", doc: "Loop while cell is non-zero." },
  { label: "]", doc: "End loop." },
  { label: ".", doc: "Output character." },
  { label: ",", doc: "Input character." },
];

const SNIPPETS: CompletionItem[] = [
  {
    label: "fn …",
    kind: CompletionItemKind.Snippet,
    insertText: "fn ${1:name}(${2:args}) {\n\t$0\n}",
    detail: "snippet",
  },
  {
    label: "struct …",
    kind: CompletionItemKind.Snippet,
    insertText: "struct ${1:Name} {\n\t$0\n}",
    detail: "snippet",
  },
  {
    label: "while …",
    kind: CompletionItemKind.Snippet,
    insertText: "while ${1:condition} {\n\t$0\n}",
    detail: "snippet",
  },
  {
    label: "if … else …",
    kind: CompletionItemKind.Snippet,
    insertText: "if ${1:condition} {\n\t$0\n} else {\n\t\n}",
    detail: "snippet",
  },
  {
    label: "bf { … }",
    kind: CompletionItemKind.Snippet,
    insertText: "bf {\n\t$0\n}",
    detail: "snippet",
  },
];

let configuredStdPath = "";
const stdModuleCache = new Map<string, string[]>();

export function setConfiguredStdPath(stdPath: string) {
  configuredStdPath = stdPath.trim();
  stdModuleCache.clear();
}

function listStdModules(stdDir: string): string[] {
  const cached = stdModuleCache.get(stdDir);
  if (cached) {
    return cached;
  }

  try {
    const names = fs
      .readdirSync(stdDir, { withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => e.name)
      .sort();
    stdModuleCache.set(stdDir, names);
    return names;
  } catch {
    return [];
  }
}

function resolveStdDirs(workspaceRoots: string[] | undefined): string[] {
  const dirs: string[] = [];
  if (configuredStdPath) {
    dirs.push(configuredStdPath);
  }
  for (const root of workspaceRoots ?? []) {
    dirs.push(path.join(root, "compiler", "std"));
  }
  return [...new Set(dirs)];
}

function isInsideBfBlock(tree: ReturnType<typeof parseDocument>["tree"], offset: number): boolean {
  let node: TreeNode | null = tree.resolve(offset, -1);
  while (node) {
    if (node.type.name === "EBrainfuck" || node.type.name === "BrainfuckClause") {
      return true;
    }
    node = node.parent;
  }
  return false;
}

function isInIncludeContext(doc: TextDocument, offset: number): boolean {
  const lineStart = doc.offsetAt({
    line: doc.positionAt(offset).line,
    character: 0,
  });
  const lineText = doc.getText().slice(lineStart, offset);
  return /^\s*#include\b/.test(lineText) || /\b#include\s*$/.test(lineText);
}

function collectSymbols(
  text: string,
  tree: ReturnType<typeof parseDocument>["tree"],
): {
  types: Set<string>;
  functions: Set<string>;
  variables: Set<string>;
} {
  const types = new Set<string>();
  const functions = new Set<string>();
  const variables = new Set<string>();

  const cursor = tree.cursor();
  do {
    if (cursor.type.name !== "Name") continue;
    const node = cursor.node;
    const label = text.slice(node.from, node.to);
    const parent = node.parent?.type.name;
    if (parent === "StructClause" || parent === "Struct") {
      types.add(label);
    } else if (parent === "FnClause") {
      functions.add(label);
    } else if (parent === "VariableDefinition") {
      variables.add(label);
    } else {
      variables.add(label);
    }
  } while (cursor.next());

  return { types, functions, variables };
}

function keywordItems(): CompletionItem[] {
  return KEYWORDS.map((k) => ({
    label: k.label,
    kind: CompletionItemKind.Keyword,
    detail: k.detail,
    documentation: k.doc
      ? { kind: MarkupKind.Markdown, value: k.doc }
      : undefined,
  }));
}

function bfOperatorItems(): CompletionItem[] {
  return BF_OPERATORS.map((op) => ({
    label: op.label,
    kind: CompletionItemKind.Operator,
    detail: "brainfuck",
    documentation: { kind: MarkupKind.Markdown, value: op.doc },
  }));
}

function includeItems(workspaceRoots: string[] | undefined): CompletionItem[] {
  const items: CompletionItem[] = [];
  const seen = new Set<string>();

  for (const stdDir of resolveStdDirs(workspaceRoots)) {
    for (const name of listStdModules(stdDir)) {
      const label = `<${name}>`;
      if (seen.has(label)) continue;
      seen.add(label);
      items.push({
        label,
        kind: CompletionItemKind.Module,
        detail: "stdlib",
        insertText: label,
        documentation: {
          kind: MarkupKind.Markdown,
          value: `Standard library module from \`${stdDir}\`.`,
        },
      });
    }
  }

  return items;
}

function symbolItems(symbols: ReturnType<typeof collectSymbols>): CompletionItem[] {
  const items: CompletionItem[] = [];

  for (const name of symbols.types) {
    items.push({
      label: name,
      kind: CompletionItemKind.Class,
      detail: "struct",
    });
  }
  for (const name of symbols.functions) {
    items.push({
      label: name,
      kind: CompletionItemKind.Function,
      detail: "function",
    });
  }
  for (const name of symbols.variables) {
    if (symbols.types.has(name) || symbols.functions.has(name)) continue;
    items.push({
      label: name,
      kind: CompletionItemKind.Variable,
      detail: "variable",
    });
  }

  return items;
}

export function getCompletions(
  doc: TextDocument,
  offset: number,
  workspaceRoots: string[] | undefined,
): CompletionItem[] {
  const text = doc.getText();
  const { tree } = parseDocument(doc);

  if (isInsideBfBlock(tree, offset)) {
    return bfOperatorItems();
  }

  if (isInIncludeContext(doc, offset)) {
    const includes = includeItems(workspaceRoots);
    if (includes.length) return includes;
    return [
      {
        label: "#include",
        kind: CompletionItemKind.Keyword,
        insertText: "#include ",
        detail: "preprocessor",
      },
      ...includeItems(workspaceRoots),
    ];
  }

  const symbols = collectSymbols(text, tree);
  const symbolCompletions = symbolItems(symbols);

  return [...keywordItems(), ...SNIPPETS, ...symbolCompletions];
}

export function findKeywordHover(word: string) {
  return KEYWORDS.find((k) => k.label === word);
}

export function findBfOperatorHover(char: string) {
  return BF_OPERATORS.find((op) => op.label === char);
}
