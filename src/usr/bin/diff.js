export const help = "diff [-u] [-c] [-i] [-b] [-q] [-y] file1 file2\n  Compare two files line by line.\n  -u  unified format (default)\n  -c  context format\n  -i  ignore case\n  -b  ignore whitespace changes\n  -q  report only whether files differ\n  -y  side-by-side format\n  --  accept - as stdin\n  Examples:\n    diff file1.txt file2.txt\n    diff -u old.txt new.txt\n    diff -q a.txt b.txt\n";
export default function diff(args, { stdin, vfs, sh }) {
  const norm = p => vfs.resolve(p, sh.cwd);
  let unified=false, context=false, icase=false, ignoreWS=false, quiet=false, sideBySide=false;
  const files=[];
  for (const a of args) {
    if (a==="-u"||a==="--unified") unified=true;
    else if (a==="-c") context=true;
    else if (a==="-i"||a==="--ignore-case") icase=true;
    else if (a==="-b"||a==="--ignore-space-change") ignoreWS=true;
    else if (a==="-q"||a==="--brief") quiet=true;
    else if (a==="-y"||a==="--side-by-side") sideBySide=true;
    else if (!a.startsWith("-")||a==="-") files.push(a);
  }
  if (files.length<2) return { output: "diff: missing operand after 'diff'\n", exitCode: 2 };
  const read=f=>{
    if (f==="-") { const t=stdin??""; const l=t.split("\n"); if (l[l.length-1]==="") l.pop(); return l; }
    const p=norm(f); if (!vfs.isFile(p)) return null;
    const t=vfs.read(p)??""; const l=t.split("\n"); if (l[l.length-1]==="") l.pop(); return l;
  };
  const l1=read(files[0]), l2=read(files[1]);
  if (!l1) return { output: `diff: ${files[0]}: No such file or directory\n`, exitCode: 2 };
  if (!l2) return { output: `diff: ${files[1]}: No such file or directory\n`, exitCode: 2 };

  const norm2=l=>icase?l.toLowerCase():ignoreWS?l.replace(/\s+/g," ").trim():l;
  
  // Myers diff
  const a=l1, b=l2;
  const lcs=computeLCS(a, b, norm2);
  const hunks=buildHunks(a, b, lcs);
  
  if (quiet) {
    const same=hunks.every(h=>h.type==="same");
    if (same) return { output: "", exitCode: 0 };
    return { output: `Files ${files[0]} and ${files[1]} differ\n`, exitCode: 1 };
  }
  if (!hunks.some(h=>h.type!=="same")) return { output: "", exitCode: 0 };
  
  let out=`--- ${files[0]}\n+++ ${files[1]}\n`;
  if (sideBySide) {
    const w=40;
    const pairs=alignSideBySide(a, b, lcs);
    out=pairs.map(([l,r,t])=>{
      const lp=(l??"").padEnd(w); const rp=r??"";
      const sep=t==="same"?"  ":t==="del"?"<":t==="add"?">":" |";
      return `${lp} ${sep} ${rp}`;
    }).join("\n")+"\n";
    return { output: out, exitCode: 1 };
  }
  // unified diff
  let ai=0, bi=0;
  for (let hi=0; hi<hunks.length; ) {
    if (hunks[hi].type==="same") { hi++; continue; }
    // collect a block of changes with context
    const ctx=3;
    let start=hi;
    let aStart=hunks[hi].a, bStart=hunks[hi].b;
    const blockLines=[];
    // before context
    const beforeCtx=[]; for (let k=hi-1;k>=0&&k>=hi-ctx&&hunks[k].type==="same";k--) beforeCtx.unshift(hunks[k]);
    for (const h of beforeCtx) blockLines.push({...h, type:"ctx"});
    let lastChange=hi;
    while (hi<hunks.length && (hunks[hi].type!=="same" || hi<lastChange+ctx)) {
      if (hunks[hi].type!=="same") lastChange=hi;
      blockLines.push(hunks[hi++]);
    }
    const aEnd=blockLines[blockLines.length-1].a+1, bEnd=blockLines[blockLines.length-1].b+1;
    out+=`@@ -${aStart+1},${aEnd-aStart} +${bStart+1},${bEnd-bStart} @@\n`;
    for (const h of blockLines) {
      if (h.type==="ctx"||h.type==="same") out+=` ${a[h.a]}\n`;
      else if (h.type==="del") out+=`-${a[h.a]}\n`;
      else if (h.type==="add") out+=`+${b[h.b]}\n`;
    }
  }
  return { output: out, exitCode: 1 };
}

function computeLCS(a, b, norm2) {
  const m=a.length, n=b.length;
  const dp=Array.from({length:m+1},()=>new Array(n+1).fill(0));
  for (let i=m-1;i>=0;i--) for (let j=n-1;j>=0;j--) {
    if (norm2(a[i])===norm2(b[j])) dp[i][j]=1+dp[i+1][j+1];
    else dp[i][j]=Math.max(dp[i+1][j],dp[i][j+1]);
  }
  const lcs=[]; let i=0, j=0;
  while (i<m&&j<n) {
    if (norm2(a[i])===norm2(b[j])) { lcs.push([i,j]); i++; j++; }
    else if (dp[i+1]?.[j]>=(dp[i]?.[j+1]??0)) i++; else j++;
  }
  return lcs;
}

function buildHunks(a, b, lcs) {
  const hunks=[]; let ai=0, bi=0;
  for (const [li, lj] of lcs) {
    while (ai<li) { hunks.push({type:"del",a:ai,b:bi}); ai++; }
    while (bi<lj) { hunks.push({type:"add",a:ai,b:bi}); bi++; }
    hunks.push({type:"same",a:li,b:lj}); ai=li+1; bi=lj+1;
  }
  while (ai<a.length) { hunks.push({type:"del",a:ai,b:bi}); ai++; }
  while (bi<b.length) { hunks.push({type:"add",a:ai,b:bi}); bi++; }
  return hunks;
}

function alignSideBySide(a, b, lcs) {
  const hunks=buildHunks(a,b,lcs);
  return hunks.map(h=>{
    if (h.type==="same") return [a[h.a],b[h.b],"same"];
    if (h.type==="del")  return [a[h.a],null,"del"];
    return [null,b[h.b],"add"];
  });
}
