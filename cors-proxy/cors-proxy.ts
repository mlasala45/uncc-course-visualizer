const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const cors = require("cors");

// Capture command-line arguments for target host and port
const args = process.argv.slice(2);

// Ensure the target URL is provided
const TARGET_URL = args[0];
if (!TARGET_URL) {
  console.error("\u001b[31mError: Target host is required.\u001b[0m");
  console.error("\u001b[31mUsage: cors-proxy <target_host> [<port>]\u001b[0m");
  process.exit(1); // Exit the process if no target URL is provided
}

const PORT = args[1] || 4000;  // Default port is 4000 if not provided

const app = express();

// Enable CORS for all origins
app.use(cors());

// Proxy all requests
app.use(
  "/",
  createProxyMiddleware({
    target: TARGET_URL,
    changeOrigin: true,
    onProxyReq: (proxyReq, req, res) => {
      console.log(`Proxying request: ${req.method} ${req.url}`);
    },
    onError: (err, req, res) => {
      console.error("Proxy error:", err);
      res.status(500).json({ error: "Proxy request failed" });
    }
  })
);

// Start server on the specified port
app.listen(PORT, "0.0.0.0", () => {
  console.log(`\u001b[32mProxy server running on http://0.0.0.0:${PORT}\u001b[0m`);
  console.log(`\u001b[32mTarget URL: ${TARGET_URL}\u001b[0m`);
});
