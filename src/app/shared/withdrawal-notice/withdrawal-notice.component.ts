import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, effect, inject, signal } from '@angular/core';
import { WithdrawalNoticeService } from '../../core/services/withdrawal-notice.service';

/**
 * Android-style heads-up notification for a confirmed admin withdrawal.
 *
 * Every value shown is the real one returned by the withdrawal endpoint: the
 * transaction reference, the amount, the destination number and the wallet
 * balance left after the deduction. It is branded as Palpesabet and does not
 * impersonate a payment provider or claim that funds have landed in M-PESA,
 * which the app has no way of knowing.
 */
@Component({
  selector: 'app-withdrawal-notice',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="wn-wrap"
      *ngIf="notices.notice() as n"
      [class.wn-in]="visible()"
      role="status"
      aria-live="polite"
    >
      <article class="wn-card" (click)="dismiss()">
        <header class="wn-head">
          <img class="wn-avatar" src="/assets/icons/palpesabet-mark.png" alt="" />
          <span class="wn-app">Palpesabet</span>
          <span class="wn-dot">•</span>
          <span class="wn-when">Just now</span>
          <svg class="wn-chev" viewBox="0 0 24 24" width="18" height="18" fill="none"
               stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </header>

        <p class="wn-title">Withdrawal confirmed</p>
        <p class="wn-body">
          {{ n.reference }} confirmed. Ksh{{ n.amount | number: '1.2-2' }} withdrawn to
          {{ n.phone }} on {{ shortDate(n.at) }} at {{ shortTime(n.at) }}. New Palpesabet
          balance is Ksh{{ n.balance | number: '1.2-2' }}.
        </p>

        <div class="wn-actions">
          <button type="button" class="wn-btn wn-btn-primary" (click)="dismiss(); $event.stopPropagation()">
            Got it
          </button>
          <button type="button" class="wn-btn" (click)="dismiss(); $event.stopPropagation()">
            Dismiss
          </button>
        </div>
      </article>
    </div>
  `,
  styles: [`
    .wn-wrap {
      position: fixed; z-index: 4000; top: 0; left: 0; right: 0;
      display: flex; justify-content: center;
      padding: 10px 10px 0;
      pointer-events: none;
      /* Sits above the notch / status bar area on installed PWAs. */
      padding-top: calc(10px + env(safe-area-inset-top, 0px));
      transform: translateY(-140%);
      opacity: 0;
      transition: transform .42s cubic-bezier(.16, 1, .3, 1), opacity .28s ease;
    }
    .wn-wrap.wn-in { transform: translateY(0); opacity: 1; }

    .wn-card {
      pointer-events: auto;
      width: 100%; max-width: 430px;
      box-sizing: border-box;
      padding: 13px 15px 11px;
      border-radius: 26px;
      background: #1e2225;
      border: 1px solid rgba(255, 255, 255, .06);
      box-shadow: 0 18px 44px rgba(0, 0, 0, .55);
      color: #e9edf0;
      font-size: 14px;
      line-height: 1.38;
      cursor: pointer;
      user-select: none;
    }

    .wn-head { display: flex; align-items: center; gap: 7px; margin-bottom: 7px; }
    .wn-avatar {
      width: 22px; height: 22px; flex: 0 0 22px;
      border-radius: 50%; object-fit: cover; background: #000;
    }
    .wn-app { font-weight: 700; font-size: 13.5px; color: #f2f5f7; }
    .wn-dot, .wn-when { font-size: 12.5px; color: #9aa3ab; }
    .wn-chev { margin-left: auto; color: #9aa3ab; flex: 0 0 auto; }

    .wn-title { margin: 0 0 2px; font-weight: 700; font-size: 15px; color: #fff; }
    .wn-body { margin: 0; font-size: 13.5px; color: #c7cdd3; }

    .wn-actions { display: flex; gap: 8px; margin-top: 11px; }
    .wn-btn {
      flex: 0 0 auto; padding: 7px 16px;
      border: 0; border-radius: 999px;
      background: #2c3237; color: #dfe4e8;
      font-size: 13px; font-weight: 600; cursor: pointer;
      transition: background .15s ease;
    }
    .wn-btn:hover { background: #363d43; }
    .wn-btn-primary { background: #1f6f3f; color: #eaffef; }
    .wn-btn-primary:hover { background: #24824a; }

    @media (prefers-reduced-motion: reduce) {
      .wn-wrap { transition: opacity .2s ease; transform: none; }
    }
  `],
})
export class WithdrawalNoticeComponent implements OnDestroy {
  readonly notices = inject(WithdrawalNoticeService);
  readonly visible = signal(false);

  /** Let the withdrawal screen settle before the notification drops in. */
  private static readonly ENTER_DELAY_MS = 3200;
  /** How long it stays on screen before sliding back up. */
  private static readonly DWELL_MS = 9000;
  /** Must outlast the slide-out transition above. */
  private static readonly EXIT_MS = 460;

  private enterTimer: ReturnType<typeof setTimeout> | null = null;
  private dwellTimer: ReturnType<typeof setTimeout> | null = null;
  private exitTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const notice = this.notices.notice();
      this.clearTimers();
      if (!notice) {
        this.visible.set(false);
        return;
      }
      this.visible.set(false);
      this.enterTimer = setTimeout(() => {
        this.visible.set(true);
        this.dwellTimer = setTimeout(() => this.dismiss(), WithdrawalNoticeComponent.DWELL_MS);
      }, WithdrawalNoticeComponent.ENTER_DELAY_MS);
    });
  }

  /** Slide out first, then drop the notice so the card is not yanked away. */
  dismiss(): void {
    if (!this.visible()) {
      this.clearTimers();
      this.notices.dismiss();
      return;
    }
    this.visible.set(false);
    this.clearTimers();
    this.exitTimer = setTimeout(() => this.notices.dismiss(), WithdrawalNoticeComponent.EXIT_MS);
  }

  shortDate(d: Date): string {
    return `${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(-2)}`;
  }

  shortTime(d: Date): string {
    const h = d.getHours();
    const suffix = h < 12 ? 'AM' : 'PM';
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12}:${String(d.getMinutes()).padStart(2, '0')} ${suffix}`;
  }

  private clearTimers(): void {
    for (const t of [this.enterTimer, this.dwellTimer, this.exitTimer]) if (t) clearTimeout(t);
    this.enterTimer = this.dwellTimer = this.exitTimer = null;
  }

  ngOnDestroy(): void {
    this.clearTimers();
  }
}
