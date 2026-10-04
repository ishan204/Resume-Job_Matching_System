# ResumeMatch AI 🎯

A production-ready, full-stack AI-powered SaaS platform that matches resumes to job postings with **transparent, explainable scoring**, actionable gap analysis, automated bullet optimization (Google XYZ formula), AI cover letter synthesis, and an end-to-end application CRM tracker.

---

## 🌟 Key Features

1. **Intelligent Document Ingestion & Parsing**
   - Extracts plain text, structural sections, and metadata from **PDF**, **DOCX**, and **TXT** files.
   - Normalizes contact data (email, phone, LinkedIn, GitHub, portfolio, location).
   - Segregates work experience, educational degrees, certifications, and portfolio projects.
   - Comprehensive **ATS Compatibility Diagnostics**: validates word count, structural headings, action verbs density, and quantifiable metrics.

2. **Job Description Extraction & Taxonomy Mapping**
   - Automatically segments job postings into **Required Skills**, **Preferred Skills**, **Seniority Level**, and **Key Responsibilities**.
   - Built-in taxonomy of **600+ technology and business skills** categorized into Languages, Frameworks, Databases, Cloud/DevOps, Tools, and Soft Skills.

3. **Explainable Multi-Dimensional Match Engine**
   - Replaces black-box AI with a clear, auditable scoring breakdown:
     - **Hard Skills Match (40% weight)**: Exact canonical matching and synonym cross-referencing.
     - **Experience & Seniority (25% weight)**: Candidate years vs. role requirements threshold.
     - **Responsibilities Alignment (20% weight)**: TF-IDF vectorization and cosine similarity between past achievements and day-to-day duties.
     - **Education & Credentials (10% weight)**: Degree field and qualification alignment.
     - **ATS Machine Readability (5% weight)**: Formatting structure and keyword density.
   - **Interactive Skill Matrix**: Matched skills (with evidence in resume), Missing Required (Critical), Missing Preferred (Bonus), and Candidate Bonus Skills.
   - **Actionable Advice Checklist**: High, medium, and low-priority fixes with concrete code or bullet snippet examples.

4. **Resume Tailor Studio (Google XYZ Formula)**
   - Tailors professional summaries directly to the target role.
   - Rewrites bullets using the Google XYZ Formula: *"Accomplished [X], as measured by [Y], by doing [Z]"*.
   - Weaves missing keywords into relevant experience points naturally.
   - **Interactive Side-by-Side Diff Viewer** showing original vs. tailored bullets with keyword additions highlighted.
   - One-click copy and text export.

5. **AI Cover Letter Studio**
   - Synthesizes personalized cover letters addressing target hiring teams.
   - Selectable tone: *Professional*, *Enthusiastic*, *Confident*, *Concise*, and *Technical*.
   - Embeds concrete past achievements and metrics from the candidate's actual background.
   - Real-time inline editor with live word count and reading time metrics.

6. **Job Application CRM Pipeline**
   - Kanban board and table views with drag-and-drop or status selector: *Saved*, *Applied*, *Screening*, *Interviewing*, *Offer*, *Rejected*.
   - Milestone event history and timeline logger.
   - Compensation and notes tracker.

7. **Dual-Mode AI Architecture**
   - **Google Gemini & OpenAI Integration**: Connects with modern LLMs when API keys are configured.
   - **Zero-Failure Local Semantic Engine**: Fully functional offline/deterministic NLP fallback using TF-IDF, tokenizers, and rule-based generators. The application works 100% out of the box with zero external dependencies.

---

## 🏗️ Architecture & Project Structure

```
resumematch-ai/
├── client/                     # Frontend (React 18, Vite, TypeScript, Tailwind CSS, Lucide)
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/         # ScoreGauge, SkillBadge, etc.
│   │   │   └── layout/         # Navbar, Sidebar
│   │   ├── views/              # DashboardView, ResumesView, JobsView, MatchView,
│   │   │                       # OptimizerView, CoverLetterView, ApplicationsView
│   │   ├── api.ts              # Type-safe API client
│   │   └── App.tsx             # Main routing & state
│   ├── Dockerfile
│   └── nginx.conf
│
├── server/                     # Backend (Node.js, Express, TypeScript, Prisma ORM, Vitest)
│   ├── prisma/
│   │   ├── schema.prisma       # Database schema (SQLite / PostgreSQL)
│   │   └── seed.ts             # Production seeder with realistic resumes & jobs
│   ├── src/
│   │   ├── constants/          # 600+ skills taxonomy with canonical mappings
│   │   ├── services/
│   │   │   ├── ai/             # AI Strategy: GeminiProvider, SemanticEngine, Factory
│   │   │   ├── fileParserService.ts    # PDF / DOCX / TXT extractors
│   │   │   ├── resumeParserService.ts  # Contact, sections, & ATS analyzer
│   │   │   ├── jobAnalyzerService.ts   # Requirements & seniority parser
│   │   │   ├── matchScorerService.ts   # Multi-factor explainable engine
│   │   │   ├── optimizerService.ts     # Resume tailoring & diff generator
│   │   │   ├── coverLetterService.ts   # Tone-adjusted letter synthesis
│   │   │   └── applicationService.ts   # CRM pipeline & dashboard metrics
│   │   ├── routes/             # RESTful API route controllers
│   │   ├── middleware/         # Zod validator, Multer file upload, Error handler
│   │   ├── db.ts               # Prisma connection
│   │   └── index.ts            # Server entry point
│   ├── test/                   # Vitest unit & API integration tests
│   └── Dockerfile
│
├── shared/                     # Shared TypeScript interfaces & domain models
│   └── src/index.ts
│
├── docker-compose.yml          # Production multi-container setup (DB + API + Web)
└── pnpm-workspace.yaml
```

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js 20+ / 22+
- `pnpm` (or `npm`)
- Optional: Docker & Docker Compose

### 1. Installation
Clone the repository and install all dependencies:
```bash
pnpm install
```

### 2. Database Initialization & Seeding
Initialize the SQLite database (or configure PostgreSQL) and load realistic sample data:
```bash
# Push Prisma schema to database
pnpm db:push

# Seed sample user, resumes, jobs, match analysis, and applications
pnpm db:seed
```

### 3. Running Development Servers
Start both backend API (`http://localhost:5000`) and frontend UI (`http://localhost:5173`) concurrently:
```bash
pnpm dev
```

Visit **`http://localhost:5173`** in your browser!

### 4. Running Tests
Run the complete unit and integration test suite:
```bash
pnpm test
```

---

## 🐳 Docker Deployment

To launch the complete multi-container production stack with backend API, Nginx frontend web server, and PostgreSQL:

```bash
# Build and start all services
docker compose up --build -d

# View status
docker compose ps
```
- Frontend Web App: `http://localhost:3000`
- Backend REST API: `http://localhost:5000/api`

---

## 🔌 API Reference Summary

| Endpoint | Method | Description |
|---|---|---|
| `/api/health` | GET | System health, database connection, and AI provider status |
| `/api/stats` | GET | Aggregated dashboard metrics & recent activity logs |
| `/api/resumes` | GET | List all resumes with parsed sections & ATS scores |
| `/api/resumes/upload` | POST | Upload PDF/DOCX/TXT file with automatic parsing |
| `/api/resumes/text` | POST | Ingest resume from raw text string |
| `/api/resumes/:id` | GET / DELETE | Retrieve or delete specific resume |
| `/api/jobs` | GET / POST | List or create analyzed job description |
| `/api/jobs/:id` | GET / DELETE | Retrieve or delete specific job posting |
| `/api/match` | POST | Calculate explainable multi-factor match score |
| `/api/match/:id` | GET | Retrieve existing match analysis & breakdown |
| `/api/optimize` | POST | Tailor resume for target job with bullet diffs |
| `/api/cover-letters/generate` | POST | Synthesize customized cover letter with chosen tone |
| `/api/cover-letters/:id` | GET / PUT | Retrieve or edit generated cover letter |
| `/api/applications` | GET / POST | List or create CRM job applications |
| `/api/applications/:id/status`| PATCH | Update pipeline status and record timeline event |

---

## 🧪 Testing Coverage

The platform includes comprehensive test suites in `server/test/`:
- `parser.test.ts`: Validates phone/email/LinkedIn extraction, skills categorization, and ATS rule checks.
- `matchScorer.test.ts`: Verifies weighted scoring calculations, seniority differential evaluation, and actionable advice generation.
- `api.test.ts`: Tests end-to-end HTTP endpoints for resumes, jobs, match calculation, cover letter generation, and CRM workflow.

All tests run via:
```bash
pnpm test
```

---

## 📄 License
MIT License. Built for production SaaS scalability.
