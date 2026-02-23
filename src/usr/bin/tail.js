export const help = `tail [-n N] [-c N] [file...]
  Output last N lines (default: 10) or last N bytes.
  -n N   print last N lines
  -n +N  print from line N to end
  -c N   print last N bytes
  Examples:
    tail README.txt
    tail -n 3 file.txt
    tail -n +5 file.txt    (from line 5 to end)
    tail -c 50 file.txt
`;

export default function tail(args, { stdin, vfs, sh }) {
  const norm = p => vfs.resolve(p, sh.cwd);
  let n = 10, fromStart = false, bytes = null;
  const files = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "-n" && args[i+1]) {
      const val = args[++i];
      if (val.startsWith("+")) { n = parseInt(val.slice(1)); fromStart = true; }
      else n = parseInt(val);
    } else if (args[i] === "-c" && args[i+1]) bytes = parseInt(args[++i]);
    else if (/^-\d+$/.test(args[i])) n = parseInt(args[i].slice(1));
    else files.push(args[i]);
  }

  const proc = t => {
    if (bytes !== null) return t.slice(-bytes);
    const ls = t.split("\n"); if (ls[ls.length-1] === "") ls.pop();
    if (fromStart) return ls.slice(n - 1).join("\n") + "\n";
    return ls.slice(-n).join("\n") + "\n";
  };

  if (!files.length) return { output: proc(stdin ?? ""), exitCode: 0 };
  const outs = []; let ec = 0;
  for (const f of files) {
    const p = norm(f);
    if (!vfs.isFile(p)) { outs.push(`tail: ${f}: No such file or directory`); ec = 1; }
    else outs.push((files.length > 1 ? `==> ${f} <==\n` : "") + proc(vfs.read(p) ?? ""));
  }
  return { output: outs.join("\n"), exitCode: ec };
}
