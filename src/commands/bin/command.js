export const help = "command [-v] CMD [ARGS...]\n  Run a command bypassing aliases.\n";
export default function command(args, { execCmd, vfs, sh, stdin, registry }) {
  if (!args.length) return { output: "", exitCode: 0 };
  if (args[0] === "-v") return { output: (registry && registry[args[1]] ? "/bin/"+args[1] : "") + "\n", exitCode: registry && registry[args[1]] ? 0 : 1 };
  return execCmd(args[0], args.slice(1), stdin, vfs, sh);
}
