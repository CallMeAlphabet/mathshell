export const help = "mktemp [-d] [-t] [TEMPLATE]\n  Create a temporary file or directory.\n  -d  create a directory instead of a file\n  Template must end with XXXXXX (replaced with random chars).\n  Examples:\n    mktemp\n    mktemp /tmp/myapp.XXXXXX\n    mktemp -d /tmp/dir.XXXXXX\n";
export default function mktemp(args, { vfs, sh }) {
  let isDir=false;
  const fileArgs=args.filter(a=>{ if (a==="-d") { isDir=true; return false; } return !a.startsWith("-"); });
  const template=fileArgs[0]||"/tmp/tmp.XXXXXX";
  const rand=Math.random().toString(36).slice(2,8).toUpperCase();
  const path=template.replace(/X{6}$/, rand).replace(/XXXXXX$/, rand);
  const p=vfs.resolve(path, sh.cwd);
  if (isDir) vfs._mkdirP(p);
  else vfs.write(p, "");
  return { output: p+"\n", exitCode: 0 };
}
