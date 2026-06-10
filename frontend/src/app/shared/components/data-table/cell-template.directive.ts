import { Directive, inject, input, TemplateRef } from '@angular/core';

interface CellContext {
  $implicit: unknown;
}

/**
 * Lets a parent supply a custom cell renderer for a given column key:
 *   <ng-template appCellTemplate="status" let-row>
 *     <app-status-chip [value]="row.status" />
 *   </ng-template>
 *
 * The context guard types `let-row` so strict templates accept property access
 * on the projected row without each caller needing to cast.
 */
@Directive({ selector: '[appCellTemplate]', standalone: true })
export class CellTemplateDirective {
  readonly columnKey = input.required<string>({ alias: 'appCellTemplate' });
  readonly template = inject<TemplateRef<CellContext>>(TemplateRef);

  static ngTemplateContextGuard(
    _dir: CellTemplateDirective,
    _ctx: unknown,
  ): _ctx is { $implicit: any } {
    return true;
  }
}
