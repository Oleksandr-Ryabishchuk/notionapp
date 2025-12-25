# Notion App - Multi-Tab Session Tracker

An Angular application that demonstrates reliable session presence tracking across multiple browser tabs and devices using Supabase authentication and a three-state presence model.

## 🎯 What This App Does

Track which browser tabs are active, idle, or stale across multiple devices while logged into your account. See real-time session information grouped by device with intelligent presence detection that doesn't flicker.

**Key Features:**
- ✅ Secure authentication (Supabase Auth)
- ✅ Multi-tab tracking with unique IDs per tab and device
- ✅ Three-state presence model (Active → Idle → Stale)
- ✅ Real-time heartbeat every 30 seconds
- ✅ 5-second UI refresh for instant feedback
- ✅ No unload event reliance (graceful background handling)
- ✅ Responsive grid layout
- ✅ Color-coded tab states
- ✅ Smart "last seen" timestamps

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm 11.6.0+
- Modern browser (Chrome, Firefox, Safari, Edge)

### Installation & Run

```bash
# Navigate to project
cd notionapp

# Install dependencies
npm install

# Start development server
npm start
```

The app will open at `http://localhost:4200`

### Pages
1. **Login** (`/login`) - Sign in with email/password
2. **Signup** (`/signup`) - Create new account
3. **Dashboard** (`/app`) - Main app showing active tabs (protected route)

### Dashboard Features
- Header with active tab count and sign out
- Device groups (responsive grid)
- Tab cards with color-coded states:
  - 🟢 **Active** - Tab in focus or recently used (green)
  - 🟠 **Idle** - 5-30 min of inactivity (orange)
  - ⚫ **Stale** - 30+ min abandoned (gray)
- Tab details: state, last seen, user agent
- [CURRENT] badge on active tab

## 🔧 Architecture

### Services
- **AuthService** - Supabase authentication
- **SessionService** - Device/tab ID management
- **PresenceService** - Activity tracking & heartbeat

### Components
- **LoginComponent** - Sign in
- **SignupComponent** - Sign up
- **DashboardComponent** - Tab tracker (protected)

### Guards
- **authGuard** - Route protection

## 💾 Database

Supabase `user_tabs` table stores:
- user_id, device_id, tab_id (composite key)
- is_active, last_seen, user_agent, created_at

## 🧪 Testing

### Test Same Browser
1. Open dashboard in Tab A
2. Open in Tab B
3. Both show in dashboard, grouped by device
4. Switch tabs - [CURRENT] badge moves

### Test Multiple Devices
1. Open on Device A
2. Open on Device B with same account
3. Dashboard shows tabs grouped by device ID

### Test State Transitions
1. Open tab → ACTIVE (green)
2. Wait 5+ min → IDLE (orange)
3. Wait 30+ min → STALE (gray)
4. Click tab → ACTIVE again (instant)

## ⚙️ Configuration

Supabase setup in `src/environments/environment.ts`:
```typescript
export const environment = {
  supabaseUrl: 'https://zqpezexjcilfatwgbduv.supabase.co',
  supabaseKey: '[API_KEY]'
};
```

## 🎯 Presence Strategy

**Three-State Model** prevents flickering:
- **Active** (<5 min): Currently in use
- **Idle** (5-30 min): Background tab
- **Stale** (30+ min): Likely abandoned

**Why this works:**
- Smooth transitions (no rapid flickering)
- Realistic user behavior
- Tolerates browser throttling
- Clear visual feedback

## 🏗️ Project Structure

```
src/app/
├── services/
│   ├── auth.service.ts
│   ├── session.service.ts
│   └── presence.service.ts
├── pages/
│   ├── login/
│   ├── signup/
│   └── dashboard/
├── guards/
│   └── auth.guard.ts
├── app.ts (root component)
└── app.routes.ts (routing)
```

## 🚀 Build & Deploy

```bash
# Production build
npm run build

# Output in dist/notionapp/
```

## 📝 Key Implementation Details

- **localStorage** - deviceId (persists across tabs)
- **sessionStorage** - tabId (unique per tab)
- **Activity tracking** - Focus, visibility, interactions
- **Heartbeat** - 30-second sync to database
- **UI refresh** - 5-second poll for updates

## 🐛 Troubleshooting

**Blank page?** → Check DevTools (F12) → Console for errors  
**Tabs not showing?** → Refresh page, check network  
**Not seeing other tabs?** → Open another tab, wait 5 seconds

## 🎓 Demonstrates

- Angular 21 standalone components
- Functional route guards
- RxJS Observables/Subjects
- Supabase integration
- Real-time database sync
- State management patterns
- Responsive design

---

**Ready to see it in action?** → Run `npm start` and open http://localhost:4200
