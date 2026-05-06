# Deployment Guide

## Routes Proxy

The Chrome extension should not ship a Google Routes API key. Instead, it calls a small backend endpoint:

```text
Chrome extension -> /api/routes -> Google Routes API
```

The backend reads the key from an environment variable:

```text
GOOGLE_ROUTES_API_KEY
```

## Deploy on Vercel

1. Create a Vercel project from this GitHub repo.
2. Add an environment variable:

```text
GOOGLE_ROUTES_API_KEY=your_restricted_routes_api_key
```

3. Deploy the project.
4. Copy the deployed URL, for example:

```text
https://transit-scheduler.vercel.app
```

5. Update `ROUTES_PROXY_URL` in `src/constants.js`:

```js
export const ROUTES_PROXY_URL = "https://transit-scheduler.vercel.app/api/routes";
```

6. Reload the unpacked extension and test Preview again.

## Google Cloud Key Restrictions

For the key stored in Vercel:

- Restrict APIs to **Routes API** only.
- Set billing alerts and quota limits for demo safety.
- If your host provides stable outbound IPs, add an IP restriction. Vercel does not usually provide this on standard deployments, so API restriction plus quotas are the practical class-demo minimum.

## Publishing

Before uploading to the Chrome Web Store:

1. Confirm `src/constants.js` points at the deployed proxy URL.
2. Confirm no Google API key is present in source.
3. ZIP the extension files, including:
   - `manifest.json`
   - `background.js`
   - `src/`
   - `injection/`

Do not include `.git/`, local screenshots, or private notes.
