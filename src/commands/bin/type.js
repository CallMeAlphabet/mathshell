export const help = "type CMD\n  Describe how a command is interpreted.\n";
export default function type(args, { sh, registry }) {
  if (!args.length) return { output: "type: missing argument\n", exitCode: 1 };
  const a = args[0];
  if (sh.aliases[a]) return { output: `${a} is aliased to '${sh.aliases[a]}'\n`, exitCode: 0 };
  if (registry && registry[a]) return { output: `${a} is a shell builtin\n`, exitCode: 0 };
  return { output: `${a}: not found\n`, exitCode: 1 };
}
