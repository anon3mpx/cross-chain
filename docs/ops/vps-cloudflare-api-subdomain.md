# VPS API Subdomain via Cloudflare

This stack can now publish the VPS API through a Docker-managed edge proxy instead of exposing the Node container directly.

## What changed

- The API stays bound to `127.0.0.1:8787` on the VPS host.
- Postgres, Redis, Adminer, and Swagger UI are also bound to `127.0.0.1` only.
- A new `caddy` service is available behind the `edge` compose profile.
- `Caddy` terminates TLS on `80/443` and proxies the API subdomain to the internal `api` service.

## Required `.env` values

Set these on the VPS before starting the stack:

```bash
API_DOMAIN=crosschain.empx.io
VPS_CORS_ORIGIN=https://app.example.com
VPS_TRUST_PROXY=true
```

Notes:

- `API_DOMAIN` is the public API hostname served by Caddy. For this service, use `crosschain.empx.io`.
- `VPS_CORS_ORIGIN` should be the frontend origin that consumes this API.
- `VPS_TRUST_PROXY=true` ensures Express respects the reverse-proxy chain.

## Cloudflare DNS

Create this DNS record in Cloudflare:

- Type: `A`
- Name: `bridge`
- Content: `<your_vps_public_ip>`
- Proxy status: `Proxied`

Recommended Cloudflare SSL/TLS mode:

- `Full (strict)`

## Start the stack

From the repo root:

```bash
docker compose -f config/docker/docker-compose.yml --profile edge up --build -d
```

For the testnet compose file:

```bash
docker compose -f config/docker/docker-compose.testnet.yml --profile edge up --build -d
```

## Verify

Directly on the VPS:

```bash
curl http://127.0.0.1:8787/api/v1/health
```

From the public hostname after DNS resolves:

```bash
curl https://crosschain.empx.io/api/v1/health
```

## Operational notes

- `adminer` remains available only on `127.0.0.1:8080`.
- `swagger-ui` remains available only on `127.0.0.1:8081`.
- `postgres` remains available only on `127.0.0.1:5432`.
- `redis` remains available only on `127.0.0.1:6379`.

If you need remote access to those internal services, use an SSH tunnel instead of opening public ports.
