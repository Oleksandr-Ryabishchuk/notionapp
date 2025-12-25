import { Injectable, signal, computed, effect } from '@angular/core';
import { AuthService } from './auth.service';
import { PresenceService } from './presence.service';

// Interfaces
export interface Tab {
  user_id: string;
  device_id: string;
  tab_id: string;
  user_agent: string;
  is_active: boolean;
  last_seen: string;
  created_at: string;
}

export interface GroupedTabs {
  deviceId: string;
  tabs: Tab[];
}

@Injectable({ providedIn: 'root' })
export class TabsStore {
  // Signals
  private allTabsSignal = signal<Tab[]>([]);
  private isLoadingSignal = signal<boolean>(false);
  private errorSignal = signal<string | null>(null);

  // Public read-only signals
  allTabs = this.allTabsSignal.asReadonly();
  isLoading = this.isLoadingSignal.asReadonly();
  error = this.errorSignal.asReadonly();

  // Computed values
  activeTabs = computed(() => this.allTabsSignal().filter(t => t.is_active));
  activeTabs$ = computed(() => this.activeTabs().length);

  groupedTabs = computed(() => {
    const grouped = new Map<string, Tab[]>();
    
    this.allTabsSignal().forEach(tab => {
      if (!grouped.has(tab.device_id)) {
        grouped.set(tab.device_id, []);
      }
      grouped.get(tab.device_id)!.push(tab);
    });

    return Array.from(grouped.entries()).map(([deviceId, tabs]) => ({
      deviceId,
      tabs
    }));
  });

  private pollingInterval: any = null;
  private userId: string | null = null;

  constructor(
    private auth: AuthService,
    private presenceService: PresenceService
  ) {
    // Subscribe to presence updates and refresh tabs immediately
    this.presenceService.tabPresence$.subscribe((presence) => {
      if (presence && this.userId) {
        // Immediately fetch updated tabs when presence changes
        this.fetchTabs(this.userId);
      }
    });
  }

  /**
   * Fetch tabs for a specific user and start polling
   */
  async initializeTabs(userId: string) {
    this.userId = userId;
    await this.fetchTabs(userId);
    this.startPolling(userId);
  }

  /**
   * Fetch tabs from Supabase for the given user
   */
  async fetchTabs(userId: string) {
    if (!userId) {
      this.errorSignal.set('No user ID provided');
      return;
    }

    this.isLoadingSignal.set(true);
    this.errorSignal.set(null);

    try {
      const supabase = this.auth.getAuthClient();
      
      const { data, error } = await supabase
        .from('user_tabs')
        .select('*')
        .eq('user_id', userId) as { data: Tab[] | null; error: any };

      if (error) {
        this.errorSignal.set(error.message);
        console.error('Failed to fetch tabs:', error);
        return;
      }

      if (data) {
        this.allTabsSignal.set(data);
        console.log('Tabs fetched:', data.length, 'tabs');
      }
    } catch (err: any) {
      this.errorSignal.set(err.message);
      console.error('Error fetching tabs:', err);
    } finally {
      this.isLoadingSignal.set(false);
    }
  }

  /**
   * Start polling for tabs updates every 2 seconds
   * Reduced from 5s to ensure newly opened tabs are reflected quickly
   */
  startPolling(userId: string) {
    // Clear existing polling
    this.stopPolling();

    // Poll every 2 seconds for faster updates
    this.pollingInterval = setInterval(() => {
      this.fetchTabs(userId);
    }, 2000);
  }

  /**
   * Stop polling for tabs updates
   */
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * Get the state of a specific tab (active/idle/stale)
   */
  getTabState(tab: Tab): 'active' | 'idle' | 'stale' {
    const lastSeen = new Date(tab.last_seen);
    const now = new Date();
    const diffMs = now.getTime() - lastSeen.getTime();
    
    if (diffMs > 30 * 60 * 1000) return 'stale';
    if (diffMs > 5 * 60 * 1000) return 'idle';
    return 'active';
  }

  /**
   * Format last seen time in human-readable format
   */
  formatLastSeen(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return date.toLocaleDateString();
  }

  /**
   * Check if a tab is the current tab
   */
  isCurrentTab(tabId: string, currentTabId: string): boolean {
    return tabId === currentTabId;
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.stopPolling();
  }
}
