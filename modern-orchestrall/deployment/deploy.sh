#!/bin/bash

# Railway.app Deployment Scripts for Orchestrall Platform
# Supports integration, staging, and production environments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if Railway CLI is installed
check_railway_cli() {
    if ! command -v railway &> /dev/null; then
        print_error "Railway CLI is not installed. Please install it first:"
        echo "npm install -g @railway/cli"
        exit 1
    fi
    print_success "Railway CLI is installed"
}

# Function to check if user is logged in
check_railway_auth() {
    if ! railway whoami &> /dev/null; then
        print_error "Not logged in to Railway. Please login first:"
        echo "railway login"
        exit 1
    fi
    print_success "Logged in to Railway as $(railway whoami)"
}

# Function to deploy to integration environment
deploy_integration() {
    print_status "Deploying to Integration Environment..."
    
    # Check if we're on the develop branch
    current_branch=$(git branch --show-current)
    if [ "$current_branch" != "develop" ]; then
        print_warning "Not on develop branch. Current branch: $current_branch"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_error "Deployment cancelled"
            exit 1
        fi
    fi
    
    # Link to integration environment
    railway link --environment integration
    
    # Deploy
    railway up --environment integration
    
    print_success "Integration deployment completed!"
    print_status "Integration URL: https://orchestrall-integration.railway.app"
}

# Function to deploy to staging environment
deploy_staging() {
    print_status "Deploying to Staging Environment..."
    
    # Check if we're on the staging branch
    current_branch=$(git branch --show-current)
    if [ "$current_branch" != "staging" ]; then
        print_warning "Not on staging branch. Current branch: $current_branch"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_error "Deployment cancelled"
            exit 1
        fi
    fi
    
    # Link to staging environment
    railway link --environment staging
    
    # Deploy
    railway up --environment staging
    
    print_success "Staging deployment completed!"
    print_status "Staging URL: https://orchestrall-staging.railway.app"
}

# Function to deploy to production environment
deploy_production() {
    print_status "Deploying to Production Environment..."
    
    # Check if we're on the main branch
    current_branch=$(git branch --show-current)
    if [ "$current_branch" != "main" ]; then
        print_error "Production deployment must be from main branch. Current branch: $current_branch"
        exit 1
    fi
    
    # Confirm production deployment
    print_warning "You are about to deploy to PRODUCTION!"
    read -p "Are you sure? Type 'yes' to confirm: " confirmation
    if [ "$confirmation" != "yes" ]; then
        print_error "Production deployment cancelled"
        exit 1
    fi
    
    # Link to production environment
    railway link --environment production
    
    # Deploy
    railway up --environment production
    
    print_success "Production deployment completed!"
    print_status "Production URL: https://orchestrall.railway.app"
}

# Function to run health checks
run_health_checks() {
    local environment=$1
    local base_url=""
    
    case $environment in
        "integration")
            base_url="https://orchestrall-integration.railway.app"
            ;;
        "staging")
            base_url="https://orchestrall-staging.railway.app"
            ;;
        "production")
            base_url="https://orchestrall.railway.app"
            ;;
        *)
            print_error "Invalid environment: $environment"
            exit 1
            ;;
    esac
    
    print_status "Running health checks for $environment environment..."
    
    # Basic health check
    print_status "Checking basic health..."
    if curl -f -s "$base_url/health" > /dev/null; then
        print_success "Basic health check passed"
    else
        print_error "Basic health check failed"
        return 1
    fi
    
    # Database health check
    print_status "Checking database health..."
    if curl -f -s "$base_url/health/database" > /dev/null; then
        print_success "Database health check passed"
    else
        print_error "Database health check failed"
        return 1
    fi
    
    # Redis health check
    print_status "Checking Redis health..."
    if curl -f -s "$base_url/health/redis" > /dev/null; then
        print_success "Redis health check passed"
    else
        print_error "Redis health check failed"
        return 1
    fi
    
    # Full system health check
    print_status "Checking full system health..."
    if curl -f -s "$base_url/health/full" > /dev/null; then
        print_success "Full system health check passed"
    else
        print_error "Full system health check failed"
        return 1
    fi
    
    print_success "All health checks passed for $environment environment!"
}

# Function to show deployment status
show_status() {
    local environment=$1
    
    print_status "Deployment status for $environment environment:"
    
    railway status --environment $environment
    
    print_status "Recent deployments:"
    railway logs --environment $environment --tail 10
}

# Function to rollback deployment
rollback() {
    local environment=$1
    
    print_warning "Rolling back $environment environment..."
    
    railway rollback --environment $environment
    
    print_success "Rollback completed for $environment environment"
}

# Main script logic
case "$1" in
    "integration")
        check_railway_cli
        check_railway_auth
        deploy_integration
        run_health_checks "integration"
        ;;
    "staging")
        check_railway_cli
        check_railway_auth
        deploy_staging
        run_health_checks "staging"
        ;;
    "production")
        check_railway_cli
        check_railway_auth
        deploy_production
        run_health_checks "production"
        ;;
    "health")
        if [ -z "$2" ]; then
            print_error "Please specify environment: integration, staging, or production"
            exit 1
        fi
        run_health_checks "$2"
        ;;
    "status")
        if [ -z "$2" ]; then
            print_error "Please specify environment: integration, staging, or production"
            exit 1
        fi
        show_status "$2"
        ;;
    "rollback")
        if [ -z "$2" ]; then
            print_error "Please specify environment: integration, staging, or production"
            exit 1
        fi
        rollback "$2"
        ;;
    *)
        echo "Usage: $0 {integration|staging|production|health|status|rollback} [environment]"
        echo ""
        echo "Commands:"
        echo "  integration  - Deploy to integration environment"
        echo "  staging      - Deploy to staging environment"
        echo "  production   - Deploy to production environment"
        echo "  health       - Run health checks for specified environment"
        echo "  status       - Show deployment status for specified environment"
        echo "  rollback     - Rollback deployment for specified environment"
        echo ""
        echo "Examples:"
        echo "  $0 integration"
        echo "  $0 staging"
        echo "  $0 production"
        echo "  $0 health integration"
        echo "  $0 status staging"
        echo "  $0 rollback production"
        exit 1
        ;;
esac
