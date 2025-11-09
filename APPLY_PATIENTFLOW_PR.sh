#!/bin/bash

# PatientFlow PR Application Script
# This script applies the PatientFlow PR to the medicalAIDemo repository

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}PatientFlow PR Application Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}Error: Not in a git repository${NC}"
    echo "Please run this script from the medicalAIDemo repository root"
    exit 1
fi

echo -e "${YELLOW}Current repository:${NC} $(git remote -v | head -1)"
echo ""

# Verify we're on the correct repository
REMOTE_URL=$(git config --get remote.origin.url)
if [[ ! "$REMOTE_URL" == *"medicalAIDemo"* ]]; then
    echo -e "${YELLOW}Warning: This doesn't appear to be the medicalAIDemo repository${NC}"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Create a new branch
BRANCH_NAME="feat/patientflow-services-routes-validation-booking"
echo -e "${YELLOW}Creating branch:${NC} $BRANCH_NAME"

if git rev-parse --verify $BRANCH_NAME 2>/dev/null; then
    echo -e "${YELLOW}Branch already exists, checking it out...${NC}"
    git checkout $BRANCH_NAME
else
    git checkout -b $BRANCH_NAME
    echo -e "${GREEN}✓ Branch created${NC}"
fi

echo ""
echo -e "${YELLOW}Applying patches...${NC}"

# Define patches directory (relative to current directory or use absolute path)
PATCHES_DIR="${1:-.}"

if [ ! -f "$PATCHES_DIR/0001-feat-patientflow-implement-PatientFlow-services-vali.patch" ]; then
    echo -e "${RED}Error: Patches not found in $PATCHES_DIR${NC}"
    echo "Usage: $0 [patches_directory]"
    echo ""
    echo "Patches should be located in /tmp/patches/ or the directory you specify"
    exit 1
fi

# Apply patches in order
for patch in "$PATCHES_DIR"/0001-*.patch "$PATCHES_DIR"/0002-*.patch; do
    if [ -f "$patch" ]; then
        echo -e "${YELLOW}Applying:${NC} $(basename $patch)"
        git am "$patch" 2>/dev/null || {
            echo -e "${RED}Error applying patch: $(basename $patch)${NC}"
            git am --abort
            echo -e "${YELLOW}Aborted patch application. Branch remains on $BRANCH_NAME${NC}"
            exit 1
        }
        echo -e "${GREEN}✓ Applied${NC}"
    fi
done

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ Patches applied successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Show summary
echo -e "${YELLOW}Summary:${NC}"
git log --oneline -3
echo ""

# Show file changes
echo -e "${YELLOW}Files changed:${NC}"
git diff HEAD~2..HEAD --stat | tail -20

echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Review the changes: git log -p HEAD~2..HEAD"
echo "2. Run tests: npm test -- tests/unit/patientflow-*.test.js"
echo "3. Verify seeding: npm run db:seed"
echo "4. Push to your fork: git push origin $BRANCH_NAME"
echo "5. Create a pull request on GitHub"
echo ""

# Optionally verify the changes
read -p "Would you like to verify the changes? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Showing file structure:${NC}"
    find modern-orchestrall/src/patientflow -type f -name "*.js" -o -name "*.md" | sort
    
    echo ""
    echo -e "${YELLOW}Showing package.json changes:${NC}"
    git diff HEAD~1 HEAD modern-orchestrall/package.json | head -20
    
    echo ""
    echo -e "${YELLOW}Showing integration in app-commercial.js:${NC}"
    git diff HEAD~1 HEAD modern-orchestrall/src/app-commercial.js
fi

echo ""
echo -e "${GREEN}Done!${NC}"
