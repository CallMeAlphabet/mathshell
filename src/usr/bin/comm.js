export const help = "comm [-123] file1 file2\n  Compare two sorted files line by line.\n  Output columns: col1=only in file1, col2=only in file2, col3=in both.\n  -1  suppress column 1\n  -2  suppress column 2\n  -3  suppress column 3\n  Examples:\n    comm sorted1.txt sorted2.txt\n    comm -12 file1 file2    (show only common lines)\n    comm -23 file1 file2    (show lines unique to file1)\n";
export default function comm(args, { stdin, vfs, sh }) {
  const norm = p => vfs.resolve(p, sh.cwd);
  let s1=false, s2=false, s3=false;
  const files=[];
  for (const a of args) {
    if (/^-[123]+$/.test(a)) { if (a.includes("1")) s1=true; if (a.includes("2")) s2=true; if (a.includes("3")) s3=true; }
    else files.push(a);
  }
  if (files.length<2) return { output: "comm: missing operand after 'comm'\n", exitCode: 1 };
  const read=f=>{
    if (f==="-") { const t=stdin??""; const l=t.split("\n"); if (l[l.length-1]==="") l.pop(); return l; }
    const p=norm(f); if (!vfs.isFile(p)) return null;
    const t=vfs.read(p)??""; const l=t.split("\n"); if (l[l.length-1]==="") l.pop(); return l;
  };
  const l1=read(files[0]), l2=read(files[1]);
  if (!l1) return { output: `comm: ${files[0]}: No such file or directory\n`, exitCode: 1 };
  if (!l2) return { output: `comm: ${files[1]}: No such file or directory\n`, exitCode: 1 };
  let i=0, j=0; const out=[];
  while (i<l1.length||j<l2.length) {
    const a2=l1[i], b=l2[j];
    if (i>=l1.length)      { if (!s2) out.push("\t"+b); j++; }
    else if (j>=l2.length) { if (!s1) out.push(a2); i++; }
    else if (a2<b)         { if (!s1) out.push(a2); i++; }
    else if (a2>b)         { if (!s2) out.push("\t"+b); j++; }
    else                   { if (!s3) out.push("\t\t"+a2); i++; j++; }
  }
  return { output: out.join("\n")+(out.length?"\n":""), exitCode: 0 };
}
