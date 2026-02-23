export const help = "which CMD...\n  Show command location.\n";
export default function which(args, { sh, registry }) {
  if (!args.length) return { output: "which: missing argument\n", exitCode: 1 };
  const outs = []; let ec = 0;
  for (const a of args) {
    if (sh.aliases[a]) outs.push(`${a}: aliased to ${sh.aliases[a]}`);
    else if (registry && registry[a]) outs.push("/bin/" + a);
    else { outs.push(`which: no ${a} in (/bin:/usr/bin)`); ec = 1; }
  }
  return { output: outs.join("\n") + "\n", exitCode: ec };
}
