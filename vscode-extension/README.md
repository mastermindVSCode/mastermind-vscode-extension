# Mastermind VS Code Extension

This is a VS Code extension tied to the Mastermind project, which compiles .mmi files to Brainfuck.

## Quick start

1. From `vscode-extension/`, install dependencies:
   - `yarn install`
2. Compile TypeScript and package the extension into a `.vsix`:
   - `yarn package`

## What’s included

- Registers command `mastermind.readMmi`
- TypeScript build to `dist/`

## Read .mmi

`mastermind.readMmi` is the first integration step:

- It only runs when the active editor file ends with `.mmi`.
- For now, it just confirms it can read the current `.mmi` contents (prints a preview to the Output panel).
- You’ll find a button in the VS Code status bar labeled `Mastermind: Read .mmi` that triggers this command.


