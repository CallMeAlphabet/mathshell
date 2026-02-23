export const help = "yes [STRING]\n  Output STRING (default: y) repeatedly.\n";
export default function yes(args) {
  return { output: Array(20).fill(args[0] || "y").join("\n") + "\n", exitCode: 0 };
}
