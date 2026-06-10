import { Pipe, PipeTransform } from '@angular/core';

/**
 * Turns enum-style tokens into readable labels: IN_PROGRESS -> "In progress".
 */
@Pipe({ name: 'humanize', standalone: true })
export class HumanizePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) {
      return '';
    }
    const lower = value.replace(/_/g, ' ').toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }
}
