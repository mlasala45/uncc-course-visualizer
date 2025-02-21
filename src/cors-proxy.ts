const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const cors = require("cors");

const app = express();
const TARGET_URL = "https://catalog.charlotte.edu";

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

// Start server on port 4000
const PORT = 4000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Proxy server running on http://0.0.0.0:${PORT}`);
});
