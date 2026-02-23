export const help = `wc [-l] [-w] [-c] [-m] [-L] [file...]
  Count lines, words, and characters.
  -l  count lines
  -w  count words
  -c  count bytes
  -m  count characters (same as -c for ASCII)
  -L  print length of longest line
  Default: show lines, words, bytes.
  Examples:
    wc README.txt
    wc -l /etc/passwd
    echo 'hello world' | wc -w
    wc file1 file2
`;
export default function wc(args, { stdin, vfs, sh }) {
  const norm = p => vfs.resolve(p, sh.cwd);
  let l=false, w=false, c=false, longest=false;
  const files=[];
  for (const a of args) {
    if (/^-[lwcmL]+$/.test(a)) {
      if (a.includes("l")) l=true;
      if (a.includes("w")) w=true;
      if (a.includes("c")||a.includes("m")) c=true;
      if (a.includes("L")) longest=true;
    } else files.push(a);
  }
  if (!l && !w && !c && !longest) { l=true; w=true; c=true; }

  const count = (text, name) => {
    const lns = text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
    const wds = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chs = text.length;
    const maxLen = text.split("\n").reduce((m,line)=>Math.max(m,line.length),0);
    return (l ? String(lns).padStart(8) : "") +
           (w ? String(wds).padStart(8) : "") +
           (c ? String(chs).padStart(8) : "") +
           (longest ? String(maxLen).padStart(8) : "") +
           (name ? " " + name : "");
  };

  if (!files.length) return { output: count(stdin??"","") + "\n", exitCode: 0 };

  const res=[]; let ec=0;
  let totL=0, totW=0, totC=0, totM=0;
  for (const f of files) {
    const p=norm(f);
    if (!vfs.isFile(p)) { res.push(`wc: ${f}: No such file or directory`); ec=1; continue; }
    const text=vfs.read(p)??"";;
    res.push(count(text, f));
    if (files.length > 1) {
      totL += text.split("\n").length - (text.endsWith("\n")?1:0);
      totW += text.trim()?text.trim().split(/\s+/).length:0;
      totC += text.length;
      totM  = Math.max(totM, text.split("\n").reduce((m,ln)=>Math.max(m,ln.length),0));
    }
  }
  if (files.length > 1) {
    res.push(
      (l?String(totL).padStart(8):"")+
      (w?String(totW).padStart(8):"")+
      (c?String(totC).padStart(8):"")+
      (longest?String(totM).padStart(8):"")+
      " total"
    );
  }
  return { output: res.join("\n")+"\n", exitCode: ec };
}
