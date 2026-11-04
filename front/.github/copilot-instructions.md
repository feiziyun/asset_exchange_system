# Copilot Instructions for BUPT Project

## Architecture Overview

This is a **full-stack asset management application** with:
- **Frontend**: Vue 3 + Vite (port 8080) in `front/vue-project/`
- **Backend**: Express.js + MySQL (port 3007) in `back/`
- **Key modules**: User authentication (JWT), asset registration/trading, system settings

## Frontend Structure (`front/vue-project/src/`)

### Key Patterns
- **Views**: `views/` has page components (login, home, assetManagement, assetMarket, chainRegister)
  - Menu layout wraps other pages as children routes
  - Login redirects to menu after authentication
- **Routing**: Vue Router with lazy-loaded components using `() => import('@/views/...')`
- **API calls**: Centralized in `api/login.js` using axios instance from `http/index.js`
- **Event bus**: `utils/mitt.js` exports shared `bus` for component communication
- **UI Framework**: Element Plus with Chinese locale (`zh-CN`), icons from Element Plus Icons Vue

### HTTP & Auth
- **Axios config** ([src/http/index.js](src/http/index.js)): baseURL `http://127.0.0.1:3007`, auto-adds JWT token from localStorage to `Authorization` header
- **Token storage**: JWT stored in `localStorage` under key `'token'`
- **Response format**: All API responses use unified format `{ status, message }`

### SVG Icons
- Icons stored in `src/assets/svg/` and registered via Vite plugin (`vite-plugin-svg-icons`)
- Component reference: `<SvgIcon>` in [src/components/SvgIcon.vue](src/components/SvgIcon.vue)

## Backend Structure (`back/`)

### Express Setup
- **Main entry**: `app.js` initializes middleware, CORS, body-parser, JWT auth
- **Port**: 3007 (hardcoded in frontend axios config)
- **JWT middleware**: Uses `express-jwt` with `HS256` algorithm
- **Custom response method**: `res.cc(err, status)` sends unified error format with status codes (0=success, 1=failure)

### Three-Layer Architecture
1. **Routes** (`router/`): Define endpoints with express-joi validation
   - `router/login.js`: Auth endpoints (register, login, verifyEmail, resetPassword)
   - Pattern: `router.post('/endpoint', expressJoi(validation_rules), handler)`
2. **Handlers** (`router_handle/`): Business logic for route handlers
3. **Middleware**: `limit/` contains validation schemas; other middleware in `jwt_config/`

### Database & Auth
- **MySQL**: Connection in `db/index.js` (host: localhost, user: root, password: 12345678, database: ManagementSystem)
- **JWT secrets**: Defined in `jwt_config/index.js` (access & reset keys both hardcoded)
- **Password hashing**: `bcryptjs` for user passwords
- **Request validation**: `@escook/express-joi` validates body/query/params before handlers execute

## Development Workflow

### Frontend
```bash
cd front/vue-project
npm install
npm run dev        # Start dev server (opens http://localhost:8080)
npm run build      # Production build
npm run format     # Run Prettier on src/
```

### Backend
```bash
cd back
npm install
npm run dev        # Start with nodemon (auto-restart on changes)
```

### Key Conventions
- **No 1** prefix in active code: `1router/` and `1views/` exist but actual router imports from `router/index.js` - the "1" versions are legacy/disabled
- **Import alias**: Frontend uses `@` for `src/` directory (`import X from '@/path'`)
- **API paths**: Frontend calls `/api/...` endpoints; backend routes defined without `/api` prefix (added by handler organization)
- **Naming**: Components use snake_case files (e.g., `bread_crumb.vue`, `forget_password.vue`)

## Critical Integration Points

1. **Login Flow**: Frontend posts to `/api/login` → backend validates, returns JWT → token saved to localStorage → requests auto-include token header
2. **Protected Routes**: Backend middleware (`accessJwt`) validates JWT before handlers execute
3. **Error Handling**: Backend sends `{ status: 0/1, message }` → frontend must check `response.status` not HTTP status
4. **Cross-component State**: Use event bus (`import { bus } from '@/utils/mitt'`) for non-parent/child communication

## Testing & Debugging

- **Backend console**: Runs on port 3007; check terminal for request logs
- **Frontend DevTools**: Vue.js DevTools extension recommended (already imported in main.js)
- **Network tab**: Monitor requests to `http://127.0.0.1:3007/api/*` calls
- **No test suite**: Currently no automated tests configured

## Important Dependencies

**Frontend**: vue@3.5, vue-router@4.6, element-plus@2.13, axios@1.13, echarts@6.0
**Backend**: express@5.2, mysql2@3.16, jsonwebtoken@9.0, bcryptjs@3.0
