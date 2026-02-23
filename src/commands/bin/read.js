export const help = "read [VAR]\n  Read a line from stdin into a variable.\n";
export default function read(args, { stdin, sh }) {
  if (args.length && stdin != null) sh.env[args[0]] = (stdin ?? "").split("\n")[0];
  return { output: "", exitCode: 0 };
}
