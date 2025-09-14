# 🚀 KashmirBNBServer - Render.com Deployment Checklist

## Pre-Deployment Checklist

### ✅ Code Preparation
- [x] All critical bugs fixed (route prefix, port configuration)
- [x] TypeScript builds successfully (`npm run build`)
- [x] Application starts locally (`npm start`)
- [x] Health check endpoint working (`/api/health`)
- [x] Swagger documentation accessible (`/api-docs`)

### ✅ Configuration Files
- [x] `render.yaml` created with optimal settings
- [x] `.dockerignore` added for efficient builds
- [x] `.env.example` created for environment reference
- [x] `DEPLOYMENT.md` updated with CI/CD instructions

### ✅ Performance Optimizations
- [x] Weather scheduler optimized (runs every 3 hours only)
- [x] Dockerfile optimized for production
- [x] Health check enhanced with database connectivity
- [x] Swagger configured for production URLs

## Deployment Steps

### 1. GitHub Repository Setup
```bash
# Ensure all changes are committed and pushed
git add .
git commit -m "Configure for Render.com CI/CD deployment"
git push origin main
```

### 2. Render.com Service Creation

#### Option A: Using render.yaml (Recommended)
1. Go to [render.com](https://render.com)
2. Click "New +" → "Blueprint"
3. Connect your GitHub repository
4. Select `KashmirBNBServer` repository
5. Render will auto-detect `render.yaml`
6. Review and confirm configuration

#### Option B: Manual Configuration
1. Go to [render.com](https://render.com)
2. Click "New +" → "Web Service"
3. Connect GitHub repository
4. Configure manually:
   - **Name**: `kashmir-bnb-api`
   - **Runtime**: Node.js
   - **Build Command**: `npm ci --no-audit --no-fund && npm run build && npm prune --production`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/api/health`

### 3. Environment Variables Setup

In Render Dashboard → Your Service → Environment:

| Variable | Value | Secret |
|----------|-------|--------|
| `NODE_ENV` | `production` | No |
| `SUPABASE_URL` | Your Supabase URL | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase Key | Yes |
| `TOMORROW_API_KEY` | Your Tomorrow.io Key | Yes |
| `MAPBOX_API_KEY` | Your Mapbox Key | Yes |
| `CORS_ORIGINS` | Your frontend domain | No |

### 4. Deploy and Verify

1. **Deploy**: Click "Deploy" or push to main branch
2. **Monitor Build**: Watch build logs for errors
3. **Test Health**: Visit `https://your-service.onrender.com/api/health`
4. **Test API**: Visit `https://your-service.onrender.com/api-docs`
5. **Check Logs**: Monitor service logs for runtime issues

## Free Plan Considerations

### ⚠️ **Important Free Plan Limitations**
- **Memory**: 512MB RAM limit
- **CPU**: 0.1 CPU (shared resources)
- **Sleep Mode**: Service sleeps after 15 minutes of inactivity
- **Bandwidth**: 100GB per month
- **No Persistent Storage**: No disk storage available
- **Single Instance**: No autoscaling or multiple instances
- **Cold Starts**: First request after sleep may take 10-30 seconds

### 🚀 **Optimization for Free Plan**
- ✅ **Minimal Dependencies**: TypeScript moved to devDependencies
- ✅ **Optimized Build**: `npm prune --production` removes dev dependencies
- ✅ **Health Monitoring**: Built-in health checks
- ✅ **Memory Efficient**: Weather scheduler optimized for minimal resource usage

## Post-Deployment Verification

### ✅ Health Check
- [ ] Health endpoint returns 200 status
- [ ] Database connectivity confirmed
- [ ] Memory usage within 512MB limit
- [ ] Response time < 5 seconds (accounting for cold starts)

### ✅ API Endpoints
- [ ] Authentication endpoints working
- [ ] Weather endpoints responding
- [ ] Destinations endpoints accessible
- [ ] Swagger documentation loading

### ✅ Performance
- [ ] Weather scheduler running on schedule
- [ ] No memory leaks detected
- [ ] Response times acceptable
- [ ] Error rates minimal

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check Node.js version compatibility
   - Verify all dependencies in package.json
   - Review build logs for specific errors

2. **Runtime Errors**
   - Verify all environment variables are set
   - Check database connectivity
   - Review service logs for detailed errors

3. **Health Check Failures**
   - Ensure `/api/health` endpoint is accessible
   - Verify database connection
   - Check for port binding issues

### Useful Commands

```bash
# Test build locally
npm run build

# Test production start
npm start

# Check environment variables
echo $SUPABASE_URL
echo $TOMORROW_API_KEY
```

## Monitoring and Maintenance

### Regular Checks
- [ ] Monitor service uptime
- [ ] Check memory and CPU usage
- [ ] Review error logs weekly
- [ ] Verify weather data updates

### Scaling Considerations
- Current: 1 instance (starter plan)
- Auto-scaling: 1-3 instances configured
- Upgrade plan if needed for production load

## Security Notes

- ✅ All API keys marked as secrets
- ✅ CORS properly configured
- ✅ Database RLS policies active
- ✅ Non-root user in Docker container
- ✅ Health checks don't expose sensitive data

---

**🎉 Your KashmirBNBServer is now ready for production deployment on Render.com!**
