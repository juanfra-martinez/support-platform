import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import {
  CreateTicketRequest,
  Ticket,
  TicketPriority,
  UpdateTicketRequest,
} from '@app/models/ticket.model';
import { TicketsService } from '@app/services/tickets.service';
import { UiNotificationService } from '@app/services/ui-notification.service';
import { HumanizePipe } from '@app/shared/pipes/humanize.pipe';

export interface TicketFormData {
  ticket?: Ticket;
}

/**
 * Create or edit a ticket. Opened as a dialog; resolves with the saved Ticket
 * (or undefined if cancelled) so the caller can refresh its list.
 */
@Component({
  selector: 'app-ticket-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    HumanizePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ isEdit ? 'Edit ticket' : 'New ticket' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="form">
        <mat-form-field class="full-width">
          <mat-label>Title</mat-label>
          <input matInput formControlName="title" maxlength="160" />
          @if (form.controls.title.hasError('required') && form.controls.title.touched) {
            <mat-error>Title is required</mat-error>
          }
        </mat-form-field>

        <mat-form-field class="full-width">
          <mat-label>Description</mat-label>
          <textarea matInput rows="5" formControlName="description"></textarea>
          @if (form.controls.description.hasError('required') && form.controls.description.touched) {
            <mat-error>Description is required</mat-error>
          }
        </mat-form-field>

        <div class="row">
          <mat-form-field>
            <mat-label>Priority</mat-label>
            <mat-select formControlName="priority">
              @for (p of priorities; track p) {
                <mat-option [value]="p">{{ p | humanize }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field>
            <mat-label>Category</mat-label>
            <input matInput formControlName="category" maxlength="80" />
          </mat-form-field>
        </div>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="cancel()">Cancel</button>
      <button
        mat-flat-button
        color="primary"
        (click)="save()"
        [disabled]="saving()"
      >
        {{ saving() ? 'Saving…' : isEdit ? 'Save changes' : 'Create ticket' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .form {
        display: flex;
        flex-direction: column;
        min-width: min(520px, 80vw);
      }
      .row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
    `,
  ],
})
export class TicketFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly ticketsService = inject(TicketsService);
  private readonly ui = inject(UiNotificationService);
  private readonly ref =
    inject<MatDialogRef<TicketFormComponent, Ticket | undefined>>(MatDialogRef);
  private readonly data = inject<TicketFormData>(MAT_DIALOG_DATA);

  protected readonly priorities = Object.values(TicketPriority);
  protected readonly isEdit = !!this.data?.ticket;
  protected readonly saving = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    title: [
      this.data?.ticket?.title ?? '',
      [Validators.required, Validators.minLength(3)],
    ],
    description: [
      this.data?.ticket?.description ?? '',
      [Validators.required, Validators.minLength(3)],
    ],
    priority: [this.data?.ticket?.priority ?? TicketPriority.MEDIUM],
    category: [this.data?.ticket?.category ?? ''],
  });

  protected save(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const raw = this.form.getRawValue();

    if (this.isEdit && this.data.ticket) {
      const payload: UpdateTicketRequest = {
        title: raw.title,
        description: raw.description,
        priority: raw.priority,
        category: raw.category || undefined,
      };
      this.ticketsService.update(this.data.ticket.id, payload).subscribe({
        next: (ticket) => {
          this.ui.success('Ticket updated');
          this.ref.close(ticket);
        },
        error: () => this.saving.set(false),
      });
    } else {
      const payload: CreateTicketRequest = {
        title: raw.title,
        description: raw.description,
        priority: raw.priority,
        category: raw.category || undefined,
      };
      this.ticketsService.create(payload).subscribe({
        next: (ticket) => {
          this.ui.success('Ticket created');
          this.ref.close(ticket);
        },
        error: () => this.saving.set(false),
      });
    }
  }

  protected cancel(): void {
    this.ref.close(undefined);
  }
}
