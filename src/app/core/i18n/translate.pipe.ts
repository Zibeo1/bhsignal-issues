import { Pipe, PipeTransform } from '@angular/core';

import { TranslationService } from './translation.service';

@Pipe({
  name: 't',
  standalone: true,
  pure: false,
})
export class TranslatePipe implements PipeTransform {
  constructor(private readonly translation: TranslationService) {}

  transform(key: string, params?: Record<string, string | number>): string {
    // Reading the language signal here keeps this impure pipe reactive to switches.
    this.translation.language();
    return this.translation.translate(key, params);
  }
}
