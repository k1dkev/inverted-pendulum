import { createApp } from "./app";
const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw Error("PORT must be 1..65535");
const app = await createApp({
  dev: process.argv.includes("--dev"),
  mock: process.argv.includes("--mock"),
});
app.server.listen(port, "127.0.0.1", () =>
  console.log(
    `Pendulum console: http://localhost:${port}${process.argv.includes("--mock") ? " (native test peer enabled)" : ""}`,
  ),
);
app.server.on("error", (error) => {
  console.error(error.message);
  void app.close().then(() => process.exit(1));
});
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => void app.close().then(() => process.exit(0)));
