// take in a file, read includes and simple conditionals and output a file with those includes pasted in
// C-style

// TODO: add tests for this!

use std::{collections::HashMap, path::PathBuf};

use itertools::Itertools;

use crate::macros::macros::r_assert;

/// Helper function that resolves an include path with search path fallbacks
fn resolve_include_path(file_dir: &PathBuf, include_name: &str) -> Option<PathBuf> {
	// First, try relative to the current file's directory
	let rel_path = PathBuf::from(include_name);
	let direct_path = file_dir.join(&rel_path);
	if direct_path.exists() {
		return Some(direct_path);
	}

	// If it's a simple name (no path separators), try looking in std/ subdirectory of current dir
	if !include_name.contains("/") && !include_name.contains("\\") {
		let std_path = file_dir.join("std").join(include_name);
		if std_path.exists() {
			return Some(std_path);
		}

		// Allow users to override std include directory explicitly.
		if let Ok(std_root) = std::env::var("MMI_STD_PATH") {
			let env_path = PathBuf::from(std_root).join(include_name);
			if env_path.exists() {
				return Some(env_path);
			}
		}

		// Also try finding std relative to workspace root by going up the directory tree
		let mut current = file_dir.clone();
		for _ in 0..10 {
			// Limit search depth to avoid infinite loops
			let candidate = current.join("programs").join("std").join(include_name);
			if candidate.exists() {
				return Some(candidate);
			}
			if !current.pop() {
				break;
			}
		}

		// Try the crate source directory used at compile time (works for cargo-installed binaries).
		if let Some(crate_dir) = option_env!("CARGO_MANIFEST_DIR") {
			let crate_std = PathBuf::from(crate_dir)
				.join("..")
				.join("programs")
				.join("std")
				.join(include_name);
			if crate_std.exists() {
				return Some(crate_std);
			}

			let sibling_std = PathBuf::from(crate_dir).join("programs").join("std").join(include_name);
			if sibling_std.exists() {
				return Some(sibling_std);
			}
		}

		// Try locations relative to executable path (useful for packaged distributions).
		if let Ok(mut exe_dir) = std::env::current_exe() {
			exe_dir.pop();

			let exe_std = exe_dir.join("programs").join("std").join(include_name);
			if exe_std.exists() {
				return Some(exe_std);
			}

			let parent_std = exe_dir
				.join("..")
				.join("programs")
				.join("std")
				.join(include_name);
			if parent_std.exists() {
				return Some(parent_std);
			}
		}
	}

	None
}

/// Internal preprocessing function with search path support
fn preprocess_internal(file_path: PathBuf) -> String {
	let file_contents = std::fs::read_to_string(&file_path).unwrap();
	let mut dir_path = file_path.clone();
	dir_path.pop();

	file_contents
		.lines()
		.map(|line| {
			if line.starts_with("#include") {
				// TODO: refactor and deduplicate code, currently doesn't care if "" or <> or jk or any set of two characters
				let split: Vec<&str> = line.split_whitespace().collect();
				assert!(
					split.len() == 2,
					"Malformed #include preprocessor directive {line}"
				);
				let mut substring = split[1];
				assert!(
					substring.len() > 2,
					"Expected path string in #include preprocessor directive {line}"
				);
				substring = &substring[1..(substring.len() - 1)];

				match resolve_include_path(&dir_path, substring) {
					Some(include_path) => preprocess_internal(include_path),
					None => panic!("Include file not found: {}", substring),
				}
			} else {
				line.to_owned()
			}
		})
		.fold(String::new(), |acc, e| acc + &e + "\n")
}

pub fn preprocess(file_path: PathBuf) -> String {
	preprocess_internal(file_path)
}

// utility function so that files can be compiled from javascript strings in browser

pub fn preprocess_from_memory(
	file_map: &HashMap<String, String>,
	entry_file_name: String,
) -> Result<String, String> {
	let file_contents = file_map
		.get(&entry_file_name)
		.expect(&format!("No such file \"{entry_file_name}\" exists"));

	let mut acc = String::new();
	for line in file_contents.lines() {
		if line.starts_with("#include") {
			// TODO: refactor and deduplicate code, currently doesn't care if "" or <> or jk or any set of two characters
			let split: Vec<&str> = line.split_whitespace().collect();
			r_assert!(
				split.len() == 2,
				"Malformed #include preprocessor directive {line}"
			);
			let mut substring = split[1];
			r_assert!(
				substring.len() > 2,
				"Expected path string in #include preprocessor directive {line}"
			);
			substring = &substring[1..(substring.len() - 1)];

			acc += &preprocess_from_memory(file_map, substring.to_owned())?;
		} else {
			acc += line;
		}
		acc.push('\n');
	}

	Ok(acc)
}

/// strips comments from input program, does not support anything else
pub fn strip_comments(raw_program: &str) -> String {
	let mut stripped = raw_program
		.lines()
		.map(|line| line.split_once("//").map_or_else(|| line, |(left, _)| left))
		.join("\n");
	// join doesn't add a newline to the end, here we re-add it, this is probably unnecessary
	if raw_program.ends_with("\n") {
		stripped.push_str("\n");
	}
	stripped
}

#[cfg(test)]
pub mod preprocessor_tests {
	use crate::preprocessor::strip_comments;

	#[test]
	fn comments_0() {
		assert_eq!(strip_comments(""), "");
		assert_eq!(strip_comments("\n\t\t\n"), "\n\t\t\n");
	}

	#[test]
	fn comments_1() {
		assert_eq!(strip_comments("hi//hello"), "hi");
	}

	#[test]
	fn comments_2() {
		assert_eq!(strip_comments("h//i // hello"), "h");
	}

	#[test]
	fn comments_3() {
		assert_eq!(
			strip_comments(
				r#"
hello // don't talk to me
second line
// third line comment
fourth line
"#
			),
			r#"
hello 
second line

fourth line
"#
		);
	}
}
