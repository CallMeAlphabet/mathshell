export const help = `ln [-s] [-f] TARGET [LINK_NAME]
  Create links between files.
  -s  create symbolic link (simulated in MASH VFS)
  -f  remove existing destination
  Examples:
    ln -s /etc/hostname hostname
    ln file1 file2
`;

export default function ln(args, { vfs, sh }) {
  const norm = p => vfs.resolve(p, sh.cwd);
  let sym = false, force = false; const files = [];
  for (const a of args) {
    if (a === "-s") sym = true;
    else if (a === "-f") force = true;
    else if (/^-[sf]+$/.test(a)) { if (a.includes("s")) sym=true; if (a.includes("f")) force=true; }
    else files.push(a);
  }

  if (files.length < 2) return { output: "ln: missing destination\n", exitCode: 1 };
  const [target, linkName] = files;
  const tp = norm(target);
  const lp = vfs.isDir(norm(linkName)) ? norm(linkName) + "/" + target.split("/").pop() : norm(linkName);

  if (!vfs.exists(tp)) return { output: `ln: failed to access '${target}': No such file or directory\n`, exitCode: 1 };
  if (vfs.exists(lp) && !force) return { output: `ln: failed to create link '${linkName}': File exists\n`, exitCode: 1 };

  if (sym) {
    // Simulate symlink as a file with special content
    vfs.write(lp, vfs.read(tp) ?? "");
    const n = vfs.stat(lp);
    if (n) n.symlink = target;
  } else {
    if (vfs.isDir(tp)) return { output: `ln: ${target}: Is a directory\n`, exitCode: 1 };
    vfs.write(lp, vfs.read(tp) ?? "");
  }
  return { output: "", exitCode: 0 };
}
