/** No-op when husky isn't installed (Netlify/CI production installs). */
try {
  require.resolve("husky");
  require("child_process").execSync("husky", { stdio: "inherit" });
} catch {
  // ignore
}
