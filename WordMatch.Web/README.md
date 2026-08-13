# Word Match Web

React frontend for Word Match practice.

## Development

```bash
npm install
npm run dev
```

The Vite dev server proxies `/api` requests to `http://localhost:5164`.

## Production Build

```bash
npm run build
```

## Docker

```bash
docker compose up -d --build
```

Nginx serves the React build and proxies `/api` requests to the API service.
