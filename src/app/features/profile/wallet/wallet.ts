import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { GameSocketService } from '../../../core/services/game-socket.service';

@Component({
  selector: 'app-wallet',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="wallet-page-wrapper">
      <div class="wallet-card-container">
        
        <!-- TOP CURRENT BALANCE CARD -->
        <div class="balance-banner-card">
          <div class="lbl-title">Current Balance</div>
          <div class="lbl-sub">Available wallet amount</div>
          <div class="val-amount">KES {{ (userBalance$ | async) | number:'1.0-2' }}</div>
        </div>

        <!-- SEGMENTED PILL TAB SWITCHER -->
        <div class="segmented-control-row">
          <button type="button" class="seg-btn" [class.active]="activeTab === 'deposit'" (click)="selectTab('deposit')">
            Deposit
          </button>
          <button type="button" class="seg-btn" [class.active]="activeTab === 'withdraw'" (click)="selectTab('withdraw')">
            Withdraw
          </button>
        </div>

        <!-- DEPOSIT STANDALONE CARD -->
        <div *ngIf="activeTab === 'deposit'" class="main-form-box">
          <h2 class="box-heading">Deposit</h2>
          <p class="box-subheading">Send money into your account</p>

          <!-- QUICK PRESETS -->
          <div class="presets-row">
            <button type="button" class="preset-pill" (click)="setDepositAmount(minDepositAmount)">+{{ minDepositAmount | number }}</button>
            <button type="button" class="preset-pill" (click)="setDepositAmount(2000)">+2,000</button>
            <button type="button" class="preset-pill" (click)="setDepositAmount(5000)">+5,000</button>
            <button type="button" class="preset-pill" (click)="setDepositAmount(10000)">+10,000</button>
          </div>

          <!-- COOLDOWN BANNER IF IN RATE LIMIT LOCKOUT -->
          <div *ngIf="depositCooldownSeconds > 0" class="cooldown-box">
            <div class="cooldown-head">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>Deposit Cooldown Active</span>
            </div>
            <p class="cooldown-desc">
              Too many rapid deposit prompts. To prevent M-Pesa provider restrictions, please wait before trying again:
            </p>
            <div class="cooldown-timer">
              {{ formatCooldown(depositCooldownSeconds) }}
            </div>
          </div>

          <!-- PHONE NUMBER FIELD -->
          <div class="field-wrap">
            <label class="field-lbl">Phone Number</label>
            <div class="phone-box">
              <select class="code-select">
                <option value="+254">+254</option>
              </select>
              <input type="tel" [(ngModel)]="depositPhone" placeholder="7XXXXXXXX" class="phone-input" autocomplete="tel" (ngModelChange)="stripPrefix($event, 'deposit')" />
            </div>
          </div>

          <!-- AMOUNT FIELD -->
          <div class="field-wrap">
            <label class="field-lbl">Amount</label>
            <input type="number" [(ngModel)]="depositVal" [placeholder]="minDepositAmount.toString()" class="amount-input" [min]="minDepositAmount" />
            <span class="help-lbl">Minimum KES {{ minDepositAmount | number }}.</span>
          </div>

          <!-- STATUS ALERT IF ANY -->
          <div *ngIf="depositStatusMsg" class="alert-msg" [class.err]="depositStatusType === 'error'" [class.ok]="depositStatusType === 'success'">
            {{ depositStatusMsg }}
          </div>

          <!-- BOTTOM ACTION BUTTONS -->
          <div class="actions-row">
            <button type="button" class="btn-back" (click)="goBack()">BACK</button>
            <button type="button" class="btn-green" [disabled]="isDepositSubmitting || depositCooldownSeconds > 0" (click)="submitDeposit()">
              <ng-container *ngIf="depositCooldownSeconds > 0">
                Try in {{ formatCooldown(depositCooldownSeconds) }}
              </ng-container>
              <ng-container *ngIf="depositCooldownSeconds <= 0">
                {{ isDepositSubmitting ? 'Initiating...' : 'Deposit' }}
              </ng-container>
            </button>
          </div>
        </div>

        <!-- WITHDRAWALS STANDALONE CARD -->
        <div *ngIf="activeTab === 'withdraw'" class="main-form-box">
          <h2 class="box-heading">Withdrawals</h2>
          <p class="box-subheading">Withdraw from your wallet</p>

          <!-- QUICK PRESETS -->
          <div class="presets-row">
            <button type="button" class="preset-pill" (click)="addWithdrawAmount(200)">+200</button>
            <button type="button" class="preset-pill" (click)="addWithdrawAmount(500)">+500</button>
            <button type="button" class="preset-pill" (click)="addWithdrawAmount(1000)">+1,000</button>
            <button type="button" class="preset-pill" (click)="addWithdrawAmount(5000)">+5,000</button>
          </div>

          <!-- PHONE NUMBER FIELD -->
          <div class="field-wrap">
            <label class="field-lbl">Phone Number</label>
            <div class="phone-box">
              <select class="code-select">
                <option value="+254">+254</option>
              </select>
              <input type="tel" [(ngModel)]="withdrawPhone" placeholder="7XXXXXXXX" class="phone-input" autocomplete="tel" (ngModelChange)="stripPrefix($event, 'withdraw')" />
            </div>
          </div>

          <!-- AMOUNT FIELD -->
          <div class="field-wrap">
            <label class="field-lbl">Amount</label>
            <input type="number" [(ngModel)]="withdrawVal" placeholder="200" class="amount-input" min="200" max="300000" />
            <span class="help-lbl">Daily withdrawal limits: Minimum KES 200, Maximum KES 300,000.</span>
          </div>

          <!-- STATUS ALERT IF ANY -->
          <div *ngIf="withdrawStatusMsg" class="alert-msg" [class.err]="withdrawStatusType === 'error'" [class.ok]="withdrawStatusType === 'success'">
            {{ withdrawStatusMsg }}
          </div>

          <!-- BOTTOM ACTION BUTTONS -->
          <div class="actions-row">
            <button type="button" class="btn-back" (click)="goBack()">BACK</button>
            <button type="button" class="btn-green" [disabled]="isWithdrawSubmitting" (click)="submitWithdraw()">
              {{ isWithdrawSubmitting ? 'Submitting...' : 'Withdraw' }}
            </button>
          </div>
        </div>

      </div>
    </div>

    <!-- WITHDRAWAL POPUP MODAL -->
    <div *ngIf="withdrawPopupVisible" class="popup-overlay" (click)="closeWithdrawPopup()">
      <div class="popup-modal" (click)="$event.stopPropagation()">
        <div class="popup-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto;"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <h3 class="popup-title">{{ withdrawPopupTitle || 'Withdrawal Submitted' }}</h3>
        <p class="popup-body">{{ withdrawPopupMsg }}</p>
        <button class="popup-ok-btn" (click)="closeWithdrawPopup()">OK, Got it</button>
      </div>
    </div>
  `,
  styles: [`
/* ═══════════════════════════════════════════════════════════════════════
       Pakabet wallet — deep green + gold, matching the sportsbook chrome.
       Styling only: the deposit and withdraw flows are untouched.
       ═══════════════════════════════════════════════════════════════════════ */
    :host {
      --wk-green: #0a8f3c;
      --wk-green-light: #16c25b;
      --wk-green-deep: #04381c;
      --wk-gold: #ffd400;
      --wk-gold-deep: #c9a300;
      --wk-red: #e8202a;
      --wk-ink: #eaf3ec;
      --wk-muted: #9dbfa8;
      --wk-panel: rgba(8, 30, 18, .86);
      --wk-line: rgba(22, 194, 91, .22);
    }

    .wallet-page-wrapper {
      min-height: 100vh;
      padding: 26px 16px 44px;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      background: radial-gradient(120% 90% at 50% -10%, #0d5c2c 0%, #062f18 42%, #010a05 100%);
      font-family: Inter, 'Segoe UI', Roboto, system-ui, sans-serif;
      color: var(--wk-ink);
    }

    .wallet-card-container {
      width: min(460px, 100%);
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    /* ── Balance banner ───────────────────────────────────────────────── */
    .balance-banner-card {
      position: relative;
      overflow: hidden;
      padding: 22px 22px 24px;
      border-radius: 16px;
      background: linear-gradient(135deg, var(--wk-green) 0%, var(--wk-green-deep) 100%);
      border: 1px solid var(--wk-line);
      box-shadow: 0 16px 40px rgba(0, 0, 0, .45);
    }
    .balance-banner-card::after {
      content: '';
      position: absolute;
      right: -50px;
      top: -50px;
      width: 190px;
      height: 190px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(255, 212, 0, .26), transparent 68%);
    }
    .lbl-title {
      position: relative;
      font-size: 11.5px;
      font-weight: 900;
      letter-spacing: .8px;
      text-transform: uppercase;
      color: var(--wk-gold);
    }
    .lbl-sub {
      position: relative;
      font-size: 12px;
      color: rgba(234, 243, 236, .72);
      margin-top: 2px;
    }
    .val-amount {
      position: relative;
      margin-top: 10px;
      font-size: 34px;
      font-weight: 900;
      letter-spacing: -1px;
      color: #fff;
      text-shadow: 0 2px 14px rgba(0, 0, 0, .35);
    }

    /* ── Segmented deposit / withdraw switch ──────────────────────────── */
    .segmented-control-row {
      display: flex;
      gap: 6px;
      padding: 5px;
      border-radius: 12px;
      background: rgba(255, 255, 255, .05);
      border: 1px solid var(--wk-line);
    }
    .seg-btn {
      flex: 1;
      padding: 11px 12px;
      border: none;
      border-radius: 9px;
      background: transparent;
      color: var(--wk-muted);
      font-family: inherit;
      font-size: 13.5px;
      font-weight: 800;
      cursor: pointer;
      transition: background .16s, color .16s;
    }
    .seg-btn:hover { color: var(--wk-ink); }
    .seg-btn.active {
      background: linear-gradient(135deg, var(--wk-green-light), var(--wk-green));
      color: #fff;
      box-shadow: 0 5px 16px rgba(10, 143, 60, .34);
    }

    /* ── Form card ────────────────────────────────────────────────────── */
    .main-form-box {
      padding: 22px 20px 24px;
      border-radius: 16px;
      background: var(--wk-panel);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--wk-line);
      box-shadow: 0 18px 46px rgba(0, 0, 0, .48);
    }
    .box-heading {
      margin: 0;
      font-size: 20px;
      font-weight: 900;
      letter-spacing: -.3px;
      color: #fff;
    }
    .box-subheading {
      margin: 3px 0 16px;
      font-size: 12.5px;
      color: var(--wk-muted);
    }

    .presets-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 7px;
      margin-bottom: 16px;
    }
    .preset-pill {
      padding: 9px 4px;
      border-radius: 9px;
      border: 1px solid var(--wk-line);
      background: rgba(255, 255, 255, .05);
      color: var(--wk-ink);
      font-family: inherit;
      font-size: 12.5px;
      font-weight: 800;
      cursor: pointer;
      transition: background .15s, border-color .15s, transform .1s;
    }
    .preset-pill:hover {
      background: rgba(22, 194, 91, .16);
      border-color: var(--wk-green-light);
    }
    .preset-pill:active { transform: translateY(1px); }

    .field-wrap { margin-bottom: 14px; }
    .field-lbl {
      display: block;
      margin-bottom: 6px;
      font-size: 11.5px;
      font-weight: 800;
      letter-spacing: .4px;
      text-transform: uppercase;
      color: var(--wk-muted);
    }

    .phone-box { display: flex; gap: 8px; }
    .code-select {
      flex: 0 0 auto;
      padding: 0 12px;
      min-width: 78px;
      border-radius: 10px;
      border: 1px solid var(--wk-line);
      background: linear-gradient(150deg, var(--wk-green), var(--wk-green-deep));
      color: #fff;
      font-family: inherit;
      font-size: 14px;
      font-weight: 800;
      cursor: pointer;
      outline: none;
    }
    .code-select option { background: #06301a; color: #fff; }

    .phone-input,
    .amount-input {
      width: 100%;
      padding: 13px 14px;
      border-radius: 10px;
      border: 1px solid var(--wk-line);
      background: rgba(255, 255, 255, .05);
      color: #fff;
      font-family: inherit;
      font-size: 15px;
      font-weight: 600;
      outline: none;
      transition: border-color .16s, box-shadow .16s, background .16s;
    }
    .phone-input:focus,
    .amount-input:focus {
      border-color: var(--wk-green-light);
      background: rgba(255, 255, 255, .08);
      box-shadow: 0 0 0 3px rgba(22, 194, 91, .18);
    }
    .phone-input::placeholder,
    .amount-input::placeholder { color: rgba(220, 240, 228, .36); }

    .help-lbl {
      display: block;
      margin-top: 6px;
      font-size: 11.5px;
      color: var(--wk-muted);
      line-height: 1.45;
    }

    .cooldown-box {
      margin: 8px 0 16px;
      padding: 14px 16px;
      border-radius: 12px;
      background: rgba(255, 212, 0, .08);
      border: 1px solid rgba(255, 212, 0, .32);
      color: #fff;
    }
    .cooldown-head {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--wk-gold);
      font-size: 13.5px;
      font-weight: 800;
      margin-bottom: 6px;
    }
    .cooldown-desc {
      margin: 0 0 10px;
      font-size: 12.5px;
      line-height: 1.45;
      color: var(--wk-muted);
    }
    .cooldown-timer {
      font-size: 24px;
      font-weight: 900;
      letter-spacing: 1px;
      color: var(--wk-gold);
      font-variant-numeric: tabular-nums;
    }

    .alert-msg {
      margin: 4px 0 14px;
      padding: 11px 13px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 600;
      line-height: 1.45;
    }
    .alert-msg.err {
      background: rgba(232, 32, 42, .14);
      border: 1px solid rgba(232, 32, 42, .4);
      color: #ffb3b7;
    }
    .alert-msg.ok {
      background: rgba(22, 194, 91, .14);
      border: 1px solid rgba(22, 194, 91, .42);
      color: #a8f0c4;
    }

    .actions-row {
      display: flex;
      gap: 10px;
      margin-top: 18px;
    }
    .btn-back,
    .btn-green {
      flex: 1;
      padding: 14px 16px;
      border: none;
      border-radius: 11px;
      font-family: inherit;
      font-size: 14.5px;
      font-weight: 900;
      letter-spacing: .4px;
      cursor: pointer;
      transition: transform .12s, filter .16s, box-shadow .16s;
    }
    .btn-back {
      flex: 0 0 34%;
      background: rgba(255, 255, 255, .07);
      border: 1px solid var(--wk-line);
      color: var(--wk-muted);
    }
    .btn-back:hover { color: var(--wk-ink); background: rgba(255, 255, 255, .1); }
    .btn-green {
      background: linear-gradient(135deg, var(--wk-gold), #ffb300);
      color: #1a1a1a;
      box-shadow: 0 8px 22px rgba(255, 212, 0, .26);
    }
    .btn-green:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.04); }
    .btn-green:active:not(:disabled) { transform: translateY(1px); }
    .btn-green:disabled { opacity: .6; cursor: not-allowed; box-shadow: none; }

    /* ── Withdrawal confirmation popup ────────────────────────────────── */
    .popup-overlay {
      position: fixed;
      inset: 0;
      z-index: 400;
      display: grid;
      place-items: center;
      padding: 16px;
      background: rgba(2, 10, 5, .72);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
    }
    .popup-modal {
      width: min(400px, 100%);
      padding: 26px 24px 24px;
      border-radius: 16px;
      text-align: center;
      background: var(--wk-panel);
      border: 1px solid var(--wk-line);
      box-shadow: 0 24px 60px rgba(0, 0, 0, .6);
      animation: wk-pop .24s ease;
    }
    @keyframes wk-pop {
      from { opacity: 0; transform: translateY(12px) scale(.97); }
      to   { opacity: 1; transform: none; }
    }
    .popup-icon {
      width: 76px;
      height: 76px;
      margin: 0 auto 14px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: radial-gradient(circle at 34% 28%, rgba(22, 194, 91, .32), rgba(4, 56, 28, .5));
      border: 2px solid var(--wk-green-light);
    }
    .popup-title {
      margin: 0 0 8px;
      font-size: 19px;
      font-weight: 900;
      color: #fff;
    }
    .popup-body {
      margin: 0 0 20px;
      font-size: 13.5px;
      line-height: 1.6;
      color: var(--wk-muted);
      white-space: pre-line;
    }
    .popup-ok-btn {
      width: 100%;
      padding: 13px;
      border: none;
      border-radius: 11px;
      background: linear-gradient(135deg, var(--wk-green-light), var(--wk-green));
      color: #fff;
      font-family: inherit;
      font-size: 14.5px;
      font-weight: 900;
      cursor: pointer;
      box-shadow: 0 8px 22px rgba(10, 143, 60, .34);
    }
    .popup-ok-btn:active { transform: translateY(1px); }

    @media (max-width: 480px) {
      .wallet-page-wrapper { padding: 16px 12px 36px; }
      .val-amount { font-size: 28px; }
      .main-form-box { padding: 18px 16px 20px; }
      .presets-row { gap: 6px; }
      .preset-pill { font-size: 11.5px; padding: 9px 2px; }
    }
  `]
})
export class WalletComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private gameSocket = inject(GameSocketService);
  private router = inject(Router);
  private subscriptions: Subscription[] = [];

  public userBalance$ = this.authService.userBalance$;
  public activeTab: 'deposit' | 'withdraw' = 'deposit';

  public depositPhone: string = '';
  public withdrawPhone: string = '';
  public depositVal: number = 999;
  public minDepositAmount: number = 999;
  public withdrawVal: number = 200;
  public isDepositSubmitting: boolean = false;
  public isWithdrawSubmitting: boolean = false;
  public depositCooldownSeconds: number = 0;
  private depositCooldownTimer: any = null;
  public depositStatusMsg: string = '';
  public withdrawStatusMsg: string = '';
  public depositStatusType: 'info' | 'error' | 'success' = 'info';
  public withdrawStatusType: 'info' | 'error' | 'success' = 'info';

  public withdrawPopupVisible = false;
  public withdrawPopupTitle = 'Withdrawal Submitted';
  public withdrawPopupMsg = '';

  formatCooldown(totalSeconds: number): string {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  startCooldown(seconds: number): void {
    this.clearCooldownTimer();
    this.depositCooldownSeconds = Math.max(1, Math.ceil(seconds));
    this.depositCooldownTimer = setInterval(() => {
      if (this.depositCooldownSeconds > 1) {
        this.depositCooldownSeconds--;
      } else {
        this.depositCooldownSeconds = 0;
        this.clearCooldownTimer();
        if (this.depositStatusType === 'error' && this.depositStatusMsg.includes('rapid')) {
          this.depositStatusMsg = '';
        }
      }
    }, 1000);
  }

  clearCooldownTimer(): void {
    if (this.depositCooldownTimer) {
      clearInterval(this.depositCooldownTimer);
      this.depositCooldownTimer = null;
    }
  }

  ngOnInit() {
    const url = this.router.url;
    this.activeTab = url.includes('/withdraw') ? 'withdraw' : 'deposit';

    const currentUser = this.authService.currentUser$.getValue();
    if (currentUser?.phone_number) {
      this.depositPhone = (currentUser.phone_number || '').replace(/^(\+?254|0)+/, '');
      this.withdrawPhone = (currentUser.phone_number || '').replace(/^(\+?254|0)+/, '');
    }

    const token = this.authService.getToken();
    if (token) this.gameSocket.connect(token);

    this.authService.getDepositCooldown().subscribe(res => {
      if (res.inCooldown && res.retryAfterSeconds > 0) {
        this.startCooldown(res.retryAfterSeconds);
      }
    });

    this.authService.getPaymentConfig().subscribe(config => {
      const oldMin = this.minDepositAmount;
      this.minDepositAmount = config.minDepositAmount;
      if (!this.depositVal || this.depositVal === oldMin || this.depositVal < this.minDepositAmount) {
        this.depositVal = config.minDepositAmount;
      }
    });

    this.subscriptions.push(
      this.gameSocket.paymentConfig$.subscribe(config => {
        if (!config?.minDepositAmount) return;
        const oldMin = this.minDepositAmount;
        this.minDepositAmount = config.minDepositAmount;
        if (!this.depositVal || this.depositVal === oldMin || this.depositVal < this.minDepositAmount) {
          this.depositVal = config.minDepositAmount;
        }
      }),
      this.authService.currentUser$.subscribe(user => {
        if (user?.phone_number) {
          const cleanPhone = (user.phone_number || '').replace(/^(\+?254|0)+/, '');
          if (!this.depositPhone) this.depositPhone = cleanPhone;
          if (!this.withdrawPhone) this.withdrawPhone = cleanPhone;
        }
      }),
      this.gameSocket.walletUpdated$.subscribe(event => {
        if (event?.balance !== undefined) this.authService.updateBalance(event.balance);
      }),
      this.gameSocket.mpesaSuccess$.subscribe(event => {
        if (!event) return;
        this.clearStkStatusPolling();
        this.authService.updateBalance(event.balance);
        this.depositStatusMsg = `Deposit complete. KES ${event.amount.toLocaleString()} has been added to your balance.`;
        this.depositStatusType = 'success';
        setTimeout(() => {
          this.depositStatusMsg = '';
          this.depositVal = this.minDepositAmount;
        }, 2500);
      }),
      this.gameSocket.mpesaFailed$.subscribe(event => {
        if (!event) return;
        this.clearStkStatusPolling();
        this.depositStatusMsg = event.reason || 'The M-Pesa payment was not completed.';
        this.depositStatusType = 'error';
        setTimeout(() => { this.depositStatusMsg = ''; }, 5000);
      }),
      this.gameSocket.userUpdated$.subscribe(event => {
        if (event) this.authService.loadCurrentUser().subscribe();
      })
    );
  }

  ngOnDestroy() {
    this.clearStkStatusPolling();
    this.clearCooldownTimer();
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  stripPrefix(value: string, field: 'deposit' | 'withdraw') {
    // Remove leading +254, 254, or 0 so user can't double-enter country code
    let cleaned = (value || '').replace(/^(\+?254|0)+/, '');
    if (field === 'deposit') this.depositPhone = cleaned;
    else this.withdrawPhone = cleaned;
  }

  closeWithdrawPopup() {
    this.withdrawPopupVisible = false;
    this.withdrawPopupMsg = '';
  }

  selectTab(tab: 'deposit' | 'withdraw') {
    this.activeTab = tab;
    const currentReturn = history.state?.returnUrl || localStorage.getItem('walletReturnUrl');
    if (tab === 'deposit') {
      this.router.navigate(['/deposit'], { state: { returnUrl: currentReturn } });
    } else {
      this.router.navigate(['/withdraw'], { state: { returnUrl: currentReturn } });
    }
  }

  addDepositAmount(val: number) {
    this.depositVal = (this.depositVal || 0) + val;
  }

  setDepositAmount(val: number) {
    this.depositVal = val;
  }

  addWithdrawAmount(val: number) {
    this.withdrawVal = (this.withdrawVal || 0) + val;
  }

  submitDeposit() {
    if (this.depositCooldownSeconds > 0) {
      this.depositStatusMsg = `Too many rapid deposit prompts. Please wait ${this.formatCooldown(this.depositCooldownSeconds)} before trying again.`;
      this.depositStatusType = 'error';
      return;
    }
    if (!this.depositVal || this.depositVal < this.minDepositAmount) {
      this.depositStatusMsg = `Minimum deposit is KES ${this.minDepositAmount.toLocaleString()}.`;
      this.depositStatusType = 'error';
      return;
    }
    const rawPhone = this.depositPhone || this.authService.currentUser$.getValue()?.phone_number || '';
    const cleanDigits = rawPhone.replace(/\D/g, '').replace(/^(254|0)+/, '');
    if (!cleanDigits || cleanDigits.length < 9) {
      this.depositStatusMsg = 'Please enter a valid M-Pesa phone number (e.g. 7XXXXXXXX).';
      this.depositStatusType = 'error';
      return;
    }
    const fullPhone = `254${cleanDigits}`;

    this.isDepositSubmitting = true;
    this.depositStatusMsg = 'Initiating STK Push...';
    this.depositStatusType = 'info';

    this.authService.initiateMpesaSTKPush(this.depositVal, fullPhone)
      .subscribe({
        next: (res) => {
          this.isDepositSubmitting = false;
          this.depositStatusMsg = '📱 Check your phone! Enter your M-Pesa PIN to complete payment.';
          this.depositStatusType = 'info';
          const reqId = res.checkoutRequestId;
          if (reqId) this.startMpesaStatusPolling(reqId);
        },
        error: (err: any) => {
          this.isDepositSubmitting = false;
          const msg = typeof err === 'string' ? err : (err?.message || 'STK Push failed. Please try again.');
          this.depositStatusMsg = `❌ ${msg}`;
          this.depositStatusType = 'error';
          if (err?.code === 'RATE_LIMIT_COOLDOWN' || err?.retryAfterSeconds || err?.status === 429) {
            const cooldownSec = Number(err?.retryAfterSeconds) || 600;
            this.startCooldown(cooldownSec);
          }
        }
      });
  }

  private stkPollTimer: any = null;

  private clearStkStatusPolling() {
    if (this.stkPollTimer) clearInterval(this.stkPollTimer);
    this.stkPollTimer = null;
  }

  private startMpesaStatusPolling(checkoutRequestId: string) {
    this.clearStkStatusPolling();
    let attempts = 0;
    const checkStatus = () => {
      attempts++;
      if (attempts > 150) {
        this.clearStkStatusPolling();
        if (this.depositStatusType === 'info') {
          this.depositStatusMsg = 'We are still waiting for PayHero’s final result. Your balance will update automatically once it is confirmed.';
          this.depositStatusType = 'error';
          setTimeout(() => { this.depositStatusMsg = ''; }, 5000);
        }
        return;
      }
      this.authService.checkMpesaStatus(checkoutRequestId).subscribe({
        next: (res) => {
          if (res.status === 'completed') {
            this.clearStkStatusPolling();
            if (res.balance !== undefined) this.authService.updateBalance(Number(res.balance));
            const creditedAmt = res.amount || this.depositVal;
            this.depositStatusMsg = `✅ Deposit complete! KES ${Number(creditedAmt).toLocaleString()} added to your balance.`;
            this.depositStatusType = 'success';
            setTimeout(() => {
              this.depositStatusMsg = '';
              this.depositVal = this.minDepositAmount;
            }, 4000);
          } else if (res.status === 'failed') {
            this.clearStkStatusPolling();
            this.depositStatusMsg = `❌ ${res.reason || 'Payment failed or was cancelled.'}`;
            this.depositStatusType = 'error';
            setTimeout(() => { this.depositStatusMsg = ''; }, 5000);
          }
        },
        error: () => undefined
      });
    };

    // Check immediately, then every two seconds while the customer completes the prompt.
    checkStatus();
    this.stkPollTimer = setInterval(checkStatus, 2000);
  }

  submitWithdraw() {
    if (!this.withdrawVal || this.withdrawVal < 200) {
      this.withdrawStatusMsg = 'Minimum withdrawal is KES 200.';
      this.withdrawStatusType = 'error';
      return;
    }
    if (this.withdrawVal > 300000) {
      this.withdrawStatusMsg = 'Maximum withdrawal is KES 300,000.';
      this.withdrawStatusType = 'error';
      return;
    }

    // Client-side balance check
    const currentBalance = this.authService.userBalance$.getValue() || 0;
    if (Number(currentBalance) < this.withdrawVal) {
      this.withdrawStatusMsg = `❌ Insufficient balance. Your balance is KES ${Number(currentBalance).toFixed(2)}.`;
      this.withdrawStatusType = 'error';
      return;
    }

    const rawPhone = this.withdrawPhone || this.authService.currentUser$.getValue()?.phone_number || '';
    const phone = rawPhone.replace(/^(\+?254|0)/, '');
    if (!phone || phone.length < 9) {
      this.withdrawStatusMsg = 'Please enter a valid M-Pesa phone number (e.g. 7XXXXXXXX).';
      this.withdrawStatusType = 'error';
      return;
    }

    this.isWithdrawSubmitting = true;
    this.withdrawStatusMsg = 'Submitting withdrawal...';
    this.withdrawStatusType = 'info';

    this.authService.withdraw(this.withdrawVal, `254${phone}`).subscribe({
      next: (res: any) => {
        this.isWithdrawSubmitting = false;
        this.withdrawStatusMsg = '';
        // Show popup with admin-configured title & message
        const popupTitle = res?.popup?.title || 'Withdrawal Submitted';
        const popupMsg = res?.popup?.message || res?.message || 'Your withdrawal request has been submitted. The admin team will process it shortly.';
        this.withdrawPopupTitle = popupTitle;
        this.withdrawPopupMsg = popupMsg;
        this.withdrawPopupVisible = true;
        // Refresh balance from response
        if (res?.balance !== undefined) this.authService.updateBalance(Number(res.balance));
      },
      error: (err) => {
        this.isWithdrawSubmitting = false;
        const msg = typeof err === 'string' ? err : 'Withdrawal failed. Check your balance.';
        this.withdrawStatusMsg = `❌ ${msg}`;
        this.withdrawStatusType = 'error';
      }
    });
  }

  goBack() {
    const returnUrl = history.state?.returnUrl || localStorage.getItem('walletReturnUrl');
    if (returnUrl) {
      this.router.navigateByUrl(returnUrl);
    } else {
      this.router.navigate(['/bets']);
    }
  }
}
export class Wallet extends WalletComponent {}
