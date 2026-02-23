export const help = "md5sum [file...]\n  Compute MD5 checksums.\n  Example:\n    md5sum file.txt\n    echo 'hello' | md5sum\n";
// Simple MD5 implementation
function md5(str) {
  const rotate=(n,c)=>n>>>c|n<<(32-c);
  const s=[7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
  const K=new Int32Array(64);
  for (let i=0;i<64;i++) K[i]=Math.floor(Math.abs(Math.sin(i+1))*2**32)|0;
  const bytes=[...str].map(c=>c.charCodeAt(0));
  const origLen=bytes.length;
  bytes.push(0x80);
  while (bytes.length%64!==56) bytes.push(0);
  const bitLen=BigInt(origLen*8);
  for (let i=0;i<8;i++) bytes.push(Number((bitLen>>(BigInt(i*8)))&0xffn));
  let a=0x67452301, b=0xefcdab89, c=0x98badcfe, d=0x10325476;
  for (let i=0;i<bytes.length;i+=64) {
    const M=new Int32Array(16);
    for (let j=0;j<16;j++) M[j]=bytes[i+j*4]|(bytes[i+j*4+1]<<8)|(bytes[i+j*4+2]<<16)|(bytes[i+j*4+3]<<24);
    let A=a, B=b, C=c, D=d;
    for (let j=0;j<64;j++) {
      let F,g;
      if(j<16){F=(B&C)|(~B&D);g=j;}
      else if(j<32){F=(D&B)|(~D&C);g=(5*j+1)%16;}
      else if(j<48){F=B^C^D;g=(3*j+5)%16;}
      else{F=C^(B|~D);g=(7*j)%16;}
      F=(F+A+K[j]+M[g])|0;
      A=D;D=C;C=B;B=(B+rotate(F,s[j]))|0;
    }
    a=(a+A)|0;b=(b+B)|0;c=(c+C)|0;d=(d+D)|0;
  }
  const hex=n=>(n>>>0).toString(16).padStart(8,"0").replace(/(..)/g,(_,h)=>h);
  return [a,b,c,d].map(hex).join("");
}
export default function md5sum(args, { stdin, vfs, sh }) {
  const norm = p => vfs.resolve(p, sh.cwd);
  const files=args.filter(a=>!a.startsWith("-"));
  if (!files.length) { const t=stdin??""; return { output: `${md5(t)}  -\n`, exitCode: 0 }; }
  const out=[]; let ec=0;
  for (const f of files) {
    const p=norm(f);
    if (!vfs.isFile(p)) { out.push(`md5sum: ${f}: No such file or directory`); ec=1; continue; }
    out.push(`${md5(vfs.read(p)??"")}  ${f}`);
  }
  return { output: out.join("\n")+"\n", exitCode: ec };
}
