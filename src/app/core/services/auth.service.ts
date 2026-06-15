import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Inject, Injectable, computed, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { API_BASE_URL } from '../config/api-base-url.token';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

interface AuthResponse {
  token: string;
  user: AuthUser;
}

const TOKEN_KEY = 'bhsignal-auth-token';
const USER_KEY = 'bhsignal-auth-user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _user = signal<AuthUser | null>(this.readStoredUser());
  private readonly _token = signal<string | null>(this.readStoredToken());

  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => this._user() !== null);

  constructor(
    @Inject(API_BASE_URL) private readonly apiBaseUrl: string,
    private readonly http: HttpClient,
  ) {}

  get token(): string | null {
    return this._token();
  }

  register(name: string, email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiBaseUrl}/api/v1/auth/register`, { name, email, password })
      .pipe(tap((res) => this.persistSession(res)));
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiBaseUrl}/api/v1/auth/login`, { email, password })
      .pipe(tap((res) => this.persistSession(res)));
  }

  updateProfile(changes: { name?: string; password?: string }): Observable<AuthUser> {
    return this.http
      .put<AuthUser>(`${this.apiBaseUrl}/api/v1/auth/me`, changes, { headers: this.authHeaders() })
      .pipe(tap((user) => this.setUser(user)));
  }

  deleteAccount(): Observable<void> {
    return this.http
      .delete<void>(`${this.apiBaseUrl}/api/v1/auth/me`, { headers: this.authHeaders() })
      .pipe(tap(() => this.logout()));
  }

  logout(): void {
    this._user.set(null);
    this._token.set(null);
    globalThis.localStorage?.removeItem(TOKEN_KEY);
    globalThis.localStorage?.removeItem(USER_KEY);
  }

  private authHeaders(): Record<string, string> {
    const token = this._token();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private setUser(user: AuthUser): void {
    this._user.set(user);
    globalThis.localStorage?.setItem(USER_KEY, JSON.stringify(user));
  }

  private persistSession(res: AuthResponse): void {
    this._token.set(res.token);
    this.setUser(res.user);
    globalThis.localStorage?.setItem(TOKEN_KEY, res.token);
  }

  private readStoredToken(): string | null {
    return globalThis.localStorage?.getItem(TOKEN_KEY) ?? null;
  }

  private readStoredUser(): AuthUser | null {
    const raw = globalThis.localStorage?.getItem(USER_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  }

  static isConflict(error: unknown): boolean {
    return error instanceof HttpErrorResponse && error.status === 409;
  }

  static isUnauthorized(error: unknown): boolean {
    return error instanceof HttpErrorResponse && error.status === 401;
  }
}
