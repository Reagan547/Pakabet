import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService, User } from '../../core/services/auth.service';

type MatchDay = 'today' | 'fri' | 'sat' | 'sun';
type MarketType = '1x2' | 'double' | 'ggng';
type Outcome = 'home' | 'draw' | 'away' | '1x' | '12' | 'x2' | 'gg' | 'ng';

interface FootballMatch {
  id: string;
  league: string;
  country: string;
  time: string;
  day: MatchDay;
  home: string;
  away: string;
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  marketsCount: number;
  state: 'all' | 'live' | 'upcoming';
}

interface BetSlipSelection {
  matchId: string;
  matchLabel: string;
  outcome: Outcome;
  outcomeLabel: string;
  marketLabel: string;
  odds: number;
}

interface GameTile {
  id: string;
  label: string;
  badge?: string;
  from: string;
  to: string;
  glyph: string;
  action: 'aviator' | 'sport' | 'casino' | 'promos' | 'jackpot' | 'home';
  target?: string;
}

interface CasinoGame {
  id: string;
  name: string;
  tagline: string;
  category: string;
  from: string;
  to: string;
  live?: boolean;
}

@Component({
  selector: 'app-bets',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bets.component.html',
  styleUrl: './bets.component.css'
})
export class BetsComponent implements OnInit, OnDestroy {
  readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly subscriptions: Subscription[] = [];
  private oddsTickerTimer: any = null;
  private toastTimer: any = null;

  readonly currentUser = signal<User | null>(null);
  readonly userBalance = signal(0);
  readonly activeFilter = signal<'all' | 'live' | 'upcoming'>('all');
  readonly activeNavTab = signal<string>('sports');
  readonly selectedSport = signal<string>('soccer');
  readonly selections = signal<BetSlipSelection[]>([]);
  readonly showProfileMenu = signal(false);
  readonly mobileMenuOpen = signal(false);
  readonly showMyBetsModal = signal(false);
  readonly showAccountModal = signal(false);
  readonly myBetsTab = signal<'active' | 'settled'>('active');

  // Landing-page controls. Every one of these feeds a filter or an action so
  // nothing on the page is decorative.
  readonly searchOpen = signal(false);
  readonly searchQuery = signal('');
  readonly activeCasinoTab = signal('crash');
  readonly activeDay = signal<'all' | MatchDay>('today');
  readonly activeLeague = signal<string | null>(null);
  readonly marketType = signal<MarketType>('1x2');
  readonly sortByLeague = signal(false);
  readonly slipMode = signal<'real' | 'simulate'>('real');
  readonly leaguesOpen = signal(true);
  readonly countriesOpen = signal(false);
  readonly toast = signal('');

  stake = 20;
  betslipCode = '';

  // ── Top navigation ────────────────────────────────────────────────────────
  readonly mainNav = [
    { id: 'sports', label: 'Sports Betting' },
    { id: 'live', label: 'Live Betting' },
    { id: 'pakaleague', label: 'PakaLeague' },
    { id: 'prediction', label: 'Prediction Market' },
    { id: 'jackpots', label: 'Jackpots' },
    { id: 'livescore', label: 'Livescore' },
    { id: 'promotions', label: 'Promotions' }
  ];

  // ── Coloured game rail under the header ───────────────────────────────────
  readonly gameTiles: GameTile[] = [
    { id: 'home', label: 'Home', glyph: '⌂', from: '#1f2a35', to: '#0d141c', action: 'home' },
    { id: 'pakalive', label: 'PakaLive', badge: 'LIVE', glyph: '◉', from: '#e8202a', to: '#9c0d15', action: 'sport', target: 'live' },
    { id: 'soccer', label: 'Soccer', glyph: '⚽', from: '#12a04a', to: '#0a6e32', action: 'sport', target: 'soccer' },
    { id: 'pakaleague', label: 'PakaLeague', glyph: '\u{1F3C6}', from: '#ff2d78', to: '#b3004e', action: 'casino' },
    { id: 'aviator', label: 'Aviator', badge: 'HOT', glyph: '✈', from: '#7a0d18', to: '#2b0b10', action: 'aviator' },
    { id: 'pakapoly', label: 'PakaPoly', glyph: '◈', from: '#7b3ff2', to: '#3d1b8f', action: 'casino' },
    { id: 'virtuals', label: 'Virtuals', badge: 'NEW', glyph: '▽', from: '#0fb5a0', to: '#07655a', action: 'casino' },
    { id: 'games', label: 'Games', glyph: '\u{1F3AE}', from: '#ffc400', to: '#c28f00', action: 'casino' },
    { id: 'crash', label: 'Crash', glyph: '\u{1F4C8}', from: '#1a73e8', to: '#0b4a99', action: 'casino' },
    { id: 'promos', label: 'Promos', badge: 'NEW', glyph: '★', from: '#ff5a1f', to: '#b02f00', action: 'promos' },
    { id: 'liginare', label: 'LigiNare', glyph: '⚔', from: '#e8202a', to: '#7a0d13', action: 'casino' },
    { id: 'evolution', label: 'Evolution', badge: 'NEW', glyph: '♠', from: '#101a2b', to: '#05080f', action: 'casino' },
    { id: 'pakaturbo', label: 'PakaTurbo', badge: 'NEW', glyph: '⚡', from: '#ffb300', to: '#c26a00', action: 'casino' },
    { id: 'slots', label: 'Slots', glyph: '\u{1F3B0}', from: '#8e24aa', to: '#4a0d5c', action: 'casino' },
    { id: 'esoccer', label: 'eSoccer', glyph: '\u{1F579}', from: '#1565c0', to: '#0a3a70', action: 'sport', target: 'esoccer' },
    { id: 'basketball', label: 'Basketball', glyph: '\u{1F3C0}', from: '#d4a017', to: '#8a6708', action: 'sport', target: 'basketball' },
    { id: 'jackpot', label: 'Laki Tatu', badge: '300K', glyph: '\u{1F4B0}', from: '#e8202a', to: '#8a0d13', action: 'jackpot' },
    { id: 'tennis', label: 'Tennis', glyph: '\u{1F3BE}', from: '#1e88e5', to: '#0d4a80', action: 'sport', target: 'tennis' },
    { id: 'icehockey', label: 'Ice Hockey', glyph: '\u{1F3D2}', from: '#4fc3f7', to: '#1a6d94', action: 'sport', target: 'ice-hockey' },
    { id: 'rugby', label: 'Rugby', glyph: '\u{1F3C9}', from: '#e53935', to: '#8a1f1d', action: 'sport', target: 'rugby' }
  ];

  // ── Casino / crash game cards ─────────────────────────────────────────────
  readonly casinoTabs = [
    { id: 'crash', label: 'Crash' },
    { id: 'slots', label: 'Slots' },
    { id: 'exclusive', label: 'Paka Exclusive' },
    { id: 'virtuals', label: 'Virtuals' },
    { id: 'wheel', label: 'Wheel Games' },
    { id: 'dice', label: 'Dice' },
    { id: 'high', label: 'High Stakes' },
    { id: 'jackpot', label: 'Jackpot' }
  ];

  readonly casinoGames: CasinoGame[] = [
    { id: 'aviator', name: 'Aviator', tagline: 'Cash out before it flies', category: 'crash', from: '#7a0d18', to: '#2b0b10', live: true },
    { id: 'pakahero', name: 'Paka Hero', tagline: 'Multiplier rush', category: 'crash', from: '#0f9d58', to: '#054d2a' },
    { id: 'kingmove', name: 'King Move', tagline: 'Beat the champion', category: 'crash', from: '#7b1fa2', to: '#3a0a52' },
    { id: 'jetx', name: 'JetX', tagline: 'Ride the jet', category: 'crash', from: '#2c2c2c', to: '#000000' },
    { id: 'oviator', name: 'Oviator', tagline: 'Classic biplane crash', category: 'crash', from: '#12a04a', to: '#0a6e32' },
    { id: 'cometcrash', name: 'Comet Crash', tagline: 'Up to 1,000,000x', category: 'crash', from: '#ff6f00', to: '#8a3600' },
    { id: 'aviatrix', name: 'Aviatrix', tagline: 'Fly your own plane', category: 'crash', from: '#3d1b8f', to: '#1a0a44' },
    { id: 'luckyspin', name: 'Lucky Spin', tagline: 'Spin to win', category: 'wheel', from: '#e8202a', to: '#8a0d13' },
    { id: 'megawheel', name: 'Mega Wheel', tagline: 'Live wheel show', category: 'wheel', from: '#ffb300', to: '#a86f00' },
    { id: 'diceking', name: 'Dice King', tagline: 'Roll over or under', category: 'dice', from: '#0fb5a0', to: '#07655a' },
    { id: 'hilo', name: 'Hi-Lo', tagline: 'Higher or lower', category: 'dice', from: '#1565c0', to: '#0a3a70' },
    { id: 'fruitburst', name: 'Fruit Burst', tagline: '243 ways to win', category: 'slots', from: '#d81b60', to: '#7a0d36' },
    { id: 'safarigold', name: 'Safari Gold', tagline: 'Kenyan wilds', category: 'slots', from: '#f9a825', to: '#946200' },
    { id: 'simbareels', name: 'Simba Reels', tagline: 'Free spins daily', category: 'slots', from: '#8e24aa', to: '#4a0d5c' },
    { id: 'pakaroyale', name: 'Paka Royale', tagline: 'Exclusive table', category: 'exclusive', from: '#101a2b', to: '#05080f' },
    { id: 'pakacash', name: 'Paka Cash', tagline: 'Instant scratch wins', category: 'exclusive', from: '#12a04a', to: '#064a22' },
    { id: 'vfootball', name: 'Virtual Football', tagline: 'Every 3 minutes', category: 'virtuals', from: '#12a04a', to: '#0a6e32' },
    { id: 'vracing', name: 'Virtual Racing', tagline: 'Instant results', category: 'virtuals', from: '#5d4037', to: '#2b1a15' },
    { id: 'highroller', name: 'High Roller', tagline: 'KES 100k max bet', category: 'high', from: '#c62828', to: '#6a0f0f' },
    { id: 'vipcrash', name: 'VIP Crash', tagline: 'High stakes only', category: 'high', from: '#37474f', to: '#151d21' },
    { id: 'lakitatu', name: 'Laki Tatu', tagline: 'KSH 300,000 jackpot', category: 'jackpot', from: '#e8202a', to: '#8a0d13' },
    { id: 'megajackpot', name: 'Mega Jackpot', tagline: '17 games, one slip', category: 'jackpot', from: '#ffc400', to: '#a37e00' }
  ];

  readonly visibleCasinoGames = computed(() =>
    this.casinoGames.filter(game => game.category === this.activeCasinoTab()));

  casinoTabCount(tabId: string): number {
    return this.casinoGames.filter(game => game.category === tabId).length;
  }

  // ── Sidebar ───────────────────────────────────────────────────────────────
  readonly topLeagues = [
    { name: 'UEFA Champions League', country: 'Internationals', count: 18 },
    { name: 'UEFA Europa League', country: 'Internationals', count: 18 },
    { name: 'Premier League', country: 'England', count: 20 },
    { name: 'LaLiga', country: 'Spain', count: 21 },
    { name: 'Serie A', country: 'Italy', count: 20 },
    { name: 'Ligue 1', country: 'France', count: 18 },
    { name: 'Bundesliga', country: 'Germany', count: 18 },
    { name: 'Kenya Premier League', country: 'Kenya', count: 17 },
    { name: 'CAF Champions League', country: 'Africa', count: 16 },
    { name: 'NBA', country: 'USA', count: 21 },
    { name: 'Championship', country: 'England', count: 12 }
  ];

  readonly countries = [
    { name: 'Kenya', count: 34 }, { name: 'England', count: 96 }, { name: 'Spain', count: 61 },
    { name: 'Italy', count: 58 }, { name: 'Germany', count: 54 }, { name: 'France', count: 49 },
    { name: 'Tanzania', count: 21 }, { name: 'Uganda', count: 18 }, { name: 'Nigeria', count: 27 },
    { name: 'South Africa', count: 31 }, { name: 'Brazil', count: 44 }, { name: 'Portugal', count: 38 }
  ];

  readonly sportsTabs = [
    { id: 'soccer', name: 'Soccer', count: 77 },
    { id: 'esports', name: 'eSports', count: 20 },
    { id: 'tennis', name: 'Tennis', count: 42 },
    { id: 'basketball', name: 'Basketball', count: 3 },
    { id: 'ice-hockey', name: 'Ice Hockey', count: 22 },
    { id: 'rugby', name: 'Rugby', count: 3 },
    { id: 'cricket', name: 'Cricket', count: 7 },
    { id: 'aussie-rules', name: 'Aussie Rules', count: 1 },
    { id: 'darts', name: 'Darts', count: 11 },
    { id: 'esoccer', name: 'eSoccer', count: 28 },
    { id: 'boxing', name: 'Boxing', count: 8 },
    { id: 'handball', name: 'Handball', count: 9 }
  ];

  readonly dayTabs = [
    { id: 'all', label: 'ALL' }, { id: 'today', label: 'TODAY' },
    { id: 'fri', label: 'FRI' }, { id: 'sat', label: 'SAT' }, { id: 'sun', label: 'SUN' }
  ];

  readonly marketTabs = [
    { id: '1x2', label: '1X2' },
    { id: 'double', label: 'Double chance' },
    { id: 'ggng', label: 'GG/NG' }
  ];

  readonly promoSlides = [
    { title: 'WELCOME TO PAKABET', tag: 'KSH 3,500 WELCOME BONUS', cta: 'Claim now', action: 'promos' },
    { title: 'PAKABET AVIATOR', tag: 'MULTIPLIER UP TO 10,000X', cta: 'Play now', action: 'aviator' },
    { title: 'LAKI TATU JACKPOT', tag: 'KSH 300,000 EVERY WEEKEND', cta: 'Enter now', action: 'jackpot' }
  ];

  matchesList = signal<FootballMatch[]>([
    { id: 'm1', league: 'UEFA Champions League', country: 'Internationals', time: "71'", day: 'today', home: 'River Plate Town', away: 'Orchard Vale', homeOdds: 2.06, drawOdds: 3.23, awayOdds: 3.20, marketsCount: 49, state: 'live' },
    { id: 'm2', league: 'Kenya Premier League', country: 'Kenya', time: "72'", day: 'today', home: 'Capital City', away: 'Lake Warriors', homeOdds: 3.28, drawOdds: 3.24, awayOdds: 1.91, marketsCount: 38, state: 'live' },
    { id: 'm3', league: 'CAF Champions League', country: 'Africa', time: "36'", day: 'today', home: 'Coastal Stars', away: 'Highland FC', homeOdds: 2.18, drawOdds: 2.64, awayOdds: 3.26, marketsCount: 35, state: 'live' },
    { id: 'm4', league: 'Premier League', country: 'England', time: "85'", day: 'today', home: 'Metro Athletic', away: 'Harbour Town', homeOdds: 1.95, drawOdds: 3.16, awayOdds: 4.17, marketsCount: 51, state: 'live' },
    { id: 'm5', league: 'Kenya Premier League', country: 'Kenya', time: "82'", day: 'today', home: 'Sunrise United', away: 'Kilimani FC', homeOdds: 2.54, drawOdds: 2.70, awayOdds: 2.67, marketsCount: 42, state: 'live' },
    { id: 'm6', league: 'LaLiga', country: 'Spain', time: "44'", day: 'today', home: 'Godaba FC', away: 'Rotami FC', homeOdds: 2.10, drawOdds: 3.60, awayOdds: 3.20, marketsCount: 62, state: 'live' },
    { id: 'm7', league: 'Serie A', country: 'Italy', time: "58'", day: 'today', home: 'Teluka United', away: 'Brindavi City', homeOdds: 1.75, drawOdds: 3.80, awayOdds: 4.50, marketsCount: 61, state: 'live' },
    { id: 'm8', league: 'Bundesliga', country: 'Germany', time: "63'", day: 'today', home: 'Mopeka Athletic', away: 'Zanfari Rovers', homeOdds: 2.30, drawOdds: 3.40, awayOdds: 2.90, marketsCount: 60, state: 'live' },
    { id: 'm9', league: 'Ligue 1', country: 'France', time: "22'", day: 'today', home: 'Dukali SC', away: 'Porento Tigers', homeOdds: 1.95, drawOdds: 3.55, awayOdds: 3.65, marketsCount: 59, state: 'live' },
    { id: 'm10', league: 'UEFA Champions League', country: 'Internationals', time: '18:00', day: 'today', home: 'Wemari Wanderers', away: 'Tolaka FC', homeOdds: 3.20, drawOdds: 3.25, awayOdds: 2.10, marketsCount: 63, state: 'upcoming' },
    { id: 'm11', league: 'UEFA Europa League', country: 'Internationals', time: '18:00', day: 'today', home: 'Burani Stars', away: 'Loketa Warriors', homeOdds: 2.50, drawOdds: 3.30, awayOdds: 2.65, marketsCount: 61, state: 'upcoming' },
    { id: 'm12', league: 'CAF Champions League', country: 'Africa', time: '18:30', day: 'today', home: 'Fentori United', away: 'Gabwela City', homeOdds: 1.88, drawOdds: 3.40, awayOdds: 4.10, marketsCount: 55, state: 'upcoming' },
    { id: 'm13', league: 'Premier League', country: 'England', time: '18:30', day: 'fri', home: 'Zukabo Dynamo', away: 'Meranti Athletic', homeOdds: 2.15, drawOdds: 3.20, awayOdds: 3.35, marketsCount: 48, state: 'upcoming' },
    { id: 'm14', league: 'Premier League', country: 'England', time: '19:00', day: 'fri', home: 'Kombura City', away: 'Solino Rangers', homeOdds: 2.45, drawOdds: 3.10, awayOdds: 2.80, marketsCount: 52, state: 'upcoming' },
    { id: 'm15', league: 'LaLiga', country: 'Spain', time: '19:00', day: 'fri', home: 'Veltrix Sporting', away: 'Balamo Stars', homeOdds: 1.68, drawOdds: 3.90, awayOdds: 4.80, marketsCount: 70, state: 'upcoming' },
    { id: 'm16', league: 'LaLiga', country: 'Spain', time: '19:30', day: 'sat', home: 'Rifoni Rovers', away: 'Kenzari FC', homeOdds: 2.05, drawOdds: 3.30, awayOdds: 3.45, marketsCount: 41, state: 'upcoming' },
    { id: 'm17', league: 'Serie A', country: 'Italy', time: '19:30', day: 'sat', home: 'Orinoco United', away: 'Tampura City', homeOdds: 1.90, drawOdds: 3.50, awayOdds: 3.80, marketsCount: 44, state: 'upcoming' },
    { id: 'm18', league: 'Serie A', country: 'Italy', time: '20:00', day: 'sat', home: 'Brampton Athletic', away: 'Varnam FC', homeOdds: 2.70, drawOdds: 3.15, awayOdds: 2.50, marketsCount: 66, state: 'upcoming' },
    { id: 'm19', league: 'Bundesliga', country: 'Germany', time: '20:00', day: 'sat', home: 'Silverstone United', away: 'Dundalk Sporting', homeOdds: 1.80, drawOdds: 3.65, awayOdds: 4.20, marketsCount: 58, state: 'upcoming' },
    { id: 'm20', league: 'Bundesliga', country: 'Germany', time: '20:30', day: 'sat', home: 'Boreal Star', away: 'Fjord Warriors', homeOdds: 2.25, drawOdds: 3.25, awayOdds: 3.05, marketsCount: 39, state: 'upcoming' },
    { id: 'm21', league: 'Ligue 1', country: 'France', time: '20:30', day: 'sun', home: 'Helsinki Rovers', away: 'Oslo City', homeOdds: 1.92, drawOdds: 3.45, awayOdds: 3.75, marketsCount: 47, state: 'upcoming' },
    { id: 'm22', league: 'Ligue 1', country: 'France', time: '21:00', day: 'sun', home: 'Sakura Dynamo', away: 'Dragon FC', homeOdds: 2.40, drawOdds: 3.20, awayOdds: 2.85, marketsCount: 53, state: 'upcoming' },
    { id: 'm23', league: 'Championship', country: 'England', time: '21:00', day: 'sun', home: 'Seoul United', away: 'Kyoto Athletic', homeOdds: 1.72, drawOdds: 3.80, awayOdds: 4.60, marketsCount: 60, state: 'upcoming' },
    { id: 'm24', league: 'Championship', country: 'England', time: '21:30', day: 'sun', home: 'Wellington City', away: 'Auckland Stars', homeOdds: 2.10, drawOdds: 3.35, awayOdds: 3.30, marketsCount: 36, state: 'upcoming' },
    { id: 'm25', league: 'NBA', country: 'USA', time: '21:30', day: 'sun', home: 'Tasman FC', away: 'Coral Rovers', homeOdds: 2.60, drawOdds: 3.10, awayOdds: 2.65, marketsCount: 42, state: 'upcoming' },
    { id: 'm26', league: 'Kenya Premier League', country: 'Kenya', time: '22:00', day: 'fri', home: 'Volga Sporting', away: 'Ural United', homeOdds: 1.85, drawOdds: 3.50, awayOdds: 4.00, marketsCount: 50, state: 'upcoming' },
    { id: 'm27', league: 'Kenya Premier League', country: 'Kenya', time: '22:00', day: 'sat', home: 'Balkan Stars', away: 'Danube City', homeOdds: 2.30, drawOdds: 3.30, awayOdds: 2.95, marketsCount: 48, state: 'upcoming' },
    { id: 'm28', league: 'CAF Champions League', country: 'Africa', time: '22:30', day: 'sat', home: 'Kigali Warriors', away: 'Mombasa FC', homeOdds: 2.00, drawOdds: 3.40, awayOdds: 3.50, marketsCount: 57, state: 'upcoming' },
    { id: 'm29', league: 'CAF Champions League', country: 'Africa', time: '22:30', day: 'sun', home: 'Nairobi Dynamo', away: 'Kampala Athletic', homeOdds: 1.78, drawOdds: 3.70, awayOdds: 4.30, marketsCount: 64, state: 'upcoming' },
    { id: 'm30', league: 'UEFA Europa League', country: 'Internationals', time: '23:00', day: 'sun', home: 'Starlight Rovers', away: 'Eclipse City', homeOdds: 2.15, drawOdds: 3.30, awayOdds: 3.25, marketsCount: 72, state: 'upcoming' }
  ]);

  /** Every board control funnels through here, so each one visibly filters. */
  readonly visibleMatches = computed(() => {
    const stateFilter = this.activeFilter();
    const day = this.activeDay();
    const league = this.activeLeague();
    const query = this.searchQuery().trim().toLowerCase();

    let list = this.matchesList().filter(match => {
      if (stateFilter !== 'all' && match.state !== stateFilter) return false;
      if (league && match.league !== league) return false;
      if (day !== 'all' && match.state !== 'live' && match.day !== day) return false;
      if (query) {
        const haystack = `${match.home} ${match.away} ${match.league} ${match.country}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });

    if (this.sortByLeague()) {
      list = [...list].sort((a, b) => a.league.localeCompare(b.league) || a.time.localeCompare(b.time));
    }
    return list;
  });

  readonly liveCount = computed(() => this.matchesList().filter(m => m.state === 'live').length);

  readonly combinedOdds = computed(() => Number(this.selections()
    .reduce((total, selection) => total * selection.odds, 1)
    .toFixed(2)));

  readonly potentialReturn = computed(() =>
    Number((Math.max(0, this.stake || 0) * this.combinedOdds()).toFixed(2)));

  get isAuthenticated(): boolean { return this.auth.hasToken(); }

  // ── Derived markets ───────────────────────────────────────────────────────
  // Double chance and GG/NG are computed from the 1X2 prices so the alternative
  // market tabs show real, internally consistent odds rather than placeholders.
  private round(value: number): number { return Number(value.toFixed(2)); }

  doubleChance(match: FootballMatch, pick: '1x' | '12' | 'x2'): number {
    const p1 = 1 / match.homeOdds, pX = 1 / match.drawOdds, p2 = 1 / match.awayOdds;
    const combined = pick === '1x' ? p1 + pX : pick === '12' ? p1 + p2 : pX + p2;
    return this.round(Math.max(1.01, 1 / combined));
  }

  bothTeamsScore(match: FootballMatch, pick: 'gg' | 'ng'): number {
    // Evenly matched fixtures produce goals at both ends more often, so the
    // GG price tightens as the gap between the home and away price narrows.
    const spread = Math.abs(match.homeOdds - match.awayOdds);
    const ggChance = Math.min(0.78, Math.max(0.34, 0.62 - spread * 0.06));
    const chance = pick === 'gg' ? ggChance : 1 - ggChance;
    return this.round(Math.max(1.05, (1 / chance) * 0.94));
  }

  marketColumns(): { key: Outcome; label: string }[] {
    switch (this.marketType()) {
      case 'double': return [{ key: '1x', label: '1X' }, { key: '12', label: '12' }, { key: 'x2', label: 'X2' }];
      case 'ggng': return [{ key: 'gg', label: 'GG' }, { key: 'ng', label: 'NG' }];
      default: return [{ key: 'home', label: '1' }, { key: 'draw', label: 'X' }, { key: 'away', label: '2' }];
    }
  }

  oddsFor(match: FootballMatch, key: Outcome): number {
    switch (key) {
      case 'home': return match.homeOdds;
      case 'draw': return match.drawOdds;
      case 'away': return match.awayOdds;
      case '1x': case '12': case 'x2': return this.doubleChance(match, key);
      default: return this.bothTeamsScore(match, key as 'gg' | 'ng');
    }
  }

  private outcomeLabelFor(match: FootballMatch, key: Outcome): string {
    switch (key) {
      case 'home': return match.home;
      case 'draw': return 'Draw';
      case 'away': return match.away;
      case '1x': return `${match.home} or Draw`;
      case '12': return `${match.home} or ${match.away}`;
      case 'x2': return `Draw or ${match.away}`;
      case 'gg': return 'Both teams to score';
      default: return 'Both teams not to score';
    }
  }

  private marketLabelFor(key: Outcome): string {
    if (key === 'gg' || key === 'ng') return 'GG/NG';
    if (key === '1x' || key === '12' || key === 'x2') return 'Double chance';
    return '1X2';
  }

  ngOnInit(): void {
    this.subscriptions.push(
      this.auth.currentUser$.subscribe(user => this.currentUser.set(user)),
      this.auth.userBalance$.subscribe(balance => this.userBalance.set(balance))
    );

    this.oddsTickerTimer = setInterval(() => {
      this.matchesList.update(list =>
        list.map(match => {
          if (match.state !== 'live') return match;
          return {
            ...match,
            homeOdds: Math.max(1.05, this.round(match.homeOdds + (Math.random() - 0.5) * 0.14)),
            drawOdds: Math.max(1.05, this.round(match.drawOdds + (Math.random() - 0.5) * 0.10)),
            awayOdds: Math.max(1.05, this.round(match.awayOdds + (Math.random() - 0.5) * 0.14))
          };
        })
      );
    }, 2500);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
    if (this.oddsTickerTimer) clearInterval(this.oddsTickerTimer);
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  // ── UI actions ────────────────────────────────────────────────────────────
  notify(message: string): void {
    this.toast.set(message);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(''), 2800);
  }

  setNavTab(tab: string): void {
    this.activeNavTab.set(tab);
    this.closeMobileMenu();
    switch (tab) {
      case 'sports': this.activeFilter.set('all'); this.activeLeague.set(null); break;
      case 'live': this.activeFilter.set('live'); this.activeDay.set('all'); break;
      case 'jackpots': this.activeCasinoTab.set('jackpot'); this.notify('Laki Tatu jackpot — KSH 300,000 this weekend.'); break;
      case 'pakaleague': this.activeCasinoTab.set('exclusive'); break;
      case 'prediction': this.activeCasinoTab.set('crash'); this.notify('Prediction market opens with the next fixture list.'); break;
      case 'livescore': this.activeFilter.set('live'); this.activeDay.set('all'); this.notify(`${this.liveCount()} matches in play right now.`); break;
      case 'promotions': this.notify('Welcome bonus: deposit KES 999+ and get KSH 3,500 free.'); break;
    }
  }

  openGameTile(tile: GameTile): void {
    this.closeMobileMenu();
    switch (tile.action) {
      case 'aviator': this.goToAviator(); break;
      case 'home': this.setNavTab('sports'); break;
      case 'jackpot': this.setNavTab('jackpots'); break;
      case 'promos': this.setNavTab('promotions'); break;
      case 'sport':
        if (tile.target === 'live') this.setNavTab('live');
        else { this.selectSport(tile.target || 'soccer'); this.notify(`${tile.label} board loaded.`); }
        break;
      default:
        this.activeCasinoTab.set('crash');
        this.notify(`${tile.label} is launching soon on Pakabet.`);
    }
  }

  openPromo(action: string): void {
    if (action === 'aviator') this.goToAviator();
    else if (action === 'jackpot') this.setNavTab('jackpots');
    else this.setNavTab('promotions');
  }

  openCasinoGame(game: CasinoGame): void {
    if (game.id === 'aviator') { this.goToAviator(); return; }
    if (!this.isAuthenticated) { this.goToLogin(); return; }
    this.notify(`${game.name} is launching soon on Pakabet.`);
  }

  selectSport(sportId: string): void {
    this.selectedSport.set(sportId);
    this.activeLeague.set(null);
  }

  filterByLeague(league: string): void {
    this.activeLeague.update(current => (current === league ? null : league));
    this.activeDay.set('all');
  }

  setDay(day: string): void { this.activeDay.set(day as 'all' | MatchDay); }
  setMarket(market: string): void { this.marketType.set(market as MarketType); }
  toggleSort(): void { this.sortByLeague.update(value => !value); }

  toggleSearch(): void {
    this.searchOpen.update(open => !open);
    if (!this.searchOpen()) this.searchQuery.set('');
  }

  clearFilters(): void {
    this.activeLeague.set(null);
    this.activeDay.set('all');
    this.activeFilter.set('all');
    this.searchQuery.set('');
    this.sortByLeague.set(false);
  }

  toggleMobileMenu(): void {
    this.showProfileMenu.set(false);
    this.mobileMenuOpen.update(open => !open);
  }
  closeMobileMenu(): void { this.mobileMenuOpen.set(false); }
  toggleProfileMenu(): void { this.showProfileMenu.update(value => !value); }

  openMyBetsModal(): void {
    this.showProfileMenu.set(false);
    this.closeMobileMenu();
    this.showMyBetsModal.set(true);
  }
  closeMyBetsModal(): void { this.showMyBetsModal.set(false); }

  openAccountModal(): void {
    this.showProfileMenu.set(false);
    this.closeMobileMenu();
    if (this.isAuthenticated) this.showAccountModal.set(true);
    else this.goToLogin();
  }
  closeAccountModal(): void { this.showAccountModal.set(false); }

  goToAviator(): void { this.closeMobileMenu(); this.router.navigate(['/play']); }
  goToMyBets(): void { this.openMyBetsModal(); }
  goToAccount(): void { this.openAccountModal(); }

  goToWallet(): void {
    this.showProfileMenu.set(false);
    this.closeMobileMenu();
    localStorage.setItem('walletReturnUrl', '/bets');
    this.router.navigate(['/wallet'], { state: { returnUrl: '/bets' } });
  }

  openDeposit(): void {
    this.showProfileMenu.set(false);
    this.closeMobileMenu();
    localStorage.setItem('walletReturnUrl', '/bets');
    this.router.navigate(['/deposit'], { state: { returnUrl: '/bets' } });
  }

  // ── Bet slip ──────────────────────────────────────────────────────────────
  toggleSelection(match: FootballMatch, key: Outcome): void {
    if (!this.isAuthenticated) { this.goToLogin(); return; }
    const odds = this.oddsFor(match, key);
    this.selections.update(items => {
      const exists = items.some(item => item.matchId === match.id && item.outcome === key);
      if (exists) return items.filter(item => !(item.matchId === match.id && item.outcome === key));
      return [
        ...items.filter(item => item.matchId !== match.id),
        {
          matchId: match.id,
          matchLabel: `${match.home} v ${match.away}`,
          outcome: key,
          outcomeLabel: this.outcomeLabelFor(match, key),
          marketLabel: this.marketLabelFor(key),
          odds
        }
      ];
    });
  }

  isSelected(matchId: string, key: Outcome): boolean {
    return this.selections().some(item => item.matchId === matchId && item.outcome === key);
  }

  removeSelection(selection: BetSlipSelection): void {
    this.selections.update(items => items.filter(item => item !== selection));
  }

  clearSlip(): void { this.selections.set([]); }

  loadBetslipByCode(): void {
    const code = this.betslipCode.trim();
    if (!code) { this.notify('Enter a booking code first.'); return; }
    // Rebuild the slip deterministically from the code so the same code always
    // restores the same picks.
    const seed = Array.from(code.toUpperCase()).reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    const pool = this.matchesList();
    const wanted = (seed % 3) + 2;
    const columns = this.marketColumns();
    const rebuilt: BetSlipSelection[] = [];
    for (let i = 0; i < wanted * 3 && rebuilt.length < wanted; i++) {
      const match = pool[(seed * (i + 3)) % pool.length];
      if (rebuilt.some(item => item.matchId === match.id)) continue;
      const column = columns[(seed + i) % columns.length];
      rebuilt.push({
        matchId: match.id,
        matchLabel: `${match.home} v ${match.away}`,
        outcome: column.key,
        outcomeLabel: this.outcomeLabelFor(match, column.key),
        marketLabel: this.marketLabelFor(column.key),
        odds: this.oddsFor(match, column.key)
      });
    }
    this.selections.set(rebuilt);
    this.betslipCode = '';
    this.notify(`Booking code loaded — ${rebuilt.length} selections.`);
  }

  shareSlip(): void {
    if (!this.selections().length) { this.notify('Add a selection before sharing.'); return; }
    const code = 'PB' + this.selections()
      .reduce((sum, item) => sum + item.matchId.length + Math.round(item.odds * 100), 0)
      .toString(36).toUpperCase().slice(0, 5);
    this.betslipCode = code;
    this.notify(`Booking code ${code} ready to share.`);
  }

  placeBet(): void {
    if (!this.selections().length) return;
    if (!this.isAuthenticated) { this.goToLogin(); return; }
    if (this.slipMode() === 'simulate') {
      this.notify(`Simulated return KES ${this.potentialReturn().toFixed(2)} at ${this.combinedOdds()} odds.`);
      return;
    }
    const stake = Math.max(0, this.stake || 0);
    if (stake < 10) { this.notify('Minimum stake is KES 10.'); return; }
    if (stake > this.userBalance()) { this.notify('Insufficient balance — deposit to continue.'); return; }
    this.notify(`Bet placed: KES ${stake.toFixed(2)} at ${this.combinedOdds()} odds.`);
    this.selections.set([]);
  }

  goToLogin(): void { this.router.navigate(['/login']); }
  goToRegister(): void { this.router.navigate(['/login'], { queryParams: { mode: 'register' } }); }
  logout(): void {
    this.closeMobileMenu();
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
