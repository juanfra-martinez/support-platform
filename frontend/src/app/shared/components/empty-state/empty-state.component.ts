import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** An empty screen as an invitation to act, not a dead end. */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty">
      <span class="material-symbols-outlined">{{ icon() }}</span>
      <h3>{{ title() }}</h3>
      @if (message()) {
        <p>{{ message() }}</p>
      }
      <ng-content />
    </div>
  `,
  styles: [
    `
      .empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 56px 24px;
        color: rgba(0, 0, 0, 0.6);
      }
      .material-symbols-outlined {
        font-size: 48px;
        opacity: 0.5;
        margin-bottom: 12px;
      }
      h3 {
        margin: 0 0 4px;
        font-size: 18px;
        font-weight: 600;
        color: rgba(0, 0, 0, 0.82);
      }
      p {
        margin: 0 0 16px;
        font-size: 14px;
        max-width: 360px;
      }
    `,
  ],
})
export class EmptyStateComponent {
  readonly icon = input<string>('inbox');
  readonly title = input.required<string>();
  readonly message = input<string>('');
}
