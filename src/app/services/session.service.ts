import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SessionService {
  
  getOrCreateDeviceId(): string {
    const key = 'deviceId';
    let deviceId = localStorage.getItem(key);
    
    if (!deviceId) {
      deviceId = this.generateUUID();
      localStorage.setItem(key, deviceId);
    }
    return deviceId;
  }

  getOrCreateTabId(): string {
    const key = 'tabId';
    let tabId = sessionStorage.getItem(key);
    
    if (!tabId) {
      tabId = this.generateUUID();
      sessionStorage.setItem(key, tabId);
    }
    return tabId;
  }

  getUserAgent(): string {
    return navigator.userAgent;
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}
