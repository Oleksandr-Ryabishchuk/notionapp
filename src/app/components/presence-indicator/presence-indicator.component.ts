import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-presence-indicator',
  standalone: true,
  imports: [CommonModule],
  template: `<div>Presence Indicator Component</div>`
})
export class PresenceIndicatorComponent {
  @Input() state: 'active' | 'idle' | 'stale' = 'active';
}
