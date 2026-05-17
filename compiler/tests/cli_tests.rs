// Integration tests for the `mmi` CLI binary.
//
// These tests verify that CLI option combinations behave correctly:
// which combinations should succeed, which should fail, and that
// flags like -c, -r, -b, and -o do what they are supposed to.
use std::process::{Command, Output};

const MMI_BIN: &str = env!("CARGO_BIN_EXE_mmi");
const FIXTURES: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/tests/fixtures");

fn mmi(args: &[&str]) -> Output {
	Command::new(MMI_BIN)
		.args(args)
		.output()
		.expect("failed to execute mmi binary")
}

fn stdout(out: &Output) -> String {
	String::from_utf8_lossy(&out.stdout).into_owned()
}

fn stderr(out: &Output) -> String {
	String::from_utf8_lossy(&out.stderr).into_owned()
}

fn fixture(name: &str) -> String {
	format!("{FIXTURES}/{name}")
}

// ─── Failure cases ───────────────────────────────────────────────────────────

// No arguments at all must exit with an error.
#[test]
fn no_args_fails() {
	let out = mmi(&[]);
	assert!(!out.status.success(), "expected failure when no args are given");
}

// Providing -r (run) alone on a .mmi source file is not valid because -r only
// runs pre-compiled .bf files.  The user must add -c to compile first.
#[test]
fn run_flag_on_mmi_file_fails() {
	let path = fixture("hello.mmi");
	let out = mmi(&["--file", &path, "-r"]);
	assert!(
		!out.status.success(),
		"expected failure when -r is used on a .mmi file without -c"
	);
	assert!(
		stderr(&out).contains("Cannot use -r on non .bf files"),
		"expected a descriptive error message, got: {}",
		stderr(&out)
	);
}

// Providing -c (compile) alone on a .bf file is not valid because .bf files
// are already compiled.
#[test]
fn compile_flag_on_bf_file_fails() {
	let path = fixture("hello.bf");
	let out = mmi(&["--file", &path, "-c"]);
	assert!(
		!out.status.success(),
		"expected failure when -c is used on a .bf file without -r"
	);
	assert!(
		stderr(&out).contains("Cannot use -c on .bf files"),
		"expected a descriptive error message, got: {}",
		stderr(&out)
	);
}

// ─── Success cases ────────────────────────────────────────────────────────────

// -c with an inline program must produce BF output on stdout.
#[test]
fn compile_inline_program_produces_bf_output() {
	let out = mmi(&["--program", "output 65;", "-c"]);
	assert!(
		out.status.success(),
		"expected success; stderr: {}",
		stderr(&out)
	);
	// Compiled BF must contain at least some BF instructions
	let bf = stdout(&out);
	assert!(
		bf.chars().any(|c| "+-<>[].,".contains(c)),
		"expected BF instructions in output, got: {bf}"
	);
}

// -c -r together compile an inline program and then run it, producing the
// expected output.
#[test]
fn compile_and_run_inline_program_produces_output() {
	let out = mmi(&["--program", "output 65;", "-c", "-r"]);
	assert!(
		out.status.success(),
		"expected success; stderr: {}",
		stderr(&out)
	);
	assert_eq!(
		stdout(&out),
		"A",
		"expected 'A' (ASCII 65) on stdout"
	);
}

// -r alone with an inline program treats the program text directly as BF.
// Non-BF characters are ignored in BF, so a .mmi snippet passed with -r
// should still exit successfully (it will just produce no output).
#[test]
fn run_inline_program_as_brainfuck_succeeds() {
	let out = mmi(&["--program", "+-", "-r"]);
	assert!(
		out.status.success(),
		"expected success when running inline BF; stderr: {}",
		stderr(&out)
	);
}

// -c with a .mmi file must compile and exit successfully.
#[test]
fn compile_mmi_file_succeeds() {
	let path = fixture("hello.mmi");
	let out = mmi(&["--file", &path, "-c"]);
	assert!(
		out.status.success(),
		"expected success when compiling a .mmi file; stderr: {}",
		stderr(&out)
	);
}

// -c -r with a .mmi file must produce the expected program output.
#[test]
fn compile_and_run_mmi_file_produces_expected_output() {
	let path = fixture("hello.mmi");
	let out = mmi(&["--file", &path, "-c", "-r"]);
	assert!(
		out.status.success(),
		"expected success when compiling and running a .mmi file; stderr: {}",
		stderr(&out)
	);
	assert_eq!(stdout(&out), "Hello!\n");
}

// -r with a .bf file must run it and exit successfully.
#[test]
fn run_bf_file_succeeds() {
	let path = fixture("a.bf");
	let out = mmi(&["--file", &path, "-r"]);
	assert!(
		out.status.success(),
		"expected success when running a .bf file; stderr: {}",
		stderr(&out)
	);
	// a.bf outputs 'a' (ASCII 97)
	assert_eq!(stdout(&out), "a");
}

// -r with a .bf file can also omit -r; the binary defaults to running when
// neither -c nor -b is given.
#[test]
fn running_bf_file_without_explicit_run_flag_succeeds() {
	let path = fixture("a.bf");
	let out = mmi(&["--file", &path]);
	assert!(
		out.status.success(),
		"expected success when a .bf file is given with no mode flags; stderr: {}",
		stderr(&out)
	);
}

// -o (optimise) accepts a bitmask and the program still produces correct output.
#[test]
fn optimise_flag_produces_correct_output() {
	// bitmask 7 = bits 0,1,2 = optimise_generated_code + cell_clearing + unreachable_loops
	let out = mmi(&["--program", "output 65;", "-c", "-r", "--optimise", "7"]);
	assert!(
		out.status.success(),
		"expected success with --optimise 7; stderr: {}",
		stderr(&out)
	);
	assert_eq!(stdout(&out), "A");
}

// -o with each individual optimisation bit still produces correct output.
#[test]
fn individual_optimise_bits_produce_correct_output() {
	for bit in 0..4u32 {
		let mask = (1u32 << bit).to_string();
		let out = mmi(&["--program", "output 65;", "-c", "-r", "--optimise", &mask]);
		assert!(
			out.status.success(),
			"expected success with --optimise {mask}; stderr: {}",
			stderr(&out)
		);
		assert_eq!(stdout(&out), "A", "--optimise {mask} changed the output");
	}
}

// --input passes a string to the BF VM instead of reading from stdin.
#[test]
fn input_flag_is_passed_to_vm() {
	// This mmi program reads one byte and outputs it back.
	let program = "cell c; input c; output c;";
	let out = mmi(&["--program", program, "-c", "-r", "--input", "Z"]);
	assert!(
		out.status.success(),
		"expected success with --input; stderr: {}",
		stderr(&out)
	);
	assert_eq!(stdout(&out), "Z");
}

// -c and -r as a combined short flag (-cr) behave the same as passing them
// separately.
#[test]
fn combined_cr_flag_matches_separate_flags() {
	let separate = mmi(&["--program", "output 65;", "-c", "-r"]);
	let combined = mmi(&["--program", "output 65;", "-cr"]);
	assert!(separate.status.success());
	assert!(combined.status.success());
	assert_eq!(stdout(&separate), stdout(&combined));
}

// -b writes the compiled output to a .bf file and exits successfully.
// not conflict with the static a.bf fixture used by the run tests.
#[test]
fn build_flag_writes_bf_file() {
	use std::fs;

	// build_test.mmi → build_test.bf (alongside the source in fixtures/)
	let src = fixture("build_test.mmi");
	let expected_bf = std::path::PathBuf::from(&src).with_extension("bf");
	// Clean up any leftover from a previous run.
	let _ = fs::remove_file(&expected_bf);

	let out = mmi(&["--file", &src, "-b"]);
	assert!(
		out.status.success(),
		"expected success with -b; stderr: {}",
		stderr(&out)
	);
	assert!(
		expected_bf.exists(),
		"expected {expected_bf:?} to be created by -b"
	);

	// Clean up the generated file so it doesn't linger between test runs.
	let _ = fs::remove_file(&expected_bf);
}

// -q suppresses informational stderr output. Currently just byte-size messages.
#[test]
fn quiet_flag_suppresses_informational_byte_size_output() {
	let out = mmi(&["--program", "output 65;", "-c", "-q"]);
	assert!(
		out.status.success(),
		"expected success with -q; stderr: {}",
		stderr(&out)
	);
	assert!(
		!stderr(&out).contains("compiled code was"),
		"expected byte-size info to be suppressed, got: {}",
		stderr(&out)
	);
}
