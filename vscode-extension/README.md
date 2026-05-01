# Mastermind VS Code Extension

VS Code extension for compiling and running Mastermind (`.mmi`) programs via the `mmi` command.

## Features

- `Mastermind: Compile`
  - Available when the active file is `.mmi`.
  - Compiles the file to Brainfuck (`.bf`) using `mmi --file <file> --compile`.
  - Writes the generated `.bf` file next to the source file.
  - Opens the generated `.bf` file in the editor.
- `Mastermind: Run`
  - Available for `.mmi` and `.bf` files.
  - For `.mmi`, it first compiles to `.bf`, then runs it.
  - For `.bf`, it runs the file directly.
  - Runs in a dedicated `Mastermind` terminal inside VS Code.
- Output and errors are shown in `Output > Mastermind` for compile/run failures.

## Requirements

- `mmi` must be available on your system `PATH`.
- VS Code `1.110.0` or newer.

## Install `mmi-cli`

The compiler CLI is provided by the main Mastermind project.

1. Install [Rust and Cargo](https://www.rust-lang.org/tools/install).
2. Clone the compiler repository:
   - `git clone https://github.com/Heathcorp/Mastermind.git`
3. Build/install with Cargo from the compiler crate:
   - `cd Mastermind/compiler`
   - `cargo install --path .`
4. The installed crate should provide the `mmi` command.
5. Verify it is available on your `PATH`:
   - `mmi --help`

If your install exposes a different binary name, create an alias/wrapper named `mmi` so this extension can invoke it.

## Configuration

This extension contributes one setting:

- `mastermind.stdPath` (string, default: empty)
  - Optional path to the Mastermind stdlib directory.
  - When set, the extension exports it as `MMI_STD_PATH` for compile/run commands.

If `mastermind.stdPath` is not set, the extension attempts to auto-detect stdlib at:

- `<workspaceRoot>/compiler/std`

## Usage

1. Open a `.mmi` file.
2. Run **Mastermind: Compile** from the Command Palette, or use the editor title button.
3. Run **Mastermind: Run** to execute either `.mmi` (compile + run) or `.bf` files.

When a program requests input, type into the `Mastermind` terminal and press Enter.


