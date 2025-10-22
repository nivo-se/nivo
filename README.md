# Nivo - Advanced Swedish Company Intelligence Platform

A comprehensive AI-powered system for analyzing, valuing, and managing Swedish companies with advanced financial modeling, multi-model valuation engine, and intelligent company insights powered by GPT-4.

## 🏗️ Project Structure

```
nivo/
├── 📁 backend/              # Python data processing & analysis
│   ├── *.py                # Scraping, analysis, and migration scripts
│   ├── requirements.txt    # Python dependencies
│   └── .env               # Environment variables
├── 📁 frontend/            # Next.js web application
│   ├── components/         # React components
│   ├── pages/             # Next.js pages
│   ├── lib/               # Supabase client configuration
│   ├── package.json       # Node.js dependencies
│   └── .env.local         # Frontend environment variables
├── 📁 database/           # Database schemas and migrations
│   ├── supabase_create_tables.sql
│   └── *.json            # Configuration files
├── 📁 outputs/            # Analysis results and reports
└── 📄 deploy.sh          # Deployment script
```

## 🚀 Features

### 🤖 AI-Powered Analysis
- **GPT-4 Integration**: Advanced AI insights using GPT-4.1-mini and GPT-4o
- **Swedish Localization**: All AI responses in Swedish with proper business terminology
- **Multi-Model Analysis**: Revenue, EBITDA, Earnings, and DCF valuation models
- **Intelligent Commentary**: Automated company summaries, risk assessment, and opportunities
- **Historical Analysis**: Track analysis runs and compare results over time

### 💰 Advanced Valuation Engine
- **Multi-Model Valuation**: Revenue Multiple, EBITDA Multiple, Earnings Multiple, DCF-Lite, Hybrid Score-Adjusted
- **Industry-Specific Assumptions**: Tailored valuation multiples for different industries
- **Real-Time Calculations**: Live valuation updates with proper financial conversions
- **Export Capabilities**: CSV, Excel, and PDF export functionality
- **Interactive Charts**: Revenue trends, EV/EBITDA comparisons, and financial metrics

### 📋 Saved Company Lists
- **Complete CRUD Operations**: Create, read, update, and delete company lists
- **Advanced Search Integration**: Add companies from search results to lists
- **List Management**: Organize companies into custom categories
- **Persistent Storage**: Supabase integration with proper security policies
- **User-Friendly Interface**: Intuitive list management with easy company removal

### 🎨 Modern Frontend (Vite/React/TypeScript)
- **Responsive Design**: Mobile-first approach with desktop optimization
- **Advanced Search**: Multi-criteria filtering with MSEK format display
- **Interactive Dashboard**: Real-time analytics with corrected financial calculations
- **Export Features**: Multiple format support (CSV, Excel, PDF)
- **Accessibility**: WCAG-compliant components and navigation

### 🛠️ Backend (Node.js/TypeScript)
- **Enhanced API**: 20+ endpoints for comprehensive functionality
- **AI Integration**: OpenAI GPT-4.1-mini and GPT-4o integration
- **Valuation Engine**: Multi-model financial calculations
- **Data Services**: Supabase integration with proper error handling
- **Security**: Row-level security policies and proper authentication

### 🗄️ Database (Supabase PostgreSQL)
- **Master Analytics**: 8,479+ companies with comprehensive financial data
- **Valuation Tables**: valuation_sessions, valuation_assumptions, valuation_models
- **Saved Lists**: saved_company_lists with proper RLS policies
- **AI Analysis**: Historical analysis runs and AI insights storage
- **Real-time**: Live data updates with proper indexing

## 📊 Data Overview

- **Companies**: 8,479+ Swedish companies with comprehensive financial data
- **Financial Data**: 35,409+ financial records with corrected MSEK conversions
- **Valuation Models**: 5 different valuation approaches with industry-specific assumptions
- **AI Analysis**: GPT-4 powered insights with Swedish localization
- **Saved Lists**: Complete company list management with CRUD operations
- **Export Formats**: CSV, Excel, and PDF export capabilities

## 🛠️ Setup Instructions

### Prerequisites
- Node.js 20.19+ (required for Vite)
- Supabase account
- OpenAI API key (for AI features)
- Git

### Full-Stack Setup
```bash
# Clone the repository
git clone [repository-url]
cd nivo

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your Supabase and OpenAI credentials

# Start development server
npm run dev
```

### Database Setup
1. Create a Supabase project
2. Run the SQL migrations:
   - `database/supabase_create_tables.sql` (main tables)
   - `database/valuation_schema.sql` (valuation tables)
   - `database/disable_saved_lists_rls.sql` (for saved lists)
3. Configure environment variables with your Supabase and OpenAI credentials

## 🚀 Deployment

### Vercel (Full-Stack)
```bash
# Deploy to Vercel
vercel deploy

# Configure environment variables in Vercel dashboard:
# - VITE_SUPABASE_URL
# - VITE_SUPABASE_ANON_KEY
# - OPENAI_API_KEY
```

### Supabase (Database)
- Database is automatically deployed to Supabase cloud
- Row Level Security (RLS) policies configured for saved lists
- All valuation and AI analysis tables ready for production

## 📈 Usage

### Web Interface
- **Company Search**: Advanced search with multi-criteria filtering
- **Valuation Analysis**: Multi-model valuation with AI insights
- **Saved Lists**: Create and manage company lists
- **Dashboard**: Real-time analytics and financial metrics
- **Export**: Download data in CSV, Excel, or PDF formats

### API Endpoints
- `GET /api/companies` - Company search and filtering
- `POST /api/valuation` - Multi-model valuation calculations
- `GET /api/saved-lists` - Saved company lists management
- `POST /api/ai-analysis` - AI-powered company insights

## 🔧 Configuration

### Environment Variables

#### Required (.env)
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
OPENAI_API_KEY=your_openai_api_key
```

## 📊 Key Tables

- `master_analytics`: Main company data with financial metrics
- `valuation_sessions`: Valuation analysis sessions and results
- `valuation_assumptions`: Industry-specific valuation assumptions
- `saved_company_lists`: User-created company lists
- `ai_company_analysis`: AI-powered insights and analysis runs
- `company_accounts_by_id`: Historical financial data
- `company_kpis_by_id`: Calculated KPIs and ratios

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is for educational and research purposes.

## 🆘 Support

For issues and questions:
1. Check the documentation
2. Review existing issues
3. Create a new issue with detailed information

---

**Built with ❤️ using React, TypeScript, Supabase, and OpenAI GPT-4**

## 🎉 Production Ready

The Nivo platform is now a comprehensive, production-ready Swedish company intelligence system with:
- **Advanced AI capabilities** for company analysis
- **Multi-model valuation engine** for financial assessment  
- **Complete saved lists functionality** for company management
- **Secure, scalable architecture** with proper error handling
- **Comprehensive documentation** for easy maintenance and development

**All systems are operational and ready for live deployment!** 🚀
