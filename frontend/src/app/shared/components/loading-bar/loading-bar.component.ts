import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';

/** Indeterminate top progress bar that reserves its height to avoid layout shift. */
@Component({
  selector: 'app-loading-bar',
  standalone: true,
  imports: [MatProgressBarModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bar-slot">
      @if (loading()) {
        <mat-progress-bar mode="indeterminate" />
      }
    </div>
  `,
  styles: [
    `
      .bar-slot {
        height: 4px;
      }
    `,
  ],
})
export class LoadingBarComponent {
  readonly loading = input<boolean>(false);
}
