import { MONTHS } from "../_utils/format.js";
export const help = `date [+format] [-d DATE] [-u]
  Display or format date and time.
  Format codes:
    %Y  year (e.g. 2025)         %m  month (01-12)
    %d  day (01-31)              %e  day ( 1-31, space-padded)
    %H  hour (00-23)             %M  minute (00-59)
    %S  second (00-59)           %N  nanoseconds (simulated)
    %a  weekday abbr             %A  weekday full
    %b  month abbr               %B  month full
    %Z  timezone                 %z  +/-HHMM offset
    %s  unix timestamp (seconds) %j  day of year
    %p  AM/PM                    %P  am/pm
    %w  weekday number (0=Sun)   %u  weekday (1=Mon)
    %n  newline                  %t  tab
  Examples:
    date
    date '+%Y-%m-%d'
    date '+%H:%M:%S'
    date +%s
    date -d 'now'
`;
export default function date(args) {
  const now = new Date();
  const pad = n => String(n).padStart(2,"0");
  const days  = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const daysF = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const monF  = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  // -d support (very basic: just treat as now)
  const fmtArg = args.find(a => a.startsWith("+")) ?? null;

  const dayOfYear = d => {
    const start = new Date(d.getFullYear(), 0, 0);
    return Math.floor((d - start) / 86400000);
  };

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const tzOffset = -now.getTimezoneOffset();
  const tzSign = tzOffset >= 0 ? "+" : "-";
  const tzH = Math.floor(Math.abs(tzOffset) / 60);
  const tzM = Math.abs(tzOffset) % 60;
  const tzStr = `${tzSign}${String(tzH).padStart(2,"0")}${String(tzM).padStart(2,"0")}`;

  const fmt = (fmtArg ? fmtArg.slice(1) : "%a %b %e %H:%M:%S %Z %Y")
    .replace(/%Y/g, now.getFullYear())
    .replace(/%m/g, pad(now.getMonth()+1))
    .replace(/%d/g, pad(now.getDate()))
    .replace(/%e/g, String(now.getDate()).padStart(2," "))
    .replace(/%H/g, pad(now.getHours()))
    .replace(/%M/g, pad(now.getMinutes()))
    .replace(/%S/g, pad(now.getSeconds()))
    .replace(/%N/g, String(now.getMilliseconds()).padStart(3,"0")+"000000")
    .replace(/%s/g, Math.floor(Date.now()/1000))
    .replace(/%a/g, days[now.getDay()])
    .replace(/%A/g, daysF[now.getDay()])
    .replace(/%b/g, MONTHS[now.getMonth()])
    .replace(/%B/g, monF[now.getMonth()])
    .replace(/%Z/g, tz)
    .replace(/%z/g, tzStr)
    .replace(/%j/g, pad(dayOfYear(now)))
    .replace(/%p/g, now.getHours() < 12 ? "AM" : "PM")
    .replace(/%P/g, now.getHours() < 12 ? "am" : "pm")
    .replace(/%w/g, String(now.getDay()))
    .replace(/%u/g, String(now.getDay() || 7))
    .replace(/%n/g, "\n")
    .replace(/%t/g, "\t")
    .replace(/%%/g, "%");
  return { output: fmt+"\n", exitCode: 0 };
}
