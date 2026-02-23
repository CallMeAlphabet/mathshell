export const help = "unalias NAME...\n  Remove aliases.\n";
export default function unalias(args, { sh }) {
  for (const a of args) delete sh.aliases[a];
  return { output: "", exitCode: 0 };
}
