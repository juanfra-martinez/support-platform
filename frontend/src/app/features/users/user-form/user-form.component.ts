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
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Role } from '@app/models/auth.model';
import {
  CreateUserRequest,
  UpdateUserRequest,
  User,
} from '@app/models/user.model';
import { AuthService } from '@app/services/auth.service';
import { UiNotificationService } from '@app/services/ui-notification.service';
import { UsersService } from '@app/services/users.service';
import { HumanizePipe } from '@app/shared/pipes/humanize.pipe';

export interface UserFormData {
  user?: User;
}

/** Create a new user or edit an existing one. Resolves with the saved User. */
@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatButtonModule,
    HumanizePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ isEdit ? 'Edit user' : 'Invite user' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="form">
        <div class="row">
          <mat-form-field>
            <mat-label>First name</mat-label>
            <input matInput formControlName="firstName" />
          </mat-form-field>
          <mat-form-field>
            <mat-label>Last name</mat-label>
            <input matInput formControlName="lastName" />
          </mat-form-field>
        </div>

        @if (!isEdit) {
          <mat-form-field class="full-width">
            <mat-label>Email</mat-label>
            <input matInput type="email" formControlName="email" />
            @if (form.controls.email.hasError('email')) {
              <mat-error>Enter a valid email</mat-error>
            }
          </mat-form-field>

          <mat-form-field class="full-width">
            <mat-label>Temporary password</mat-label>
            <input matInput type="text" formControlName="password" />
            <mat-hint>At least 8 characters, with a letter and a number</mat-hint>
          </mat-form-field>
        }

        <mat-form-field class="full-width">
          <mat-label>Role</mat-label>
          <mat-select formControlName="role">
            @for (r of roles; track r) {
              <mat-option [value]="r">{{ r | humanize }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        @if (isEdit) {
          <mat-slide-toggle formControlName="isActive">Active</mat-slide-toggle>
        }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="cancel()">Cancel</button>
      <button mat-flat-button color="primary" (click)="save()" [disabled]="saving()">
        {{ saving() ? 'Saving…' : isEdit ? 'Save changes' : 'Create user' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .form {
        display: flex;
        flex-direction: column;
        min-width: min(480px, 80vw);
      }
      .row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
    `,
  ],
})
export class UserFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly usersService = inject(UsersService);
  private readonly auth = inject(AuthService);
  private readonly ui = inject(UiNotificationService);
  private readonly ref =
    inject<MatDialogRef<UserFormComponent, User | undefined>>(MatDialogRef);
  private readonly data = inject<UserFormData>(MAT_DIALOG_DATA);

  protected readonly roles = Object.values(Role);
  protected readonly isEdit = !!this.data?.user;
  protected readonly saving = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    firstName: [this.data?.user?.firstName ?? '', [Validators.required]],
    lastName: [this.data?.user?.lastName ?? '', [Validators.required]],
    email: [this.data?.user?.email ?? '', [Validators.required, Validators.email]],
    password: [
      '',
      this.data?.user
        ? []
        : [
            Validators.required,
            Validators.minLength(8),
            Validators.pattern(/^(?=.*[A-Za-z])(?=.*\d).+$/),
          ],
    ],
    role: [this.data?.user?.role ?? Role.CUSTOMER, [Validators.required]],
    isActive: [this.data?.user?.isActive ?? true],
  });

  protected save(): void {
    if (this.saving()) {
      return;
    }
    const raw = this.form.getRawValue();

    if (this.isEdit && this.data.user) {
      if (
        this.form.controls.firstName.invalid ||
        this.form.controls.lastName.invalid ||
        this.form.controls.role.invalid
      ) {
        this.form.markAllAsTouched();
        return;
      }
      const payload: UpdateUserRequest = {
        firstName: raw.firstName,
        lastName: raw.lastName,
        role: raw.role,
        isActive: raw.isActive,
      };
      this.saving.set(true);
      this.usersService.update(this.data.user.id, payload).subscribe({
        next: (user) => {
          this.ui.success('User updated');
          this.ref.close(user);
        },
        error: () => this.saving.set(false),
      });
    } else {
      if (this.form.invalid) {
        this.form.markAllAsTouched();
        return;
      }
      const payload: CreateUserRequest = {
        email: raw.email,
        password: raw.password,
        firstName: raw.firstName,
        lastName: raw.lastName,
        role: raw.role,
        organizationId: this.auth.user()!.organizationId,
      };
      this.saving.set(true);
      this.usersService.create(payload).subscribe({
        next: (user) => {
          this.ui.success('User created');
          this.ref.close(user);
        },
        error: () => this.saving.set(false),
      });
    }
  }

  protected cancel(): void {
    this.ref.close(undefined);
  }
}
