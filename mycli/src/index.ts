#!/usr/bin/env node

import { MockDebugSession } from "./session";

if (process.argv.includes("debugger-mode")) {
  const session = new MockDebugSession();

  process.on("SIGTERM", () => {
    session.shutdown();
  });

  session.start(process.stdin, process.stdout);
}
