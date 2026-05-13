const useColor = process.stdout.isTTY && !process.env.NO_COLOR;

const c = {
  reset: useColor ? "\x1b[0m" : "",
  dim: useColor ? "\x1b[2m" : "",
  red: useColor ? "\x1b[31m" : "",
  green: useColor ? "\x1b[32m" : "",
  yellow: useColor ? "\x1b[33m" : "",
  blue: useColor ? "\x1b[34m" : "",
  cyan: useColor ? "\x1b[36m" : "",
  bold: useColor ? "\x1b[1m" : "",
};

export const log = {
  info(msg: string): void {
    console.error(`${c.cyan}info${c.reset}  ${msg}`);
  },
  ok(msg: string): void {
    console.error(`${c.green}ok${c.reset}    ${msg}`);
  },
  warn(msg: string): void {
    console.error(`${c.yellow}warn${c.reset}  ${msg}`);
  },
  error(msg: string): void {
    console.error(`${c.red}error${c.reset} ${msg}`);
  },
  dim(msg: string): void {
    console.error(`${c.dim}${msg}${c.reset}`);
  },
  header(msg: string): void {
    console.error(`\n${c.bold}${msg}${c.reset}`);
  },
};

export { c as color };
