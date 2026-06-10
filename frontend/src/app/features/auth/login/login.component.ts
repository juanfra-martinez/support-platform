import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '@app/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 class="title">Sign in</h2>
    <p class="subtitle">Welcome back. Enter your credentials to continue.</p>

    <form [formGroup]="form" (ngSubmit)="submit()">
      <mat-form-field class="full-width">
        <mat-label>Email</mat-label>
        <input
          matInput
          type="email"
          formControlName="email"
          autocomplete="email"
        />
        @if (form.controls.email.hasError('required') && form.controls.email.touched) {
          <mat-error>Email is required</mat-error>
        }
        @if (form.controls.email.hasError('email')) {
          <mat-error>Enter a valid email</mat-error>
        }
      </mat-form-field>

      <mat-form-field class="full-width">
        <mat-label>Password</mat-label>
        <input
          matInput
          [type]="showPassword() ? 'text' : 'password'"
          formControlName="password"
          autocomplete="current-password"
        />
        <button
          mat-icon-button
          matSuffix
          type="button"
          (click)="showPassword.set(!showPassword())"
          [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
        >
          <mat-icon fontSet="material-symbols-outlined">
            {{ showPassword() ? 'visibility_off' : 'visibility' }}
          </mat-icon>
        </button>
        @if (form.controls.password.hasError('required') && form.controls.password.touched) {
          <mat-error>Password is required</mat-error>
        }
      </mat-form-field>

      <button
        mat-flat-button
        color="primary"
        class="full-width submit"
        type="submit"
        [disabled]="loading()"
      >
        {{ loading() ? 'Signing in…' : 'Sign in' }}
      </button>
    </form>

    <p class="alt">
      Need an account? <a routerLink="/auth/register">Create one</a>
    </p>

    <div class="demo">
      <span>Demo accounts (password <code>Password123!</code>):</span>
      <button mat-button type="button" (click)="fill('admin@acme.test')">admin</button>
      <button mat-button type="button" (click)="fill('agent@acme.test')">agent</button>
      <button mat-button type="button" (click)="fill('customer@acme.test')">customer</button>
    </div>
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
      .submit {
        height: 44px;
        margin-top: 4px;
      }
      .alt {
        text-align: center;
        font-size: 14px;
        margin: 18px 0 0;
      }
      .demo {
        margin-top: 18px;
        padding-top: 14px;
        border-top: 1px solid var(--app-border);
        font-size: 12px;
        color: rgba(0, 0, 0, 0.6);
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px;
      }
      code {
        background: rgba(0, 0, 0, 0.05);
        padding: 1px 5px;
        border-radius: 4px;
      }
    `,
  ],
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly loading = signal(false);
  protected readonly showPassword = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  protected fill(email: string): void {
    this.form.patchValue({ email, password: 'Password123!' });
  }

  protected submit(): void {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.auth.login(this.form.getRawValue()).subscribe({
      next: () => {
        const redirectTo =
          this.route.snapshot.queryParamMap.get('redirectTo') ?? '/dashboard';
        void this.router.navigateByUrl(redirectTo);
      },
      error: () => this.loading.set(false),
    });
  }
}
