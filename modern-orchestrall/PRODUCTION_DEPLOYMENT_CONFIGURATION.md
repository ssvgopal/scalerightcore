# Production Deployment Configuration
# Modern Orchestrall Platform - Enterprise Deployment

## Railway.app Deployment Configuration

### Railway Configuration Files

# railway.json - Railway.app configuration
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm run start:production",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 300,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}

# nixpacks.toml - Nixpacks build configuration
[phases.setup]
nixPkgs = ["nodejs", "npm", "postgresql"]

[phases.install]
cmds = [
  "npm ci --only=production",
  "npx prisma generate",
  "npx prisma migrate deploy"
]

[phases.build]
cmds = [
  "npm run build"
]

[start]
cmd = "npm run start:production"

# Railway Environment Variables Template
# Copy to Railway dashboard environment variables

# Database Configuration
DATABASE_URL=postgresql://username:password@hostname:port/database
DATABASE_POOL_SIZE=20
DATABASE_QUERY_TIMEOUT=30000

# Redis Configuration
REDIS_HOST=redis.railway.internal
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
REDIS_DB=0

# Application Configuration
NODE_ENV=production
PORT=3000
API_VERSION=v2
LOG_LEVEL=info

# Security Configuration
JWT_SECRET=your_super_secure_jwt_secret_key_here
JWT_EXPIRES_IN=24h
API_KEY_SECRET=your_api_key_secret_here
ENCRYPTION_KEY=your_encryption_key_here

# External Service APIs
OPENAI_API_KEY=your_openai_api_key
SARVAM_API_KEY=your_sarvam_api_key
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
OPENWEATHER_API_KEY=your_openweather_api_key

# Payment Gateway
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret

# SMS/Email Services
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_email_password

# Monitoring & Observability
PROMETHEUS_ENABLED=true
GRAFANA_ENABLED=true
SENTRY_DSN=your_sentry_dsn_for_error_tracking

# Backup Configuration
BACKUP_PATH=/app/backups
BACKUP_RETENTION_DAYS=30
BACKUP_COMPRESSION=true
BACKUP_ENCRYPTION=true
BACKUP_ENCRYPTION_KEY=your_backup_encryption_key

# Performance Configuration
CACHE_TTL=300
CACHE_CHECK_PERIOD=120
ENABLE_QUERY_LOGGING=false
ENABLE_SLOW_QUERY_LOGGING=true
SLOW_QUERY_THRESHOLD=1000

# Multi-tenancy Configuration
TENANT_ISOLATION_MODE=schema
DEFAULT_TENANT_TIER=starter

# Internationalization
DEFAULT_LANGUAGE=en
SUPPORTED_LANGUAGES=en,hi,te,ta

# Feature Flags
ENABLE_VOICE_INTEGRATION=true
ENABLE_MULTI_TENANCY=true
ENABLE_BACKUP_RECOVERY=true
ENABLE_PERFORMANCE_OPTIMIZATION=true
ENABLE_INTERNATIONALIZATION=true

## AWS Deployment Configuration

### AWS ECS Task Definition
{
  "family": "modern-orchestrall-platform",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "2048",
  "memory": "4096",
  "executionRoleArn": "arn:aws:iam::ACCOUNT:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::ACCOUNT:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "modern-orchestrall-app",
      "image": "ACCOUNT.dkr.ecr.REGION.amazonaws.com/modern-orchestrall:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "essential": true,
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "PORT",
          "value": "3000"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:REGION:ACCOUNT:secret:modern-orchestrall/database-url"
        },
        {
          "name": "JWT_SECRET",
          "valueFrom": "arn:aws:secretsmanager:REGION:ACCOUNT:secret:modern-orchestrall/jwt-secret"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/modern-orchestrall",
          "awslogs-region": "REGION",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}

### AWS CloudFormation Template
AWSTemplateFormatVersion: '2010-09-09'
Description: 'Modern Orchestrall Platform - Production Infrastructure'

Parameters:
  Environment:
    Type: String
    Default: production
    AllowedValues: [staging, production]
  
  VpcCIDR:
    Type: String
    Default: 10.0.0.0/16
  
  PublicSubnetCIDR:
    Type: String
    Default: 10.0.1.0/24
  
  PrivateSubnetCIDR:
    Type: String
    Default: 10.0.2.0/24

Resources:
  # VPC and Networking
  VPC:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: !Ref VpcCIDR
      EnableDnsHostnames: true
      EnableDnsSupport: true
      Tags:
        - Key: Name
          Value: !Sub '${AWS::StackName}-vpc'

  PublicSubnet:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: !Ref PublicSubnetCIDR
      AvailabilityZone: !Select [0, !GetAZs '']
      MapPublicIpOnLaunch: true
      Tags:
        - Key: Name
          Value: !Sub '${AWS::StackName}-public-subnet'

  PrivateSubnet:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: !Ref PrivateSubnetCIDR
      AvailabilityZone: !Select [1, !GetAZs '']
      Tags:
        - Key: Name
          Value: !Sub '${AWS::StackName}-private-subnet'

  InternetGateway:
    Type: AWS::EC2::InternetGateway
    Properties:
      Tags:
        - Key: Name
          Value: !Sub '${AWS::StackName}-igw'

  InternetGatewayAttachment:
    Type: AWS::EC2::VPCGatewayAttachment
    Properties:
      InternetGatewayId: !Ref InternetGateway
      VpcId: !Ref VPC

  PublicRouteTable:
    Type: AWS::EC2::RouteTable
    Properties:
      VpcId: !Ref VPC
      Tags:
        - Key: Name
          Value: !Sub '${AWS::StackName}-public-routes'

  DefaultPublicRoute:
    Type: AWS::EC2::Route
    DependsOn: InternetGatewayAttachment
    Properties:
      RouteTableId: !Ref PublicRouteTable
      DestinationCidrBlock: 0.0.0.0/0
      GatewayId: !Ref InternetGateway

  PublicSubnetRouteTableAssociation:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      RouteTableId: !Ref PublicRouteTable
      SubnetId: !Ref PublicSubnet

  # Security Groups
  WebSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupName: !Sub '${AWS::StackName}-web-sg'
      GroupDescription: Security group for web servers
      VpcId: !Ref VPC
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 80
          ToPort: 80
          CidrIp: 0.0.0.0/0
        - IpProtocol: tcp
          FromPort: 443
          ToPort: 443
          CidrIp: 0.0.0.0/0
        - IpProtocol: tcp
          FromPort: 3000
          ToPort: 3000
          CidrIp: 0.0.0.0/0
      Tags:
        - Key: Name
          Value: !Sub '${AWS::StackName}-web-sg'

  DatabaseSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupName: !Sub '${AWS::StackName}-db-sg'
      GroupDescription: Security group for database
      VpcId: !Ref VPC
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 5432
          ToPort: 5432
          SourceSecurityGroupId: !Ref WebSecurityGroup
      Tags:
        - Key: Name
          Value: !Sub '${AWS::StackName}-db-sg'

  # RDS Database
  DatabaseSubnetGroup:
    Type: AWS::RDS::DBSubnetGroup
    Properties:
      DBSubnetGroupDescription: Subnet group for RDS database
      SubnetIds:
        - !Ref PrivateSubnet
        - !Ref PublicSubnet
      Tags:
        - Key: Name
          Value: !Sub '${AWS::StackName}-db-subnet-group'

  Database:
    Type: AWS::RDS::DBInstance
    Properties:
      DBInstanceIdentifier: !Sub '${AWS::StackName}-database'
      DBName: orchestrall
      DBInstanceClass: db.t3.medium
      Engine: postgres
      EngineVersion: '15.4'
      MasterUsername: postgres
      MasterUserPassword: !Ref DatabasePassword
      AllocatedStorage: 100
      StorageType: gp2
      VPCSecurityGroups:
        - !Ref DatabaseSecurityGroup
      DBSubnetGroupName: !Ref DatabaseSubnetGroup
      BackupRetentionPeriod: 7
      MultiAZ: true
      StorageEncrypted: true
      DeletionProtection: true
      Tags:
        - Key: Name
          Value: !Sub '${AWS::StackName}-database'

  # ElastiCache Redis
  RedisSubnetGroup:
    Type: AWS::ElastiCache::SubnetGroup
    Properties:
      Description: Subnet group for Redis
      SubnetIds:
        - !Ref PrivateSubnet
        - !Ref PublicSubnet

  RedisSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: Security group for Redis
      VpcId: !Ref VPC
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 6379
          ToPort: 6379
          SourceSecurityGroupId: !Ref WebSecurityGroup

  RedisCluster:
    Type: AWS::ElastiCache::ReplicationGroup
    Properties:
      ReplicationGroupId: !Sub '${AWS::StackName}-redis'
      Description: Redis cluster for caching
      NodeType: cache.t3.micro
      Port: 6379
      NumCacheClusters: 2
      Engine: redis
      EngineVersion: '7.0'
      CacheSubnetGroupName: !Ref RedisSubnetGroup
      SecurityGroupIds:
        - !Ref RedisSecurityGroup
      AtRestEncryptionEnabled: true
      TransitEncryptionEnabled: true

  # Application Load Balancer
  ApplicationLoadBalancer:
    Type: AWS::ElasticLoadBalancingV2::LoadBalancer
    Properties:
      Name: !Sub '${AWS::StackName}-alb'
      Scheme: internet-facing
      Type: application
      Subnets:
        - !Ref PublicSubnet
      SecurityGroups:
        - !Ref WebSecurityGroup
      Tags:
        - Key: Name
          Value: !Sub '${AWS::StackName}-alb'

  ALBTargetGroup:
    Type: AWS::ElasticLoadBalancingV2::TargetGroup
    Properties:
      Name: !Sub '${AWS::StackName}-tg'
      Port: 3000
      Protocol: HTTP
      VpcId: !Ref VPC
      HealthCheckPath: /health
      HealthCheckIntervalSeconds: 30
      HealthCheckTimeoutSeconds: 5
      HealthyThresholdCount: 2
      UnhealthyThresholdCount: 3
      TargetType: ip

  ALBListener:
    Type: AWS::ElasticLoadBalancingV2::Listener
    Properties:
      DefaultActions:
        - Type: forward
          TargetGroupArn: !Ref ALBTargetGroup
      LoadBalancerArn: !Ref ApplicationLoadBalancer
      Port: 80
      Protocol: HTTP

  # ECS Cluster
  ECSCluster:
    Type: AWS::ECS::Cluster
    Properties:
      ClusterName: !Sub '${AWS::StackName}-cluster'
      CapacityProviders:
        - FARGATE
      DefaultCapacityProviderStrategy:
        - CapacityProvider: FARGATE
          Weight: 1

  ECSService:
    Type: AWS::ECS::Service
    Properties:
      ServiceName: !Sub '${AWS::StackName}-service'
      Cluster: !Ref ECSCluster
      TaskDefinition: !Ref TaskDefinition
      DesiredCount: 2
      LaunchType: FARGATE
      NetworkConfiguration:
        AwsvpcConfiguration:
          SecurityGroups:
            - !Ref WebSecurityGroup
          Subnets:
            - !Ref PrivateSubnet
          AssignPublicIp: DISABLED
      LoadBalancers:
        - ContainerName: modern-orchestrall-app
          ContainerPort: 3000
          TargetGroupArn: !Ref ALBTargetGroup

  # CloudWatch Logs
  LogGroup:
    Type: AWS::Logs::LogGroup
    Properties:
      LogGroupName: !Sub '/ecs/${AWS::StackName}'
      RetentionInDays: 30

  # Secrets Manager
  DatabasePassword:
    Type: AWS::SecretsManager::Secret
    Properties:
      Name: !Sub '${AWS::StackName}/database-password'
      Description: Database password
      GenerateSecretString:
        SecretStringTemplate: '{"username":"postgres"}'
        GenerateStringKey: 'password'
        PasswordLength: 32
        ExcludeCharacters: '"@/\'

  JWTSecret:
    Type: AWS::SecretsManager::Secret
    Properties:
      Name: !Sub '${AWS::StackName}/jwt-secret'
      Description: JWT secret key
      GenerateSecretString:
        PasswordLength: 64
        ExcludeCharacters: '"@/\'

Outputs:
  LoadBalancerDNS:
    Description: DNS name of the load balancer
    Value: !GetAtt ApplicationLoadBalancer.DNSName
    Export:
      Name: !Sub '${AWS::StackName}-LoadBalancerDNS'

  DatabaseEndpoint:
    Description: RDS instance endpoint
    Value: !GetAtt Database.Endpoint.Address
    Export:
      Name: !Sub '${AWS::StackName}-DatabaseEndpoint'

  RedisEndpoint:
    Description: Redis cluster endpoint
    Value: !GetAtt RedisCluster.RedisEndpoint.Address
    Export:
      Name: !Sub '${AWS::StackName}-RedisEndpoint'

## Docker Production Configuration

# Dockerfile.production - Production Docker image
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci --only=production && npm cache clean --force

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Production image, copy all the files and run the app
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 orchestrall

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma

USER orchestrall

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]

# docker-compose.production.yml - Production Docker Compose
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.production
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@db:5432/orchestrall
      - REDIS_HOST=redis
      - REDIS_PORT=6379
    depends_on:
      - db
      - redis
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=orchestrall
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    ports:
      - "5432:5432"
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --requirepass password
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:

# nginx.conf - Nginx reverse proxy configuration
events {
    worker_connections 1024;
}

http {
    upstream app {
        server app:3000;
    }

    server {
        listen 80;
        server_name _;
        return 301 https://$host$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name _;

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers off;

        location / {
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }

        location /health {
            proxy_pass http://app;
            access_log off;
        }

        location /metrics {
            proxy_pass http://app;
            allow 10.0.0.0/8;
            allow 172.16.0.0/12;
            allow 192.168.0.0/16;
            deny all;
        }
    }
}

## Deployment Scripts

# deploy-railway.sh - Railway deployment script
#!/bin/bash

echo "🚀 Deploying Modern Orchestrall Platform to Railway.app"

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Please install it first:"
    echo "npm install -g @railway/cli"
    exit 1
fi

# Login to Railway
echo "🔐 Logging into Railway..."
railway login

# Create new project or link to existing
echo "📦 Setting up Railway project..."
railway link

# Set environment variables
echo "🔧 Setting environment variables..."
railway variables set NODE_ENV=production
railway variables set PORT=3000
railway variables set API_VERSION=v2
railway variables set LOG_LEVEL=info

# Database variables
railway variables set DATABASE_URL=$DATABASE_URL
railway variables set DATABASE_POOL_SIZE=20
railway variables set DATABASE_QUERY_TIMEOUT=30000

# Redis variables
railway variables set REDIS_HOST=$REDIS_HOST
railway variables set REDIS_PORT=$REDIS_PORT
railway variables set REDIS_PASSWORD=$REDIS_PASSWORD

# Security variables
railway variables set JWT_SECRET=$JWT_SECRET
railway variables set API_KEY_SECRET=$API_KEY_SECRET
railway variables set ENCRYPTION_KEY=$ENCRYPTION_KEY

# External API keys
railway variables set OPENAI_API_KEY=$OPENAI_API_KEY
railway variables set SARVAM_API_KEY=$SARVAM_API_KEY
railway variables set GOOGLE_MAPS_API_KEY=$GOOGLE_MAPS_API_KEY
railway variables set OPENWEATHER_API_KEY=$OPENWEATHER_API_KEY

# Payment gateway
railway variables set RAZORPAY_KEY_ID=$RAZORPAY_KEY_ID
railway variables set RAZORPAY_KEY_SECRET=$RAZORPAY_KEY_SECRET

# SMS/Email services
railway variables set TWILIO_ACCOUNT_SID=$TWILIO_ACCOUNT_SID
railway variables set TWILIO_AUTH_TOKEN=$TWILIO_AUTH_TOKEN
railway variables set TWILIO_PHONE_NUMBER=$TWILIO_PHONE_NUMBER

railway variables set SMTP_HOST=$SMTP_HOST
railway variables set SMTP_PORT=$SMTP_PORT
railway variables set SMTP_USER=$SMTP_USER
railway variables set SMTP_PASS=$SMTP_PASS

# Monitoring
railway variables set PROMETHEUS_ENABLED=true
railway variables set GRAFANA_ENABLED=true
railway variables set SENTRY_DSN=$SENTRY_DSN

# Backup configuration
railway variables set BACKUP_PATH=/app/backups
railway variables set BACKUP_RETENTION_DAYS=30
railway variables set BACKUP_COMPRESSION=true
railway variables set BACKUP_ENCRYPTION=true
railway variables set BACKUP_ENCRYPTION_KEY=$BACKUP_ENCRYPTION_KEY

# Performance configuration
railway variables set CACHE_TTL=300
railway variables set CACHE_CHECK_PERIOD=120
railway variables set ENABLE_QUERY_LOGGING=false
railway variables set ENABLE_SLOW_QUERY_LOGGING=true
railway variables set SLOW_QUERY_THRESHOLD=1000

# Multi-tenancy
railway variables set TENANT_ISOLATION_MODE=schema
railway variables set DEFAULT_TENANT_TIER=starter

# Internationalization
railway variables set DEFAULT_LANGUAGE=en
railway variables set SUPPORTED_LANGUAGES=en,hi,te,ta

# Feature flags
railway variables set ENABLE_VOICE_INTEGRATION=true
railway variables set ENABLE_MULTI_TENANCY=true
railway variables set ENABLE_BACKUP_RECOVERY=true
railway variables set ENABLE_PERFORMANCE_OPTIMIZATION=true
railway variables set ENABLE_INTERNATIONALIZATION=true

# Deploy the application
echo "🚀 Deploying application..."
railway up

echo "✅ Deployment completed!"
echo "🌐 Your application is now live at:"
railway domain

# deploy-aws.sh - AWS deployment script
#!/bin/bash

echo "🚀 Deploying Modern Orchestrall Platform to AWS"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Please install it first:"
    echo "https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install it first:"
    echo "https://docs.docker.com/get-docker/"
    exit 1
fi

# Set variables
AWS_REGION=${AWS_REGION:-us-east-1}
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPOSITORY="modern-orchestrall"
ECS_CLUSTER="modern-orchestrall-cluster"
ECS_SERVICE="modern-orchestrall-service"

echo "🏗️ Building Docker image..."
docker build -f Dockerfile.production -t $ECR_REPOSITORY:latest .

echo "🏷️ Tagging image for ECR..."
docker tag $ECR_REPOSITORY:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:latest

echo "🔐 Logging into ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

echo "📦 Creating ECR repository if it doesn't exist..."
aws ecr describe-repositories --repository-names $ECR_REPOSITORY --region $AWS_REGION || \
aws ecr create-repository --repository-name $ECR_REPOSITORY --region $AWS_REGION

echo "⬆️ Pushing image to ECR..."
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:latest

echo "☁️ Deploying CloudFormation stack..."
aws cloudformation deploy \
    --template-file cloudformation.yml \
    --stack-name modern-orchestrall-production \
    --parameter-overrides \
        Environment=production \
        VpcCIDR=10.0.0.0/16 \
        PublicSubnetCIDR=10.0.1.0/24 \
        PrivateSubnetCIDR=10.0.2.0/24 \
    --capabilities CAPABILITY_IAM \
    --region $AWS_REGION

echo "🔄 Updating ECS service..."
aws ecs update-service \
    --cluster $ECS_CLUSTER \
    --service $ECS_SERVICE \
    --force-new-deployment \
    --region $AWS_REGION

echo "✅ Deployment completed!"
echo "🌐 Your application is now live at:"
aws cloudformation describe-stacks \
    --stack-name modern-orchestrall-production \
    --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' \
    --output text \
    --region $AWS_REGION

## Health Check and Monitoring

# health-check.sh - Production health check script
#!/bin/bash

echo "🏥 Running production health checks..."

# Get the application URL
APP_URL=${APP_URL:-"https://your-app-domain.com"}

# Check basic health endpoint
echo "🔍 Checking basic health..."
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $APP_URL/health)
if [ $HEALTH_RESPONSE -eq 200 ]; then
    echo "✅ Basic health check passed"
else
    echo "❌ Basic health check failed (HTTP $HEALTH_RESPONSE)"
    exit 1
fi

# Check database health
echo "🔍 Checking database health..."
DB_HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $APP_URL/health/database)
if [ $DB_HEALTH_RESPONSE -eq 200 ]; then
    echo "✅ Database health check passed"
else
    echo "❌ Database health check failed (HTTP $DB_HEALTH_RESPONSE)"
    exit 1
fi

# Check Redis health
echo "🔍 Checking Redis health..."
REDIS_HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $APP_URL/health/redis)
if [ $REDIS_HEALTH_RESPONSE -eq 200 ]; then
    echo "✅ Redis health check passed"
else
    echo "❌ Redis health check failed (HTTP $REDIS_HEALTH_RESPONSE)"
    exit 1
fi

# Check API endpoints
echo "🔍 Checking API endpoints..."
API_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $APP_URL/api/health)
if [ $API_RESPONSE -eq 200 ]; then
    echo "✅ API health check passed"
else
    echo "❌ API health check failed (HTTP $API_RESPONSE)"
    exit 1
fi

# Check metrics endpoint
echo "🔍 Checking metrics endpoint..."
METRICS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $APP_URL/metrics)
if [ $METRICS_RESPONSE -eq 200 ]; then
    echo "✅ Metrics endpoint check passed"
else
    echo "❌ Metrics endpoint check failed (HTTP $METRICS_RESPONSE)"
    exit 1
fi

echo "🎉 All health checks passed! Application is healthy."

## Production Package.json Scripts

# Add these scripts to package.json
{
  "scripts": {
    "start:production": "node src/app-zero-config.js",
    "build": "npm run build:prisma && npm run build:app",
    "build:prisma": "npx prisma generate",
    "build:app": "echo 'App build completed'",
    "deploy:railway": "bash scripts/deploy-railway.sh",
    "deploy:aws": "bash scripts/deploy-aws.sh",
    "health:check": "bash scripts/health-check.sh",
    "migrate:production": "npx prisma migrate deploy",
    "seed:production": "npx prisma db seed"
  }
}

## Environment-specific Configuration

# config/production.js - Production configuration
module.exports = {
  app: {
    name: 'Modern Orchestrall Platform',
    version: '2.0.0',
    environment: 'production',
    port: process.env.PORT || 3000,
    host: '0.0.0.0'
  },
  
  database: {
    url: process.env.DATABASE_URL,
    poolSize: parseInt(process.env.DATABASE_POOL_SIZE) || 20,
    queryTimeout: parseInt(process.env.DATABASE_QUERY_TIMEOUT) || 30000,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB) || 0,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3
  },
  
  security: {
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    apiKeySecret: process.env.API_KEY_SECRET,
    encryptionKey: process.env.ENCRYPTION_KEY,
    bcryptRounds: 12
  },
  
  external: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY
    },
    sarvam: {
      apiKey: process.env.SARVAM_API_KEY
    },
    googleMaps: {
      apiKey: process.env.GOOGLE_MAPS_API_KEY
    },
    openWeather: {
      apiKey: process.env.OPENWEATHER_API_KEY
    }
  },
  
  payments: {
    razorpay: {
      keyId: process.env.RAZORPAY_KEY_ID,
      keySecret: process.env.RAZORPAY_KEY_SECRET
    }
  },
  
  notifications: {
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      phoneNumber: process.env.TWILIO_PHONE_NUMBER
    },
    smtp: {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  },
  
  monitoring: {
    prometheus: {
      enabled: process.env.PROMETHEUS_ENABLED === 'true',
      port: 9090
    },
    grafana: {
      enabled: process.env.GRAFANA_ENABLED === 'true',
      port: 3001
    },
    sentry: {
      dsn: process.env.SENTRY_DSN
    }
  },
  
  backup: {
    path: process.env.BACKUP_PATH || './backups',
    retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS) || 30,
    compression: process.env.BACKUP_COMPRESSION === 'true',
    encryption: process.env.BACKUP_ENCRYPTION === 'true',
    encryptionKey: process.env.BACKUP_ENCRYPTION_KEY
  },
  
  performance: {
    cacheTTL: parseInt(process.env.CACHE_TTL) || 300,
    cacheCheckPeriod: parseInt(process.env.CACHE_CHECK_PERIOD) || 120,
    enableQueryLogging: process.env.ENABLE_QUERY_LOGGING === 'true',
    enableSlowQueryLogging: process.env.ENABLE_SLOW_QUERY_LOGGING === 'true',
    slowQueryThreshold: parseInt(process.env.SLOW_QUERY_THRESHOLD) || 1000
  },
  
  multitenancy: {
    isolationMode: process.env.TENANT_ISOLATION_MODE || 'schema',
    defaultTier: process.env.DEFAULT_TENANT_TIER || 'starter'
  },
  
  i18n: {
    defaultLanguage: process.env.DEFAULT_LANGUAGE || 'en',
    supportedLanguages: (process.env.SUPPORTED_LANGUAGES || 'en,hi,te,ta').split(',')
  },
  
  features: {
    voiceIntegration: process.env.ENABLE_VOICE_INTEGRATION === 'true',
    multiTenancy: process.env.ENABLE_MULTI_TENANCY === 'true',
    backupRecovery: process.env.ENABLE_BACKUP_RECOVERY === 'true',
    performanceOptimization: process.env.ENABLE_PERFORMANCE_OPTIMIZATION === 'true',
    internationalization: process.env.ENABLE_INTERNATIONALIZATION === 'true'
  }
};
