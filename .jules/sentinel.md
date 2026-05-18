## 2024-05-30 - [Overly Permissive CORS]
**Vulnerability:** Found `Access-Control-Allow-Origin: *` in `api/taste-analysis.js`.
**Learning:** This is a security vulnerability as it allows any external website to make cross-origin requests and read the responses, potentially stealing sensitive data. Also, wildcard origins are invalid with credentials in modern browsers.
**Prevention:** Strictly define allowed origins or dynamically check the `Origin` header against an allowlist.
