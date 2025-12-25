import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-tab-list',
  standalone: true,
  imports: [CommonModule],
  template: `<div>Tab List Component</div>`
})
export class TabListComponent {
  @Input() tabs: any[] = [];
}
