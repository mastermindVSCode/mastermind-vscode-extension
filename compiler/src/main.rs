#![allow(dead_code)]
// dead code is allowed because we have two different compile targets (wasm and command-line)

// project dependencies:
mod backend;
mod brainfuck;
mod frontend;
#[macro_use]
mod macros;
mod misc;
mod parser;
mod preprocessor;
mod tests;
use crate::{
	backend::{bf::{Opcode, TapeCell}, bf2d::{Opcode2D, TapeCell2D}, common::BrainfuckProgram},
	backend::{bf::{Opcode, TapeCell}, bf2d::{Opcode2D, TapeCell2D}, common::BrainfuckProgram},
	brainfuck::{BrainfuckConfig, BrainfuckContext},
	misc::{MastermindConfig, MastermindContext},
	parser::parser::parse_program,
	preprocessor::{preprocess, strip_comments},
};

// stdlib dependencies:
use std::{collections::HashMap,	fs,	io::{stdin, stdout, Cursor}, path::{Path, PathBuf}};
use std::{collections::HashMap,	fs,	io::{stdin, stdout, Cursor}, path::{Path, PathBuf}};

// external dependencies:
use clap::Parser;

#[derive(Parser, Default, Debug)]
#[command(author = "Heathcorp", version = "0.1", about = "Mastermind: the Brainfuck interpreter and compilation tool", long_about = None)]
struct Arguments {
	#[arg(short, long, help = "provide a file to read a program from")]
	file: Option<String>,

	#[arg(short, long, help = "provide a program via command line arguments")]
	program: Option<String>,

	#[arg(
		short = 'i',
		short = 'i',
		long,
		help = "provide input to the Brainfuck VM if running, stdin will be used if not provided"
	)]
	input: Option<String>,

	#[arg(
		short = 'I',
		long = "include",
		help = "add a directory to the include search path (can be specified multiple times)"
	)]
	include_dirs: Vec<String>,

	#[arg(
		short = 'I',
		long = "include",
		help = "add a directory to the include search path (can be specified multiple times)"
	)]
	include_dirs: Vec<String>,

	#[arg(
		short,
		long,
		default_value_t = false,
		help = "compile the provided program to Brainfuck"
	)]
	compile: bool,

	#[arg(
		short,
		long,
		default_value_t = false,
		help = "compile the provided program and write the output to a .bf file"
	)]
	build: bool,

	#[arg(
		short,
		long,
		default_value_t = false,
		help = "run the compiled or provided Brainfuck code"
	)]
	run: bool,

	#[arg(
		short,
		long,
		default_value_t = 0,
		help = "specify the level of optimisation, this is a bitmask value"
	)]
	optimise: usize,

	#[arg(
		short,
		long,
		default_value_t = false,
		help = "suppress informational output like compiled byte-size messages"
	)]
	quiet: bool,
}
// This helper function checks if a candidate path exists and is not already in the list of include directories before adding it to the list. It ensures that only valid and unique directories are included in the search path for included files.
fn push_include_dir_if_exists(include_dirs: &mut Vec<PathBuf>, candidate: PathBuf) {
	if candidate.exists() && !include_dirs.iter().any(|existing| existing == &candidate) {
		include_dirs.push(candidate);
	}
}
// This function builds a list of include directories to search for included files, based on the provided entry file and user-specified include directories. It also checks various locations such as the current working directory, the executable's directory, and the crate directory for potential include paths.
fn build_include_dirs(entry_file: &Path, user_include_dirs: &[String]) -> Vec<PathBuf> {
	let mut include_dirs = Vec::new();

	for dir in user_include_dirs {
		let path = PathBuf::from(dir);
		let canonical = fs::canonicalize(&path).unwrap_or(path);
		push_include_dir_if_exists(&mut include_dirs, canonical);
	}

	if let Ok(std_path) = std::env::var("MMI_STD_PATH") {
		let path = PathBuf::from(std_path);
		let canonical = fs::canonicalize(&path).unwrap_or(path);
		push_include_dir_if_exists(&mut include_dirs, canonical);
	}

	if let Some(parent) = entry_file.parent() {
		for ancestor in parent.ancestors() {
			push_include_dir_if_exists(&mut include_dirs, ancestor.join("std"));
			push_include_dir_if_exists(&mut include_dirs, ancestor.join("stubs"));
			push_include_dir_if_exists(&mut include_dirs, ancestor.join("programs").join("std"));
		}
	}

	if let Ok(cwd) = std::env::current_dir() {
		for ancestor in cwd.ancestors() {
			push_include_dir_if_exists(&mut include_dirs, ancestor.join("std"));
			push_include_dir_if_exists(&mut include_dirs, ancestor.join("stubs"));
			push_include_dir_if_exists(&mut include_dirs, ancestor.join("programs").join("std"));
		}
	}

	if let Ok(exe_path) = std::env::current_exe() {
		if let Some(exe_dir) = exe_path.parent() {
			for ancestor in exe_dir.ancestors() {
				push_include_dir_if_exists(&mut include_dirs, ancestor.join("std"));
				push_include_dir_if_exists(&mut include_dirs, ancestor.join("stubs"));
				push_include_dir_if_exists(&mut include_dirs, ancestor.join("programs").join("std"));
			}
		}
	}

	if let Some(crate_dir) = option_env!("CARGO_MANIFEST_DIR") {
		let crate_root = PathBuf::from(crate_dir);
		push_include_dir_if_exists(&mut include_dirs, crate_root.join("programs").join("std"));
		push_include_dir_if_exists(
			&mut include_dirs,
			crate_root.join("..").join("programs").join("std"),
		);
		push_include_dir_if_exists(&mut include_dirs, crate_root.join("..") .join("stubs"));
	}

	include_dirs

	#[arg(
		short,
		long,
		default_value_t = false,
		help = "suppress informational output like compiled byte-size messages"
	)]
	quiet: bool,
}
// This helper function checks if a candidate path exists and is not already in the list of include directories before adding it to the list. It ensures that only valid and unique directories are included in the search path for included files.
fn push_include_dir_if_exists(include_dirs: &mut Vec<PathBuf>, candidate: PathBuf) {
	if candidate.exists() && !include_dirs.iter().any(|existing| existing == &candidate) {
		include_dirs.push(candidate);
	}
}
// This function builds a list of include directories to search for included files, based on the provided entry file and user-specified include directories. It also checks various locations such as the current working directory, the executable's directory, and the crate directory for potential include paths.
fn build_include_dirs(entry_file: &Path, user_include_dirs: &[String]) -> Vec<PathBuf> {
	let mut include_dirs = Vec::new();

	for dir in user_include_dirs {
		let path = PathBuf::from(dir);
		let canonical = fs::canonicalize(&path).unwrap_or(path);
		push_include_dir_if_exists(&mut include_dirs, canonical);
	}

	if let Ok(std_path) = std::env::var("MMI_STD_PATH") {
		let path = PathBuf::from(std_path);
		let canonical = fs::canonicalize(&path).unwrap_or(path);
		push_include_dir_if_exists(&mut include_dirs, canonical);
	}

	if let Some(parent) = entry_file.parent() {
		for ancestor in parent.ancestors() {
			push_include_dir_if_exists(&mut include_dirs, ancestor.join("std"));
			push_include_dir_if_exists(&mut include_dirs, ancestor.join("stubs"));
			push_include_dir_if_exists(&mut include_dirs, ancestor.join("programs").join("std"));
		}
	}

	if let Ok(cwd) = std::env::current_dir() {
		for ancestor in cwd.ancestors() {
			push_include_dir_if_exists(&mut include_dirs, ancestor.join("std"));
			push_include_dir_if_exists(&mut include_dirs, ancestor.join("stubs"));
			push_include_dir_if_exists(&mut include_dirs, ancestor.join("programs").join("std"));
		}
	}

	if let Ok(exe_path) = std::env::current_exe() {
		if let Some(exe_dir) = exe_path.parent() {
			for ancestor in exe_dir.ancestors() {
				push_include_dir_if_exists(&mut include_dirs, ancestor.join("std"));
				push_include_dir_if_exists(&mut include_dirs, ancestor.join("stubs"));
				push_include_dir_if_exists(&mut include_dirs, ancestor.join("programs").join("std"));
			}
		}
	}

	if let Some(crate_dir) = option_env!("CARGO_MANIFEST_DIR") {
		let crate_root = PathBuf::from(crate_dir);
		push_include_dir_if_exists(&mut include_dirs, crate_root.join("programs").join("std"));
		push_include_dir_if_exists(
			&mut include_dirs,
			crate_root.join("..").join("programs").join("std"),
		);
		push_include_dir_if_exists(&mut include_dirs, crate_root.join("..") .join("stubs"));
	}

	include_dirs
}

fn push_include_dir_if_exists(include_dirs: &mut Vec<PathBuf>, candidate: PathBuf) {
	if candidate.exists() && !include_dirs.iter().any(|existing| existing == &candidate) {
		include_dirs.push(candidate);
	}
}

fn build_include_dirs(entry_file: &Path, user_include_dirs: &[String]) -> Vec<PathBuf> {
	let mut include_dirs = Vec::new();

	for dir in user_include_dirs {
		let path = PathBuf::from(dir);
		let canonical = fs::canonicalize(&path).unwrap_or(path);
		push_include_dir_if_exists(&mut include_dirs, canonical);
	}

	if let Ok(std_path) = std::env::var("MMI_STD_PATH") {
		let path = PathBuf::from(std_path);
		let canonical = fs::canonicalize(&path).unwrap_or(path);
		push_include_dir_if_exists(&mut include_dirs, canonical);
	}

	if let Some(parent) = entry_file.parent() {
		for ancestor in parent.ancestors() {
			push_include_dir_if_exists(&mut include_dirs, ancestor.join("std"));
			push_include_dir_if_exists(&mut include_dirs, ancestor.join("stubs"));
			push_include_dir_if_exists(&mut include_dirs, ancestor.join("programs").join("std"));
		}
	}

	if let Ok(cwd) = std::env::current_dir() {
		for ancestor in cwd.ancestors() {
			push_include_dir_if_exists(&mut include_dirs, ancestor.join("std"));
			push_include_dir_if_exists(&mut include_dirs, ancestor.join("stubs"));
			push_include_dir_if_exists(&mut include_dirs, ancestor.join("programs").join("std"));
		}
	}

	if let Ok(exe_path) = std::env::current_exe() {
		if let Some(exe_dir) = exe_path.parent() {
			for ancestor in exe_dir.ancestors() {
				push_include_dir_if_exists(&mut include_dirs, ancestor.join("std"));
				push_include_dir_if_exists(&mut include_dirs, ancestor.join("stubs"));
				push_include_dir_if_exists(&mut include_dirs, ancestor.join("programs").join("std"));
			}
		}
	}

	if let Some(crate_dir) = option_env!("CARGO_MANIFEST_DIR") {
		let crate_root = PathBuf::from(crate_dir);
		push_include_dir_if_exists(&mut include_dirs, crate_root.join("programs").join("std"));
		push_include_dir_if_exists(
			&mut include_dirs,
			crate_root.join("..").join("programs").join("std"),
		);
		push_include_dir_if_exists(&mut include_dirs, crate_root.join("..") .join("stubs"));
	}

	include_dirs
}

fn main() -> Result<(), String> {
	// TODO: clean up this crazy file, this was the first ever rust I wrote and it's messy
	std::env::set_var("RUST_BACKTRACE", "1");

	let args = Arguments::parse();

	let ctx = MastermindContext {
		// TODO: change this to not be a bitmask, or at least document it
		config: MastermindConfig::new(args.optimise),
	};

	let program = match (&args.file, &args.program) {
		(Some(file), _) => {
			let file_path = PathBuf::from(file);
			let file_path = fs::canonicalize(&file_path).unwrap_or(file_path);

			let is_bf = file_path.extension().map_or(false, |e| e.eq_ignore_ascii_case("bf"));
			if args.run && !args.compile && !args.build && !is_bf {
				return Err("Cannot use -r on non .bf files. -r only runs .bf files directly. Use -cr to compile and run a .mmi file.".to_string());
			}
			if args.compile && !args.run && !args.build && is_bf {
				return Err("Cannot use -c on .bf files as they are already compiled. -c only compiles .mmi files. Use -r to run a .bf file.".to_string());
			}
			let file_path = PathBuf::from(file);
			let file_path = fs::canonicalize(&file_path).unwrap_or(file_path);

			let is_bf = file_path.extension().map_or(false, |e| e.eq_ignore_ascii_case("bf"));
			if args.run && !args.compile && !args.build && !is_bf {
				return Err("Cannot use -r on non .bf files. -r only runs .bf files directly. Use -cr to compile and run a .mmi file.".to_string());
			}
			if args.compile && !args.run && !args.build && is_bf {
				return Err("Cannot use -c on .bf files as they are already compiled. -c only compiles .mmi files. Use -r to run a .bf file.".to_string());
			}
			let mut defines: HashMap<String, String> = HashMap::new();
			let mut conditionals: Vec<bool> = Vec::new();
			let include_dirs = build_include_dirs(&file_path, &args.include_dirs);
			let include_dirs = build_include_dirs(&file_path, &args.include_dirs);

			preprocess(file_path, &mut defines, &mut conditionals, &include_dirs)
		}
		(None, Some(program)) => program.clone(),
		(None, None) => {
			return Err("Provide either --file <path> or --program <code>".to_string());
		}
	};

	let bf_program = match args.compile || args.build {
		true => {
			let stripped_program = strip_comments(&program);
			// compile the provided file
			if ctx.config.enable_2d_grid {
				let parsed_syntax = parse_program::<TapeCell2D, Opcode2D>(&stripped_program)?;
				let instructions = ctx.create_ir_scope(&parsed_syntax, None)?.build_ir();
				let bf_code = ctx.ir_to_bf(instructions, None)?;
				match ctx.config.optimise_generated_code {
					true => ctx.optimise_bf2d(bf_code),
					false => bf_code,
				}
				.to_string()
			} else {
				let parsed_syntax = parse_program::<TapeCell, Opcode>(&stripped_program)?;
				let instructions = ctx.create_ir_scope(&parsed_syntax, None)?.build_ir();
				let bf_code = ctx.ir_to_bf(instructions, None)?;
				match ctx.config.optimise_generated_code {
					true => ctx.optimise_bf(bf_code),
					false => bf_code,
				}
				.to_string()
			}
		}
		false => program,
	};

	if args.build {
		let output_path = match &args.file {
			Some(file) => {
				let p = Path::new(file);
				// If the input already has a .bf extension, avoid overwriting it
				if p.extension().map_or(false, |e| e.eq_ignore_ascii_case("bf")) {
					let stem = p.file_stem().unwrap_or_default();
					p.with_file_name(format!("{}.bf", stem.to_string_lossy()))
						.to_string_lossy()
						.into_owned()
				} else {
					p.with_extension("bf").to_string_lossy().into_owned()
				}
				// If the input already has a .bf extension, avoid overwriting it
				if p.extension().map_or(false, |e| e.eq_ignore_ascii_case("bf")) {
					let stem = p.file_stem().unwrap_or_default();
					p.with_file_name(format!("{}.bf", stem.to_string_lossy()))
						.to_string_lossy()
						.into_owned()
				} else {
					p.with_extension("bf").to_string_lossy().into_owned()
				}
			}
			None => "output.bf".to_string(),
		};
		fs::write(&output_path, &bf_program).map_err(|e| format!("Failed to write code to file: {e}"))?;
		if !args.quiet {
			eprintln!("Compiled code written to {output_path} and was ({} bytes)", bf_program.len());
		}
		fs::write(&output_path, &bf_program).map_err(|e| format!("Failed to write code to file: {e}"))?;
		if !args.quiet {
			eprintln!("Compiled code written to {output_path} and was ({} bytes)", bf_program.len());
		}
	}

	if args.run || args.build || !(args.compile || args.build) {
		// run brainfuck
		let ctx = BrainfuckContext {
			config: BrainfuckConfig {
				enable_debug_symbols: false,
				enable_2d_grid: false,
			},
		};

		if args.input.is_some() {
			ctx.run(
				bf_program.chars().collect(),
				&mut Cursor::new(args.input.unwrap()),
				&mut stdout(),
				None,
			)?;
		} else {
			ctx.run(
				bf_program.chars().collect(),
				&mut stdin(),
				&mut stdout(),
				None,
			)?;
		}
		if !args.quiet {
			eprintln!("\nThe compiled code was ({} bytes)", bf_program.len());
		}

		if !args.quiet {
			eprintln!("\nThe compiled code was ({} bytes)", bf_program.len());
		}

	} else {
		print!("{bf_program}");
		if !args.quiet {
			eprintln!("\nThe compiled code was ({} bytes)", bf_program.len());
		}
		if !args.quiet {
			eprintln!("\nThe compiled code was ({} bytes)", bf_program.len());
		}
	}

	Ok(())
}
