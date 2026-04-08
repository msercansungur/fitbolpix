import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { COLORS, SPACING, FONTS } from '../constants/theme';
import { NATIONS_BY_ID } from '../constants/nations';
import PixelFlag from './PixelFlag';
import { ResolvedKnockoutMatch, KnockoutRound } from '../types/knockout';
import { KNOCKOUT_MATCHES, ROUND_ORDERS } from '../constants/knockoutBracket';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BracketActions {
  onQuickSim?: (match: ResolvedKnockoutMatch) => void;
  onSimulate?: (match: ResolvedKnockoutMatch) => void;
  onReset?: (match: ResolvedKnockoutMatch) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CARD_WIDTH  = 168;
const CARD_HEIGHT = 72;
const COL_GAP     = 12;
const CARD_GAP    = 6;

const ROUND_LABELS: Record<KnockoutRound, string> = {
  R32:   'Round of 32',
  R16:   'Round of 16',
  QF:    'Quarter-finals',
  SF:    'Semi-finals',
  '3rd': '3rd Place',
  Final: 'FINAL',
};

const ROUND_ACCENT: Record<KnockoutRound, string> = {
  R32:   COLORS.textMuted,
  R16:   COLORS.textSecondary,
  QF:    COLORS.warning,
  SF:    COLORS.primaryLight,
  '3rd': COLORS.accentTeal,
  Final: COLORS.accent,
};

// ─── Match card ───────────────────────────────────────────────────────────────

function TeamSlot({ teamId, winner }: { teamId: string | null; winner?: boolean }) {
  const team = teamId ? NATIONS_BY_ID[teamId] : null;
  return (
    <View style={[styles.teamSlot, winner && styles.teamSlotWinner]}>
      {team
        ? <PixelFlag isoCode={team.isoCode} size={16} />
        : <Text style={styles.teamSlotFlag}>🏳️</Text>
      }
      <Text
        style={[styles.teamSlotName, winner && styles.teamSlotNameWinner]}
        numberOfLines={1}
      >
        {team?.code3 ?? '?'}
      </Text>
    </View>
  );
}

function KnockoutMatchCard({
  match,
  onQuickSim,
  onSimulate,
  onReset,
}: {
  match: ResolvedKnockoutMatch;
  onQuickSim?: () => void;
  onSimulate?: () => void;
  onReset?: () => void;
}) {
  const { def, homeTeamId, awayTeamId, result } = match;
  const bothKnown = homeTeamId !== null && awayTeamId !== null;
  const isPlayed   = result !== null;
  const accent     = ROUND_ACCENT[def.round];

  let homeWinner = false;
  let awayWinner = false;
  if (isPlayed) {
    homeWinner = result!.homeScore >= result!.awayScore;
    awayWinner = !homeWinner;
  }

  return (
    <View style={[styles.card, { borderTopColor: accent }]}>
      {/* Match number */}
      <View style={styles.cardHeader}>
        <Text style={[styles.cardMatchNum, { color: accent }]}>#{def.id}</Text>
        {isPlayed && (
          <Text style={styles.cardFT}>FT</Text>
        )}
      </View>

      {/* Teams */}
      <View style={styles.cardBody}>
        <View style={styles.cardTeams}>
          <TeamSlot teamId={homeTeamId} winner={homeWinner} />
          <View style={styles.cardScoreBox}>
            {isPlayed ? (
              <Text style={styles.cardScore}>
                {result!.homeScore}–{result!.awayScore}
              </Text>
            ) : (
              <Text style={styles.cardVs}>vs</Text>
            )}
          </View>
          <TeamSlot teamId={awayTeamId} winner={awayWinner} />
        </View>

        {/* Action buttons — only rendered when callbacks are provided (Simulator tab) */}
        {bothKnown && (onQuickSim || onSimulate) && (
          <View style={styles.cardActions}>
            {isPlayed ? (
              <>
                {onQuickSim && (
                  <TouchableOpacity style={styles.quickSimBtn} onPress={onQuickSim} activeOpacity={0.75}>
                    <Text style={styles.quickSimBtnText}>⚡</Text>
                  </TouchableOpacity>
                )}
                {onReset && (
                  <TouchableOpacity style={[styles.simBtn, styles.simBtnPlayed]} onPress={onReset} activeOpacity={0.75}>
                    <Text style={[styles.simBtnText, styles.simBtnTextPlayed]}>↺</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <>
                {onSimulate && (
                  <TouchableOpacity style={styles.simBtn} onPress={onSimulate} activeOpacity={0.75}>
                    <Text style={styles.simBtnText}>▶</Text>
                  </TouchableOpacity>
                )}
                {onQuickSim && (
                  <TouchableOpacity style={styles.quickSimBtn} onPress={onQuickSim} activeOpacity={0.75}>
                    <Text style={styles.quickSimBtnText}>⚡</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Column ───────────────────────────────────────────────────────────────────

function BracketColumn({
  round,
  matches,
  resolvedMap,
  actions = {},
}: {
  round: KnockoutRound;
  matches: number[];
  resolvedMap: Map<number, ResolvedKnockoutMatch>;
  actions?: BracketActions;
}) {
  const label = ROUND_LABELS[round];
  const accent = ROUND_ACCENT[round];
  const count = matches.length;

  // Vertical spacing grows with each round so cards align with their pair
  // R32=6, R16=78, QF=150, SF=294 — each step doubles the gap
  const gaps: Record<KnockoutRound, number> = {
    R32: CARD_GAP,
    R16: CARD_HEIGHT + CARD_GAP * 2 + 6,
    QF:  CARD_HEIGHT * 3 + CARD_GAP * 6 + 18,
    SF:  CARD_HEIGHT * 7 + CARD_GAP * 14 + 42,
    '3rd': CARD_GAP,
    Final: CARD_HEIGHT * 15 + CARD_GAP * 30 + 90,
  };
  const gap = gaps[round];

  const colHeight =
    count > 0
      ? count * CARD_HEIGHT + (count - 1) * gap
      : CARD_HEIGHT;

  return (
    <View style={[styles.column, { width: CARD_WIDTH }]}>
      {/* Column header */}
      <Text style={[styles.colLabel, { color: accent }]}>{label}</Text>

      {/* Cards positioned with growing gaps */}
      <View style={{ height: colHeight, position: 'relative' }}>
        {matches.map((matchId, idx) => {
          const match = resolvedMap.get(matchId);
          if (!match) return null;
          const top = idx * (CARD_HEIGHT + gap);
          return (
            <View key={matchId} style={[styles.cardWrap, { top }]}>
              <KnockoutMatchCard
                match={match}
                onQuickSim={actions.onQuickSim ? () => actions.onQuickSim!(match) : undefined}
                onSimulate={actions.onSimulate ? () => actions.onSimulate!(match) : undefined}
                onReset={actions.onReset ? () => actions.onReset!(match) : undefined}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Full bracket component ───────────────────────────────────────────────────

interface KnockoutBracketProps {
  resolved: ResolvedKnockoutMatch[];
  onQuickSim?: (match: ResolvedKnockoutMatch) => void;
  onSimulate?: (match: ResolvedKnockoutMatch) => void;
  onReset?: (match: ResolvedKnockoutMatch) => void;
}

export default function KnockoutBracket({ resolved, onQuickSim, onSimulate, onReset }: KnockoutBracketProps) {
  const resolvedMap = new Map(resolved.map((m) => [m.def.id, m]));
  const actions: BracketActions = { onQuickSim, onSimulate, onReset };

  const rounds: { round: KnockoutRound; order: number[] }[] = [
    { round: 'R32',   order: ROUND_ORDERS['R32']  },
    { round: 'R16',   order: ROUND_ORDERS['R16']  },
    { round: 'QF',    order: ROUND_ORDERS['QF']   },
    { round: 'SF',    order: ROUND_ORDERS['SF']   },
    { round: 'Final', order: [104]                 },
    { round: '3rd',   order: [103]                 },
  ];

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.outerScroll}
    >
      {/* Bracket columns — horizontal scroll: R32 → R16 → QF → SF → Final → 3rd Place */}
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.bracketScroll}
      >
        <View style={styles.bracketRow}>
          {rounds.map(({ round, order }) => (
            <BracketColumn
              key={round}
              round={round}
              matches={order}
              resolvedMap={resolvedMap}
              actions={actions}
            />
          ))}
        </View>
      </ScrollView>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  outerScroll: {
    paddingBottom: SPACING.xl,
  },
  bracketScroll: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    alignItems: 'flex-start',
  },
  bracketRow: {
    flexDirection: 'row',
    gap: COL_GAP,
    alignItems: 'flex-start',
  },

  // ── Column ──
  column: {
    flexDirection: 'column',
  },
  colLabel: {
    fontFamily: FONTS.headingMedium,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  cardWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: CARD_HEIGHT,
  },

  // ── Match card ──
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: COLORS.bgCard,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderTopWidth: 2,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 5,
    paddingTop: 2,
  },
  cardMatchNum: {
    fontFamily: FONTS.bodyBold,
    fontSize: 9,
  },
  cardFT: {
    fontFamily: FONTS.bodyBold,
    fontSize: 9,
    color: COLORS.success,
  },
  cardBody: {
    flex: 1,
    paddingHorizontal: 5,
    paddingBottom: 3,
    justifyContent: 'space-between',
  },
  cardTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  // ── Team slot ──
  teamSlot: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  teamSlotWinner: {},
  teamSlotFlag: {
    fontSize: 12,
  },
  teamSlotName: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  teamSlotNameWinner: {
    fontFamily: FONTS.bodyBold,
    color: COLORS.textPrimary,
  },

  // ── Score / VS ──
  cardScoreBox: {
    width: 30,
    alignItems: 'center',
  },
  cardScore: {
    fontFamily: FONTS.heading,
    fontSize: 12,
    color: COLORS.accent,
    letterSpacing: 0.5,
  },
  cardVs: {
    fontFamily: FONTS.bodyBold,
    fontSize: 9,
    color: COLORS.textMuted,
  },

  // ── Action buttons ──
  cardActions: {
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'flex-end',
  },
  quickSimBtn: {
    backgroundColor: COLORS.bgSurface,
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: COLORS.warning,
  },
  quickSimBtnText: {
    fontSize: 10,
  },
  simBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  simBtnPlayed: {
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1,
    borderColor: COLORS.textMuted,
  },
  simBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    color: COLORS.textPrimary,
  },
  simBtnTextPlayed: {
    color: COLORS.textSecondary,
  },

  // ── Third-place row ──
  thirdPlaceRow: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    width: CARD_WIDTH,
  },
});
