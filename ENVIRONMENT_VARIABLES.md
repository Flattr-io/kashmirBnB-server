# Environment Variables Reference

## Required Variables (Must be set for production)

### Application Configuration
| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Application environment | `development` | ✅ |
| `PORT` | Server port | `3000` | ✅ |

### Database Configuration (Supabase)
| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Your Supabase project URL | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | ✅ |

### External API Keys
| Variable | Description | Required |
|----------|-------------|----------|
| `TOMORROW_API_KEY` | Tomorrow.io weather API key | ✅ |
| `MAPBOX_API_KEY` | Mapbox geocoding API key | ✅ |
| `PHONE_VERIFICATION_API_KEY` | Secret used to verify phone verification JWTs | ✅ |

### CORS Configuration
| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `CORS_ORIGINS` | Comma-separated allowed origins | `*` | ✅ |

## Optional Variables (Production Optimizations)

### Performance & Monitoring
| Variable | Description | Default | Usage |
|----------|-------------|---------|-------|
| `HEALTH_CHECK_TIMEOUT` | Health check timeout in ms | `5000` | Health endpoint |
| `WEATHER_UPDATE_INTERVAL` | Weather update interval in ms | `10800000` (3 hours) | Scheduler |
| `MAX_MEMORY_USAGE` | Max memory usage in MB | `450` | Memory monitoring |

### Security
| Variable | Description | Default | Usage |
|----------|-------------|---------|-------|
| `JWT_SECRET` | JWT signing secret | `your_jwt_secret_here` | Authentication |
| `SESSION_SECRET` | Session secret | `your_session_secret_here` | Sessions |
| `PHONE_VERIFICATION_ISSUER` | Expected issuer for phone verification JWTs | _unset_ | Phone verification |
| `PHONE_VERIFICATION_AUDIENCE` | Expected audience for phone verification JWTs | _unset_ | Phone verification |
| `PHONE_VERIFICATION_PHONE_CLAIM` | Custom claim key that contains the phone number | _unset_ | Phone verification |

### Logging & Debugging
| Variable | Description | Default | Usage |
|----------|-------------|---------|-------|
| `LOG_LEVEL` | Logging level | `info` | Application logging |
| `DEBUG` | Debug namespace | `kashmir-bnb:*` | Debug logging |
| `VERBOSE_LOGGING` | Enable verbose logging | `false` | Detailed logs |

### Rate Limiting
| Variable | Description | Default | Usage |
|----------|-------------|---------|-------|
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in ms | `900000` (15 min) | Rate limiting |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `100` | Rate limiting |

## Render.com Specific Variables

### Automatically Set by Render
| Variable | Description | Set By |
|----------|-------------|--------|
| `RENDER_EXTERNAL_URL` | External service URL | Render |
| `RENDER` | Indicates running on Render | Render |
| `RENDER_EXTERNAL_HOSTNAME` | External hostname | Render |

## Environment Variable Usage in Code

### Core Application (`app.bootstrap.ts`)
```typescript
const origin = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : '*';
const port = Number(process.env.PORT) || 3000;
const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
```

### Swagger Configuration (`swagger.ts`)
```typescript
const port = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && process.env.RENDER_EXTERNAL_URL) {
    // Use production URL
}
```

### Weather Service (`weather.service.ts`)
```typescript
this.apiKey = process.env.TOMORROW_API_KEY as string;
if (!this.apiKey) {
    throw new UnauthorizedError('Tomorrow.io API key is missing');
}
```

### Mapbox Service (`mapbox.service.ts`)
```typescript
this.apiKey = process.env.MAPBOX_API_KEY as string;
if (!this.apiKey) {
    throw new UnauthorizedError('Mapbox API key is missing');
}
```

### Health Check (`router.config.ts`)
```typescript
version: process.env.npm_package_version || '1.0.0'
```

## Production Deployment Checklist

### ✅ Required for Render.com
- [ ] `NODE_ENV=production`
- [ ] `SUPABASE_URL` (set as secret)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` (set as secret)
- [ ] `TOMORROW_API_KEY` (set as secret)
- [ ] `MAPBOX_API_KEY` (set as secret)
- [ ] `CORS_ORIGINS` (set to your frontend domain)

### ✅ Optional but Recommended
- [ ] `HEALTH_CHECK_TIMEOUT=5000`
- [ ] `MAX_MEMORY_USAGE=450`
- [ ] `LOG_LEVEL=info`

### ⚠️ Security Notes
- Never commit `.env` files to version control
- Use Render Dashboard to set secrets
- Rotate API keys regularly
- Use different keys for development/production

## Development vs Production

### Development (.env)
```bash
NODE_ENV=development
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
DEBUG=kashmir-bnb:*
VERBOSE_LOGGING=true
```

### Production (Render Dashboard)
```bash
NODE_ENV=production
CORS_ORIGINS=https://yourdomain.com
LOG_LEVEL=info
HEALTH_CHECK_TIMEOUT=5000
MAX_MEMORY_USAGE=450
```
