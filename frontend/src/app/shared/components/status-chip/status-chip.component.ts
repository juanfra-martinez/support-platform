import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { HumanizePipe } from '@app/shared/pipes/humanize.pipe';

/**
 * Renders a ticket status or priority using the shared semantic colour
 * language defined as CSS variables in styles.scss. Used in tables, the
 * dashboard and the ticket detail header so the colour of a state is identical
 * everywhere it appears.
 */
@Component({
  selector: 'app-status-chip',
  standalone: true,
  imports: [HumanizePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="chip" [style.--chip-color]="color()">
      <span class="dot"></span>
      {{ value() | humanize }}
    </span>
  `,
  styles: [
    `
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 2px 10px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 600;
        line-height: 20px;
        color: var(--chip-color);
        background: color-mix(in srgb, var(--chip-color) 12%, transparent);
        border: 1px solid color-mix(in srgb, var(--chip-color) 30%, transparent);
        white-space: nowrap;
      }
      .dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--chip-color);
      }
    `,
  ],
})
export class StatusChipComponent {
  readonly value = input.required<string>();
  readonly kind = input<'status' | 'priority'>('status');

  protected readonly color = computed(() => {
    const token = this.value()?.toLowerCase();
    return `var(--${this.kind()}-${token})`;
  });
}
