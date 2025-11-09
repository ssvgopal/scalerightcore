#!/usr/bin/env python3
"""
PatientFlow PR Migration Script
Transfers PatientFlow implementation from current repo to medicalAIDemo
"""

import os
import shutil
import json
import argparse
from pathlib import Path
from typing import List, Dict

# ANSI color codes
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

def print_header(text: str):
    print(f"\n{Colors.BLUE}{Colors.BOLD}{'='*50}{Colors.ENDC}")
    print(f"{Colors.BLUE}{Colors.BOLD}{text}{Colors.ENDC}")
    print(f"{Colors.BLUE}{Colors.BOLD}{'='*50}{Colors.ENDC}\n")

def print_success(text: str):
    print(f"{Colors.GREEN}✓ {text}{Colors.ENDC}")

def print_warning(text: str):
    print(f"{Colors.YELLOW}⚠ {text}{Colors.ENDC}")

def print_error(text: str):
    print(f"{Colors.RED}✗ {text}{Colors.ENDC}")

def print_info(text: str):
    print(f"{Colors.CYAN}ℹ {text}{Colors.ENDC}")

class PatientFlowMigrator:
    def __init__(self, source_dir: str, target_dir: str):
        self.source_dir = Path(source_dir)
        self.target_dir = Path(target_dir)
        self.files_to_copy: List[Dict] = [
            # New PatientFlow module files
            {
                'source': 'modern-orchestrall/src/patientflow/README.md',
                'target': 'modern-orchestrall/src/patientflow/README.md',
                'type': 'new'
            },
            {
                'source': 'modern-orchestrall/src/patientflow/routes.js',
                'target': 'modern-orchestrall/src/patientflow/routes.js',
                'type': 'new'
            },
            {
                'source': 'modern-orchestrall/src/patientflow/services/patient-service.js',
                'target': 'modern-orchestrall/src/patientflow/services/patient-service.js',
                'type': 'new'
            },
            {
                'source': 'modern-orchestrall/src/patientflow/services/doctor-service.js',
                'target': 'modern-orchestrall/src/patientflow/services/doctor-service.js',
                'type': 'new'
            },
            {
                'source': 'modern-orchestrall/src/patientflow/services/appointment-service.js',
                'target': 'modern-orchestrall/src/patientflow/services/appointment-service.js',
                'type': 'new'
            },
            {
                'source': 'modern-orchestrall/src/patientflow/services/conversation-session-service.js',
                'target': 'modern-orchestrall/src/patientflow/services/conversation-session-service.js',
                'type': 'new'
            },
            {
                'source': 'modern-orchestrall/src/patientflow/services/interaction-logger.js',
                'target': 'modern-orchestrall/src/patientflow/services/interaction-logger.js',
                'type': 'new'
            },
            {
                'source': 'modern-orchestrall/src/patientflow/validation/schemas.js',
                'target': 'modern-orchestrall/src/patientflow/validation/schemas.js',
                'type': 'new'
            },
            {
                'source': 'modern-orchestrall/tests/unit/patientflow-services.test.js',
                'target': 'modern-orchestrall/tests/unit/patientflow-services.test.js',
                'type': 'new'
            },
            {
                'source': 'modern-orchestrall/tests/unit/patientflow-validation.test.js',
                'target': 'modern-orchestrall/tests/unit/patientflow-validation.test.js',
                'type': 'new'
            },
            # Files to be modified
            {
                'source': 'modern-orchestrall/package.json',
                'target': 'modern-orchestrall/package.json',
                'type': 'modify'
            },
            {
                'source': 'modern-orchestrall/src/app-commercial.js',
                'target': 'modern-orchestrall/src/app-commercial.js',
                'type': 'modify'
            },
            {
                'source': 'modern-orchestrall/prisma/seed.js',
                'target': 'modern-orchestrall/prisma/seed.js',
                'type': 'modify'
            },
        ]

    def validate_source(self) -> bool:
        """Validate that all source files exist"""
        print_info("Validating source files...")
        missing_files = []
        
        for file_info in self.files_to_copy:
            source_path = self.source_dir / file_info['source']
            if not source_path.exists():
                missing_files.append(file_info['source'])
        
        if missing_files:
            print_error("Missing source files:")
            for f in missing_files:
                print(f"  - {f}")
            return False
        
        print_success(f"All {len(self.files_to_copy)} source files exist")
        return True

    def validate_target(self) -> bool:
        """Validate that target directory is a git repository"""
        print_info("Validating target directory...")
        
        if not (self.target_dir / '.git').exists():
            print_error("Target directory is not a git repository")
            return False
        
        if not (self.target_dir / 'modern-orchestrall').exists():
            print_error("Target directory doesn't have modern-orchestrall subdirectory")
            return False
        
        print_success("Target directory is valid git repository")
        return True

    def create_directories(self) -> bool:
        """Create necessary directories in target"""
        print_info("Creating target directories...")
        
        dirs_to_create = [
            'modern-orchestrall/src/patientflow/services',
            'modern-orchestrall/src/patientflow/validation',
            'modern-orchestrall/tests/unit',
        ]
        
        try:
            for dir_path in dirs_to_create:
                target_path = self.target_dir / dir_path
                target_path.mkdir(parents=True, exist_ok=True)
            
            print_success(f"Created {len(dirs_to_create)} directories")
            return True
        except Exception as e:
            print_error(f"Failed to create directories: {e}")
            return False

    def copy_files(self) -> bool:
        """Copy all new files from source to target"""
        print_info("Copying files...")
        
        new_files = [f for f in self.files_to_copy if f['type'] == 'new']
        failed = []
        
        for file_info in new_files:
            try:
                source_path = self.source_dir / file_info['source']
                target_path = self.target_dir / file_info['target']
                
                # Ensure parent directory exists
                target_path.parent.mkdir(parents=True, exist_ok=True)
                
                shutil.copy2(source_path, target_path)
                print_success(f"Copied {file_info['source']}")
            except Exception as e:
                print_error(f"Failed to copy {file_info['source']}: {e}")
                failed.append(file_info['source'])
        
        if failed:
            return False
        
        print_success(f"Copied {len(new_files)} new files")
        return True

    def merge_package_json(self) -> bool:
        """Merge package.json changes"""
        print_info("Updating package.json...")
        
        try:
            target_package = self.target_dir / 'modern-orchestrall/package.json'
            
            with open(target_package, 'r') as f:
                target_pkg = json.load(f)
            
            # Update db:seed script
            if 'scripts' in target_pkg:
                target_pkg['scripts']['db:seed'] = 'npx prisma db seed'
            
            # Add prisma configuration
            if 'prisma' not in target_pkg:
                target_pkg['prisma'] = {
                    'seed': 'node prisma/seed.js'
                }
            
            with open(target_package, 'w') as f:
                json.dump(target_pkg, f, indent=2)
                f.write('\n')
            
            print_success("Updated package.json")
            return True
        except Exception as e:
            print_error(f"Failed to update package.json: {e}")
            return False

    def update_app_commercial(self) -> bool:
        """Update app-commercial.js with PatientFlow routes"""
        print_info("Updating app-commercial.js...")
        
        try:
            app_file = self.target_dir / 'modern-orchestrall/src/app-commercial.js'
            
            with open(app_file, 'r') as f:
                content = f.read()
            
            # Check if already present
            if 'patientFlowRoutes' in content:
                print_warning("PatientFlow routes already registered")
                return True
            
            # Find the universal CRUD routes section
            marker = "const universalCRUDRoutes = require('./routes/universal-crud');\napp.register(universalCRUDRoutes, { prisma: database.client });"
            
            if marker not in content:
                print_warning("Could not find insertion point in app-commercial.js")
                return False
            
            # Add PatientFlow routes after universal CRUD
            insertion = "\n\n// PatientFlow Routes\nconst patientFlowRoutes = require('./patientflow/routes');\napp.register(patientFlowRoutes, { prisma: database.client, redis: cacheService.redis });"
            
            content = content.replace(marker, marker + insertion)
            
            with open(app_file, 'w') as f:
                f.write(content)
            
            print_success("Updated app-commercial.js")
            return True
        except Exception as e:
            print_error(f"Failed to update app-commercial.js: {e}")
            return False

    def update_seed(self) -> bool:
        """Append PatientFlow seeding to seed.js"""
        print_info("Updating prisma/seed.js...")
        
        try:
            seed_file = self.target_dir / 'modern-orchestrall/prisma/seed.js'
            source_seed = self.source_dir / 'modern-orchestrall/prisma/seed.js'
            
            # For now, just copy the entire seed file
            shutil.copy2(source_seed, seed_file)
            
            print_success("Updated prisma/seed.js")
            return True
        except Exception as e:
            print_error(f"Failed to update prisma/seed.js: {e}")
            return False

    def run_migration(self) -> bool:
        """Run the complete migration"""
        print_header("PatientFlow PR Migration")
        
        print_info(f"Source: {self.source_dir}")
        print_info(f"Target: {self.target_dir}")
        
        # Validate
        if not self.validate_source():
            return False
        
        if not self.validate_target():
            return False
        
        # Create directories
        if not self.create_directories():
            return False
        
        # Copy new files
        if not self.copy_files():
            return False
        
        # Update configuration files
        if not self.merge_package_json():
            return False
        
        if not self.update_app_commercial():
            return False
        
        if not self.update_seed():
            return False
        
        print_header("Migration Complete!")
        print_success("All files transferred successfully")
        
        print_info("Next steps:")
        print(f"  1. cd {self.target_dir}")
        print(f"  2. git checkout -b feat/patientflow-services-routes-validation-booking")
        print(f"  3. git add .")
        print(f"  4. git commit -m 'feat(patientflow): implement core services, routes, validation, and seeding'")
        print(f"  5. git push origin feat/patientflow-services-routes-validation-booking")
        print(f"  6. Create PR on GitHub")
        
        return True

def main():
    parser = argparse.ArgumentParser(
        description='Migrate PatientFlow PR to medicalAIDemo repository'
    )
    parser.add_argument(
        '--source',
        default='/home/engine/project',
        help='Source directory (default: /home/engine/project)'
    )
    parser.add_argument(
        '--target',
        required=True,
        help='Target medicalAIDemo directory'
    )
    
    args = parser.parse_args()
    
    migrator = PatientFlowMigrator(args.source, args.target)
    success = migrator.run_migration()
    
    return 0 if success else 1

if __name__ == '__main__':
    exit(main())
