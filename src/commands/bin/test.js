export const help = `test EXPR  or  [ EXPR ]
  Evaluate a conditional expression. Returns exit code 0=true, 1=false.
  File tests:    -f file  -d dir  -e path  -s file (non-empty)  -r -w -x (perms, always true)
  String tests:  -z str (empty)  -n str (non-empty)  str1 = str2  str1 != str2
  Numeric:       n1 -eq|-ne|-lt|-le|-gt|-ge n2
  Negate:        ! EXPR
  Compound:      EXPR -a EXPR  EXPR -o EXPR
  Examples:
    test -f README.txt && echo exists
    [ -d /etc ] && echo is dir
    test 5 -gt 3 && echo yes
    [ "a" = "a" ] && echo equal
`;
// exported as both "test" and "["
export default function test(args, { vfs, sh }, isBracket=false) {
  const norm = p => vfs.resolve(p, sh.cwd);
  const a = isBracket ? args.slice(0, -1) : args;
  if (!a.length) return { output: "", exitCode: 1 };

  // handle -a and -o compound
  const orIdx  = a.findIndex(x => x === "-o");
  const andIdx = a.findIndex(x => x === "-a");
  if (orIdx > 0)  { const l=test(a.slice(0,orIdx),{vfs,sh}); if (l.exitCode===0) return {output:"",exitCode:0}; return test(a.slice(orIdx+1),{vfs,sh}); }
  if (andIdx > 0) { const l=test(a.slice(0,andIdx),{vfs,sh}); if (l.exitCode!==0) return {output:"",exitCode:1}; return test(a.slice(andIdx+1),{vfs,sh}); }

  if (a[0]==="!") return { output:"", exitCode: test(a.slice(1),{vfs,sh}).exitCode===0?1:0 };
  if (a[0]==="-f") return { output:"", exitCode: vfs.isFile(norm(a[1]??""))?0:1 };
  if (a[0]==="-d") return { output:"", exitCode: vfs.isDir(norm(a[1]??""))?0:1 };
  if (a[0]==="-e") return { output:"", exitCode: vfs.exists(norm(a[1]??""))?0:1 };
  if (a[0]==="-s") return { output:"", exitCode: (vfs.stat(norm(a[1]??""))?.size??0)>0?0:1 };
  if (a[0]==="-r"||a[0]==="-w"||a[0]==="-x") return { output:"", exitCode: vfs.exists(norm(a[1]??""))?0:1 };
  if (a[0]==="-z") return { output:"", exitCode: (a[1]??"").length===0?0:1 };
  if (a[0]==="-n") return { output:"", exitCode: (a[1]??"").length>0?0:1 };
  if (a[1]==="="||a[1]==="==") return { output:"", exitCode: a[0]===a[2]?0:1 };
  if (a[1]==="!=")  return { output:"", exitCode: a[0]!==a[2]?0:1 };
  if (a[1]==="-eq") return { output:"", exitCode: Number(a[0])===Number(a[2])?0:1 };
  if (a[1]==="-ne") return { output:"", exitCode: Number(a[0])!==Number(a[2])?0:1 };
  if (a[1]==="-lt") return { output:"", exitCode: Number(a[0])<Number(a[2])?0:1 };
  if (a[1]==="-le") return { output:"", exitCode: Number(a[0])<=Number(a[2])?0:1 };
  if (a[1]==="-gt") return { output:"", exitCode: Number(a[0])>Number(a[2])?0:1 };
  if (a[1]==="-ge") return { output:"", exitCode: Number(a[0])>=Number(a[2])?0:1 };
  return { output:"", exitCode: (a[0]??"").length>0?0:1 };
}
