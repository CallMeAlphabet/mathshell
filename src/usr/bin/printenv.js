export const help = "printenv [VAR]\n  Print environment variable value.\n";
export default function printenv(args, { sh }) {
  if (args.length) { const v = sh.env[args[0]]; return v !== undefined ? { output: String(v).replace(/\n$/,"")+"\n", exitCode: 0 } : { output: "", exitCode: 1 }; }
  return { output: Object.entries(sh.env).map(([k,v])=>`${k}=${String(v).replace(/\n$/,"")}`).join("\n")+"\n", exitCode: 0 };
}
