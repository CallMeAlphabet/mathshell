export const help = "download FILE\n  Download a VFS file to your local machine.\n";
export default function download(args, { vfs, sh }) {
  const norm = p => vfs.resolve(p, sh.cwd);
  if (!args.length) return { output: "download: missing filename\n", exitCode: 1 };
  const p = norm(args[0]);
  if (!vfs.isFile(p)) return { output: `download: '${args[0]}': not found\n`, exitCode: 1 };
  return vfs.download(p) ? { output: `Downloading '${args[0]}'...\n`, exitCode: 0 } : { output: "download: failed\n", exitCode: 1 };
}
