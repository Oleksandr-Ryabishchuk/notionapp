# System Architecture & Visual Guide

## Component Hierarchy

```
App (Root)
│
└── Router Outlet
    ├── LoginComponent
    │   ├── Email Input
    │   ├── Password Input
    │   ├── Submit Button
    │   ├── Error Display
    │   └── Signup Link
    │
    ├── SignupComponent
    │   ├── Email Input
    │   ├── Password Input
    │   ├── Confirm Password Input
    │   ├── Submit Button
    │   ├── Error Display
    │   └── Login Link
    │
    └── DashboardComponent [authGuard]
        ├── Header Section
        │   ├── Title
        │   ├── Active Tab Counter
        │   └── Sign Out Button
        │
        └── Devices Grid Layout
            ├── Device Group 1
            │   ├── Device ID Heading
            │   └── Tabs List
            │       ├── Tab Item Card
            │       │   ├── Status Indicator (dot)
            │       │   ├── Tab ID
            │       │   ├── Current Badge [if current]
            │       │   └── Details Section
            │       │       ├── State (ACTIVE/IDLE/STALE)
            │       │       ├── Last Seen (smart format)
            │       │       └── User Agent (truncated)
            │       │
            │       └── [More tab items...]
            │
            └── [More device groups...]
```

## Service Architecture

```
Angular App
│
├── AuthService (Supabase Auth)
│   ├── createClient(supabaseUrl, supabaseKey)
│   ├── initializeUser()
│   ├── signUp(email, password)
│   ├── signIn(email, password)
│   ├── signOut()
│   ├── getAuthClient() → SupabaseClient
│   └── currentUser$ (Observable<User>)
│
├── SessionService (Device/Tab IDs)
│   ├── getOrCreateDeviceId()
│   │   └── localStorage['deviceId']
│   ├── getOrCreateTabId()
│   │   └── sessionStorage['tabId']
│   ├── getUserAgent()
│   └── generateUUID()
│
└── PresenceService (Heartbeat & Tracking)
    ├── setupActivityTracking()
    │   ├── window focus/blur events
    │   ├── document visibilitychange
    │   └── user interaction listeners (mouse, keyboard, touch)
    │
    ├── initializePresence(userId)
    │   └── Creates TabPresence object
    │
    ├── startHeartbeat()
    │   ├── Runs every 30 seconds
    │   ├── Updates presence state
    │   └── Calls upsertPresence()
    │
    ├── updatePresenceState()
    │   ├── Calculates timeSinceLastActivity
    │   ├── Determines state (active/idle/stale)
    │   └── Updates tabPresenceSubject
    │
    ├── upsertPresence()
    │   └── Saves to Supabase user_tabs table
    │
    └── tabPresence$ (Observable<TabPresence>)
```

## Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                        USER LOGIN                                │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                    ┌────────▼─────────┐
                    │  LoginComponent  │
                    │  captures email  │
                    │   & password     │
                    └────────┬─────────┘
                             │
                    ┌────────▼──────────────┐
                    │   AuthService.       │
                    │   signIn()           │
                    └────────┬──────────────┘
                             │
            ┌────────────────▼──────────────────┐
            │   Supabase Auth.                 │
            │   Validates credentials          │
            └────────────────┬──────────────────┘
                             │
                    ┌────────▼──────────────┐
                    │ currentUserSubject    │
                    │ emits authenticated  │
                    │ user object          │
                    └────────┬──────────────┘
                             │
            ┌────────────────▼──────────────────┐
            │ DashboardComponent.ngOnInit()     │
            │ Subscribes to currentUser$        │
            └────────────────┬──────────────────┘
                             │
        ┌────────────────────┴──────────────────────┐
        │                                           │
        │                                           │
   ┌────▼────────────────┐            ┌───────────▼────┐
   │ SessionService:     │            │ PresenceService:
   │ • Generate device ID│            │ • Get device ID │
   │ • Generate tab ID   │            │ • Get tab ID    │
   │ • Get user agent    │            │ • Get user agent
   └────┬────────────────┘            └───────────┬────┘
        │                                         │
        └─────────────────┬───────────────────────┘
                          │
                   ┌──────▼──────┐
                   │ Create      │
                   │ TabPresence │
                   │ object      │
                   └──────┬──────┘
                          │
            ┌─────────────┴────────────┐
            │                          │
       ┌────▼────────┐        ┌───────▼──────┐
       │ Start        │        │ Fetch tabs   │
       │ Heartbeat    │        │ from         │
       │ (30 sec)     │        │ Supabase     │
       └────┬────────┘        └───────┬──────┘
            │                         │
       ┌────▼──────────────┐    ┌─────▼────────┐
       │ Every 30 seconds: │    │ GroupedTabs  │
       │ • Update state    │    │ populated    │
       │ • Upsert to DB    │    │ by deviceId  │
       └────┬──────────────┘    └─────┬────────┘
            │                         │
            │        ┌────────────────┴─────────┐
            │        │                          │
            │   ┌────▼────────────┐    ┌───────▼───────┐
            │   │ UI Renders      │    │ DashboardComp │
            │   │ Tab States      │    │ Refreshes:    │
            │   │ (color coded)   │    │ • Every 5 sec │
            │   └─────────────────┘    └───────────────┘
            │
            ▼
   ┌─────────────────────┐
   │ Supabase user_tabs  │
   │ Table Updated       │
   └─────────────────────┘
```

## Tab State Transitions

```
┌─────────────────────────────────────────────────────────┐
│                  TAB STATE MACHINE                      │
└─────────────────────────────────────────────────────────┘

┌──────────────┐
│   ACTIVE     │ ◄────── User focuses tab OR uses keyboard/mouse
│ (0-5 min)    │         lastActivityTime = now
├──────────────┤
│ • Tab focused│
│ • Recent use │
│ • Green dot  │
└────────┬─────┘
         │ (5+ minutes no activity)
         │
         ▼
┌──────────────┐
│   IDLE       │ ◄────── Can return to ACTIVE with user action
│ (5-30 min)   │
├──────────────┤
│ • Tab unfocus│
│ • Not recent │
│ • Orange dot │
└────────┬─────┘
         │ (30+ minutes no activity)
         │
         ▼
┌──────────────┐
│   STALE      │ ◄────── Likely abandoned
│ (30+ min)    │         Still tracked but grayed out
├──────────────┤
│ • Long idle  │
│ • Abandoned? │
│ • Gray dot   │
└──────────────┘
```

## Activity Tracking Events

```
┌────────────────────────────────────────────┐
│      ACTIVITY TRACKING MECHANISMS          │
└────────────────────────────────────────────┘

1. WINDOW FOCUS/BLUR
   ├─ window.addEventListener('focus')
   │  └─ isTabActiveSubject.next(true)
   │     lastActivityTime = Date.now()
   └─ window.addEventListener('blur')
      └─ isTabActiveSubject.next(false)

2. DOCUMENT VISIBILITY
   ├─ document.addEventListener('visibilitychange')
   ├─ if document.visibilityState === 'visible'
   │  └─ Tab just became visible
   └─ else
      └─ Tab just became hidden

3. USER INTERACTIONS
   ├─ mousedown
   ├─ keydown
   └─ touchstart
      └─ All trigger: lastActivityTime = Date.now()

4. HEARTBEAT (30 seconds)
   ├─ Evaluate current state
   ├─ Compare with timeouts
   ├─ Update presence state
   ├─ Save to Supabase (upsert)
   └─ Repeat...
```

## Authentication Flow

```
┌───────────────────────────────────────┐
│     AUTHENTICATION LIFECYCLE          │
└───────────────────────────────────────┘

APP INIT
  │
  ├─ AuthService constructor
  │  └─ createClient(supabaseUrl, key)
  │
  └─ AuthService.initializeUser()
     ├─ getUser() from Supabase Auth
     └─ currentUserSubject.next(user)
        │
        ├─ If user exists → USER LOGGED IN
        │  └─ Emit user object
        │
        └─ If null → NOT LOGGED IN
           └─ Emit null
              │
              ├─ AuthGuard detects null
              └─ Redirect to /login
```

## Database Schema Visualization

```
┌──────────────────────────────────────────────────────┐
│              Supabase user_tabs Table                │
├──────────────────────────────────────────────────────┤
│ Column       │ Type       │ Description              │
├──────────────┼────────────┼──────────────────────────┤
│ user_id      │ UUID       │ Foreign key to auth      │
│ device_id    │ TEXT       │ Unique per device        │
│ tab_id       │ TEXT       │ Unique per tab           │
│ user_agent   │ TEXT       │ Browser/OS info          │
│ is_active    │ BOOLEAN    │ Tab currently focused    │
│ last_seen    │ TIMESTAMP  │ Last activity timestamp  │
│ created_at   │ TIMESTAMP  │ When tab was created     │
│ PRIMARY KEY  │ (user_id, │ Composite key ensures    │
│              │ device_id, │ one record per tab       │
│              │ tab_id)    │ per user per device      │
└──────────────┴────────────┴──────────────────────────┘

Row Level Security:
- Users can ONLY access their own records
- Enforced by Supabase RLS policies
```

## UI Color Coding

```
┌────────────────────────────────────────┐
│          TAB STATE COLORS              │
├────────────────────────────────────────┤
│ STATE  │ DOT COLOR │ CARD COLORS       │
├────────┼───────────┼───────────────────┤
│ ACTIVE │ 🟢 Green  │ Green border      │
│        │           │ Light green bg    │
├────────┼───────────┼───────────────────┤
│ IDLE   │ 🟠 Orange │ Orange border     │
│        │           │ Light orange bg   │
├────────┼───────────┼───────────────────┤
│ STALE  │ ⚫ Gray   │ Gray border       │
│        │           │ Light gray bg     │
│        │           │ Reduced opacity   │
├────────┼───────────┼───────────────────┤
│CURRENT │ 🔵 Blue   │ Blue border       │
│ (Any)  │  outline  │ Blue box shadow   │
│        │           │ Bold highlight    │
└────────┴───────────┴───────────────────┘
```

## File Organization

```
notionapp/
├── src/
│   ├── app/
│   │   ├── services/                 [Core Business Logic]
│   │   │   ├── auth.service.ts       🔐 Authentication
│   │   │   ├── session.service.ts    🔑 ID Management
│   │   │   └── presence.service.ts   ❤️  Heartbeat
│   │   │
│   │   ├── pages/                    [Route Components]
│   │   │   ├── login/                🔓 Sign In
│   │   │   ├── signup/               📝 Register
│   │   │   └── dashboard/            📊 Main App
│   │   │
│   │   ├── guards/                   [Protection]
│   │   │   └── auth.guard.ts         🛡️  Route Guard
│   │   │
│   │   ├── components/               [Reusable UI]
│   │   │   ├── tab-list/             [Placeholder]
│   │   │   └── presence-indicator/   [Placeholder]
│   │   │
│   │   ├── app.ts                    ⚙️  Root Component
│   │   ├── app.routes.ts             🗺️  Routing
│   │   └── app.html                  📄 Root Template
│   │
│   ├── environments/
│   │   └── environment.ts            🔗 Supabase Config
│   │
│   └── index.html
│
├── QUICKSTART.md                     📖 Setup Guide
└── IMPLEMENTATION_CHECKLIST.md       ✅ What's Done
```

---

## Summary: What's Implemented

✅ **Services** - 3 specialized services handling auth, sessions, and presence  
✅ **Components** - 3 pages (login, signup, dashboard) fully styled  
✅ **Routing** - Protected route with auth guard  
✅ **Database** - Supabase integration with real-time sync  
✅ **State Management** - RxJS Observables for clean state flow  
✅ **Presence Logic** - Three-state model preventing flickering  
✅ **UI/UX** - Responsive design with color-coded states  
✅ **Documentation** - Complete guides for setup and usage  

**Ready to run:** `npm start` notionapp
