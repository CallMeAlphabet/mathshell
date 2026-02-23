export const help = "unset VAR...\n  Remove environment variables.\n";
export default function unset(args, { sh }) {
  for (const a of args) delete sh.env[a];
  return { output: "", exitCode: 0 };
}
