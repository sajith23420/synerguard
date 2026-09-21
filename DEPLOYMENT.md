# Deploying SynerGuard

The API (`server/`) runs on **Render** (free web service, 512 MB). The UI
(`client/`) runs on **Vercel**. They are on different origins, so each side
needs the other's URL: the client needs the API URL, and the API's CORS
allow-list needs the client URL.

Deploying changes only configuration. The data files, `store.js`, and the API
responses are the same as in local development.

## Environment variables

### Render (API)

| Variable | Value | Notes |
|---|---|---|
| `NODE_VERSION` | `22` | Already set by `render.yaml`. |
| `ALLOWED_ORIGINS` | `https://<your-app>.vercel.app` | Comma-separated. Exact origin: scheme and host, no path. A trailing slash is ignored. If unset, **every origin is allowed**. |
| `PORT` | *(do not set)* | Render sets this itself, and the server reads it. |

### Vercel (client)

| Variable | Value | Notes |
|---|---|---|
| `VITE_API_BASE_URL` | `https://<your-service>.onrender.com/api` | Include `/api`. No trailing slash. |

Vercel project settings: **Root Directory** `client`, **Framework Preset**
Vite, **Build Command** `npm run build`, **Output Directory** `dist`.

`VITE_API_BASE_URL` is read **at build time** and compiled into the bundle.
If you change it, redeploy on Vercel. Changing the variable alone does
nothing to the site that is already deployed.

## Deployment order

1. **Push the repo to GitHub** (see *Repository size* below).
2. **Deploy the backend on Render.** Go to *New → Blueprint* and pick the repo.
   Render reads `render.yaml` (root dir `server`, `npm install`, `npm start`,
   health check `/healthz`, Node 22, free plan). When it asks for
   `ALLOWED_ORIGINS`, leave it empty for now. Wait for the deploy to go live,
   then note the URL, for example `https://synerguard-api.onrender.com`.
3. **Deploy the frontend on Vercel.** Import the repo and set Root Directory
   to `client`. Add `VITE_API_BASE_URL=https://synerguard-api.onrender.com/api`
   before the first build. Deploy, then note the production URL, for example
   `https://synerguard.vercel.app`.
4. **Lock down CORS on Render.** Set
   `ALLOWED_ORIGINS=https://synerguard.vercel.app` and save. Render restarts
   the service with the new value.

Between steps 2 and 4 the API accepts any origin. That is harmless for a
read-only API, but don't skip step 4.

**Vercel preview deployments** get their own URLs
(`https://<project>-<hash>-<user>.vercel.app`). Once `ALLOWED_ORIGINS` is
set, those URLs are blocked. Give survey participants the production URL. To
test a preview, add its origin to the list temporarily.

## Verifying the deployment

Replace `$API` with your Render URL.

```sh
# 1. Health: expect {"status":"ok","ready":true}
curl -s $API/healthz

# 2. Dataset: expect "drugs":2691 and "interactions":314068
#    (the pair count is reported as "interactions")
curl -s $API/api/stats

# 3. Screening: expect counts.Major = 1 and severity "Major"
#    ("Aspirin" resolves to "Acetylsalicylic acid", a curated record)
curl -s -X POST $API/api/check \
  -H 'Content-Type: application/json' \
  -d '{"drugs":["Warfarin","Aspirin"]}'

# 4. CORS: the response must include
#    Access-Control-Allow-Origin: https://synerguard.vercel.app
curl -si $API/api/stats -H 'Origin: https://synerguard.vercel.app' | grep -i access-control
```

Then open the Vercel URL in a browser, add Warfarin and Aspirin, and check
that the Major interaction appears. If the page loads but no data does, open
the browser console:

- A **CORS error** means `ALLOWED_ORIGINS` does not match the page's origin
  exactly.
- A **404 on `/api/...` at the Vercel domain** means `VITE_API_BASE_URL` was
  not set when the site was built. Set it and redeploy.

## Keep-alive

Render's free tier puts a service to sleep after 15 minutes with no inbound
traffic. The next request then waits 30–50 seconds for the container to start
and the ~80 MB of interaction data to load. A survey participant will likely
think the tool is broken.

To prevent this, point an external uptime monitor at the health endpoint, for
example [UptimeRobot](https://uptimerobot.com) or
[cron-job.org](https://cron-job.org):

- **URL:** `https://<your-service>.onrender.com/healthz`
- **Method:** GET
- **Interval:** every 10 minutes (anything under 15 works)

`/healthz` sits outside `/api`, so it never gets the 503 "still loading"
response, and it only reads the ready flag. It never touches the data maps, so
each ping costs almost nothing. The server starts listening only after the data
has loaded, so in practice any response you get from it says `"ready": true`.

The Render health check configured in `render.yaml` is internal: Render uses
it to decide whether a deploy is healthy. It does **not** count as traffic and
will not keep the service awake. You still need the external pinger.

Budget: a free service kept awake all month uses about 720–744 instance hours.
That fits within the 750 free hours per workspace only if this is the only free
service running. Turn the pinger off when the survey ends.

## Repository size

`server/src/data/interactions.json` is 81,256,404 bytes (77.5 MiB) and is the
largest tracked file. GitHub warns about files over 50 MiB and rejects files
over 100 MiB. A normal `git push` succeeds with a size warning, and Git LFS is
not needed. Render clones the repo normally, so the data files arrive intact.
