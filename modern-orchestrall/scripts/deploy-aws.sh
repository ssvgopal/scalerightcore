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
