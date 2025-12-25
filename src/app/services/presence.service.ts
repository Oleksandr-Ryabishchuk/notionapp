import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject, interval } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';

interface TabPresence {
  userId: string;
  deviceId: string;
  tabId: string;
  isActive: boolean;
  lastSeen: Date;
  userAgent: string;
  state: 'active' | 'idle' | 'stale';
}

/**
 * ANTI-FLICKERING STRATEGY: Three-State Presence Model
 * 
 * Instead of binary online/offline state (which causes rapid flickering when:
 * - Tab loses focus briefly
 * - Network hiccups temporarily break connection
 * - Browser throttles background tabs
 * 
 * We use THREE states with graduated TTLs:
 * 
 * 🟢 ACTIVE (0-5 min):
 *    - Tab has focus AND
 *    - User activity within last 5 minutes (mouse, keyboard, touch)
 *    - Indicates user is actively engaging
 * 
 * 🟠 IDLE (5-30 min):
 *    - Tab lacks focus OR
 *    - No user activity for 5+ minutes
 *    - Indicates tab is open but backgrounded/inactive
 * 
 * ⚫ STALE (30+ min):
 *    - No user activity for 30+ minutes
 *    - Indicates tab is effectively abandoned
 * 
 * BENEFITS:
 * ✓ Prevents flickering: State transitions are intentional, not reactive
 * ✓ Realistic: Matches actual user behavior (active → idle → stale)
 * ✓ Tolerates browser throttling: 30-second heartbeat survives bg tab slowdown
 * ✓ No unload events: Doesn't rely on unreliable beforeunload/unload
 * ✓ Graceful degradation: If heartbeat misses, state naturally expires
 */
@Injectable({ providedIn: 'root' })
export class PresenceService implements OnDestroy {
  private destroy$ = new Subject<void>();
  private tabPresenceSubject = new BehaviorSubject<TabPresence | null>(null);
  public tabPresence$ = this.tabPresenceSubject.asObservable();
  
  private isTabActiveSubject = new BehaviorSubject<boolean>(true);
  
  // HEARTBEAT CONFIGURATION
  private heartbeatInterval = 30000; // 30 seconds - conservative to tolerate browser throttling
  
  // TTL CONFIGURATION FOR STATE TRANSITIONS
  private idleTimeout = 5 * 60 * 1000;   // 5 minutes before ACTIVE → IDLE
  private staleTimeout = 30 * 60 * 1000; // 30 minutes before IDLE → STALE
  
  private lastActivityTime = Date.now();

  constructor(
    private auth: AuthService,
    private session: SessionService
  ) {
    this.setupActivityTracking();
  }

  private setupActivityTracking() {
    // Track focus/blur events - immediate state change
    window.addEventListener('focus', () => {
      this.isTabActiveSubject.next(true);
      this.lastActivityTime = Date.now();
      console.log('[Presence] Tab focused - isActive=true');
    });

    window.addEventListener('blur', () => {
      this.isTabActiveSubject.next(false);
      console.log('[Presence] Tab blurred - isActive=false');
    });

    // Track visibility API - more reliable than focus/blur for some browsers
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.isTabActiveSubject.next(true);
        this.lastActivityTime = Date.now();
        console.log('[Presence] Document visible - isActive=true');
      } else {
        this.isTabActiveSubject.next(false);
        console.log('[Presence] Document hidden - isActive=false');
      }
    });

    // Track user interactions - updates lastActivityTime
    ['mousedown', 'keydown', 'touchstart'].forEach(event => {
      document.addEventListener(event, () => {
        this.lastActivityTime = Date.now();
      }, { capture: true });
    });
  }

  initializePresence(userId: string) {
    const deviceId = this.session.getOrCreateDeviceId();
    const tabId = this.session.getOrCreateTabId();
    const userAgent = this.session.getUserAgent();

    const presence: TabPresence = {
      userId,
      deviceId,
      tabId,
      isActive: true,
      lastSeen: new Date(),
      userAgent,
      state: 'active'
    };

    this.tabPresenceSubject.next(presence);

    // Immediately upsert to database so other tabs see this tab instantly
    this.upsertPresence();

    // Start heartbeat for periodic updates
    this.startHeartbeat();
  }

  private startHeartbeat() {
    interval(this.heartbeatInterval)
      .pipe(takeUntil(this.destroy$))
      .subscribe(async () => {
        this.updatePresenceState();
        await this.upsertPresence();
      });
  }

  private updatePresenceState() {
    const presence = this.tabPresenceSubject.value;
    if (!presence) return;

    const now = Date.now();
    const timeSinceLastActivity = now - this.lastActivityTime;
    const isCurrentlyActive = this.isTabActiveSubject.value;

    // State machine for anti-flickering three-state model
    let state: 'active' | 'idle' | 'stale' = 'active';
    
    if (timeSinceLastActivity > this.staleTimeout) {
      // More than 30 min: definitely STALE
      state = 'stale';
    } else if (timeSinceLastActivity > this.idleTimeout || !isCurrentlyActive) {
      // More than 5 min inactive, OR tab is currently unfocused: IDLE
      state = 'idle';
    } else {
      // Less than 5 min AND tab has focus: ACTIVE
      state = 'active';
    }

    const oldState = presence.state;
    const updatedPresence: TabPresence = {
      ...presence,
      isActive: isCurrentlyActive,
      lastSeen: new Date(),
      state
    };

    // Only log state transitions to reduce noise
    if (oldState !== state) {
      console.log(`[Presence] State transition: ${oldState} → ${state}`);
    }

    this.tabPresenceSubject.next(updatedPresence);
  }

  async upsertPresence() {
    const presence = this.tabPresenceSubject.value;
    if (!presence) return;

    const supabase = this.auth.getAuthClient();
    
    const { error } = await supabase
      .from('user_tabs')
      .upsert(
        {
          user_id: presence.userId,
          device_id: presence.deviceId,
          tab_id: presence.tabId,
          user_agent: presence.userAgent,
          is_active: presence.isActive,
          last_seen: presence.lastSeen.toISOString()
        },
        { onConflict: 'user_id,device_id,tab_id' }
      );

    if (error) {
      console.error('Failed to upsert presence:', error);
    }
  }

  getPresenceState() {
    return this.tabPresenceSubject.value;
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
