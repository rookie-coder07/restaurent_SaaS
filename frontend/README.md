# RestroMaxx Frontend

Production-ready React-based Restaurant Management SaaS UI with Vite, Tailwind CSS, and Zustand.

## Features

- **Authentication**: Secure JWT-based login/register with role-based access control
- **Dashboard**: Real-time statistics and metrics
- **Menu Management**: Create, edit, and manage restaurant menu items with Cloudinary image uploads
- **Order Management**: View, filter, and manage customer orders
- **Kitchen Dashboard**: Real-time order updates with 5-second polling
- **Analytics**: Revenue charts, order trends, and top-selling items
- **Customer Menu**: QR code-based table menu with ordering capability
- **Responsive Design**: Mobile-first approach with Tailwind CSS

## Tech Stack

- **React 18.2**: Modern UI library with functional components
- **Vite 5**: Next-generation build tool with HMR
- **React Router v6**: Client-side routing and navigation
- **Zustand**: Lightweight state management with persistence
- **Axios**: HTTP client with interceptors for token management
- **Tailwind CSS**: Utility-first CSS framework
- **Recharts**: React charting library for analytics
- **Lucide React**: Beautiful SVG icons
- **date-fns**: Date manipulation and formatting

## Project Structure

```
src/
├── components/
│   ├── shared/          # Reusable components (Layout, Navbar, Sidebar, etc)
│   ├── admin/           # Admin-specific components
│   ├── kitchen/         # Kitchen dashboard components
│   └── customer/        # Customer-facing components
├── pages/               # Page-level components (Dashboard, Orders, Analytics, etc)
├── hooks/               # Custom React hooks (useAuth, useApi, usePolling)
├── services/            # API client configuration and endpoints
├── context/             # State management (Zustand stores)
├── styles/              # Global styles and theme configuration
└── utils/               # Utility functions (formatters, validators)
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Backend API running on `http://localhost:3000`

### Installation

```bash
cd frontend
npm install
```

### Environment Setup

Create `.env.local` for development:

```
VITE_API_URL=http://localhost:3000
```

For production (`.env.production`):

```
VITE_API_URL=https://api.production.com
```

### Development

```bash
npm run dev
```

Frontend will be available at `http://localhost:5173` with hot module reloading.

### Build

```bash
npm run build
```

Optimized production build in `dist/` directory.

### Preview

```bash
npm run preview
```

Preview production build locally.

## API Integration

All API endpoints are centralized in `src/services/apiEndpoints.js`:

```javascript
// Example usage in components
const { data: orders, loading } = useApi(() =>
  orderAPI.getOrders({ limit: 50 })
);
```

### Available API Modules

- **authAPI**: Register, login, logout, password change
- **restaurantAPI**: Profile, staff management, settings
- **menuAPI**: Categories and items CRUD
- **orderAPI**: Order management
- **kitchenAPI**: Active orders and status updates
- **tableAPI**: Table management and QR codes
- **analyticsAPI**: Sales reports and metrics
- **customerAPI**: Public menu and ordering

## Authentication & Token Management

### How It Works

1. **Login**: User credentials sent to backend
2. **Token Storage**: Access and refresh tokens stored in localStorage
3. **API Requests**: Axios interceptor automatically adds Authorization header
4. **Token Refresh**: If access token expires (401), interceptor calls refresh endpoint
5. **Logout**: Clears tokens and redirects to login

### Secure Token Handling

```javascript
// Axios interceptor automatically manages token lifecycle
const response = await api.get('/protected-endpoint');
// If 401 received -> refresh token -> retry request
```

## State Management

Using Zustand with localStorage persistence:

```javascript
// Auth state
const { user, isAuthenticated, setUser, logout } = useAuthStore();

// State persists across page refreshes
```

## Custom Hooks

### useAuth()

```javascript
const { user, login, register, logout, isLoading, error } = useAuth();
```

### useApi()

```javascript
const { data, loading, error } = useApi(() => orderAPI.getOrders());
```

### usePolling()

```javascript
const { data, loading } = usePolling(kitchenAPI.getActiveOrders, 5000);
```

## Pages

### Public Routes

- `/login` - Owner/Staff login
- `/register` - Restaurant registration
- `/menu` - Customer menu via QR code (no auth required)

### Protected Routes (Authentication Required)

- `/` - Dashboard (Owner/Manager)
- `/menu-management` - Menu CRUD (Owner/Manager)
- `/orders` - Order list and details (Owner/Manager)
- `/kitchen` - Kitchen dashboard with polling (Kitchen Staff/Manager)
- `/analytics` - Sales reports and metrics (Owner/Manager)

## Styling

### Tailwind CSS

Uses Tailwind's utility-first approach:

```jsx
<button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
  Action
</button>
```

### Theme System

Custom CSS variables in `theme.css`:

```css
:root {
  --color-primary: rgb(100, 116, 139);
  --color-accent: rgb(239, 68, 68);
}
```

### Responsive Design

Mobile-first breakpoints:

```jsx
<div className="w-full md:w-1/2 lg:w-1/3">
  Responsive content
</div>
```

## Error Handling

### Global Error Boundary

Catches React component errors and displays fallback UI:

```jsx
<ErrorBoundary>
  <App />
</ErrorBoundary>
```

### API Error Handling

Axios interceptor handles API errors and redirects on auth failure:

```javascript
// Automatic 401 redirect to login
// Network errors shown in components via error state
```

## Performance Optimizations

- **Code Splitting**: Routes lazy-loaded by React Router
- **Image Optimization**: Cloudinary URLs with transformations
- **Memoization**: useCallback for stable function references
- **Bundle Analysis**: Vite build optimizations

## Deployment

### Vercel (Recommended for React)

```bash
npm install -g vercel
vercel
```

Configure environment variables in Vercel dashboard:

- `VITE_API_URL=https://api.production.com`

### Build & Serve

```bash
npm run build
npm run preview
```

## Development Workflow

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/component-name
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Start Dev Server**
   ```bash
   npm run dev
   ```

4. **Build & Test**
   ```bash
   npm run build
   ```

5. **Format Code**
   ```bash
   npm run format
   ```

## Troubleshooting

### CORS Issues

Ensure backend has CORS enabled:

```javascript
// In backend app.js
cors({
  origin: 'http://localhost:5173',
  credentials: true
})
```

### Token Expiration

If continuously redirected to login:

1. Clear localStorage: `localStorage.clear()`
2. Verify refresh token endpoint
3. Check token expiration times

### API Endpoint Errors

Check `src/services/apiEndpoints.js` matches backend routes:

```javascript
// Example: Verify /v1/auth/login exists on backend
```

## Contributing

- Follow existing code structure
- Use React functional components with hooks
- Add PropTypes for component props
- Keep components small and focused

## License

Proprietary - RestroMaxx SaaS

## Support

For issues or questions, contact support@restaurentsaas.com

