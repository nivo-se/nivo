# Database Backups

This directory contains backups of the original scraped data and important exports.

## 📁 Directory Structure

### `/databases/`
Contains SQLite database backups:
- **`allabolag_original_20251023.db`** (48MB) - Main original scraped database from October 7, 2024
- **`allabolag_backup_may2024.db`** (14MB) - Earlier backup from May 27, 2024

### `/exports/`
Contains data exports and CSV files (when created)

### `/reports/`
Contains analysis reports and documentation (when created)

## 🔄 Backup Strategy

### Original Scraped Data
The `allabolag_original_*.db` files contain the **original scraped data** from Allabolag.se. This is the foundation of our entire dataset and should **NEVER be deleted**.

### Data Flow
1. **Original Scraping** → `allabolag_original_*.db`
2. **Data Processing** → Supabase `master_analytics` table
3. **AI Analysis** → Supabase AI tables
4. **Exports** → CSV/Excel files in `/exports/`

## ⚠️ Important Notes

- **DO NOT DELETE** the original database files
- These contain the raw scraped data that was the starting point
- All processed data in Supabase can be regenerated from these originals
- Keep multiple versions for data recovery purposes

## 📊 File Sizes
- Original DB (Oct 2024): ~48MB
- Backup DB (May 2024): ~14MB

## 🔍 Recovery
If Supabase data is ever lost, the original scraped data can be re-imported from these backup files.
