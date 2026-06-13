# Mastermind

Compile and run [Mastermind](https://mastermind.lostpixels.org/) (`.mmi`) and Brainfuck (`.bf`) from VS Code.

This extension calls the **`mmi`** CLI on your machine. It does not include the compiler—you install **`mmi`** separately from **[`mmi-cli`](https://crates.io/crates/mmi-cli)** on crates.io.

The extension is installed from a **`.vsix`** file you build yourself (steps below).

---

## 1. Prerequisites

Install these before building or using the extension.

| Tool | Why you need it |
|------|------------------|
| **[VS Code](https://code.visualstudio.com/)** 1.110.0 or newer | Run the extension |
| **[Node.js](https://nodejs.org/)** (LTS, includes **npm**) | Build and package the extension |
| **[Git](https://git-scm.com/)** | Clone the repository (optional if you already have the source as a zip) |
| **[Rust](https://www.rust-lang.org/tools/install)** | Install the `mmi` compiler (`mmi-cli` crate) |

Check that Node and npm work:

```bash
node --version
npm --version
```

---

## 2. Get the source

Clone the repository (or download and extract it):

```bash
git clone https://github.com/mastermindVSCode/mastermind-vscode-extension.git
cd mastermind-vscode-extension/vscode-extension
```

All build commands below are run from the **`vscode-extension/`** directory.

---

## 3. Install Node dependencies

```bash
npm install
```

This installs TypeScript, esbuild, `@vscode/vsce` (as `vsce`), and the other packages listed in `package.json`.

---

## 4. Build the extension

Compile the extension and language server into `dist/`:

```bash
npm run build
```

Optional: type-check without emitting files:

```bash
npm run typecheck
```

---

## 5. Package a VSIX

Create an installable `.vsix` in the current folder:

```bash
npm run package
```

This runs `vsce package` (which also runs `npm run build` via the `vscode:prepublish` hook). You should get a file named like:

`mastermind-vscode-extension-1.1.0.vsix`

---

## 6. Install the VSIX in VS Code

**From the UI**

1. Open VS Code.
2. Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) → **Extensions: Install from VSIX…**
3. Select the `.vsix` file from step 5.
4. Reload VS Code when prompted.

**From a terminal**

```bash
code --install-extension mastermind-vscode-extension-1.1.0.vsix
```

(Use the actual filename produced by `npm run package`.)

---

## 7. Install `mmi` (required to compile and run)

The extension invokes **`mmi`** on your **`PATH`**. Install it from **[crates.io](https://crates.io/crates/mmi-cli)**:

```bash
cargo install mmi-cli
```

Verify:

```bash
mmi --help
```

If `mmi` is not on your `PATH`, **Mastermind: Run** and **Mastermind: Compile** will fail.

---

## Commands

Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) → search **Mastermind**:

| Command | What it does |
|--------|----------------|
| **Mastermind: Run** | Run the active `.bf` or `.mmi` file |
| **Mastermind: Compile** | Build a `.mmi` file to `.bf` next to the source |
| **Mastermind: Edit Program Input** | Set the default text for the run input prompt |
| **Mastermind: Toggle Blocking Input** | Enable/disable blocking stdin mode (web IDE-style) |
| **Mastermind: Cancel Run** | Stop a run in progress |

When a `.mmi` or `.bf` file is open, **Blocking Input: off/on** appears in the **editor title bar** next to **Run**. Click to toggle.

---

## Running programs

- **`.bf`** — `mmi -f <file> -r`
- **`.mmi`** — `mmi -f <file> -b -r`

**Output**

- **Mastermind Program** — stdout from your program
- **Mastermind** — compiler messages and the exact `mmi` command used

### Program input

Programs that read input (Brainfuck `,` or Mastermind `input`) need extra data at run time.

**Blocking input off (default)**

- One prompt before run; input is passed as **`mmi -i`**.
- **`brainfuck.bf`** — file picker for the `.bf` program to interpret.

**Blocking input on**

- Run starts immediately; **Edit Program Input** text is fed on **stdin**.
- When more input is needed, **no popup** — further reads get a **null byte (0)**.
- **`brainfuck.bf`** — file picker (keep blocking **off** for this file; see note in `brainfuck.mmi`).

Use the title bar toggle or **Mastermind: Toggle Blocking Input** in the Command Palette.

---

## Settings

VS Code **Settings** → search **Mastermind**:

| Setting | Description |
|--------|-------------|
| **`mastermind.stdPath`** | Path to the Mastermind standard library (`MMI_STD_PATH`). If empty, the extension tries `compiler/std` in your workspace. |
| **`mastermind.programInput`** | Default/saved program input text. |
| **`mastermind.blockingInput`** | Default for blocking stdin mode (also toggled via the title bar). |

---

## Language support

- Syntax highlighting for `.mmi` and `.bf`
- Diagnostics and language features for Mastermind (`.mmi`)

---

## Development (optional)

Run the extension from source in a debug window:

1. Open the repo root in VS Code.
2. **Run Extension** launch config (`.vscode/launch.json`) — or open `vscode-extension/` and use **F5** if configured.
3. After code changes: `npm run build` in `vscode-extension/`, then reload the Extension Development Host.

---

## Links

- [Mastermind web IDE](https://mastermind.lostpixels.org/)
- [Extension repository](https://github.com/mastermindVSCode/mastermind-vscode-extension)
- [`mmi-cli` on crates.io](https://crates.io/crates/mmi-cli)
