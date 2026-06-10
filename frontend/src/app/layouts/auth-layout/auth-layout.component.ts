import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/** Centered, branded shell for the login and register pages. */
@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="auth-shell">
      <div class="brand">
        <div class="mark">SP</div>
        <div>
          <h1>Support Platform</h1>
          <p>Enterprise support, organized.</p>
        </div>
      </div>
      <div class="auth-card">
        <router-outlet />
      </div>
      <p class="footnote">Internal tooling demo · Angular + NestJS</p>
    </div>
  `,
  styles: [
    `
      .auth-shell {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 20px;
        padding: 24px;
        background:
          radial-gradient(
            1200px 600px at 50% -10%,
            color-mix(in srgb, var(--mat-sys-primary) 14%, transparent),
            transparent
          ),
          var(--app-surface);
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 14px;
      }
      .mark {
        width: 44px;
        height: 44px;
        border-radius: 12px;
        display: grid;
        place-items: center;
        font-weight: 700;
        color: white;
        background: var(--mat-sys-primary);
        letter-spacing: 0.04em;
      }
      h1 {
        margin: 0;
        font-size: 20px;
        font-weight: 700;
        letter-spacing: -0.01em;
      }
      .brand p {
        margin: 2px 0 0;
        font-size: 13px;
        color: rgba(0, 0, 0, 0.6);
      }
      .auth-card {
        width: 100%;
        max-width: 420px;
        background: white;
        border: 1px solid var(--app-border);
        border-radius: 16px;
        padding: 28px;
        box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
      }
      .footnote {
        font-size: 12px;
        color: rgba(0, 0, 0, 0.45);
        margin: 0;
      }
    `,
  ],
})
export class AuthLayoutComponent {}
