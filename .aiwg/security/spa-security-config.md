# HotM SPA Security Configuration

**Project**: HotM (Hall Of The Mind)
**Document Version**: 1.0
**Status**: DRAFT
**Date**: 2026-01-31
**Author**: Security Architect
**Related Issues**: #47 (CORS), #48 (TLS), #49 (Security Headers)
**Related Documents**: migration-security-assessment.md, ADR-003, ADR-007 (planned)

---

## Overview

This document provides production-ready security configurations for the HotM SPA deployment. It addresses three critical security areas:

1. **CORS Configuration** - Cross-Origin Resource Sharing for matric-memory API
2. **TLS/HTTPS Configuration** - Transport layer security via Nginx
3. **Security Headers** - Browser security controls via Nginx

**Architecture Context**:
```
+------------------+      HTTPS/TLS       +------------------+
|  User Browser    |<-------------------->|   Nginx (SPA)    |
|  (React SPA)     |   Security Headers   |  Static Files    |
+--------+---------+                      +------------------+
         |
         | HTTPS + Bearer Token (CORS)
         v
+------------------+
|  matric-memory   |
|  API Server      |
+------------------+
```

---

## 1. CORS Configuration (matric-memory API)

### Issue Reference: #47

### 1.1 Requirements Summary

| Requirement ID | Requirement | Priority |
|----------------|-------------|----------|
| CORS-001 | Whitelist exact SPA origin (no wildcards in production) | CRITICAL |
| CORS-002 | Enable credentials for cookie-based auth | HIGH |
| CORS-003 | Restrict allowed methods to required verbs | MEDIUM |
| CORS-004 | Restrict allowed headers to required set | MEDIUM |
| CORS-005 | Set appropriate preflight cache duration | LOW |

### 1.2 Allowed Origins by Environment

| Environment | Origin URL | Notes |
|-------------|------------|-------|
| Development | `http://localhost:5173` | Vite dev server |
| Development | `http://localhost:1420` | Tauri dev server |
| Development | `http://127.0.0.1:5173` | Alternative localhost |
| Staging | `https://hotm-staging.example.com` | Pre-production testing |
| Production | `https://hotm.example.com` | Production SPA |
| Production | `https://app.matric-memory.com` | Alternative production domain |

**CRITICAL**: Never use `Access-Control-Allow-Origin: *` in production when credentials are required.

### 1.3 Rust/Axum CORS Configuration

#### Development Configuration (Permissive)

```rust
use tower_http::cors::{Any, CorsLayer};
use axum::http::{HeaderValue, Method};

// DEVELOPMENT ONLY - Permissive CORS for local testing
// WARNING: Do NOT use in production
fn cors_layer_dev() -> CorsLayer {
    CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any)
}
```

#### Production Configuration (Strict)

```rust
use tower_http::cors::{AllowOrigin, CorsLayer};
use axum::http::{header, HeaderValue, Method};
use std::sync::Arc;

/// Production CORS configuration for matric-memory API
///
/// Security controls:
/// - Explicit origin whitelist (no wildcards)
/// - Credentials enabled for cookie-based auth
/// - Restricted methods and headers
/// - Preflight caching for performance
fn cors_layer_production() -> CorsLayer {
    // Define allowed origins from environment or configuration
    let allowed_origins: Vec<HeaderValue> = vec![
        // Production origins
        "https://hotm.example.com".parse().unwrap(),
        "https://app.matric-memory.com".parse().unwrap(),
        // Staging origin (if separate)
        "https://hotm-staging.example.com".parse().unwrap(),
    ];

    CorsLayer::new()
        // Explicit origin whitelist
        .allow_origin(AllowOrigin::list(allowed_origins))
        // Required for cookie-based authentication
        .allow_credentials(true)
        // Restrict to required HTTP methods only
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::OPTIONS,
        ])
        // Restrict to required headers only
        .allow_headers([
            header::AUTHORIZATION,
            header::CONTENT_TYPE,
            header::ACCEPT,
            header::ORIGIN,
            header::X_REQUESTED_WITH,
        ])
        // Expose headers the client needs to read
        .expose_headers([
            header::CONTENT_TYPE,
            header::CONTENT_LENGTH,
        ])
        // Cache preflight response for 24 hours (86400 seconds)
        .max_age(std::time::Duration::from_secs(86400))
}
```

#### Environment-Based Configuration

```rust
use std::env;

/// Select CORS configuration based on environment
fn cors_layer() -> CorsLayer {
    let env_mode = env::var("HOTM_ENV").unwrap_or_else(|_| "development".to_string());

    match env_mode.as_str() {
        "production" | "staging" => cors_layer_production(),
        _ => cors_layer_dev(),
    }
}
```

#### Dynamic Origin Configuration (Recommended)

```rust
use std::env;
use tower_http::cors::{AllowOrigin, CorsLayer};
use axum::http::HeaderValue;

/// Load allowed origins from environment variable
///
/// Environment variable format:
/// CORS_ALLOWED_ORIGINS=https://hotm.example.com,https://app.matric-memory.com
fn cors_layer_from_env() -> CorsLayer {
    let origins_str = env::var("CORS_ALLOWED_ORIGINS")
        .unwrap_or_else(|_| "http://localhost:5173".to_string());

    let allowed_origins: Vec<HeaderValue> = origins_str
        .split(',')
        .filter_map(|origin| origin.trim().parse().ok())
        .collect();

    if allowed_origins.is_empty() {
        panic!("CORS_ALLOWED_ORIGINS must contain at least one valid origin");
    }

    CorsLayer::new()
        .allow_origin(AllowOrigin::list(allowed_origins))
        .allow_credentials(true)
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
            axum::http::Method::DELETE,
            axum::http::Method::OPTIONS,
        ])
        .allow_headers([
            axum::http::header::AUTHORIZATION,
            axum::http::header::CONTENT_TYPE,
            axum::http::header::ACCEPT,
        ])
        .max_age(std::time::Duration::from_secs(86400))
}
```

### 1.4 Response Headers (Expected)

When properly configured, the matric-memory API should return these headers:

```http
HTTP/1.1 200 OK
Access-Control-Allow-Origin: https://hotm.example.com
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type, Accept
Access-Control-Max-Age: 86400
```

### 1.5 Verification Commands

```bash
# Test preflight request (OPTIONS)
curl -v -X OPTIONS \
  -H "Origin: https://hotm.example.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Authorization, Content-Type" \
  https://api.matric-memory.example.com/api/v1/notes

# Expected response headers:
# Access-Control-Allow-Origin: https://hotm.example.com
# Access-Control-Allow-Credentials: true
# Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
# Access-Control-Allow-Headers: Authorization, Content-Type, Accept
# Access-Control-Max-Age: 86400

# Test actual request with credentials
curl -v -X GET \
  -H "Origin: https://hotm.example.com" \
  -H "Authorization: Bearer <token>" \
  https://api.matric-memory.example.com/api/v1/health

# Verify rejected origin (should fail)
curl -v -X GET \
  -H "Origin: https://malicious-site.com" \
  https://api.matric-memory.example.com/api/v1/health
# Expected: No Access-Control-Allow-Origin header or request blocked
```

---

## 2. TLS/HTTPS Configuration (Nginx)

### Issue Reference: #48

### 2.1 Requirements Summary

| Requirement | Implementation | Priority |
|-------------|----------------|----------|
| TLS 1.2+ only | Disable SSLv3, TLS 1.0, TLS 1.1 | CRITICAL |
| Strong cipher suites | Modern cipher preference | CRITICAL |
| HSTS header | 1 year with includeSubDomains | HIGH |
| Certificate | Let's Encrypt with auto-renewal | HIGH |
| OCSP Stapling | Enable for performance | MEDIUM |

### 2.2 Let's Encrypt Certificate Setup

#### Initial Certificate Acquisition

```bash
# Install certbot
sudo apt update && sudo apt install certbot python3-certbot-nginx -y

# Stop Nginx temporarily for standalone verification
sudo systemctl stop nginx

# Obtain certificate (replace with actual domain)
sudo certbot certonly --standalone \
  -d hotm.example.com \
  -d www.hotm.example.com \
  --email admin@example.com \
  --agree-tos \
  --non-interactive

# Verify certificate was created
sudo ls -la /etc/letsencrypt/live/hotm.example.com/
# Expected files: cert.pem, chain.pem, fullchain.pem, privkey.pem

# Restart Nginx
sudo systemctl start nginx
```

#### Certificate Auto-Renewal

```bash
# Test renewal (dry run)
sudo certbot renew --dry-run

# Add cron job for auto-renewal (runs twice daily)
echo "0 0,12 * * * root certbot renew --quiet --post-hook 'systemctl reload nginx'" | \
  sudo tee /etc/cron.d/certbot-renew

# Alternative: systemd timer (preferred on modern systems)
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# Verify timer is active
sudo systemctl list-timers | grep certbot
```

### 2.3 Nginx SSL Configuration

The complete SSL configuration is in the companion file: `.aiwg/deployment/nginx-security.conf`

Key excerpts:

```nginx
# SSL certificate paths
ssl_certificate /etc/letsencrypt/live/hotm.example.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/hotm.example.com/privkey.pem;

# TLS version - ONLY TLS 1.2 and 1.3
ssl_protocols TLSv1.2 TLSv1.3;

# Strong cipher suites (TLS 1.3 has built-in secure ciphers)
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;

# Server cipher preference
ssl_prefer_server_ciphers off;

# SSL session configuration
ssl_session_timeout 1d;
ssl_session_cache shared:SSL:50m;
ssl_session_tickets off;

# OCSP Stapling
ssl_stapling on;
ssl_stapling_verify on;
resolver 8.8.8.8 8.8.4.4 valid=300s;
resolver_timeout 5s;

# HSTS (1 year, includeSubDomains, preload-ready)
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
```

### 2.4 Diffie-Hellman Parameters (Optional, Enhanced Security)

```bash
# Generate strong DH parameters (2048-bit minimum, 4096-bit recommended)
# This may take several minutes
sudo openssl dhparam -out /etc/nginx/dhparam.pem 4096

# Add to Nginx SSL configuration
# ssl_dhparam /etc/nginx/dhparam.pem;
```

### 2.5 HTTP to HTTPS Redirect

```nginx
# Redirect all HTTP traffic to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name hotm.example.com www.hotm.example.com;

    # Allow Let's Encrypt HTTP-01 challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect everything else to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}
```

### 2.6 SSL Labs Verification

After deployment, verify TLS configuration:

```bash
# Online test (comprehensive)
# Visit: https://www.ssllabs.com/ssltest/analyze.html?d=hotm.example.com

# Command-line test with testssl.sh
docker run --rm -ti drwetter/testssl.sh https://hotm.example.com

# Quick OpenSSL verification
openssl s_client -connect hotm.example.com:443 -tls1_2 </dev/null 2>/dev/null | \
  openssl x509 -noout -dates -subject

# Verify TLS 1.0/1.1 is rejected
openssl s_client -connect hotm.example.com:443 -tls1 </dev/null 2>&1 | \
  grep -i "handshake\|error"
# Expected: Handshake failure or protocol error

openssl s_client -connect hotm.example.com:443 -tls1_1 </dev/null 2>&1 | \
  grep -i "handshake\|error"
# Expected: Handshake failure or protocol error
```

**Target Grade**: A or A+ on SSL Labs

---

## 3. Security Headers (Nginx)

### Issue Reference: #49

### 3.1 Required Security Headers

| Header | Value | Purpose |
|--------|-------|---------|
| Content-Security-Policy | See below | XSS/injection prevention |
| X-Frame-Options | DENY | Clickjacking prevention |
| X-Content-Type-Options | nosniff | MIME sniffing prevention |
| X-XSS-Protection | 0 | Disable legacy filter (CSP preferred) |
| Referrer-Policy | strict-origin-when-cross-origin | Referrer leakage control |
| Permissions-Policy | See below | Feature policy restriction |
| Strict-Transport-Security | max-age=31536000; includeSubDomains | HTTPS enforcement |

### 3.2 Content-Security-Policy (CSP)

#### Base CSP for SPA

```nginx
# Content-Security-Policy for HotM SPA
# NOTE: Adjust connect-src URLs to match your actual API and auth endpoints

add_header Content-Security-Policy "
    default-src 'self';
    script-src 'self';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https:;
    font-src 'self' data:;
    connect-src 'self' https://api.matric-memory.example.com https://auth.example.com wss://api.matric-memory.example.com;
    frame-ancestors 'none';
    base-uri 'self';
    form-action 'self';
    object-src 'none';
    script-src-attr 'none';
    upgrade-insecure-requests;
" always;
```

#### CSP Directive Explanation

| Directive | Value | Purpose |
|-----------|-------|---------|
| `default-src` | `'self'` | Default policy: same-origin only |
| `script-src` | `'self'` | JavaScript from same origin only |
| `style-src` | `'self' 'unsafe-inline'` | CSS from same origin + inline styles (React requirement) |
| `img-src` | `'self' data: https:` | Images from same origin, data URIs, and HTTPS |
| `font-src` | `'self' data:` | Fonts from same origin and data URIs |
| `connect-src` | Multiple | API endpoints, WebSocket connections |
| `frame-ancestors` | `'none'` | Prevent embedding in frames (clickjacking) |
| `base-uri` | `'self'` | Restrict base element |
| `form-action` | `'self'` | Form submissions to same origin only |
| `object-src` | `'none'` | Block plugins (Flash, Java) |
| `upgrade-insecure-requests` | - | Upgrade HTTP to HTTPS |

#### CSP with Nonce (Enhanced Security)

For stricter CSP without `'unsafe-inline'`:

```nginx
# Generate nonce per request (requires Nginx module or application support)
# This is more secure but requires build process changes to inject nonce

# Application would inject nonce into script/style tags:
# <script nonce="random-base64-value">...</script>

add_header Content-Security-Policy "
    default-src 'self';
    script-src 'self' 'nonce-$request_id';
    style-src 'self' 'nonce-$request_id';
    ...
" always;
```

### 3.3 Complete Security Headers Block

```nginx
# Security headers for HotM SPA
# Add to server block after SSL configuration

# Prevent clickjacking
add_header X-Frame-Options "DENY" always;

# Prevent MIME type sniffing
add_header X-Content-Type-Options "nosniff" always;

# Disable legacy XSS filter (CSP is the modern approach)
add_header X-XSS-Protection "0" always;

# Control referrer information
add_header Referrer-Policy "strict-origin-when-cross-origin" always;

# Feature/Permissions Policy - disable unnecessary browser features
add_header Permissions-Policy "
    accelerometer=(),
    camera=(),
    geolocation=(),
    gyroscope=(),
    magnetometer=(),
    microphone=(),
    payment=(),
    usb=()
" always;

# HSTS - enforce HTTPS for 1 year
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

# Content-Security-Policy (adjust endpoints to your environment)
add_header Content-Security-Policy "
    default-src 'self';
    script-src 'self';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https:;
    font-src 'self' data:;
    connect-src 'self' https://api.matric-memory.example.com https://auth.example.com wss://api.matric-memory.example.com;
    frame-ancestors 'none';
    base-uri 'self';
    form-action 'self';
    object-src 'none';
    upgrade-insecure-requests;
" always;
```

### 3.4 CSP Violation Reporting (Optional)

```nginx
# CSP with violation reporting
# Reports violations to a logging endpoint for security monitoring

add_header Content-Security-Policy "
    default-src 'self';
    script-src 'self';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https:;
    font-src 'self' data:;
    connect-src 'self' https://api.matric-memory.example.com https://auth.example.com wss://api.matric-memory.example.com;
    frame-ancestors 'none';
    base-uri 'self';
    form-action 'self';
    object-src 'none';
    upgrade-insecure-requests;
    report-uri /api/v1/csp-report;
    report-to csp-endpoint;
" always;

# Report-To header for CSP reporting (modern browsers)
add_header Report-To '{
    \"group\": \"csp-endpoint\",
    \"max_age\": 86400,
    \"endpoints\": [{\"url\": \"https://api.matric-memory.example.com/api/v1/csp-report\"}]
}' always;
```

### 3.5 Verification Commands

```bash
# Check all security headers
curl -I https://hotm.example.com 2>/dev/null | grep -iE "^(content-security|x-frame|x-content|x-xss|referrer|permissions|strict)"

# Expected output:
# Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
# X-XSS-Protection: 0
# Referrer-Policy: strict-origin-when-cross-origin
# Permissions-Policy: accelerometer=(), camera=(), ...
# Content-Security-Policy: default-src 'self'; ...

# Online security header scanner
# Visit: https://securityheaders.com/?q=hotm.example.com&followRedirects=on

# Mozilla Observatory
# Visit: https://observatory.mozilla.org/analyze/hotm.example.com
```

**Target Grade**: A or A+ on securityheaders.com

---

## 4. Verification Checklist

### 4.1 Pre-Deployment Checklist

#### CORS Configuration (Issue #47)
- [ ] Production origins defined in environment configuration
- [ ] `CORS_ALLOWED_ORIGINS` environment variable set
- [ ] Credentials mode enabled for cookie-based auth
- [ ] Preflight requests return correct headers
- [ ] Unauthorized origins are rejected

#### TLS/HTTPS Configuration (Issue #48)
- [ ] Let's Encrypt certificate obtained
- [ ] Certificate auto-renewal configured (certbot timer/cron)
- [ ] TLS 1.2 and 1.3 only (1.0/1.1 disabled)
- [ ] Strong cipher suites configured
- [ ] HSTS header enabled (1 year minimum)
- [ ] HTTP to HTTPS redirect working
- [ ] OCSP stapling enabled

#### Security Headers (Issue #49)
- [ ] Content-Security-Policy configured
- [ ] X-Frame-Options: DENY set
- [ ] X-Content-Type-Options: nosniff set
- [ ] X-XSS-Protection: 0 set
- [ ] Referrer-Policy configured
- [ ] Permissions-Policy configured
- [ ] HSTS header present

### 4.2 Post-Deployment Verification

#### Online Tests

| Test | URL | Target Grade |
|------|-----|--------------|
| SSL Labs | https://www.ssllabs.com/ssltest/ | A or A+ |
| Security Headers | https://securityheaders.com/ | A or A+ |
| Mozilla Observatory | https://observatory.mozilla.org/ | A or A+ |
| CSP Evaluator | https://csp-evaluator.withgoogle.com/ | No high-severity findings |

#### Command-Line Verification

```bash
# Full verification script
#!/bin/bash
DOMAIN="hotm.example.com"

echo "=== TLS Verification ==="
echo | openssl s_client -connect $DOMAIN:443 2>/dev/null | openssl x509 -noout -dates

echo ""
echo "=== Security Headers ==="
curl -sI https://$DOMAIN | grep -iE "^(content-security|x-frame|x-content|x-xss|referrer|permissions|strict)"

echo ""
echo "=== CORS Test ==="
curl -sI -X OPTIONS \
  -H "Origin: https://$DOMAIN" \
  -H "Access-Control-Request-Method: POST" \
  https://api.matric-memory.example.com/api/v1/notes | \
  grep -i "access-control"

echo ""
echo "=== TLS 1.0 Rejection Test ==="
timeout 5 openssl s_client -connect $DOMAIN:443 -tls1 </dev/null 2>&1 | \
  grep -q "handshake failure" && echo "PASS: TLS 1.0 rejected" || echo "FAIL: TLS 1.0 accepted"

echo ""
echo "=== TLS 1.1 Rejection Test ==="
timeout 5 openssl s_client -connect $DOMAIN:443 -tls1_1 </dev/null 2>&1 | \
  grep -q "handshake failure" && echo "PASS: TLS 1.1 rejected" || echo "FAIL: TLS 1.1 accepted"
```

---

## 5. Environment-Specific Configurations

### 5.1 Development Environment

```bash
# Environment variables for development
export HOTM_ENV=development
export CORS_ALLOWED_ORIGINS="http://localhost:5173,http://localhost:1420,http://127.0.0.1:5173"
export RUST_LOG=hotm_server=debug,axum=debug

# CSP can be relaxed for development (report-only mode)
# add_header Content-Security-Policy-Report-Only "..." always;
```

### 5.2 Staging Environment

```bash
# Environment variables for staging
export HOTM_ENV=staging
export CORS_ALLOWED_ORIGINS="https://hotm-staging.example.com"
export RUST_LOG=hotm_server=info,axum=info
```

### 5.3 Production Environment

```bash
# Environment variables for production
export HOTM_ENV=production
export CORS_ALLOWED_ORIGINS="https://hotm.example.com,https://app.matric-memory.com"
export RUST_LOG=hotm_server=warn,axum=warn
```

---

## 6. Troubleshooting

### 6.1 CORS Issues

**Problem**: `Access-Control-Allow-Origin` header missing

```
Access to fetch at 'https://api.example.com' from origin 'https://hotm.example.com'
has been blocked by CORS policy
```

**Solutions**:
1. Verify origin is in `CORS_ALLOWED_ORIGINS` environment variable
2. Check API server is using production CORS configuration
3. Ensure preflight (OPTIONS) requests are handled

**Problem**: Credentials mode failing

```
The value of 'Access-Control-Allow-Credentials' header must be 'true'
```

**Solutions**:
1. Ensure `.allow_credentials(true)` is set in CORS layer
2. Verify `Access-Control-Allow-Origin` is not `*` (wildcard incompatible with credentials)

### 6.2 TLS/Certificate Issues

**Problem**: Certificate not trusted

**Solutions**:
1. Verify full certificate chain: `ssl_certificate` should point to `fullchain.pem`
2. Check certificate expiry: `openssl x509 -noout -dates -in /path/to/fullchain.pem`
3. Verify domain matches certificate

**Problem**: SSL Labs reports weak configuration

**Solutions**:
1. Ensure `ssl_protocols TLSv1.2 TLSv1.3;` only
2. Verify cipher suite is modern (no RC4, 3DES, or export ciphers)
3. Enable HSTS and OCSP stapling

### 6.3 CSP Issues

**Problem**: Application functionality broken after CSP

```
Refused to execute inline script because it violates Content-Security-Policy
```

**Solutions**:
1. Temporarily use `Content-Security-Policy-Report-Only` to identify violations
2. Add necessary sources to appropriate directives
3. For inline scripts, consider nonce-based CSP or move scripts to external files

**Problem**: WebSocket connections blocked

**Solutions**:
1. Add `wss://` protocol to `connect-src`
2. Ensure WebSocket endpoint is included in allowed origins

---

## 7. Document Control

| Field | Value |
|-------|-------|
| Document Version | 1.0 |
| Status | DRAFT |
| Author | Security Architect |
| Date | 2026-01-31 |
| Next Review | Before SPA deployment |
| Related Issues | #47, #48, #49 |
| Related Documents | migration-security-assessment.md |

---

## Appendix A: Quick Reference

### Essential Environment Variables

```bash
# CORS
CORS_ALLOWED_ORIGINS=https://hotm.example.com,https://app.matric-memory.com

# Environment
HOTM_ENV=production

# Logging
RUST_LOG=hotm_server=warn,axum=warn
```

### Essential Nginx Configuration Files

- `/etc/nginx/sites-available/hotm.conf` - Main site configuration
- `/etc/nginx/snippets/ssl-params.conf` - SSL parameters (optional)
- `/etc/letsencrypt/live/hotm.example.com/` - Certificate files

### Verification Commands Summary

```bash
# CORS
curl -I -X OPTIONS -H "Origin: https://hotm.example.com" https://api.example.com/api/v1/notes

# TLS
openssl s_client -connect hotm.example.com:443 -tls1_2 </dev/null

# Headers
curl -I https://hotm.example.com | grep -iE "^(x-|content-security|strict|referrer|permissions)"
```

---

*End of SPA Security Configuration Document*
