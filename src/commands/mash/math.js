import { mathEval, fmtNum } from "../_utils/math.js";
export const help = `math <expression>
  Evaluate a math expression directly.
  Functions: sqrt cbrt sin cos tan asin acos atan sinh cosh tanh
             abs floor ceil round log log2 ln max min pow sign
  Constants: pi (π), e
  Operators: + - * / ^ % () !
  Examples:
    math 2^10
    math sqrt(144)
    math sin(pi/6)
    math 10!
    math log(1000)
`;
export default function math(args, { stdin }) {
  const e=(args.join(" ").trim()||(stdin??"").trim());
  if (!e) return { output: "math: no expression given\n", exitCode: 1 };
  try { return { output: fmtNum(mathEval(e))+"\n", exitCode: 0 }; }
  catch(err) { return { output: `math: ${err.message}\n`, exitCode: 1 }; }
}
