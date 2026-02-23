export const help = `tr [-d] [-s] [-c] <set1> [set2]
  Translate or delete characters.
  -d  delete characters in set1 (no set2 needed)
  -s  squeeze repeated characters in set2 (or set1 with -d)
  -c  complement set1 (operate on chars NOT in set1)
  Set notation: a-z  A-Z  0-9  [:alpha:]  [:digit:]  [:upper:]  [:lower:]  [:space:]  [:punct:]
  Examples:
    echo 'hello' | tr 'a-z' 'A-Z'
    echo 'hello world' | tr -d 'aeiou'
    echo 'hello' | tr 'el' 'ip'
    echo 'aabbcc' | tr -s 'a-z'
    echo 'Hello World' | tr -dc 'a-zA-Z'
`;

const POSIX_CLASSES = {
  "[:alpha:]":  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
  "[:digit:]":  "0123456789",
  "[:alnum:]":  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  "[:upper:]":  "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  "[:lower:]":  "abcdefghijklmnopqrstuvwxyz",
  "[:space:]":  " \t\n\r",
  "[:blank:]":  " \t",
  "[:punct:]":  "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~",
  "[:print:]":  " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~",
  "[:cntrl:]":  Array.from({length:32},(_,i)=>String.fromCharCode(i)).join("")+"\x7f",
};

function expandSet(s) {
  let result = s;
  for (const [cls, chars] of Object.entries(POSIX_CLASSES)) {
    result = result.replace(cls, chars);
  }
  return result.replace(/(.)-(.)/g, (_, a, b) => {
    const ca=a.charCodeAt(0), cb=b.charCodeAt(0);
    if (ca>cb) return _;
    let r=""; for (let i=ca;i<=cb;i++) r+=String.fromCharCode(i); return r;
  }).replace(/\\n/g,"\n").replace(/\\t/g,"\t").replace(/\\r/g,"\r").replace(/\\\\/g,"\\");
}

export default function tr(args, { stdin }) {
  let del=false, squeeze=false, complement=false;
  const ta=[];
  for (const a of args) {
    if (a==="-d"||a==="--delete")       del=true;
    else if (a==="-s"||a==="--squeeze-repeats") squeeze=true;
    else if (a==="-c"||a==="-C"||a==="--complement") complement=true;
    else ta.push(a);
  }
  const text = stdin ?? "";
  const set1 = ta[0] ? expandSet(ta[0]) : "";
  const set2 = ta[1] ? expandSet(ta[1]) : "";

  let chars = [...text];

  if (complement) {
    const s1set = new Set(set1.split(""));
    const all = Array.from({length:256},(_,i)=>String.fromCharCode(i));
    const comp = all.filter(c=>!s1set.has(c)).join("");
    if (del) {
      const compSet = new Set(comp.split(""));
      return { output: chars.filter(c=>!compSet.has(c)).join(""), exitCode: 0 };
    }
    // translate: map complement chars -> last char of set2
    const toChar = set2[set2.length-1] ?? "";
    const compSet = new Set(comp.split(""));
    return { output: chars.map(c=>compSet.has(c)?toChar:c).join(""), exitCode: 0 };
  }

  if (del) {
    const set = new Set(set1.split(""));
    chars = chars.filter(c=>!set.has(c));
    if (squeeze && set2) {
      const s2set = new Set(set2.split(""));
      const out2 = []; let prev=null;
      for (const c of chars) { if (c===prev && s2set.has(c)) continue; out2.push(c); prev=c; }
      return { output: out2.join(""), exitCode: 0 };
    }
    return { output: chars.join(""), exitCode: 0 };
  }

  if (!set1) return { output: text, exitCode: 0 };
  let out = text;
  for (let i=0; i<set1.length; i++) {
    const toChar = set2[Math.min(i, set2.length-1)] ?? "";
    out = out.split(set1[i]).join(toChar);
  }
  if (squeeze && set2) {
    const s2set = new Set(set2.split(""));
    const result=[]; let prev=null;
    for (const c of [...out]) { if (c===prev && s2set.has(c)) continue; result.push(c); prev=c; }
    return { output: result.join(""), exitCode: 0 };
  }
  return { output: out, exitCode: 0 };
}
