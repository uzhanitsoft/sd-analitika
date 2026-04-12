# 🚀 Sales Doctor Cache Server

Fast API backend for Sales Doctor Analytics Dashboard. Caches data from Sales Doctor API and serves it quickly to the frontend.

## ⚡ Features

- **10x Faster**: Dashboard loads in <1 second
- **Auto-Refresh**: Updates every 10 minutes (30 min at night)
- **Smart Caching**: In-memory cache with TTL
- **Night Mode**: Slower refresh during night hours (0:00-6:00)
- **Manual Refresh**: Force refresh via API
- **RESTful API**: Simple JSON endpoints

## 📊 Architecture

```
Frontend → Cache Server (this) → Sales Doctor API
           ↑
        10 min refresh
        Instant response ⚡
```

## 🚀 Quick Start

### Install Dependencies
```bash
npm install
```

### Configuration
Copy `.env.example` to `.env` and configure:
```bash
cp .env.example .env
```

### Run Server
```bash
# Development
npm run dev

# Production
npm start
```

Server will start on `http://localhost:3001`

## 📡 API Endpoints

### GET /api/dashboard
Get complete dashboard data (cached)

**Response:**
```json
{
  "data": {
    "sales": { "uzs": 105268710, "usd": 20458 },
    "orders": 87,
    "clients": { "total": 6300, "active": 72 },
    "products": 4500,
    "profit": { "uzs": 9264876, "usd": 759 },
    "topProducts": [...],
    "topAgents": [...]
  },
  "meta": {
    "lastUpdate": "2026-02-08T02:15:00.000Z",
    "age": 120,
    "isFresh": true,
    "nextRefresh": 480
  }
}
```

### GET /api/health
Server health check

### POST /api/refresh
Manually trigger cache refresh

### GET /api/stats
Quick summary stats only

## 🔧 Configuration

Edit `config.js` to customize:

- `REFRESH_INTERVALS.DASHBOARD`: Refresh interval (default: 10 min)
- `REFRESH_INTERVALS.NIGHT_MODE`: Night refresh (default: 30 min)
- `CACHE_TTL`: Cache validity period (default: 15 min)
- `DEFAULT_USD_RATE`: USD exchange rate

## 🌙 Night Mode

Automatically switches to slower refresh (30 min) between 0:00-6:00 to reduce server load.

## 📦 Deploy to Railway

1. Push to GitHub
2. Connect Railway to your repo
3. Set environment variables in Railway dashboard
4. Deploy!

Railway will automatically detect Node.js and run `npm start`.

## 📝 Environment Variables

- `PORT`: Server port (default: 3001)
- `SD_SERVER`: Sales Doctor server domain
- `SD_LOGIN`: API login
- `SD_PASSWORD`: API password
- `LOG_LEVEL`: Logging level (info, debug, warn, error)

## 🔒 Security

- CORS configured for specific domains
- Session-based authentication with Sales Doctor API
- Auto re-authentication on session expiry

## 📈 Performance

- **First Request**: ~5-10 seconds (fetches from API)
- **Cached Requests**: <100ms ⚡
- **Memory Usage**: ~50-100MB
- **API Load**: 6 requests/hour (vs 50+ without cache)

## 🛠️ Development

```bash
# Install dev dependencies
npm install

# Run with auto-reload
npm run dev

# Test endpoints
curl http://localhost:3001/api/health
curl http://localhost:3001/api/dashboard
```

## 📄 License

MIT

---

Made with ❤️ by Uzhanitsoft
