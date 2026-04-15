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
	backend::{
		bf::{Opcode, TapeCell},
		bf2d::{Opcode2D, TapeCell2D},
		common::BrainfuckProgram,
	},
	brainfuck::{BrainfuckConfig, BrainfuckContext},
	misc::{MastermindConfig, MastermindContext},
	parser::parser::parse_program,
	preprocessor::{preprocess, strip_comments},
};

// stdlib dependencies:
use std::{collections::HashMap, fs, io::{Cursor, stdin, stdout}, path::Path};

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
		short,
		long,
		help = "provide input to the Brainfuck VM if running, stdin will be used if not provided"
	)]
	input: Option<String>,

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
			let file_path = std::path::PathBuf::from(file);
			let mut defines: HashMap<String, String> = HashMap::new();
			let mut conditionals: Vec<bool> = Vec::new();

			// Build include search paths: look for std/ and stubs/ in the current working directory
			let include_dirs: Vec<std::path::PathBuf> = {
				let mut dirs = Vec::new();
				// Support MMI_STD_PATH env var override
				if let Ok(std_path) = std::env::var("MMI_STD_PATH") {
					dirs.push(std::path::PathBuf::from(std_path));
				}
				// Check for std/ and stubs/ in the current working directory
				if let Ok(cwd) = std::env::current_dir() {
					let std_dir = cwd.join("std");
					if std_dir.exists() {
						dirs.push(std_dir);
					}
					let stubs_dir = cwd.join("stubs");
					if stubs_dir.exists() {
						dirs.push(stubs_dir);
					}
				}
				dirs
			};

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
				let instructions = ctx.create_ir_scope(&parsed_syntax, None)?.build_ir(false);
				let bf_code = ctx.ir_to_bf(instructions, None)?;
				match ctx.config.optimise_generated_code {
					true => ctx.optimise_bf2d(bf_code),
					false => bf_code,
				}
				.to_string()
			} else {
				let parsed_syntax = parse_program::<TapeCell, Opcode>(&stripped_program)?;
				let instructions = ctx.create_ir_scope(&parsed_syntax, None)?.build_ir(false);
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
				p.with_extension("bf").to_string_lossy().into_owned()
			}
			None => "output.bf".to_string(),
		};
		fs::write(&output_path, &bf_program).map_err(|e| format!("Failed to write output file: {e}"))?;
		println!("Compiled output written to {output_path}");
	}

	if args.run || !(args.compile || args.build) {
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
	} else {
		print!("{bf_program}");
	}

	Ok(())
}
