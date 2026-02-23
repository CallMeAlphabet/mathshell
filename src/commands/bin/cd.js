export const help = "cd [dir]\n  Change the current working directory.\n  With no argument, returns to /home/user. '~' = home, '..' = parent.\n  Examples:\n    cd /etc\n    cd ..\n    cd ~\n    cd -    (return to previous directory)\n";
export default function cd(args, { vfs, sh }) {
  const norm = p => vfs.resolve(p, sh.cwd);
  if (args[0] === "-") {
    const prev = sh.env.OLDPWD ?? sh.cwd;
    sh.env.OLDPWD = sh.cwd;
    sh.cwd = prev; sh.env.PWD = prev;
    return { output: prev + "\n", exitCode: 0 };
  }
  const target = !args.length ? "/home/user" : norm(args[0]);
  if (!vfs.exists(target))  return { output: `cd: ${args[0]}: No such file or directory\n`, exitCode: 1 };
  if (!vfs.isDir(target))   return { output: `cd: ${args[0]}: Not a directory\n`, exitCode: 1 };
  sh.env.OLDPWD = sh.cwd;
  sh.cwd = target; sh.env.PWD = target;
  return { output: "", exitCode: 0 };
}
