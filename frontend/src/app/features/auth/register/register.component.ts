import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@app/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 class="title">Create account</h2>
    <p class="subtitle">Register as a customer to start raising tickets.</p>

    <form [formGroup]="form" (ngSubmit)="submit()">
      <div class="row">
        <mat-form-field>
          <mat-label>First name</mat-label>
          <input matInput formControlName="firstName" autocomplete="given-name" />
          @if (form.controls.firstName.hasError('required') && form.controls.firstName.touched) {
            <mat-error>Required</mat-error>
          }
        </mat-form-field>
        <mat-form-field>
          <mat-label>Last name</mat-label>
          <input matInput formControlName="lastName" autocomplete="family-name" />
          @if (form.controls.lastName.hasError('required') && form.controls.lastName.touched) {
            <mat-error>Required</mat-error>
          }
        </mat-form-field>
      </div>

      <mat-form-field class="full-width">
        <mat-label>Email</mat-label>
        <input matInput type="email" formControlName="email" autocomplete="email" />
        @if (form.controls.email.hasError('email')) {
          <mat-error>Enter a valid email</mat-error>
        }
      </mat-form-field>

      <mat-form-field class="full-width">
        <mat-label>Password</mat-label>
        <input matInput type="password" formControlName="password" autocomplete="new-password" />
        <mat-hint>At least 8 characters, with a letter and a number</mat-hint>
        @if (form.controls.password.hasError('minlength') && form.controls.password.touched) {
          <mat-error>Password is too short</mat-error>
        }
        @if (form.controls.password.hasError('pattern') && form.controls.password.touched) {
          <mat-error>Must include a letter and a number</mat-error>
        }
      </mat-form-field>

      <mat-form-field class="full-width">
        <mat-label>Organization ID</mat-label>
        <input matInput formControlName="organizationId" />
        <mat-hint>The UUID of your organization (provided by your admin)</mat-hint>
        @if (form.controls.organizationId.hasError('required') && form.controls.organizationId.touched) {
          <mat-error>Organization is required</mat-error>
        }
      </mat-form-field>

      <button
        mat-flat-button
        color="primary"
        class="full-width submit"
        type="submit"
        [disabled]="loading()"
      >
        {{ loading() ? 'Creating account…' : 'Create account' }}
      </button>
    </form>

    <p class="alt">Already registered? <a routerLink="/auth/login">Sign in</a></p>
  `,
  styles: [
    `
      .title {
        margin: 0 0 4px;
        font-size: 22px;
        font-weight: 700;
      }
      .subtitle {
        margin: 0 0 20px;
        color: rgba(0, 0, 0, 0.6);
        font-size: 14px;
      }
      .row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      .submit {
        height: 44px;
        margin-top: 4px;
      }
      .alt {
        text-align: center;
        font-size: 14px;
        margin: 18px 0 0;
      }
    `,
  ],
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: [
      '',
      [
        Validators.required,
        Validators.minLength(8),
        Validators.pattern(/^(?=.*[A-Za-z])(?=.*\d).+$/),
      ],
    ],
    organizationId: ['', [Validators.required]],
  });

  protected submit(): void {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.auth.register(this.form.getRawValue()).subscribe({
      next: () => void this.router.navigateByUrl('/dashboard'),
      error: () => this.loading.set(false),
    });
  }
}
