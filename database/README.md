# Database Directory

This directory contains all database-related files for the Nivo project.

## 📁 File Structure

### 🏗️ Core Schema Files
- **`valuation_schema.sql`** - Complete valuation system schema with RLS policies
- **`valuation_schema_simple.sql`** - Simplified version for manual execution
- **`ai_ops_schema.sql`** - AI analysis operations schema
- **`saved_lists_schema.sql`** - User saved company lists schema
- **`create_user_roles_table_simple.sql`** - User roles and permissions schema

### 🔧 Performance & Security Fixes
- **`fix_performance_warnings_corrected.sql`** - Fixes for 64 Supabase performance warnings
- **`test_performance_fixes.sql`** - Verification script for performance fixes
- **`performance_warnings_summary.md`** - Documentation of performance fixes

### 📊 Configuration Files
- **`allabolag_financial_codes.json`** - Financial data mapping codes
- **`allabolag_kpi_definitions.json`** - KPI definitions and calculations
- **`filter_config.json`** - Company filtering configuration
- **`output_segmentation.json`** - Industry segmentation mapping
- **`test_company_financials.json`** - Test financial data
- **`test_companyid_financials.json`** - Test company ID data
- **`test_thermoprodukter.json`** - Test company data

### 📚 Documentation
- **`COMPLETE_ALLABOLAG_MAPPING.md`** - Complete data mapping guide
- **`DATA_MAPPING_GUIDE.md`** - Data mapping documentation
- **`performance_warnings_summary.md`** - Performance fixes documentation

### 📂 Reference Files
- **`temporary_files/`** - Contains reference and backup files
  - `data_architecture_analysis.md` - Data architecture analysis
  - `supabase_create_tables.sql` - Table creation reference

## 🚀 Quick Start

### For Performance Fixes:
1. Run `fix_performance_warnings_corrected.sql` in Supabase SQL Editor
2. Run `test_performance_fixes.sql` to verify fixes
3. Re-run Supabase security linter to confirm all warnings resolved

### For Schema Setup:
1. Run `valuation_schema_simple.sql` for valuation system
2. Run `create_user_roles_table_simple.sql` for user permissions
3. Run `saved_lists_schema.sql` for user lists functionality

## 📋 File Status

- ✅ **Current/Active**: All files in this directory are current and actively maintained
- 🗑️ **Cleaned**: Removed 30+ old/temporary/duplicate files
- 📊 **Organized**: Clear separation between core schemas, fixes, configs, and docs

## 🔄 Maintenance

This directory is regularly cleaned to remove:
- Old/duplicate schema files
- Temporary fix scripts
- Superseded security scripts
- Outdated migration files

Only essential, current, and well-documented files are kept.
