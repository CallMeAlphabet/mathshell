export const help = "pwd [-L] [-P]\n  Print the current working directory.\n  -L  print logical path (default)\n  -P  print physical path (same in mash)\n  Example:\n    pwd\n";
export default function pwd(args, { sh }) {
  return { output: sh.cwd + "\n", exitCode: 0 };
}
