/** Write seed bytes to mmi stdin, then close so further reads get EOF/null. */
export function feedStdinSeed(stdin: NodeJS.WritableStream, seed: string): void {
  if (seed.length > 0) {
    stdin.write(seed, 'utf8', () => {
      stdin.end();
    });
  } else {
    stdin.end();
  }
}
