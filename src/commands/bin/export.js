export const help = "export [VAR=value]\n  Set environment variables.\n  With no args, lists all exported variables.\n";
export default function exportCmd(args, { sh }) {
  if (!args.length) return { output: Object.entries(sh.env).map(([k,v])=>`export ${k}="${String(v).replace(/\n$/,"")}"`).join("\n")+"\n", exitCode: 0 };
  for (const a of args) { const eq = a.indexOf("="); if (eq !== -1) sh.env[a.slice(0,eq)] = a.slice(eq+1); }
  return { output: "", exitCode: 0 };
}
