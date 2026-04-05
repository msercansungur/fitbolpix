import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { COLORS, SPACING, FONT_SIZE } from '../constants/theme';
import { NATIONS_BY_ID } from '../constants/nations';
import { ResolvedKnockoutMatch, KnockoutRound } from '../types/knockout';
import { KNOCKOUT_MATCHES, ROUND_ORDERS } from '../constants/knockoutBracket';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BracketActions {
  onQuickSim?: (match: ResolvedKnockoutMatch) => void;
  onSimulate?: (match: ResolvedKnockoutMatch) => void;
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
  SF:    COLORS.primary,
  '3rd': COLORS.save,
  Final: COLORS.primary,
};

// ─── Match card ───────────────────────────────────────────────────────────────

function TeamSlot({ teamId, winner }: { teamId: string | null; winner?: boolean }) {
  const team = teamId ? NATIONS_BY_ID[teamId] : null;
  return (
    <View style={[styles.teamSlot, winner && styles.teamSlotWinner]}>
      <Text style={styles.teamSlotFlag}>{team?.flag ?? '🏳️'}</Text>
      <Text
        style={[styles.teamSlotName, winner && styles.teamSlotNameWinner]}
        numberOfLines={1}
      >
        {team?.name ?? '?'}
      </Text>
    </View>
  );
}

function KnockoutMatchCard({
  match,
  onQuickSim,
  onSimulate,
}: {
  match: ResolvedKnockoutMatch;
  onQuickSim?: () => void;
  onSimulate?: () => void;
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
            {onQuickSim && (
              <TouchableOpacity
                style={styles.quickSimBtn}
                onPress={onQuickSim}
                activeOpacity={0.75}
              >
                <Text style={styles.quickSimBtnText}>⚡</Text>
              </TouchableOpacity>
            )}
            {onSimulate && (
              <TouchableOpacity
                style={[styles.simBtn, isPlayed && styles.simBtnPlayed]}
                onPress={onSimulate}
                activeOpacity={0.75}
              >
                <Text style={[styles.simBtnText, isPlayed && styles.simBtnTextPlayed]}>
                  {isPlayed ? '↺' : '▶'}
                </Text>
              </TouchableOpacity>
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
}

export default function KnockoutBracket({ resolved, onQuickSim, onSimulate }: KnockoutBracketProps) {
  const resolvedMap = new Map(resolved.map((m) => [m.def.id, m]));
  const actions: BracketActions = { onQuickSim, onSimulate };

  const rounds: { round: KnockoutRound; order: number[] }[] = [
    { round: 'R32',   order: ROUND_ORDERS['R32']  },
    { round: 'R16',   order: ROUND_ORDERS['R16']  },
    { round: 'QF',    order: ROUND_ORDERS['QF']   },
    { round: 'SF',    order: ROUND_ORDERS['SF']   },
    { round: 'Final', order: [104]                 },
  ];

  const thirdMatch = resolvedMap.get(103);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.outerScroll}
    >
      {/* Bracket columns — horizontal scroll */}
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

      {/* Third-place match — below the horizontal bracket, reachable by vertical scroll */}
      {thirdMatch && (
        <View style={styles.thirdPlaceRow}>
          <Text style={[styles.colLabel, { color: ROUND_ACCENT['3rd'] }]}>
            {ROUND_LABELS['3rd']}
          </Text>
          <KnockoutMatchCard
            match={thirdMatch}
            onQuickSim={actions.onQuickSim ? () => actions.onQuickSim!(thirdMatch) : undefined}
            onSimulate={actions.onSimulate ? () => actions.onSimulate!(thirdMatch) : undefined}
          />
        </View>
      )}
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
    fontSize: FONT_SIZE.xs,
    fontWeight: 'bold',
    letterSpacing: 0.8,
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
    backgroundColor: COLORS.surface,
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
    fontSize: 9,
    fontWeight: 'bold',
  },
  cardFT: {
    fontSize: 9,
    color: COLORS.success,
    fontWeight: 'bold',
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
    fontSize: 10,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  teamSlotNameWinner: {
    color: COLORS.textPrimary,
    fontWeight: 'bold',
  },

  // ── Score / VS ──
  cardScoreBox: {
    width: 30,
    alignItems: 'center',
  },
  cardScore: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
  },
  cardVs: {
    fontSize: 9,
    color: COLORS.textMuted,
    fontWeight: 'bold',
  },

  // ── Action buttons ──
  cardActions: {
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'flex-end',
  },
  quickSimBtn: {
    backgroundColor: COLORS.surfaceAlt,
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
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.textMuted,
  },
  simBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000',
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
