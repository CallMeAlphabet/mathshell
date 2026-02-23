export const help = "dirname NAME...\n  Strip last component from path.\n  Examples:\n    dirname /path/to/file   → /path/to\n    dirname file.txt        → .\n    dirname /               → /\n";
export default function dirname(args) {
  if (!args.length) return { output: "dirname: missing operand\n", exitCode: 1 };
  const out=args.map(p=>{
    p=p.replace(/\/+$/,"");
    return p.includes("/")?p.slice(0,p.lastIndexOf("/"))||"/":".";
  });
  return { output: out.join("\n")+"\n", exitCode: 0 };
}
