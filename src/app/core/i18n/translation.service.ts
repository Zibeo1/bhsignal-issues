import { Injectable, signal } from '@angular/core';

export type Language = 'en' | 'bs';

type Dictionary = Record<string, string>;

const STORAGE_KEY = 'bhsignal-language';

const EN: Dictionary = {
  'brand.subtitle': 'Bosnia and Herzegovina',
  'nav.news': 'News',
  'nav.legend': 'Legend',
  'nav.alerts': 'Alerts',
  'nav.login': 'Login',
  'nav.signup': 'Sign up',
  'nav.profile': 'Profile',
  'nav.logout': 'Log out',
  'nav.backToMap': '← Back to map',

  'toolbar.allCategories': 'All',
  'toolbar.searchPlaceholder': 'Search headline, place, category',
  'toolbar.allPrecision': 'All precision',
  'toolbar.clearFocus': 'Clear focus',

  'legend.title': 'Legend',
  'legend.colored': 'Category colored markers',
  'legend.size': 'Larger dots = more stories',
  'legend.window': 'Window = last {h}h',
  'map.refreshIn': 'Refresh in {s}s',

  'feed.live': 'Live Feed',
  'feed.events': '{n} events',
  'feed.empty': 'No stories match the active filters.',
  'feed.unknownLocation': 'Unknown location',

  'notif.title': 'Notifications',
  'notif.subtitle': 'Latest news events arriving from the live feed',
  'notif.markAllRead': 'Mark all read',
  'notif.close': 'Close',
  'notif.all': 'All',
  'notif.unread': 'Unread',
  'notif.allCategories': 'All categories',
  'notif.empty': 'No notifications match the current filter.',
  'notif.new': 'New',
  'notif.updated': 'Updated',
  'notif.read': 'Read',

  'auth.loginTitle': 'Welcome back',
  'auth.loginSubtitle': 'Log in to your BHSignal account',
  'auth.signupTitle': 'Create your account',
  'auth.signupSubtitle': 'Join BHSignal to personalize your feed',
  'auth.name': 'Name',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.loginButton': 'Log in',
  'auth.signupButton': 'Sign up',
  'auth.noAccount': "Don't have an account?",
  'auth.haveAccount': 'Already have an account?',
  'auth.loggingIn': 'Logging in…',
  'auth.creating': 'Creating account…',
  'auth.invalidCredentials': 'Invalid email or password.',
  'auth.emailTaken': 'An account with this email already exists.',
  'auth.genericError': 'Something went wrong. Please try again.',
  'auth.passwordHint': 'At least 6 characters',

  'profile.title': 'Your account',
  'profile.subtitle': 'Manage your BHSignal profile',
  'profile.memberSince': 'Member since',
  'profile.update': 'Save changes',
  'profile.updated': 'Profile updated.',
  'profile.newPassword': 'New password (optional)',
  'profile.delete': 'Delete account',
  'profile.deleteConfirm': 'Delete your account permanently? This cannot be undone.',
  'profile.saving': 'Saving…',

  'lang.label': 'Language',
};

const BS: Dictionary = {
  'brand.subtitle': 'Bosna i Hercegovina',
  'nav.news': 'Vijesti',
  'nav.legend': 'Legenda',
  'nav.alerts': 'Obavijesti',
  'nav.login': 'Prijava',
  'nav.signup': 'Registracija',
  'nav.profile': 'Profil',
  'nav.logout': 'Odjava',
  'nav.backToMap': '← Nazad na mapu',

  'toolbar.allCategories': 'Sve',
  'toolbar.searchPlaceholder': 'Pretraži naslov, mjesto, kategoriju',
  'toolbar.allPrecision': 'Sva preciznost',
  'toolbar.clearFocus': 'Poništi fokus',

  'legend.title': 'Legenda',
  'legend.colored': 'Markeri obojeni po kategoriji',
  'legend.size': 'Veće tačke = više vijesti',
  'legend.window': 'Period = zadnjih {h}h',
  'map.refreshIn': 'Osvježavanje za {s}s',

  'feed.live': 'Live prijenos',
  'feed.events': '{n} događaja',
  'feed.empty': 'Nijedna vijest ne odgovara filterima.',
  'feed.unknownLocation': 'Nepoznata lokacija',

  'notif.title': 'Obavijesti',
  'notif.subtitle': 'Najnoviji događaji sa live prijenosa',
  'notif.markAllRead': 'Označi sve kao pročitano',
  'notif.close': 'Zatvori',
  'notif.all': 'Sve',
  'notif.unread': 'Nepročitano',
  'notif.allCategories': 'Sve kategorije',
  'notif.empty': 'Nema obavijesti za odabrani filter.',
  'notif.new': 'Novo',
  'notif.updated': 'Ažurirano',
  'notif.read': 'Pročitano',

  'auth.loginTitle': 'Dobro došli nazad',
  'auth.loginSubtitle': 'Prijavite se na svoj BHSignal račun',
  'auth.signupTitle': 'Kreirajte račun',
  'auth.signupSubtitle': 'Pridružite se BHSignalu i personalizujte feed',
  'auth.name': 'Ime',
  'auth.email': 'Email',
  'auth.password': 'Lozinka',
  'auth.loginButton': 'Prijava',
  'auth.signupButton': 'Registracija',
  'auth.noAccount': 'Nemate račun?',
  'auth.haveAccount': 'Već imate račun?',
  'auth.loggingIn': 'Prijavljivanje…',
  'auth.creating': 'Kreiranje računa…',
  'auth.invalidCredentials': 'Pogrešan email ili lozinka.',
  'auth.emailTaken': 'Račun sa ovim emailom već postoji.',
  'auth.genericError': 'Nešto je pošlo po zlu. Pokušajte ponovo.',
  'auth.passwordHint': 'Najmanje 6 znakova',

  'profile.title': 'Vaš račun',
  'profile.subtitle': 'Upravljajte svojim BHSignal profilom',
  'profile.memberSince': 'Član od',
  'profile.update': 'Sačuvaj izmjene',
  'profile.updated': 'Profil ažuriran.',
  'profile.newPassword': 'Nova lozinka (opcionalno)',
  'profile.delete': 'Obriši račun',
  'profile.deleteConfirm': 'Trajno obrisati vaš račun? Ovo se ne može poništiti.',
  'profile.saving': 'Spremanje…',

  'lang.label': 'Jezik',
};

const DICTIONARIES: Record<Language, Dictionary> = { en: EN, bs: BS };

@Injectable({ providedIn: 'root' })
export class TranslationService {
  readonly language = signal<Language>(this.readInitialLanguage());

  setLanguage(language: Language): void {
    this.language.set(language);
    globalThis.localStorage?.setItem(STORAGE_KEY, language);
  }

  toggleLanguage(): void {
    this.setLanguage(this.language() === 'en' ? 'bs' : 'en');
  }

  translate(key: string, params?: Record<string, string | number>): string {
    const dict = DICTIONARIES[this.language()];
    let value = dict[key] ?? DICTIONARIES.en[key] ?? key;
    if (params) {
      for (const [name, raw] of Object.entries(params)) {
        value = value.replace(`{${name}}`, String(raw));
      }
    }
    return value;
  }

  private readInitialLanguage(): Language {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
    return stored === 'bs' || stored === 'en' ? stored : 'en';
  }
}
