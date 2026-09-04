# OAE Inventory & Sales Management System

**Company:** Office Automation & Equipment Limited (OAE)  
**Stack:** Next.js 15 · TypeScript · Tailwind CSS 4 · Firebase  
**Status:** Frontend complete — awaiting Firebase backend integration

## Quick Start

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

**Dev preview:** The app uses mock data until Firebase is configured. Use `?role=admin`, `?role=manager`, or `?role=clerk` query params to preview each user role's dashboard.

## Documentation

- [HANDOVER.md](HANDOVER.md) — Complete handover for the backend partner (Firebase setup, data model, security rules, AI instructions)
- [DESIGN.md](DESIGN.md) — UI design system reference
- [docs/superpowers/specs/](docs/superpowers/specs/) — Design spec and implementation plan

## Project Structure

```
├── frontend/          # Next.js application
├── DESIGN.md          # Design system tokens
├── HANDOVER.md        # Partner handover document
└── docs/              # Specifications & plans
```

## License

Proprietary — Office Automation & Equipment Limited
