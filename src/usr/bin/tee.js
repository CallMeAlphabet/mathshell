export const help = "tee [-a] [-i] <file...>\n  Read stdin and write to both stdout and files.\n  -a  append to files instead of overwriting\n  -i  ignore SIGINT (no-op in mash)\n  Examples:\n    echo 'hello' | tee output.txt\n    ls | tee -a log.txt\n    cmd | tee file1 file2\n";
export default function tee(args, { stdin, vfs, sh }) {
  const norm = p => vfs.resolve(p, sh.cwd);
  let append=false; const files=[];
  for (const a of args) {
    if (a==="-a"||a==="--append") append=true;
    else if (a==="-i") { /* no-op */ }
    else files.push(a);
  }
  const content=stdin??"";
  for (const f of files) {
    const p=norm(f);
    if (append) vfs.append(p, content); else vfs.write(p, content);
  }
  return { output: content, exitCode: 0 };
}
