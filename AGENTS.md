# Repository Guidelines

CostOntology Editor is a web-based visual OWL ontology editor for the road-construction cost domain: a React/TypeScript SPA in `frontend/` and a FastAPI service in `backend/`.

## Project Structure & Module Organization

- `frontend/` — React 18 + TypeScript + Vite + Tailwind + ReactFlow + Zustand. Entry: `src/main.tsx`. Key areas: `src/components/` (GraphView, SidePanel, Toolbar, Dialogs, common), `src/store/` (Zustand: ontology, ui, history), `src/services/` (OWL parser/generator, API client, file/storage), plus `src/hooks/`, `src/types/`, `src/utils/`, `src/data/`.
- `backend/` — FastAPI + SQLAlchemy + SQLite. Entry: `app/main.py`. Routes in `app/api/`, SQLAlchemy models in `app/models/`, Pydantic schemas in `app/schemas/`, business logic in `app/services/` (`owl_service.py` is pure-stdlib OWL parse/generate with no third-party OWL dependency).
- Root — `docker-compose.yml` orchestrates both services; `start-dev.bat` is the Windows one-click launcher.

Keep the ontology data shape shared by `frontend/src/types/ontology.ts` and `backend/app/services/owl_service.py` in sync.

## Build, Test, and Development Commands

- `start-dev.bat` — Windows: creates `.venv`, installs dependencies, starts backend (:8000) and frontend (:5173).
- Backend: `cd backend; python -m venv .venv; .venv\Scripts\pip install -r requirements.txt; .venv\Scripts\python -m uvicorn app.main:app --port 8000 --reload`
- Frontend: `cd frontend; npm install; npm run dev` — Vite dev server at http://localhost:5173, proxying `/api` to :8000.
- `npm run build` — type-checks (`tsc`) then builds; `npm run preview` serves the production build.
- Docker: `docker compose up --build` — frontend at :8080, backend at :8000; data persists in the `ontology-data` volume.

## Coding Style & Naming Conventions

- Frontend: TypeScript `strict` mode with `noUnusedLocals`/`noUnusedParameters`; 2-space indent, single quotes, semicolons. Components are PascalCase files (`Button.tsx`); hooks are `useXxx`; Zustand stores are one file per domain under `store/`. Style with Tailwind utility classes only.
- Backend: PEP 8, 4-space indent, snake_case, type hints on public functions, Chinese docstrings, relative imports inside `app`.
- No ESLint/Prettier is configured; match the surrounding code.

## Testing Guidelines

- No automated tests exist yet: `package.json` has no test script and `requirements.txt` has no pytest.
- When adding tests: Vitest + React Testing Library for the frontend (`*.test.tsx` colocated with source); pytest + FastAPI `TestClient` in `backend/tests/test_*.py`.

## Commit & Pull Request Guidelines

- History uses concise Chinese summaries with a bulleted body and optional `Co-Authored-By` trailer; e.g. `修复布局保存与自动排版重叠` followed by `-` detail lines.
- PRs: link the issue, describe the behavior change and manual testing steps, include screenshots for UI changes, and confirm `npm run build` passes.
