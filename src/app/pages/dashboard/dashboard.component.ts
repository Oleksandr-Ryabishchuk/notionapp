import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PresenceService } from '../../services/presence.service';
import { AuthService } from '../../services/auth.service';
import { TabsStore, type Tab } from '../../services/tabs.store';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent implements OnInit, OnDestroy {
  currentTabId: string = '';
  destroy$ = new Subject<void>();
  private presenceService = inject(PresenceService);
  private tabsStore = inject(TabsStore);
  private auth = inject(AuthService)
  private router = inject(Router)

  // Store signals (reactive)
  allTabs = this.tabsStore.allTabs;
  groupedTabs = this.tabsStore.groupedTabs;
  activeTabs = this.tabsStore.activeTabs;
  activeTabs$ = this.tabsStore.activeTabs$;
  isLoading = this.tabsStore.isLoading;
  error = this.tabsStore.error;

  
  ngOnInit() {
    this.auth.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        if (user) {
          this.presenceService.initializePresence(user.id);
          this.tabsStore.initializeTabs(user.id);
        }
      });

    this.presenceService.tabPresence$
      .pipe(takeUntil(this.destroy$))
      .subscribe(presenceService => {
        if (presenceService) {
          this.currentTabId = presenceService.tabId;
        }
      });
  }

  ngOnDestroy(): void {
    this.tabsStore.cleanup();
    this.destroy$.next();
    this.destroy$.complete();
  }

  getTabState(tab: Tab): string {
    return this.tabsStore.getTabState(tab);
  }

  formatLastSeen(dateString: string): string {
    return this.tabsStore.formatLastSeen(dateString);
  }

  isCurrentTab(tabId: string): boolean {
    return this.tabsStore.isCurrentTab(tabId, this.currentTabId)
  }

  async signOut() {
    try {
      this.tabsStore.cleanup();
      await this.auth.signOut();
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  }  
}