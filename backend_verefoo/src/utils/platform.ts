import { execFile, spawn } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const IS_WINDOWS = process.platform === "win32";

export function runCommand(args: string[]) {
  if (IS_WINDOWS) {
    return execFileAsync("wsl.exe", args);
  }
  const [cmd, ...rest] = args;
  return execFileAsync(cmd, rest);
}

export function spawnCommand(args: string[]) {
  if (IS_WINDOWS) {
    return spawn("wsl.exe", args);
  }
  const [cmd, ...rest] = args;
  return spawn(cmd, rest);
}

export function toContainerlabPath(absolutePath: string): string {
  if (IS_WINDOWS) {
    return `/mnt/${absolutePath
      .replace(/\\/g, "/")
      .replace(/^([A-Za-z]):/, (_, drive) => drive.toLowerCase())}`;
  }
  return absolutePath;
}
