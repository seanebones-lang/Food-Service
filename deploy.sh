#!/bin/bash

# Restaurant POS Deployment Script
# This script handles the complete deployment process

set -e

echo "🚀 Starting Restaurant POS Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_dependencies() {
    print_status "Checking dependencies..."
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 22+"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        print_warning "Docker is not installed. Docker deployment will be skipped."
        DOCKER_AVAILABLE=false
    else
        DOCKER_AVAILABLE=true
    fi
    
    print_status "Dependencies check completed"
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    # Frontend dependencies
    npm install
    
    # Backend dependencies
    cd backend
    npm install
    cd ..
    
    print_status "Dependencies installed successfully"
}

# Setup environment
setup_environment() {
    print_status "Setting up environment..."
    
    # Copy environment files if they don't exist
    if [ ! -f backend/.env ]; then
        cp backend/.env.example backend/.env
        print_warning "Please update backend/.env with your API keys"
    fi
    
    if [ ! -f .env.local ]; then
        cp .env.local.example .env.local
        print_warning "Please update .env.local with your frontend configuration"
    fi
    
    print_status "Environment setup completed"
}

# Setup database
setup_database() {
    print_status "Setting up database..."
    
    cd backend
    
    # Generate Prisma client
    npm run db:generate
    
    # Check if database exists, create if not
    if ! npm run db:push -- --accept-data-loss; then
        print_error "Failed to setup database. Please check your DATABASE_URL"
        exit 1
    fi
    
    # Seed database
    npm run db:seed
    
    cd ..
    
    print_status "Database setup completed"
}

# Build applications
build_applications() {
    print_status "Building applications..."
    
    # Build backend
    cd backend
    npm run build
    cd ..
    
    # Build frontend
    npm run build
    
    print_status "Applications built successfully"
}

# Run tests
run_tests() {
    print_status "Running tests..."
    
    # Backend tests
    cd backend
    npm test
    cd ..
    
    # Frontend tests
    npm test
    
    print_status "All tests passed"
}

# Docker deployment
docker_deploy() {
    if [ "$DOCKER_AVAILABLE" = true ]; then
        print_status "Deploying with Docker..."
        
        # Build and start services
        docker-compose up -d --build
        
        # Wait for services to be ready
        sleep 10
        
        # Check health
        if curl -f http://localhost:3001/health > /dev/null 2>&1; then
            print_status "Backend is healthy"
        else
            print_error "Backend health check failed"
            exit 1
        fi
        
        if curl -f http://localhost:3000 > /dev/null 2>&1; then
            print_status "Frontend is accessible"
        else
            print_error "Frontend is not accessible"
            exit 1
        fi
        
        print_status "Docker deployment completed"
    else
        print_warning "Skipping Docker deployment"
    fi
}

# Production deployment
production_deploy() {
    print_status "Starting production deployment..."
    
    # Check if Vercel CLI is installed
    if command -v vercel &> /dev/null; then
        print_status "Deploying frontend to Vercel..."
        vercel --prod
    else
        print_warning "Vercel CLI not found. Please install it with: npm i -g vercel"
    fi
    
    print_status "Production deployment completed"
}

# Main deployment function
main() {
    echo "🎯 Restaurant POS System Deployment"
    echo "=================================="
    
    # Parse command line arguments
    DEPLOYMENT_TYPE=${1:-development}
    
    case $DEPLOYMENT_TYPE in
        "development")
            print_status "Starting development deployment..."
            check_dependencies
            install_dependencies
            setup_environment
            setup_database
            run_tests
            print_status "Development setup completed!"
            print_status "Run 'npm run dev' to start development servers"
            ;;
        "docker")
            print_status "Starting Docker deployment..."
            check_dependencies
            install_dependencies
            setup_environment
            setup_database
            run_tests
            docker_deploy
            print_status "Docker deployment completed!"
            ;;
        "production")
            print_status "Starting production deployment..."
            check_dependencies
            install_dependencies
            setup_environment
            setup_database
            run_tests
            build_applications
            production_deploy
            print_status "Production deployment completed!"
            ;;
        *)
            print_error "Invalid deployment type. Use: development, docker, or production"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
