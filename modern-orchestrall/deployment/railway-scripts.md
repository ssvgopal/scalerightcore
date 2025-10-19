# Railway.app Deployment Package.json Scripts

## Deployment Scripts for package.json

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "deploy:integration": "bash deployment/deploy.sh integration",
    "deploy:staging": "bash deployment/deploy.sh staging", 
    "deploy:production": "bash deployment/deploy.sh production",
    "health:integration": "bash deployment/deploy.sh health integration",
    "health:staging": "bash deployment/deploy.sh health staging",
    "health:production": "bash deployment/deploy.sh health production",
    "status:integration": "bash deployment/deploy.sh status integration",
    "status:staging": "bash deployment/deploy.sh status staging",
    "status:production": "bash deployment/deploy.sh status production",
    "rollback:integration": "bash deployment/deploy.sh rollback integration",
    "rollback:staging": "bash deployment/deploy.sh rollback staging",
    "rollback:production": "bash deployment/deploy.sh rollback production"
  }
}
```

## Usage Examples

### Deploy to Integration
```bash
npm run deploy:integration
```

### Deploy to Staging
```bash
npm run deploy:staging
```

### Deploy to Production
```bash
npm run deploy:production
```

### Check Health
```bash
npm run health:integration
npm run health:staging
npm run health:production
```

### Check Status
```bash
npm run status:integration
npm run status:staging
npm run status:production
```

### Rollback Deployment
```bash
npm run rollback:integration
npm run rollback:staging
npm run rollback:production
```

## Railway CLI Commands

### Install Railway CLI
```bash
npm install -g @railway/cli
```

### Login to Railway
```bash
railway login
```

### Link Project to Environment
```bash
railway link --environment integration
railway link --environment staging
railway link --environment production
```

### Deploy to Specific Environment
```bash
railway up --environment integration
railway up --environment staging
railway up --environment production
```

### View Logs
```bash
railway logs --environment integration
railway logs --environment staging
railway logs --environment production
```

### View Status
```bash
railway status --environment integration
railway status --environment staging
railway status --environment production
```

### Rollback Deployment
```bash
railway rollback --environment integration
railway rollback --environment staging
railway rollback --environment production
```

## Environment-Specific URLs

### Integration Environment
- **URL**: https://orchestrall-integration.railway.app
- **Admin Dashboard**: https://orchestrall-integration.railway.app/admin
- **API Docs**: https://orchestrall-integration.railway.app/docs
- **Health Check**: https://orchestrall-integration.railway.app/health

### Staging Environment
- **URL**: https://orchestrall-staging.railway.app
- **Admin Dashboard**: https://orchestrall-staging.railway.app/admin
- **API Docs**: https://orchestrall-staging.railway.app/docs
- **Health Check**: https://orchestrall-staging.railway.app/health

### Production Environment
- **URL**: https://orchestrall.railway.app
- **Admin Dashboard**: https://orchestrall.railway.app/admin
- **API Docs**: https://orchestrall.railway.app/docs
- **Health Check**: https://orchestrall.railway.app/health

## Deployment Workflow

### 1. Development to Integration
```bash
# On develop branch
git push origin develop
npm run deploy:integration
npm run health:integration
```

### 2. Integration to Staging
```bash
# Merge develop to staging
git checkout staging
git merge develop
git push origin staging
npm run deploy:staging
npm run health:staging
```

### 3. Staging to Production
```bash
# Merge staging to main
git checkout main
git merge staging
git push origin main
npm run deploy:production
npm run health:production
```

## Monitoring and Alerts

### Railway Dashboard
- Monitor all environments in Railway dashboard
- View logs, metrics, and performance data
- Set up alerts for errors and performance issues

### Health Check Endpoints
- `/health` - Basic application health
- `/health/database` - Database connectivity
- `/health/redis` - Redis connectivity
- `/health/full` - Complete system health

### Custom Monitoring
- Prometheus metrics available at `/metrics`
- Custom health checks for plugins
- Performance monitoring for API endpoints
