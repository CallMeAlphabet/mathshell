export const help = "alias [name='cmd']\n  Create or list command aliases.\n";
export default function alias(args, { sh }) {
  if (!args.length) { const o = Object.entries(sh.aliases).map(([k,v])=>`alias ${k}='${v}'`).join("\n"); return { output: (o||"(no aliases)")+"\n", exitCode: 0 }; }
  for (const a of args) { const eq = a.indexOf("="); if (eq !== -1) sh.aliases[a.slice(0,eq)] = a.slice(eq+1).replace(/^['"]|['"]$/g,""); }
  return { output: "", exitCode: 0 };
}
