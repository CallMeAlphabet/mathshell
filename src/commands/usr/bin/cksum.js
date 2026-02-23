export const help = "cksum [file...]\n  Print CRC checksum and byte count.\n  Example:\n    cksum README.txt\n    echo 'hello' | cksum\n";
export default function cksum(args, { stdin, vfs, sh }) {
  const norm = p => vfs.resolve(p, sh.cwd);
  const files=args.filter(a=>!a.startsWith("-"));
  const crc=(text)=>{let s=0; for (const c of text) s=((s<<5)+s)^c.charCodeAt(0); return (s>>>0);};
  if (!files.length) { const t=stdin??""; return { output: `${crc(t)} ${t.length}\n`, exitCode: 0 }; }
  const out=[]; let ec=0;
  for (const f of files) {
    const p=norm(f);
    if (!vfs.isFile(p)) { out.push(`cksum: ${f}: No such file or directory`); ec=1; continue; }
    const t=vfs.read(p)??""; out.push(`${crc(t)} ${t.length} ${f}`);
  }
  return { output: out.join("\n")+"\n", exitCode: ec };
}
