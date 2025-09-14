# KashmirBNBServer - Render.com Deployment Guide

This guide will walk you through deploying your Kashmir Tourism Backend API to Render.com using CI/CD from your main branch.

## Prerequisites

1. **GitHub Repository**: Your code should be pushed to a GitHub repository
2. **Render Account**: Sign up at [render.com](https://render.com)
3. **Environment Variables**: Gather your API keys and database credentials
4. **Supabase Database**: Remote Supabase instance configured and running

## Required Environment Variables

Before deployment, ensure you have the following environment variables ready:

### Required Variables

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key
- `TOMORROW_API_KEY`: Your Tomorrow.io weather API key
- `MAPBOX_API_KEY`: Your Mapbox API key for geocoding

### Optional Variables

- `CORS_ORIGINS`: Comma-separated list of allowed origins (default: "*")
- `NODE_ENV`: Set to "production" (automatically set by render.yaml)
- `PORT`: Server port (automatically set by Render)

## Deployment Steps

### Step 1: Prepare Your Repository

1. **Push your code to GitHub** (if not already done):

    ```bash
    git add .
    git commit -m "Add render.yaml configuration for CI/CD deployment"
    git push origin main
    ```

2. **Verify your build works locally**:
    ```bash
    npm run build
    npm start
    ```

### Step 2: Deploy Using render.yaml (Recommended)

1. **Log in to Render Dashboard**
    - Go to [render.com](https://render.com)
    - Sign in or create an account

2. **Create New Blueprint**
    - Click "New +" → "Blueprint"
    - Connect your GitHub repository
    - Select your `KashmirBNBServer` repository
    - Render will automatically detect the `render.yaml` file

3. **Review Configuration**
    - Render will show the configuration from `render.yaml`
    - Verify the service name: `kashmir-bnb-api`
    - Confirm the build command: `npm ci && npm run build`
    - Confirm the start command: `npm start`

### Step 3: Alternative Manual Configuration

If you prefer manual configuration:

1. **Create New Web Service**
    - Click "New +" → "Web Service"
    - Connect your GitHub repository
    - Select your `KashmirBNBServer` repository

2. **Configure the Service**
    - **Name**: `kashmir-bnb-api`
    - **Region**: `us-east-1` (or closest to your users)
    - **Branch**: `main`
    - **Root Directory**: Leave empty
    - **Runtime**: `Node`
    - **Build Command**: `npm ci && npm run build`
    - **Start Command**: `npm start`
    - **Health Check Path**: `/api/health`

### Step 4: Set Environment Variables

In the Render dashboard, go to your service → Environment tab:

1. **Add Required Variables**:

    ```
    NODE_ENV = production
    SUPABASE_URL = your_supabase_url_here
    SUPABASE_SERVICE_ROLE_KEY = your_supabase_service_role_key_here
    TOMORROW_API_KEY = your_tomorrow_api_key_here
    MAPBOX_API_KEY = your_mapbox_api_key_here
    CORS_ORIGINS = https://yourdomain.com
    ```

2. **Mark as Secret**: Click the "Secret" toggle for sensitive values like API keys

### Step 5: Deploy

1. **Save Configuration**: Click "Save Changes"
2. **Deploy**: Click "Deploy" or push to your main branch
3. **Monitor**: Watch the build logs for any errors

### Step 6: Verify Deployment

1. **Check Health Endpoint**: Visit `https://your-service-name.onrender.com/api/health`
2. **Test API Endpoints**: Try your authentication and weather endpoints
3. **Check Swagger Documentation**: Visit `https://your-service-name.onrender.com/api-docs`
4. **Check Logs**: Monitor the service logs for any runtime errors

## Using render.yaml (Alternative Method)

If you prefer infrastructure-as-code, you can use the included `render.yaml` file:

1. **Ensure render.yaml is in your repository root**
2. **Create service from YAML**:
    - In Render dashboard, click "New +" → "Blueprint"
    - Connect your repository
    - Render will automatically detect and use the `render.yaml` configuration

## Post-Deployment Configuration

### 1. Custom Domain (Optional)

- Go to your service → Settings → Custom Domains
- Add your domain and configure DNS

### 2. Environment-Specific Settings

- Update `CORS_ORIGINS` with your frontend domain
- Configure any additional API keys as needed

### 3. Database Setup

- Ensure your Supabase database is properly configured
- Run any pending migrations if needed

## Troubleshooting

### Common Issues

1. **Build Failures**:
    - Check that all dependencies are in `package.json`
    - Verify TypeScript compilation works locally
    - Check build logs for specific errors

2. **Runtime Errors**:
    - Verify all environment variables are set
    - Check service logs for detailed error messages
    - Ensure database connections are working

3. **Health Check Failures**:
    - Verify the `/api/health` endpoint is accessible
    - Check that the service is binding to the correct port

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

1. **Logs**: Monitor service logs in Render dashboard
2. **Metrics**: Check CPU, memory, and response time metrics
3. **Updates**: Push to main branch for automatic deployments
4. **Scaling**: Upgrade plan if you need more resources

## Security Considerations

1. **Environment Variables**: Never commit sensitive data to Git
2. **CORS**: Restrict CORS origins to your frontend domains in production
3. **API Keys**: Rotate API keys regularly
4. **Database**: Use Supabase RLS policies for data security

## Support

- **Render Documentation**: [render.com/docs](https://render.com/docs)
- **Render Support**: Available through dashboard
- **Project Issues**: Check your repository issues

---

**Note**: This deployment uses Render's free tier initially. Consider upgrading to a paid plan for production use with better performance and reliability.
