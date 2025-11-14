#!/bin/bash

# Quick PatientFlow PR Migration Script
# Interactive migration to medicalAIDemo repository

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  PatientFlow PR Quick Migration${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Step 1: Get target directory
echo -e "${YELLOW}Step 1: Target Directory${NC}"
read -p "Enter the path to medicalAIDemo repository: " TARGET_DIR

if [ ! -d "$TARGET_DIR" ]; then
    echo -e "${RED}Error: Directory not found: $TARGET_DIR${NC}"
    exit 1
fi

if [ ! -d "$TARGET_DIR/.git" ]; then
    echo -e "${RED}Error: Not a git repository: $TARGET_DIR${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Repository found${NC}"
echo ""

# Step 2: Method selection
echo -e "${YELLOW}Step 2: Choose Migration Method${NC}"
echo "1) Python Script (Recommended - most reliable)"
echo "2) Manual File Copy (Most control)"
echo "3) Git Patches (Clean history)"
read -p "Select method (1-3): " METHOD

case $METHOD in
    1)
        METHOD_NAME="Python Script"
        ;;
    2)
        METHOD_NAME="Manual File Copy"
        ;;
    3)
        METHOD_NAME="Git Patches"
        ;;
    *)
        echo -e "${RED}Invalid selection${NC}"
        exit 1
        ;;
esac

echo -e "${GREEN}✓ Selected: $METHOD_NAME${NC}"
echo ""

SOURCE_DIR="/home/engine/project"

# Create branch
echo -e "${YELLOW}Step 3: Create Git Branch${NC}"
cd "$TARGET_DIR"

BRANCH_NAME="feat/patientflow-services-routes-validation-booking"

if git rev-parse --verify $BRANCH_NAME 2>/dev/null; then
    echo -e "${YELLOW}Branch already exists${NC}"
    read -p "Switch to existing branch? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git checkout $BRANCH_NAME
    fi
else
    git checkout -b $BRANCH_NAME
    echo -e "${GREEN}✓ Branch created: $BRANCH_NAME${NC}"
fi

echo ""

# Execute migration based on method
case $METHOD in
    1)
        # Python method
        echo -e "${YELLOW}Step 4: Running Python Migration${NC}"
        python3 "$SOURCE_DIR/migrate_patientflow_pr.py" \
            --source "$SOURCE_DIR" \
            --target "$TARGET_DIR"
        ;;
    2)
        # Manual method
        echo -e "${YELLOW}Step 4: Manual File Copy${NC}"
        
        echo "Creating directories..."
        mkdir -p "$TARGET_DIR/modern-orchestrall/src/patientflow/"{services,validation}
        mkdir -p "$TARGET_DIR/modern-orchestrall/tests/unit"
        echo -e "${GREEN}✓ Directories created${NC}"
        
        echo "Copying PatientFlow files..."
        cp -r "$SOURCE_DIR/modern-orchestrall/src/patientflow"/* \
            "$TARGET_DIR/modern-orchestrall/src/patientflow/"
        echo -e "${GREEN}✓ PatientFlow module copied${NC}"
        
        echo "Copying test files..."
        cp "$SOURCE_DIR/modern-orchestrall/tests/unit/patientflow-"*.test.js \
           "$TARGET_DIR/modern-orchestrall/tests/unit/"
        echo -e "${GREEN}✓ Test files copied${NC}"
        
        echo "Updating seed.js..."
        cp "$SOURCE_DIR/modern-orchestrall/prisma/seed.js" \
           "$TARGET_DIR/modern-orchestrall/prisma/seed.js"
        echo -e "${GREEN}✓ Seed file updated${NC}"
        
        echo -e "${YELLOW}Manual steps required:${NC}"
        echo "1. Update package.json manually:"
        echo "   - Change \"db:seed\": \"node src/seed.js\" to \"npx prisma db seed\""
        echo "   - Add: \"prisma\": { \"seed\": \"node prisma/seed.js\" }"
        echo ""
        echo "2. Update src/app-commercial.js:"
        echo "   After the universal CRUD routes registration, add:"
        echo "   const patientFlowRoutes = require('./patientflow/routes');"
        echo "   app.register(patientFlowRoutes, { prisma: database.client, redis: cacheService.redis });"
        ;;
    3)
        # Patches method
        echo -e "${YELLOW}Step 4: Applying Git Patches${NC}"
        
        PATCHES_DIR="/tmp/patches"
        
        if [ ! -d "$PATCHES_DIR" ]; then
            echo -e "${RED}Patches not found at $PATCHES_DIR${NC}"
            echo "Generating patches..."
            mkdir -p "$PATCHES_DIR"
            cd "$SOURCE_DIR"
            git format-patch main..HEAD -o "$PATCHES_DIR/"
            cd "$TARGET_DIR"
        fi
        
        if [ ! -f "$PATCHES_DIR/0001-"* ]; then
            echo -e "${RED}Patches not available${NC}"
            exit 1
        fi
        
        echo "Applying patches..."
        git am "$PATCHES_DIR"/0001-*.patch
        echo -e "${GREEN}✓ First patch applied${NC}"
        
        if [ -f "$PATCHES_DIR/0002-"* ]; then
            git am "$PATCHES_DIR"/0002-*.patch
            echo -e "${GREEN}✓ Second patch applied${NC}"
        fi
        ;;
esac

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✓ Migration Complete!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Step 5: Summary
echo -e "${YELLOW}Summary:${NC}"
echo "Repository: $TARGET_DIR"
echo "Branch: $BRANCH_NAME"
echo "Method: $METHOD_NAME"
echo ""

# Show git status
echo -e "${YELLOW}Git Status:${NC}"
git status --short | head -20
echo ""

# Step 6: Next steps
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Verify changes: git diff HEAD~1 HEAD --stat"
echo "2. Review code: git log -p HEAD~1..HEAD"
echo "3. Test locally: npm install && npm test"
echo "4. Commit: git add . && git commit -m '...'"
echo "5. Push: git push origin $BRANCH_NAME"
echo "6. Create PR on GitHub"
echo ""

read -p "Would you like to commit now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    git add .
    
    read -p "Enter commit message (press Enter for default): " COMMIT_MSG
    
    if [ -z "$COMMIT_MSG" ]; then
        COMMIT_MSG="feat(patientflow): implement core services, routes, validation, and seeding"
    fi
    
    git commit -m "$COMMIT_MSG"
    echo -e "${GREEN}✓ Changes committed${NC}"
    echo ""
    
    read -p "Would you like to push now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git push origin $BRANCH_NAME
        echo -e "${GREEN}✓ Pushed to origin${NC}"
        echo ""
        echo -e "${YELLOW}Next: Create PR on GitHub${NC}"
        echo "URL: https://github.com/ssvgopal/medicalAIDemo/pull/new/$BRANCH_NAME"
    fi
fi

echo ""
echo -e "${GREEN}Done!${NC}"
