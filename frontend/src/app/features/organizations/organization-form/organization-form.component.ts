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
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import {
  CreateOrganizationRequest,
  Organization,
  UpdateOrganizationRequest,
} from '@app/models/organization.model';
import { OrganizationsService } from '@app/services/organizations.service';
import { UiNotificationService } from '@app/services/ui-notification.service';

export interface OrganizationFormData {
  organization?: Organization;
}

/** Create or edit an organization (tenant). Resolves with the saved record. */
@Component({
  selector: 'app-organization-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ isEdit ? 'Edit organization' : 'New organization' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="form">
        <mat-form-field class="full-width">
          <mat-label>Name</mat-label>
          <input matInput formControlName="name" />
          @if (form.controls.name.hasError('required') && form.controls.name.touched) {
            <mat-error>Name is required</mat-error>
          }
        </mat-form-field>

        <mat-form-field class="full-width">
          <mat-label>Slug</mat-label>
          <input matInput formControlName="slug" />
          <mat-hint>Lowercase letters, numbers and hyphens</mat-hint>
          @if (form.controls.slug.hasError('pattern') && form.controls.slug.touched) {
            <mat-error>Use lowercase letters, numbers and hyphens only</mat-error>
          }
        </mat-form-field>

        @if (isEdit) {
          <mat-slide-toggle formControlName="isActive">Active</mat-slide-toggle>
        }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="cancel()">Cancel</button>
      <button mat-flat-button color="primary" (click)="save()" [disabled]="saving()">
        {{ saving() ? 'Saving…' : isEdit ? 'Save changes' : 'Create organization' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .form {
        display: flex;
        flex-direction: column;
        min-width: min(460px, 80vw);
      }
    `,
  ],
})
export class OrganizationFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly organizationsService = inject(OrganizationsService);
  private readonly ui = inject(UiNotificationService);
  private readonly ref =
    inject<MatDialogRef<OrganizationFormComponent, Organization | undefined>>(
      MatDialogRef,
    );
  private readonly data = inject<OrganizationFormData>(MAT_DIALOG_DATA);

  protected readonly isEdit = !!this.data?.organization;
  protected readonly saving = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    name: [this.data?.organization?.name ?? '', [Validators.required]],
    slug: [
      this.data?.organization?.slug ?? '',
      [Validators.required, Validators.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)],
    ],
    isActive: [this.data?.organization?.isActive ?? true],
  });

  protected save(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const raw = this.form.getRawValue();

    if (this.isEdit && this.data.organization) {
      const payload: UpdateOrganizationRequest = {
        name: raw.name,
        slug: raw.slug,
        isActive: raw.isActive,
      };
      this.organizationsService
        .update(this.data.organization.id, payload)
        .subscribe({
          next: (org) => {
            this.ui.success('Organization updated');
            this.ref.close(org);
          },
          error: () => this.saving.set(false),
        });
    } else {
      const payload: CreateOrganizationRequest = {
        name: raw.name,
        slug: raw.slug,
      };
      this.organizationsService.create(payload).subscribe({
        next: (org) => {
          this.ui.success('Organization created');
          this.ref.close(org);
        },
        error: () => this.saving.set(false),
      });
    }
  }

  protected cancel(): void {
    this.ref.close(undefined);
  }
}
