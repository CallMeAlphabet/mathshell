// ── Command Registry ──────────────────────────────────────────────────────────
// bin/     → POSIX essential (/bin)
// usr/bin/ → GNU coreutils (/usr/bin)
// mash/    → MASH-specific builtins (math, download, motd, wipe-fs, write, append)

import * as _echo      from "./bin/echo.js";
import * as _cat       from "./bin/cat.js";
import * as _ls        from "./bin/ls.js";
import * as _pwd       from "./bin/pwd.js";
import * as _cd        from "./bin/cd.js";
import * as _mkdir     from "./bin/mkdir.js";
import * as _rmdir     from "./bin/rmdir.js";
import * as _rm        from "./bin/rm.js";
import * as _cp        from "./bin/cp.js";
import * as _mv        from "./bin/mv.js";
import * as _touch     from "./bin/touch.js";
import * as _find      from "./bin/find.js";
import * as _du        from "./bin/du.js";
import * as _df        from "./bin/df.js";
import * as _ln        from "./bin/ln.js";
import * as _chmod     from "./bin/chmod.js";
import * as _chown     from "./bin/chown.js";
import * as _date      from "./bin/date.js";
import * as _sleep     from "./bin/sleep.js";
import * as _true      from "./bin/true.js";
import * as _false     from "./bin/false.js";
import * as _yes       from "./bin/yes.js";
import * as _uname     from "./bin/uname.js";
import * as _hostname  from "./bin/hostname.js";
import * as _ps        from "./bin/ps.js";
import * as _test      from "./bin/test.js";
import * as _export    from "./bin/export.js";
import * as _unset     from "./bin/unset.js";
import * as _read      from "./bin/read.js";
import * as _alias     from "./bin/alias.js";
import * as _unalias   from "./bin/unalias.js";
import * as _which     from "./bin/which.js";
import * as _type      from "./bin/type.js";
import * as _command   from "./bin/command.js";
import * as _history   from "./bin/history.js";
import * as _jobs      from "./bin/jobs.js";
import * as _kill      from "./bin/kill.js";
import * as _clear     from "./bin/clear.js";
import * as _exit      from "./bin/exit.js";
import * as _motd      from "./bin/motd.js";
import * as _download  from "./bin/download.js";
import * as _write     from "./bin/write.js";
import * as _append    from "./bin/append.js";
import * as _nano      from "./bin/nano.js";
import * as _vi        from "./bin/vi.js";
import * as _wipeFs    from "./bin/wipe-fs.js";

import * as _grep      from "./usr/bin/grep.js";
import * as _sed       from "./usr/bin/sed.js";
import * as _awk       from "./usr/bin/awk.js";
import * as _sort      from "./usr/bin/sort.js";
import * as _uniq      from "./usr/bin/uniq.js";
import * as _cut       from "./usr/bin/cut.js";
import * as _tr        from "./usr/bin/tr.js";
import * as _wc        from "./usr/bin/wc.js";
import * as _head      from "./usr/bin/head.js";
import * as _tail      from "./usr/bin/tail.js";
import * as _printf    from "./usr/bin/printf.js";
import * as _tee       from "./usr/bin/tee.js";
import * as _seq       from "./usr/bin/seq.js";
import * as _nl        from "./usr/bin/nl.js";
import * as _rev       from "./usr/bin/rev.js";
import * as _fold      from "./usr/bin/fold.js";
import * as _od        from "./usr/bin/od.js";
import * as _cksum     from "./usr/bin/cksum.js";
import * as _xargs     from "./usr/bin/xargs.js";
import * as _bc        from "./usr/bin/bc.js";
import * as _expr      from "./usr/bin/expr.js";
import * as _tac       from "./usr/bin/tac.js";
import * as _shuf      from "./usr/bin/shuf.js";
import * as _base64    from "./usr/bin/base64.js";
import * as _md5sum    from "./usr/bin/md5sum.js";
import * as _sha256sum from "./usr/bin/sha256sum.js";
import * as _diff      from "./usr/bin/diff.js";
import * as _paste     from "./usr/bin/paste.js";
import * as _comm      from "./usr/bin/comm.js";
import * as _expand    from "./usr/bin/expand.js";
import * as _unexpand  from "./usr/bin/unexpand.js";
import * as _stat      from "./usr/bin/stat.js";
import * as _readlink  from "./usr/bin/readlink.js";
import * as _realpath  from "./usr/bin/realpath.js";
import * as _mktemp    from "./usr/bin/mktemp.js";
import * as _timeout   from "./usr/bin/timeout.js";
import * as _nproc     from "./usr/bin/nproc.js";
import * as _uptime    from "./usr/bin/uptime.js";
import * as _free      from "./usr/bin/free.js";
import * as _whoami    from "./usr/bin/whoami.js";
import * as _id        from "./usr/bin/id.js";
import * as _basename  from "./usr/bin/basename.js";
import * as _dirname   from "./usr/bin/dirname.js";
import * as _env       from "./usr/bin/env.js";
import * as _printenv  from "./usr/bin/printenv.js";

import * as _math      from "./mash/math.js";

function entry(mod) { return { fn: mod.default, help: mod.help ?? "" }; }

export const REGISTRY = {
  // /bin
  echo:      entry(_echo),
  cat:       entry(_cat),
  less:      entry(_cat),
  more:      entry(_cat),
  ls:        entry(_ls),
  pwd:       entry(_pwd),
  cd:        entry(_cd),
  mkdir:     entry(_mkdir),
  rmdir:     entry(_rmdir),
  rm:        entry(_rm),
  cp:        entry(_cp),
  mv:        entry(_mv),
  touch:     entry(_touch),
  find:      entry(_find),
  du:        entry(_du),
  df:        entry(_df),
  ln:        entry(_ln),
  chmod:     entry(_chmod),
  chown:     entry(_chown),
  date:      entry(_date),
  sleep:     entry(_sleep),
  true:      entry(_true),
  false:     entry(_false),
  yes:       entry(_yes),
  uname:     entry(_uname),
  hostname:  entry(_hostname),
  ps:        entry(_ps),
  test:      entry(_test),
  "[":       entry(_test),
  export:    entry(_export),
  unset:     entry(_unset),
  read:      entry(_read),
  alias:     entry(_alias),
  unalias:   entry(_unalias),
  which:     entry(_which),
  type:      entry(_type),
  command:   entry(_command),
  history:   entry(_history),
  jobs:      entry(_jobs),
  bg:        entry(_jobs),
  fg:        entry(_jobs),
  kill:      entry(_kill),
  clear:     entry(_clear),
  exit:      entry(_exit),
  motd:      entry(_motd),
  download:  entry(_download),
  write:     entry(_write),
  append:    entry(_append),
  nano:      entry(_nano),
  vi:        entry(_vi),
  vim:       entry(_vi),
  "wipe-fs": entry(_wipeFs),
  // /usr/bin
  grep:      entry(_grep),
  sed:       entry(_sed),
  awk:       entry(_awk),
  sort:      entry(_sort),
  uniq:      entry(_uniq),
  cut:       entry(_cut),
  tr:        entry(_tr),
  wc:        entry(_wc),
  head:      entry(_head),
  tail:      entry(_tail),
  printf:    entry(_printf),
  tee:       entry(_tee),
  seq:       entry(_seq),
  nl:        entry(_nl),
  rev:       entry(_rev),
  fold:      entry(_fold),
  od:        entry(_od),
  cksum:     entry(_cksum),
  xargs:     entry(_xargs),
  bc:        entry(_bc),
  expr:      entry(_expr),
  tac:       entry(_tac),
  shuf:      entry(_shuf),
  base64:    entry(_base64),
  md5sum:    entry(_md5sum),
  sha256sum: entry(_sha256sum),
  diff:      entry(_diff),
  paste:     entry(_paste),
  comm:      entry(_comm),
  expand:    entry(_expand),
  unexpand:  entry(_unexpand),
  stat:      entry(_stat),
  readlink:  entry(_readlink),
  realpath:  entry(_realpath),
  mktemp:    entry(_mktemp),
  timeout:   entry(_timeout),
  nproc:     entry(_nproc),
  uptime:    entry(_uptime),
  free:      entry(_free),
  whoami:    entry(_whoami),
  id:        entry(_id),
  basename:  entry(_basename),
  dirname:   entry(_dirname),
  env:       entry(_env),
  printenv:  entry(_printenv),
  // /mash
  math:      entry(_math),
};

export const BUILTINS = new Set(Object.keys(REGISTRY));

export const HELP_TOPICS = Object.fromEntries(
  Object.entries(REGISTRY).map(([k, { help }]) => [k, help])
);
