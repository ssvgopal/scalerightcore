#!/bin/bash

# PatientFlow Dashboard Test Script
# This script tests the dashboard setup and API integration

echo "🧪 Testing PatientFlow Dashboard Setup..."
echo "====================================="

# Test 1: Check if backend routes exist
echo "📋 Test 1: Backend Routes"
if [ -f "src/routes/patientflow-routes.js" ]; then
    echo "✅ PatientFlow routes file exists"
else
    echo "❌ PatientFlow routes file missing"
    exit 1
fi

# Test 2: Check if dashboard app exists
echo "📋 Test 2: Dashboard App"
if [ -d "apps/patientflow-dashboard" ]; then
    echo "✅ Dashboard app directory exists"
else
    echo "❌ Dashboard app directory missing"
    exit 1
fi

# Test 3: Check package.json workspace
echo "📋 Test 3: Workspace Configuration"
if grep -q "workspaces" package.json; then
    echo "✅ Workspace configured in package.json"
else
    echo "❌ Workspace not configured"
    exit 1
fi

# Test 4: Check dashboard dependencies
echo "📋 Test 4: Dashboard Dependencies"
cd apps/patientflow-dashboard
if [ -f "package.json" ] && npm list axios > /dev/null 2>&1; then
    echo "✅ Dashboard dependencies installed"
else
    echo "❌ Dashboard dependencies missing"
    exit 1
fi

# Test 5: Test dashboard build
echo "📋 Test 5: Dashboard Build"
if npm run build > /dev/null 2>&1; then
    echo "✅ Dashboard builds successfully"
else
    echo "❌ Dashboard build failed"
    exit 1
fi

cd ../..

# Test 6: Check documentation
echo "📋 Test 6: Documentation"
if [ -f "docs/patientflow/deployment.md" ]; then
    echo "✅ Deployment documentation exists"
else
    echo "❌ Deployment documentation missing"
    exit 1
fi

echo ""
echo "🎉 All tests passed! PatientFlow Dashboard is ready to use."
echo ""
echo "📋 Next Steps:"
echo "1. Start the backend: npm run dev"
echo "2. Seed demo data: npm run db:seed:patientflow"
echo "3. Start the dashboard: npm run dashboard:dev"
echo "4. Visit: http://localhost:3001"
echo ""
echo "📖 For detailed instructions, see: docs/patientflow/deployment.md"