export const help = `xargs [-I REPL] [-n N] [-d DELIM] [-0] <cmd> [args...]
  Build and execute commands from stdin.
  -I REPL   replace REPL in cmd with each input item
  -n N      use at most N arguments per command
  -d DELIM  input delimiter (default: whitespace/newline)
  -0 / -null  null-separated input
  -t        print each command before executing
  Examples:
    echo 'a b c' | xargs echo item:
    seq 1 3 | xargs -I{} echo 'number {}'
    find . -name '*.txt' | xargs grep 'pattern'
`;
export default function xargs(args, { stdin, vfs, sh }, execCmd) {
  let replStr=null, maxN=Infinity, delim=null, nullSep=false, trace=false;
  const cmdArgs=[];
  for (let i=0; i<args.length; i++) {
    const a=args[i];
    if ((a==="-I"||a.startsWith("-I"))&&(args[i+1]||a.length>2)) replStr=a.length>2?a.slice(2):args[++i];
    else if ((a==="-n")&&args[i+1]) maxN=parseInt(args[++i]);
    else if ((a==="-d")&&args[i+1]) delim=args[++i];
    else if (a==="-0"||a==="--null") nullSep=true;
    else if (a==="-t"||a==="--verbose") trace=true;
    else if (!a.startsWith("-")) { cmdArgs.push(a); while (++i<args.length) cmdArgs.push(args[i]); break; }
  }
  if (!cmdArgs.length) return { output: "", exitCode: 0 };
  const input=stdin??"";
  let items;
  if (nullSep)       items=input.split("\0").filter(Boolean);
  else if (delim)    items=input.split(delim).filter(Boolean);
  else               items=input.trim().split(/\s+/).filter(Boolean);

  const [cmd,...base]=cmdArgs;
  let out="";
  if (replStr) {
    for (const item of items) {
      const call=[cmd,...base.map(a=>a.split(replStr).join(item))];
      const res=execCmd(call[0],call.slice(1),null,vfs,sh);
      out+=res.output??"";
    }
  } else {
    // batch by maxN
    for (let i=0; i<items.length; i+=maxN===Infinity?items.length:maxN) {
      const chunk=items.slice(i,i+(maxN===Infinity?items.length:maxN));
      const res=execCmd(cmd,[...base,...chunk],null,vfs,sh);
      out+=res.output??"";
    }
  }
  return { output: out, exitCode: 0 };
}
