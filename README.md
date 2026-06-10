# Mastermind

Mastermind is a programming language designed to compile to the esoteric language _Brainfuck_.

Brainfuck is essentially a modern interpretation of the classical Turing machine. It consists of an array (or _tape_) of 8-bit values, with simple increment/decrement, move left/right, and control flow operations. The full language only uses 8 control characters: `+-><.,[]`.

Imagine an alternate reality where C was designed for computer architectures that run Brainfuck natively, that is what Mastermind is intended to be.

Mastermind language/compiler reference can be found here: [https://github.com/Heathcorp/Mastermind/blob/main/reference.md]()

Development guide can be found here: [https://github.com/Heathcorp/Mastermind/blob/main/devguide.md]()

## VS Code extension (1.1.0)

The [`vscode-extension/`](vscode-extension/) folder contains the **Mastermind** VS Code extension. It runs compile and run by invoking the **`mmi`** CLI.

The CLI is built from the **`mmi-cli`** Cargo crate in [`compiler/`](compiler/):

```bash
cd compiler
cargo install --path .
```

See [vscode-extension/README.md](vscode-extension/README.md) for extension features, input workflow, and development setup.
