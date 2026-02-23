export const help = "base64 [-d] [-w N] [file]\n  Encode or decode base64.\n  -d  decode\n  -w N  wrap at N characters (default: 76, 0=no wrap)\n  Examples:\n    echo 'hello' | base64\n    echo 'aGVsbG8K' | base64 -d\n    base64 file.txt\n    base64 -d encoded.txt\n";
export default function base64(args, { stdin, vfs, sh }) {
  const norm = p => vfs.resolve(p, sh.cwd);
  let decode=false, wrap=76;
  const files=[];
  for (let i=0; i<args.length; i++) {
    const a=args[i];
    if (a==="-d"||a==="--decode") decode=true;
    else if (a==="-w"&&args[i+1]) wrap=parseInt(args[++i]);
    else if (/^-w\d+$/.test(a)) wrap=parseInt(a.slice(2));
    else if (!a.startsWith("-")) files.push(a);
  }
  let text=stdin??"";
  if (files.length) { const p=norm(files[0]); if (vfs.isFile(p)) text=vfs.read(p)??"";}
  if (decode) {
    try {
      const clean=text.replace(/\s/g,"");
      return { output: atob(clean)+"\n", exitCode: 0 };
    } catch { return { output: "base64: invalid input\n", exitCode: 1 }; }
  }
  // Remove trailing newline for encoding
  const toEncode=text.endsWith("\n")?text.slice(0,-1):text;
  const encoded=btoa(toEncode);
  if (!wrap||wrap===0) return { output: encoded+"\n", exitCode: 0 };
  const lines=[]; for (let i=0;i<encoded.length;i+=wrap) lines.push(encoded.slice(i,i+wrap));
  return { output: lines.join("\n")+"\n", exitCode: 0 };
}
