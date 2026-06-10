import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Consistent page title block with an optional subtitle and a projected action
 * area (buttons) on the right.
 */
@Component({
  selector: 'app-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="page-header">
      <div class="titles">
        <h1>{{ title() }}</h1>
        @if (subtitle()) {
          <p>{{ subtitle() }}</p>
        }
      </div>
      <div class="actions">
        <ng-content />
      </div>
    </header>
  `,
  styles: [
    `
      .page-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 24px;
      }
      h1 {
        margin: 0;
        font-size: 24px;
        font-weight: 700;
        letter-spacing: -0.02em;
      }
      p {
        margin: 4px 0 0;
        color: rgba(0, 0, 0, 0.6);
        font-size: 14px;
      }
      .actions {
        display: flex;
        gap: 8px;
        flex-shrink: 0;
      }
    `,
  ],
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
}
