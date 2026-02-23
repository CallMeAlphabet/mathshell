// ls — list directory contents
import { fmtDate, fmtLong, fmtSize } from "../_utils/format.js";

export const help = `ls [-laFRhSt1] [path...]
  List directory contents.
  -l  long format (permissions, size, date)
  -a  include hidden files (dotfiles)
  -F  append indicator (/ for dirs, * for executables)
  -R  recursive listing
  -h  human-readable sizes (with -l)
  -S  sort by file size (largest first)
  -t  sort by modification time (newest first)
  -r  reverse sort order
  -1  one entry per line
  Examples:
    ls
    ls -la /etc
    ls -lhS /home/user
    ls -Rt /tmp
`;

export default function ls(args, { vfs, sh }) {
  const norm = p => vfs.resolve(p, sh.cwd);
  let long=false, all=false, classify=false, recursive=false,
      human=false, sortSz=false, sortT=false, rev=false, one=false;
  const targets = [];

  for (const a of args) {
    if (/^-[laFRhStr1]+$/.test(a)) {
      if (a.includes("l")) long     = true;
      if (a.includes("a")) all      = true;
      if (a.includes("F")) classify = true;
      if (a.includes("R")) recursive= true;
      if (a.includes("h")) human    = true;
      if (a.includes("S")) sortSz   = true;
      if (a.includes("t")) sortT    = true;
      if (a.includes("r")) rev      = true;
      if (a.includes("1")) one      = true;
    } else {
      targets.push(a);
    }
  }
  if (long) one = false;

  const getEntries = dir => {
    let entries = vfs.ls(dir);
    if (all) entries = [".", "..", ...entries];
    // sort
    if (sortSz) {
      entries.sort((a, b) => {
        const sa = vfs.stat((dir === "/" ? "" : dir) + "/" + a)?.size ?? 0;
        const sb = vfs.stat((dir === "/" ? "" : dir) + "/" + b)?.size ?? 0;
        return sb - sa;
      });
    } else if (sortT) {
      entries.sort((a, b) => {
        const ta = vfs.stat((dir === "/" ? "" : dir) + "/" + a)?.mtime ?? 0;
        const tb = vfs.stat((dir === "/" ? "" : dir) + "/" + b)?.mtime ?? 0;
        return tb - ta;
      });
    }
    if (rev) entries.reverse();
    return entries;
  };

  const listDir = (dir, prefix = "") => {
    const entries = getEntries(dir);
    if (!entries.length && !all) return "";
    const lines = [];
    if (long) {
      lines.push("total " + entries.length);
      for (const e of entries) {
        if (e === "." || e === "..") {
          lines.push(`drwxr-xr-x  2 user user ${human?"   4K":"     0"} ${fmtDate(Date.now())} ${e}`);
        } else {
          lines.push(fmtLong((dir === "/" ? "" : dir) + "/" + e, vfs, human));
        }
      }
    } else {
      const display = entries.map(e => {
        const fp = (dir === "/" ? "" : dir) + "/" + e;
        return e + (classify && vfs.isDir(fp) ? "/" : "");
      });
      if (one) lines.push(...display);
      else lines.push(display.join("  "));
    }
    let out = lines.join("\n") + "\n";
    if (recursive) {
      for (const e of entries) {
        if (e === "." || e === "..") continue;
        const fp = (dir === "/" ? "" : dir) + "/" + e;
        if (vfs.isDir(fp)) {
          out += `\n${prefix}${fp}:\n` + listDir(fp, prefix);
        }
      }
    }
    return out;
  };

  if (!targets.length) {
    if (recursive) return { output: sh.cwd + ":\n" + listDir(sh.cwd), exitCode: 0 };
    return { output: listDir(sh.cwd), exitCode: 0 };
  }

  const parts = []; let ec = 0;
  for (const t of targets) {
    const p = norm(t);
    if (!vfs.exists(p)) { parts.push(`ls: cannot access '${t}': No such file or directory`); ec = 1; }
    else if (vfs.isFile(p)) parts.push(long ? fmtLong(p, vfs, human) + "\n" : p.split("/").pop() + "\n");
    else {
      const header = targets.length > 1 || recursive ? t + ":\n" : "";
      parts.push(header + listDir(p));
    }
  }
  return { output: parts.join("\n"), exitCode: ec };
}
