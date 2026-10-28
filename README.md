# FieldView

Self-hosted site-planning tool for physical security installers. Drop Verkada cameras onto aerial imagery with phone GPS, capture mount/FOV photos, draw spec-accurate coverage cones, share an interactive read-only map with clients, and export branded PDF packages for purchasing boards.

## Stack

Next.js 15 (PWA) · MapLibre GL (Esri World Imagery) · Postgres + Prisma · Puppeteer PDF · Dexie offline queue

## Deploy (docker compose)

```bash
cp .env.example .env
# edit .env: strong SESSION_SECRET + ADMIN_PASSWORD, set APP_BASE_URL to your public URL
docker compose up -d --build
```

App listens on `PORT` (default `3200`). Point Nginx Proxy Manager at `http://<host>:3200` with a valid cert — GPS/camera capture requires HTTPS.

## Features

- **Sites** — aerial map per site, Nominatim address lookup
- **Cameras** — drop at GPS or on map, drag to move, rotate handle / compass bearing, per-model FOV cones (dome/bullet/mini/fisheye 360°/multisensor heads/PTZ ring), zoom-in photo thumbnails
- **Photos** — typed (mount/FOV/cable path/other), captions, arrows & shapes annotation
- **Offline** — captures queue in IndexedDB and upload when signal returns
- **Infra** — IDF/switch/cable-path pins with notes & photos
- **Share** — revocable links with optional expiry → slick read-only client view
- **PDF** — branded cover w/ aerial overview, per-camera spec & photo pages, cabling section
- **Admin** — logo, brand colors, PDF footer, editable Verkada catalog, password

## Env

See `.env.example`. `PUPPETEER_EXECUTABLE_PATH` defaults to container chromium.

## Dev

```bash
docker compose up -d db
cp .env.example .env   # point DATABASE_URL at localhost:5432
npm install && npx prisma migrate dev && npx prisma db seed && npm run dev
```
