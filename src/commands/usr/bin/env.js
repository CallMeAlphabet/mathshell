export const help = "env\n  Print all environment variables.\n";
export default function env(args, { sh }) {
  return { output: Object.entries(sh.env).map(([k,v])=>`${k}=${String(v).replace(/\n$/,"")}`).join("\n")+"\n", exitCode: 0 };
}
