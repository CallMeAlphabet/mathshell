import { fmtSize } from "../_utils/format.js";
export const help = "du [-h] [-s] [-a] [path...]\n  Show disk usage.\n  -h  human-readable sizes\n  -s  summary only (don't show subdirs)\n  -a  show all files, not just directories\n  Examples:\n    du /home/user\n    du -sh /home/user\n    du README.txt\n";
export default function du(args, { vfs, sh }) {
  const norm = p => vfs.resolve(p, sh.cwd);
  let human=false, summary=false, all=false;
  const targets=[];
  for (const a of args) {
    if (/^-[hsaHS]+$/.test(a)) { if (a.includes("h")) human=true; if (a.includes("s")) summary=true; if (a.includes("a")) all=true; }
    else targets.push(a);
  }
  const t=targets.length?targets:["."];
  const lines=[];
  for (const target of t) {
    const p=norm(target);
    if (!vfs.exists(p)) return { output: `du: cannot access '${target}': No such file or directory\n`, exitCode: 1 };
    if (vfs.isFile(p)) {
      const sz=vfs.stat(p)?.size??0;
      lines.push(`${human?fmtSize(sz,true):Math.max(Math.ceil(sz/1024),4)}\t${target}`);
    } else {
      const entries=Object.keys(vfs._t).filter(k=>k===p||k.startsWith(p+"/")).sort();
      let totalSz=0;
      if (!summary) {
        for (const k of entries) {
          const n=vfs._t[k];
          if (n.type==="file") totalSz+=n.size??0;
          if (all && n.type==="file") {
            const sz=n.size??0;
            lines.push(`${human?fmtSize(sz,true):Math.max(Math.ceil(sz/1024),4)}\t${k}`);
          } else if (!all && n.type==="dir") {
            let dirSz=0;
            Object.keys(vfs._t).filter(k2=>k2.startsWith(k+"/")).forEach(k2=>{ if (vfs._t[k2].type==="file") dirSz+=vfs._t[k2].size??0; });
            lines.push(`${human?fmtSize(dirSz,true):Math.max(Math.ceil(dirSz/1024),4)}\t${k}`);
          }
        }
      }
      lines.push(`${human?fmtSize(totalSz,true):Math.max(Math.ceil(totalSz/1024),4)}\t${target}`);
    }
  }
  return { output: lines.join("\n")+"\n", exitCode: 0 };
}
