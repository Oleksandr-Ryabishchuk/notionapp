import { Injectable } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  
  let canActivate = false;
  auth.currentUser$.subscribe(user => {
    if (!user) {
      router.navigate(['/login']);
      canActivate = false;
    } else {
      canActivate = true;
    }
  });
  
  return canActivate;
};
