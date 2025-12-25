import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PresenceService } from './services/presence.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  providers: [PresenceService],
  template: '<router-outlet></router-outlet>',
  styleUrl: './app.scss'
})
export class App {}
