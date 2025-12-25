# Anti-Flickering Presence Strategy

## Overview

This application implements the **Three-State Presence Model** to prevent the online/offline flickering problem common in real-time presence systems.

## The Problem: Flickering

In naive implementations with binary online/offline state, flickering occurs when:
- A tab loses focus momentarily → immediately marked offline
- User navigates away then back → rapid on/off/on transitions
- Network hiccup briefly breaks connection → appears to go offline
- Browser throttles background tabs → intermittent heartbeat → appears offline

Result: **Annoying, unreliable presence indicator that doesn't match user perception**

## The Solution: Three-State Model

Instead of binary online/offline, we use three graduated states with different TTLs:

### 🟢 ACTIVE State (0-5 minutes)
**Conditions:**
- Tab has window focus AND
- User activity within last 5 minutes (mouse click, keyboard, touch)

**Meaning:** User is actively engaging with this tab right now.

**TTL:** 5 minutes of inactivity → transitions to IDLE

### 🟠 IDLE State (5-30 minutes)
**Conditions:**
- Tab lacks focus (blurred) OR
- No user activity for 5+ minutes AND window is still open

**Meaning:** Tab is open but user isn't actively using it (minimized, background tab, etc.)

**TTL:** 30 minutes of inactivity → transitions to STALE

### ⚫ STALE State (30+ minutes)
**Conditions:**
- No user activity for 30+ minutes

**Meaning:** Tab has been effectively abandoned.

**TTL:** Indefinite (stays stale until activity resumes)

## Why This Prevents Flickering

1. **Graduated Transitions:** State changes are intentional, based on accumulated time, not reactive to transient events
2. **Hysteresis:** It takes 5 minutes of inactivity to go from ACTIVE → IDLE, and 30 minutes to go IDLE → STALE
3. **Forgives Interruptions:** A brief network glitch doesn't immediately mark user as offline
4. **Matches Reality:** Reflects how users actually perceive their own presence

## Implementation Details

### Heartbeat Mechanism
```typescript
heartbeatInterval = 30000; // 30 seconds
```

- Runs every 30 seconds via RxJS `interval()`
- Conservative enough to survive browser throttling of background tabs
- Even if a heartbeat is missed due to tab throttling, the next one (30 seconds later) will still be within the grace periods
- **Does NOT rely on unload/beforeunload events** (unreliable)

### Activity Tracking
```typescript
setupActivityTracking() {
  window.addEventListener('focus', () => /* isActive = true */);
  window.addEventListener('blur', () => /* isActive = false */);
  document.addEventListener('visibilitychange', () => /* ... */);
  ['mousedown', 'keydown', 'touchstart'].forEach(event => {
    document.addEventListener(event, () => /* lastActivityTime = now */);
  });
}
```

Captures:
- **Focus/Blur:** When user switches tabs
- **Visibility API:** When browser tab becomes hidden/visible (more reliable than focus in some cases)
- **User Interactions:** Mouse clicks, keyboard input, touch events (used to update `lastActivityTime`)

### State Calculation
```typescript
if (timeSinceLastActivity > 30 minutes) {
  state = 'stale';
} else if (timeSinceLastActivity > 5 minutes || !isCurrentlyActive) {
  state = 'idle';
} else {
  state = 'active';
}
```

### Database Sync
```typescript
async upsertPresence() {
  await supabase.from('user_tabs').upsert({
    user_id: userId,
    device_id: deviceId,
    tab_id: tabId,
    is_active: isCurrentlyActive,      // Binary: true/false
    last_seen: lastSeen,               // Timestamp for grace periods
    user_agent: userAgent
  });
}
```

Both `is_active` (binary) and `last_seen` (timestamp) are persisted, allowing client-side state calculation.

## Real-World Scenarios

### Scenario 1: User Opens New Tab
```
Time:   0s     5m     10m    30m    35m
State:  ACTIVE ACTIVE ACTIVE IDLE   IDLE
        ↑
      Tab opened, focus + interaction
```
**No flickering:** Smooth transition after 5 minutes of no activity.

### Scenario 2: User Minimizes Browser
```
Time:   0s     30s    1m     5m     30m    35m
State:  ACTIVE ACTIVE ACTIVE IDLE   STALE  STALE
        ↑                    ↑      ↑
      Window blur        5-min mark 30-min mark
```
**No flickering:** State only changes at timeout boundaries, not on blur event itself.

### Scenario 3: Network Hiccup (heartbeat missed)
```
With Binary Model:           With Three-State Model:
t=0s:  ONLINE                t=0s:  ACTIVE
t=30s: (heartbeat missed)    t=30s: (heartbeat still sends, or gets delayed)
t=35s: OFFLINE ❌             t=35s: Still ACTIVE ✅ (only 5s passed, far from 5-min boundary)
```
**Three-state prevents false offline status.**

### Scenario 4: User Alt-Tabs Away Briefly
```
Time:   0s     1s     2s          3s     4s     5m
State:  ACTIVE IDLE   IDLE        ACTIVE ACTIVE ACTIVE
        ↑      ↑                  ↑
      Focus  Blur                Re-focus
```
**No flickering:** Brief blur → immediate IDLE, but when user returns, goes back to ACTIVE without ever sending offline status to backend.

## Comparison to Alternatives

### Option 1: Binary Online/Offline (❌ Flickering)
- Simplest to implement
- Creates rapid state flipping
- Bad UX: Users appear to go offline for no reason

### Option 2: Leader-Tab Heartbeat (✅ Reduces flickering, but complex)
- One designated tab sends heartbeat for all tabs on device
- Avoids multiple heartbeats from same device
- Harder to implement, requires tab coordination
- Still doesn't address root cause of why binary state flickers

### Option 3: Different TTLs for Active vs Background (✅ Better, but incomplete)
- Active tabs: short TTL (e.g., 30s before stale)
- Background tabs: long TTL (e.g., 5m before stale)
- Helps but doesn't provide intermediate IDLE state
- Still has on/off flickering

### Option 4: Three-State Model (✅✅ Our Choice)
- **Advantages:**
  - Eliminates flickering through graduated state transitions
  - Realistic: matches user perception
  - Simple to understand and implement
  - No complex tab coordination needed
  - Works with any heartbeat interval
  
- **Trade-offs:**
  - Takes up to 5 minutes for ACTIVE tab to show as IDLE
  - Takes up to 30 minutes to show as STALE
  - More complex than binary model, but worth it for UX

## Monitoring & Debugging

The presence service logs state transitions:
```
[Presence] Tab focused - isActive=true
[Presence] State transition: active → idle
[Presence] State transition: idle → stale
```

Check browser console to verify:
1. Activity tracking is firing
2. State transitions happen at expected times
3. Heartbeat is running (every 30s)

## Configuration

To adjust timeouts:

```typescript
// In presence.service.ts
private idleTimeout = 5 * 60 * 1000;      // Change this to adjust ACTIVE→IDLE threshold
private staleTimeout = 30 * 60 * 1000;    // Change this to adjust IDLE→STALE threshold
private heartbeatInterval = 30000;        // Change this to adjust sync frequency
```

### Recommended Settings
- **For production:** idleTimeout=5min, staleTimeout=30min, heartbeat=30s
- **For testing:** idleTimeout=30s, staleTimeout=2min, heartbeat=10s
- **For real-time chat:** idleTimeout=2min, staleTimeout=10min, heartbeat=15s

## Testing

### Manual Test: Verify No Flickering
1. Open app in one tab
2. Open same app in another tab (same device)
3. Both tabs should show with ACTIVE state
4. Switch to different window (blur tab)
5. Wait 5+ seconds, then look at dashboard
6. Blurred tab should show IDLE (not immediate)
7. Wait 30+ minutes (or change timeout values for testing)
8. Should transition to STALE

### Automated Test: State Machine
```typescript
describe('PresenceService', () => {
  it('should not flicker between ACTIVE and IDLE on brief focus loss', () => {
    // Set idleTimeout to 100ms for testing
    // Blur tab
    // Wait 50ms
    // Check state is still ACTIVE (not jumped to IDLE yet)
    // Focus tab back
    // Check state is ACTIVE
  });
});
```

## Conclusion

The **three-state presence model** is a simple yet highly effective strategy for preventing online/offline flickering. By using graduated state transitions with time-based TTLs, we provide a more realistic and stable presence indicator that matches user expectations.

This aligns with how many modern real-time applications (Slack, Discord, etc.) handle presence, and proves to be the sweet spot between simplicity and reliability.
