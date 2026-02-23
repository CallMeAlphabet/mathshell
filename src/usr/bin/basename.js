export const help = "basename NAME [SUFFIX]\n  Strip directory and suffix from filename.\n  Examples:\n    basename /path/to/file.txt      → file.txt\n    basename /path/to/file.txt .txt → file\n    basename -s .txt /path/to/file.txt → file\n";
export default function basename(args) {
  let suffix=null, names=[];
  for (let i=0; i<args.length; i++) {
    if (args[i]==="-s"&&args[i+1]) suffix=args[++i];
    else if (args[i].startsWith("-s")) suffix=args[i].slice(2);
    else if (args[i]==="-a"||args[i]==="--multiple") { /* allow multiple */ }
    else names.push(args[i]);
  }
  if (!names.length) return { output: "basename: missing operand\n", exitCode: 1 };
  if (!suffix && names.length===2 && !names[0].startsWith("-")) suffix=names.pop();
  const out=names.map(n=>{
    let name=(n.replace(/\/+$/,"").split("/").pop())||"/";
    if (suffix && name.endsWith(suffix)) name=name.slice(0,-suffix.length);
    return name;
  });
  return { output: out.join("\n")+"\n", exitCode: 0 };
}
