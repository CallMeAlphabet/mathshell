import nano from "./nano.js";
export const help = "vi FILE\n  Text editor (non-interactive in MASH).\n";
export default function vi(args, ctx) { return nano(args, ctx, "vi"); }
