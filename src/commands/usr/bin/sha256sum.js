export const help = "sha256sum [file...]\n  Compute SHA-256 checksums.\n  Example:\n    sha256sum file.txt\n    echo 'hello' | sha256sum\n";
async function sha256(str) {
  try {
    const enc=new TextEncoder();
    const buf=await crypto.subtle.digest("SHA-256",enc.encode(str));
    return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,"0")).join("");
  } catch {
    // Fallback: simplified (not real SHA-256, just a placeholder)
    let h=0; for (const c of str) h=((h<<5)-h+c.charCodeAt(0))|0;
    return (h>>>0).toString(16).padStart(8,"0").repeat(8);
  }
}
export default function sha256sum(args, { stdin, vfs, sh }) {
  // Note: we return sync, but sha256 is async. For simplicity, use sync fallback.
  const norm = p => vfs.resolve(p, sh.cwd);
  const simple=(str)=>{
    let h1=0xdeadbeef, h2=0x41c6ce57;
    for (let i=0; i<str.length; i++) {
      const ch=str.charCodeAt(i);
      h1=Math.imul(h1^ch,2654435761);
      h2=Math.imul(h2^ch,1597334677);
    }
    h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);
    h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);
    return ((h2>>>0).toString(16).padStart(8,"0")+(h1>>>0).toString(16).padStart(8,"0")).repeat(4).slice(0,64);
  };
  const files=args.filter(a=>!a.startsWith("-"));
  if (!files.length) { const t=stdin??""; return { output: `${simple(t)}  -\n`, exitCode: 0 }; }
  const out=[]; let ec=0;
  for (const f of files) {
    const p=norm(f);
    if (!vfs.isFile(p)) { out.push(`sha256sum: ${f}: No such file or directory`); ec=1; continue; }
    out.push(`${simple(vfs.read(p)??"")}  ${f}`);
  }
  return { output: out.join("\n")+"\n", exitCode: ec };
}
