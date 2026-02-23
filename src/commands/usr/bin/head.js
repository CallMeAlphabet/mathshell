export const help = `head [-n N] [-c N] [file...]
  Output first N lines (default: 10) or first N bytes.
  -n N  print first N lines (use -N as shorthand)
  -c N  print first N bytes
  Examples:
    head README.txt
    head -n 5 file.txt
    head -20 file.txt
    head -c 100 file.txt
`;

export default function head(args, { stdin, vfs, sh }) {
  const norm = p => vfs.resolve(p, sh.cwd);
  let n = 10, bytes = null;
  const files = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "-n" && args[i+1]) n = parseInt(args[++i]);
    else if (args[i] === "-c" && args[i+1]) bytes = parseInt(args[++i]);
    else if (/^-\d+$/.test(args[i])) n = parseInt(args[i].slice(1));
    else files.push(args[i]);
  }

  const proc = t => {
    if (bytes !== null) return t.slice(0, bytes);
    const ls = t.split("\n");
    return ls.slice(0, n).join("\n") + "\n";
  };

  if (!files.length) return { output: proc(stdin ?? ""), exitCode: 0 };
  const outs = []; let ec = 0;
  for (const f of files) {
    const p = norm(f);
    if (!vfs.isFile(p)) { outs.push(`head: ${f}: No such file or directory`); ec = 1; }
    else outs.push((files.length > 1 ? `==> ${f} <==\n` : "") + proc(vfs.read(p) ?? ""));
  }
  return { output: outs.join("\n"), exitCode: ec };
}
