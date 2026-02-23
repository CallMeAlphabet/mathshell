export const help = "stat [-c FORMAT] [file...]\n  Display file status.\n  -c FORMAT  use FORMAT instead of default\n  Format codes: %n name, %s size, %y mtime, %f type, %i inode, %b blocks\n  Examples:\n    stat README.txt\n    stat -c '%n: %s bytes' file.txt\n    stat /etc\n";
import { MONTHS } from "../../_utils/format.js";
export default function stat(args, { vfs, sh }) {
  const norm = p => vfs.resolve(p, sh.cwd);
  let fmt=null; const files=[];
  for (let i=0; i<args.length; i++) {
    const a=args[i];
    if ((a==="-c"||a==="--format")&&args[i+1]) fmt=args[++i];
    else if (!a.startsWith("-")) files.push(a);
  }
  if (!files.length) return { output: "stat: missing operand\n", exitCode: 1 };
  const out=[]; let ec=0;
  for (const f of files) {
    const p=norm(f);
    if (!vfs.exists(p)) { out.push(`stat: cannot stat '${f}': No such file or directory`); ec=1; continue; }
    const n=vfs.stat(p);
    const isDir=vfs.isDir(p);
    const mtime=new Date(n.mtime??Date.now());
    const mtimeStr=`${mtime.getFullYear()}-${String(mtime.getMonth()+1).padStart(2,"0")}-${String(mtime.getDate()).padStart(2,"0")} ${String(mtime.getHours()).padStart(2,"0")}:${String(mtime.getMinutes()).padStart(2,"0")}:${String(mtime.getSeconds()).padStart(2,"0")}`;
    const inode=Math.abs(p.split("").reduce((h,c)=>((h<<5)-h+c.charCodeAt(0))|0,0))%100000;
    const blocks=Math.ceil((n.size??0)/512)||8;
    if (fmt) {
      out.push(fmt.replace(/%n/g,f).replace(/%s/g,n.size??0).replace(/%y/g,mtimeStr).replace(/%f/g,isDir?"directory":"regular file").replace(/%i/g,inode).replace(/%b/g,blocks));
    } else {
      out.push(`  File: ${p}
  Size: ${n.size??0}\tBlocks: ${blocks}\t${isDir?"directory":"regular file"}
Device: mashfs\tInode: ${inode}\tLinks: 1
Access: ${isDir?"drwxr-xr-x":"-rw-r--r--"} (${isDir?"755":"644"})\tUid: 1000\tGid: 1000
Modify: ${mtimeStr}`);
    }
  }
  return { output: out.join("\n")+"\n", exitCode: ec };
}
