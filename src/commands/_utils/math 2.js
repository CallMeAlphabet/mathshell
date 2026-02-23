// ── Math Engine ──────────────────────────────────────────────────────────────

export const factorial = n => {
  n = Math.round(n);
  if (n < 0) return NaN;
  if (n > 170) return Infinity;
  let r = 1; for (let i = 2; i <= n; i++) r *= i; return r;
};

export function mathEval(expr) {
  let p = expr.trim()
    .replace(/π/g,  "(Math.PI)").replace(/\bpi\b/gi, "(Math.PI)")
    .replace(/\bsin\b/g,  "Math.sin").replace(/\bcos\b/g,  "Math.cos")
    .replace(/\btan\b/g,  "Math.tan").replace(/\basin\b/g, "Math.asin")
    .replace(/\bacos\b/g, "Math.acos").replace(/\batan\b/g,"Math.atan")
    .replace(/\bsinh\b/g, "Math.sinh").replace(/\bcosh\b/g,"Math.cosh")
    .replace(/\btanh\b/g, "Math.tanh").replace(/\bsqrt\b/g,"Math.sqrt")
    .replace(/\bcbrt\b/g, "Math.cbrt").replace(/\bfloor\b/g,"Math.floor")
    .replace(/\bceil\b/g, "Math.ceil").replace(/\babs\b/g, "Math.abs")
    .replace(/\bround\b/g,"Math.round").replace(/\bsign\b/g,"Math.sign")
    .replace(/\bln\b/g,   "Math.log").replace(/\blog2\b/g, "Math.log2")
    .replace(/\blog\b/g,  "Math.log10").replace(/\bmax\b/g,"Math.max")
    .replace(/\bmin\b/g,  "Math.min").replace(/\bpow\b/g,  "Math.pow");
  p = p.replace(/(?<![a-zA-Z\d_])e(?![a-zA-Z\d_])/g, "(Math.E)");
  p = p.replace(/(\d+(?:\.\d+)?)\s*!/g, "factorial($1)");
  p = p.replace(/\^/g, "**");
  return new Function("factorial", `"use strict"; return (${p});`)(factorial);
}

export function fmtNum(n) {
  if (n === Infinity)  return "∞";
  if (n === -Infinity) return "-∞";
  if (isNaN(n))        return "NaN";
  if (Math.abs(n) >= 1e15) return n.toExponential(8);
  if (Number.isInteger(n)) return String(n);
  return String(parseFloat(n.toPrecision(12)));
}
