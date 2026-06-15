import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslationService } from '../../core/i18n/translation.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DatePipe, TranslatePipe],
  templateUrl: './profile.component.html',
  styleUrls: ['../auth/auth.css'],
})
export class ProfileComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly translation = inject(TranslationService);

  readonly user = this.auth.user;
  name = '';
  password = '';
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal(false);

  ngOnInit(): void {
    this.name = this.user()?.name ?? '';
  }

  save(): void {
    if (this.loading()) {
      return;
    }
    this.error.set(null);
    this.success.set(false);
    this.loading.set(true);

    const changes: { name?: string; password?: string } = { name: this.name.trim() };
    if (this.password) {
      changes.password = this.password;
    }

    this.auth.updateProfile(changes).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set(true);
        this.password = '';
      },
      error: () => {
        this.loading.set(false);
        this.error.set(this.translation.translate('auth.genericError'));
      },
    });
  }

  remove(): void {
    if (!globalThis.confirm(this.translation.translate('profile.deleteConfirm'))) {
      return;
    }
    this.auth.deleteAccount().subscribe({
      next: () => this.router.navigateByUrl('/'),
      error: () => this.error.set(this.translation.translate('auth.genericError')),
    });
  }

  logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/');
  }
}
