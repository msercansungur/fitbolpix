import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  useNavigation,
  useRoute,
  CompositeNavigationProp,
  RouteProp,
} from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, PIXEL_SHADOW } from '../theme';
import { cardGreen, cardTeal, cardRed } from '../theme/gradients';
import { NATIONS, NATIONS_BY_ID } from '../constants/nations';
import { Team } from '../types/simulator';
import PixelFlag from '../components/PixelFlag';
import { BottomTabParamList } from '../navigation/BottomTabNavigator';
import { RootStackParamList } from '../navigation/RootNavigator';

// ─── Nav typing ───────────────────────────────────────────────────────────────
type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<BottomTabParamList, 'Penalty'>,
  NativeStackNavigationProp<RootStackParamList>
>;
type R = RouteProp<BottomTabParamList, 'Penalty'>;

// Local mirror of the result shape (same as BottomTabParamList.Penalty.result)
type PenaltyResult = NonNullable<NonNullable<BottomTabParamList['Penalty']>['result']>;
type ShootoutMode  = PenaltyResult['mode'];

// ─── Pixel glyph (6×6 grid) ───────────────────────────────────────────────────
type GlyphKind =
  | 'trophy' | 'bolt' | 'ball' | 'goalpost' | 'back' | 'chev';

const GLYPHS: Record<GlyphKind, string[]> = {
  trophy:   ['111111','011110','011110','001100','011110','111111'],
  bolt:     ['000110','001100','011100','111100','001100','011000'],
  ball:     ['011110','110011','101101','101101','110011','011110'],
  goalpost: ['111111','100001','100001','100001','100001','111111'],
  back:     ['000010','000110','001110','001110','000110','000010'],
  chev:     ['010000','011000','011100','011100','011000','010000'],
};

function PixelGlyph({ kind, color, px = 2 }: { kind: GlyphKind; color: string; px?: number }) {
  return (
    <View style={{ width: px * 6, height: px * 6 }}>
      {GLYPHS[kind].map((row, r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {row.split('').map((c, ci) => (
            <View key={ci} style={{ width: px, height: px, backgroundColor: c === '1' ? color : 'transparent' }} />
          ))}
        </View>
      ))}
    </View>
  );
}

// ─── Mode card (Screen 1) ─────────────────────────────────────────────────────
type GradientCfg = {
  colors: readonly [string, string];
  start:  { x: number; y: number };
  end:    { x: number; y: number };
};

function ModeCard({
  gradient, accentBorder, glyph, glyphColor, title, description, pills, chevColor, onPress, disabled,
}: {
  gradient: GradientCfg;
  accentBorder: string;
  glyph: GlyphKind;
  glyphColor: string;
  title: string;
  description: string;
  pills: Array<{ label: string; gold?: boolean }>;
  chevColor: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const Container: any = disabled ? View : TouchableOpacity;
  return (
    <View style={[styles.modeCardShadow, disabled && { opacity: 0.55 }]}>
      <Container activeOpacity={0.85} onPress={onPress} disabled={disabled}>
        <LinearGradient {...gradient} style={[styles.modeCard, { borderColor: accentBorder }]}>
          <View style={styles.modeIconBox}>
            <PixelGlyph kind={glyph} color={glyphColor} px={3} />
          </View>
          <View style={styles.modeBody}>
            <Text style={styles.modeTitle}>{title}</Text>
            <Text style={styles.modeSub}>{description}</Text>
            <View style={styles.modePills}>
              {pills.map((p, i) => (
                <View key={i} style={[styles.modePill, p.gold && styles.modePillGold]}>
                  <Text style={[styles.modePillText, p.gold && styles.modePillTextGold]}>
                    {p.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
          <Text style={[styles.modeChev, { color: chevColor }]}>›</Text>
        </LinearGradient>
      </Container>
    </View>
  );
}

// ─── Team slot card (Screen 2) ────────────────────────────────────────────────
function TeamSlot({ nation, side, onPress }: { nation: Team | null; side: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.slotShadow} activeOpacity={0.85} onPress={onPress}>
      <View style={styles.slot}>
        <View style={styles.slotTag}>
          <Text style={styles.slotTagText}>{side}</Text>
        </View>
        {nation ? (
          <>
            <View style={styles.slotFlag}>
              <PixelFlag isoCode={nation.isoCode} size={40} />
            </View>
            <Text style={styles.slotCode}>{nation.code3}</Text>
            <Text style={styles.slotHint}>TAP TO CHANGE</Text>
          </>
        ) : (
          <>
            <View style={[styles.slotFlag, styles.slotFlagEmpty]}>
              <Text style={styles.slotPlus}>+</Text>
            </View>
            <Text style={[styles.slotCode, { color: COLORS.textMuted }]}>SELECT</Text>
            <Text style={styles.slotHint}>TAP TO PICK</Text>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Score row (Screen 3) ─────────────────────────────────────────────────────
function ScoreRow({
  team, score, kicks, isWinner, isLoser,
}: {
  team: Team;
  score: number;
  kicks: PenaltyResult['kicks'];
  isWinner: boolean;
  isLoser: boolean;
}) {
  return (
    <View style={styles.scoreRow}>
      <View style={styles.scoreSide}>
        <PixelFlag isoCode={team.isoCode} size={22} />
        <Text
          style={[
            styles.scoreCode,
            isWinner && { color: COLORS.gold },
            isLoser  && { color: COLORS.textMuted },
          ]}
          numberOfLines={1}
        >
          {team.code3}
        </Text>
      </View>
      <Text style={[styles.scoreBig, isLoser && { color: COLORS.textMuted }]}>
        {score}
      </Text>
      <View style={styles.scoreDotsRow}>
        {kicks.slice(0, 5).map((k, i) => (
          <View
            key={i}
            style={[
              styles.scoreDot,
              k.outcome === 'goal' ? styles.scoreDotGoal : styles.scoreDotMiss,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

function ShotCell({ kick }: { kick: PenaltyResult['kicks'][number] | undefined }) {
  if (!kick) {
    return (
      <View style={[styles.seqCell, styles.seqCellNA]}>
        <Text style={styles.seqCellTextNA}>—</Text>
      </View>
    );
  }
  if (kick.outcome === 'goal') {
    return (
      <View style={[styles.seqCell, styles.seqCellGoal]}>
        <Text style={styles.seqCellTextGoal}>✓</Text>
      </View>
    );
  }
  return (
    <View style={[styles.seqCell, styles.seqCellMiss]}>
      <Text style={styles.seqCellTextMiss}>✗</Text>
    </View>
  );
}

function SequenceGrid({
  homeTeam, awayTeam, homeKicks, awayKicks, totalRounds,
}: {
  homeTeam: Team;
  awayTeam: Team;
  homeKicks: PenaltyResult['kicks'];
  awayKicks: PenaltyResult['kicks'];
  totalRounds: number;
}) {
  const rounds = Array.from({ length: totalRounds }, (_, i) => i);
  return (
    <View>
      <View style={styles.seqRow}>
        <View style={styles.seqHdrTeam} />
        {rounds.map((r) => (
          <View key={r} style={styles.seqCell}>
            <Text style={styles.seqHdr}>{r + 1}</Text>
          </View>
        ))}
      </View>
      <View style={styles.seqRow}>
        <View style={styles.seqHdrTeam}>
          <PixelFlag isoCode={homeTeam.isoCode} size={14} />
          <Text style={styles.seqTm}>{homeTeam.code3}</Text>
        </View>
        {rounds.map((r) => <ShotCell key={r} kick={homeKicks[r]} />)}
      </View>
      <View style={styles.seqRow}>
        <View style={styles.seqHdrTeam}>
          <PixelFlag isoCode={awayTeam.isoCode} size={14} />
          <Text style={styles.seqTm}>{awayTeam.code3}</Text>
        </View>
        {rounds.map((r) => <ShotCell key={r} kick={awayKicks[r]} />)}
      </View>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
type Phase = 'mode_select' | 'team_select' | 'result';

export default function PenaltyMenuScreen() {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<R>();

  const [phase,        setPhase]        = useState<Phase>('mode_select');
  const [selectedMode, setSelectedMode] = useState<ShootoutMode | null>(null);
  const [pickedHome,   setPickedHome]   = useState<string | null>(null);
  const [pickedAway,   setPickedAway]   = useState<string | null>(null);

  // Bottom-sheet picker state
  const [pickerOpen,  setPickerOpen]  = useState(false);
  const [pickerSide,  setPickerSide]  = useState<'home' | 'away'>('home');
  const [searchQuery, setSearchQuery] = useState('');

  // Snapshot of the result so we keep rendering it after we clear the route param
  const [savedResult, setSavedResult] = useState<PenaltyResult | null>(null);

  // Watch for incoming result from PenaltyScreen → snapshot it and switch to result phase
  useEffect(() => {
    const r = route.params?.result;
    if (!r) return;
    setSavedResult(r);
    setPhase('result');
    // Clear the param so re-entering the tab doesn't re-trigger
    navigation.setParams({ result: undefined } as any);
  }, [route.params?.result, navigation]);

  // ── Picker modal helpers ─────────────────────────────────────────────────
  const openPicker = useCallback((side: 'home' | 'away') => {
    setPickerSide(side);
    setSearchQuery('');
    setPickerOpen(true);
  }, []);

  const closePicker = useCallback(() => {
    setPickerOpen(false);
    setSearchQuery('');
  }, []);

  const handlePickNation = useCallback((team: Team) => {
    if (pickerSide === 'home') {
      if (pickedAway === team.id) return;
      setPickedHome(team.id);
    } else {
      if (pickedHome === team.id) return;
      setPickedAway(team.id);
    }
    closePicker();
  }, [pickerSide, pickedHome, pickedAway, closePicker]);

  const filteredNations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = [...NATIONS].sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return list;
    return list.filter(
      (n) =>
        n.name.toLowerCase().includes(q) ||
        n.code3.toLowerCase().includes(q) ||
        n.id.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  // ── Launch game ──────────────────────────────────────────────────────────
  const handleKickOff = useCallback(() => {
    if (!pickedHome || !pickedAway || !selectedMode) return;
    if (pickedHome === pickedAway) return;
    navigation.navigate('PenaltyGame', {
      homeTeamId: pickedHome,
      awayTeamId: pickedAway,
      mode: selectedMode,
    });
  }, [pickedHome, pickedAway, selectedMode, navigation]);

  // ── Result-phase actions ─────────────────────────────────────────────────
  const handlePlayAgain = useCallback(() => {
    setSavedResult(null);
    setSelectedMode(null);
    setPickedHome(null);
    setPickedAway(null);
    setPhase('mode_select');
  }, []);

  const handleBackToMenu = useCallback(() => {
    setSavedResult(null);
    setSelectedMode(null);
    setPickedHome(null);
    setPickedAway(null);
    setPhase('mode_select');
    navigation.navigate('Home');
  }, [navigation]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Bottom-sheet picker modal (reused by team_select)
  // ═══════════════════════════════════════════════════════════════════════════
  const pickerModal = (
    <Modal
      visible={pickerOpen}
      animationType="slide"
      transparent
      onRequestClose={closePicker}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>SELECT NATION</Text>
            <View style={styles.modalBadge}>
              <Text style={styles.modalBadgeText}>
                PICKING · {pickerSide === 'home' ? 'HOME' : 'AWAY'}
              </Text>
            </View>
            <TouchableOpacity onPress={closePicker} style={styles.modalClose} activeOpacity={0.7}>
              <Text style={styles.modalCloseX}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="SEARCH NATION..."
              placeholderTextColor={COLORS.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              autoCapitalize="characters"
            />
          </View>
          <ScrollView
            style={styles.modalList}
            contentContainerStyle={styles.modalListInner}
            keyboardShouldPersistTaps="handled"
          >
            {filteredNations.map((nation) => {
              const excluded =
                (pickerSide === 'home' && nation.id === pickedAway) ||
                (pickerSide === 'away' && nation.id === pickedHome);
              return (
                <TouchableOpacity
                  key={nation.id}
                  style={[styles.modalRow, excluded && styles.modalRowExcluded]}
                  activeOpacity={excluded ? 1 : 0.7}
                  onPress={() => !excluded && handlePickNation(nation)}
                >
                  <PixelFlag isoCode={nation.isoCode} size={22} />
                  <Text style={[styles.modalRowName, excluded && styles.modalRowMuted]} numberOfLines={1}>
                    {nation.name}
                  </Text>
                  <Text style={[styles.modalRowCode, excluded && styles.modalRowMuted]}>
                    {nation.code3}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {filteredNations.length === 0 && (
              <Text style={styles.modalEmpty}>No nations match "{searchQuery}"</Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREEN 1 — Mode Select
  // ═══════════════════════════════════════════════════════════════════════════
  if (phase === 'mode_select') {
    return (
      <SafeAreaView style={styles.root}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.pageTitle}>PENALTIES</Text>
          <Text style={styles.pageSubtitle}>Choose your format</Text>

          {/* Mode cards */}
          <View style={styles.modeList}>
            <ModeCard
              gradient={cardGreen}
              accentBorder={COLORS.green}
              glyph="goalpost"
              glyphColor={COLORS.gold}
              title="CLASSIC SHOOTOUT"
              description="5 kicks per side, first to miss loses"
              pills={[{ label: 'BEST OF 5', gold: true }, { label: '~3 MIN' }]}
              chevColor={COLORS.gold}
              onPress={() => {
                setSelectedMode('best_of_5');
                setPhase('team_select');
              }}
            />
            <ModeCard
              gradient={cardTeal}
              accentBorder={COLORS.teal}
              glyph="bolt"
              glyphColor={COLORS.teal}
              title="SUDDEN DEATH"
              description="Keep shooting until someone misses"
              pills={[{ label: 'HIGH STAKES', gold: true }]}
              chevColor={COLORS.teal}
              onPress={() => {
                setSelectedMode('sudden_death');
                setPhase('team_select');
              }}
            />
            <ModeCard
              gradient={cardRed}
              accentBorder="#8a6f1f"
              glyph="trophy"
              glyphColor="#E8B929"
              title="HISTORIC DUELS"
              description="Relive the greatest shootouts in history"
              pills={[{ label: '12 SCENARIOS' }, { label: 'COMING SOON', gold: true }]}
              chevColor="#E8B929"
              disabled
            />
          </View>

          {/* Stats bar */}
          <View style={styles.statsBar}>
            <View style={styles.statsCell}>
              <Text style={styles.statsNum}>0</Text>
              <Text style={styles.statsLbl}>PLAYED</Text>
            </View>
            <View style={styles.statsCell}>
              <Text style={styles.statsNum}>0–0</Text>
              <Text style={styles.statsLbl}>RECORD</Text>
            </View>
            <View style={styles.statsCell}>
              <Text style={styles.statsNum}>—</Text>
              <Text style={styles.statsLbl}>CONVERSION</Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREEN 2 — Match Setup
  // ═══════════════════════════════════════════════════════════════════════════
  if (phase === 'team_select') {
    const modeLabel  = selectedMode === 'sudden_death' ? '⚡ SUDDEN DEATH' : '⚡ CLASSIC SHOOTOUT';
    const kicksLabel = selectedMode === 'sudden_death' ? 'SUDDEN DEATH' : '5 PER SIDE';
    const canStart =
      pickedHome !== null &&
      pickedAway !== null &&
      selectedMode !== null &&
      pickedHome !== pickedAway;

    const homeNation = pickedHome ? NATIONS_BY_ID[pickedHome] : null;
    const awayNation = pickedAway ? NATIONS_BY_ID[pickedAway] : null;

    return (
      <SafeAreaView style={styles.root}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Top bar */}
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => setPhase('mode_select')} style={styles.topBarBack} activeOpacity={0.7}>
              <PixelGlyph kind="back" color={COLORS.gold} />
            </TouchableOpacity>
            <Text style={styles.topBarTitle}>MATCH SETUP</Text>
            <View style={styles.topBarModeBadge}>
              <Text style={styles.topBarModeText}>{modeLabel}</Text>
            </View>
          </View>

          {/* Setup hero card */}
          <View style={styles.setupHeroShadow}>
            <LinearGradient {...cardGreen} style={styles.setupHero}>
              <View style={styles.slotRow}>
                <TeamSlot nation={homeNation} side="HOME" onPress={() => openPicker('home')} />
                <Text style={styles.setupVs}>VS</Text>
                <TeamSlot nation={awayNation} side="AWAY" onPress={() => openPicker('away')} />
              </View>

              {/* Options row */}
              <View style={styles.optionsRow}>
                <View style={styles.optionCell}>
                  <Text style={styles.optionLabel}>KICKS</Text>
                  <Text style={styles.optionValue}>{kicksLabel}</Text>
                </View>
                <View style={styles.optionCell}>
                  <Text style={styles.optionLabel}>FIRST SHOOTER</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={styles.greenDot} />
                    <Text style={styles.optionValue}>HOME</Text>
                  </View>
                </View>
              </View>

              {/* Round preview (classic only) */}
              {selectedMode !== 'sudden_death' && (
                <View style={styles.previewBox}>
                  <View style={styles.previewHead}>
                    <Text style={styles.previewLabel}>ROUND PREVIEW</Text>
                    <Text style={styles.previewSub}>5 kicks each side</Text>
                  </View>
                  <View style={styles.previewDotsRow}>
                    <View style={styles.previewDotRow}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <View key={i} style={styles.previewDot} />
                      ))}
                    </View>
                    <Text style={styles.previewVs}>VS</Text>
                    <View style={styles.previewDotRow}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <View key={i} style={styles.previewDot} />
                      ))}
                    </View>
                  </View>
                </View>
              )}
            </LinearGradient>
          </View>

          {/* Kick-off CTA */}
          <TouchableOpacity
            activeOpacity={canStart ? 0.85 : 1}
            onPress={handleKickOff}
            disabled={!canStart}
            style={[styles.kickoffShadow, !canStart && { opacity: 0.45 }]}
          >
            <View style={styles.kickoffBtn}>
              <Text style={styles.kickoffBtnText}>⚡ KICK OFF</Text>
            </View>
          </TouchableOpacity>

          {/* Change mode link */}
          <TouchableOpacity
            onPress={() => setPhase('mode_select')}
            activeOpacity={0.7}
            style={styles.changeModeBtn}
          >
            <Text style={styles.changeModeText}>› CHANGE MODE</Text>
          </TouchableOpacity>
        </ScrollView>

        {pickerModal}
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREEN 3 — Result
  // ═══════════════════════════════════════════════════════════════════════════
  if (phase === 'result' && savedResult) {
    const homeTeam = NATIONS_BY_ID[savedResult.homeTeamId];
    const awayTeam = NATIONS_BY_ID[savedResult.awayTeamId];

    if (!homeTeam || !awayTeam) {
      // Defensive fallback
      return (
        <SafeAreaView style={styles.root}>
          <Text style={styles.pageTitle}>Loading…</Text>
        </SafeAreaView>
      );
    }

    const winner  = savedResult.winnerId ? NATIONS_BY_ID[savedResult.winnerId] : null;
    const isDraw  = !savedResult.winnerId;
    const homeWon = savedResult.winnerId === savedResult.homeTeamId;
    const awayWon = savedResult.winnerId === savedResult.awayTeamId;
    const modeLabel = savedResult.mode === 'sudden_death' ? 'SUDDEN DEATH' : 'CLASSIC SHOOTOUT';

    const homeKicks = savedResult.kicks.filter((k) => k.teamId === savedResult.homeTeamId);
    const awayKicks = savedResult.kicks.filter((k) => k.teamId === savedResult.awayTeamId);
    const totalRounds = Math.max(5, savedResult.rounds);

    return (
      <SafeAreaView style={styles.root}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Top bar */}
          <View style={styles.topBar}>
            <Text style={styles.topBarTitle}>FULL TIME</Text>
            <View style={styles.topBarModeBadge}>
              <Text style={styles.topBarModeText}>{'⚡ ' + modeLabel}</Text>
            </View>
          </View>

          {/* Winner hero */}
          <View style={styles.heroShadow}>
            <LinearGradient {...(isDraw ? cardTeal : cardGreen)} style={styles.hero}>
              {isDraw ? (
                <>
                  <Text style={styles.heroCrown}>★ DRAW ★</Text>
                  <Text style={styles.heroNation}>LEVEL</Text>
                  <View style={styles.heroWinsPill}>
                    <Text style={styles.heroWinsText}>REMARKABLE</Text>
                  </View>
                  <Text style={styles.heroMode}>{modeLabel}</Text>
                </>
              ) : winner ? (
                <>
                  <Text style={styles.heroCrown}>★ CHAMPION ★</Text>
                  <View style={styles.heroFlagWrap}>
                    <PixelFlag isoCode={winner.isoCode} size={64} />
                  </View>
                  <Text style={styles.heroNation}>{winner.name.toUpperCase()}</Text>
                  <View style={styles.heroWinsPill}>
                    <Text style={styles.heroWinsText}>WINS!</Text>
                  </View>
                  <Text style={styles.heroMode}>
                    {modeLabel} · {savedResult.rounds} ROUND{savedResult.rounds !== 1 ? 'S' : ''}
                  </Text>
                </>
              ) : null}
            </LinearGradient>
          </View>

          {/* Score card */}
          <View style={styles.scoreCardShadow}>
            <View style={styles.scoreCard}>
              <View style={styles.scoreHead}>
                <Text style={styles.scoreHeadLbl}>FINAL SCORE</Text>
                <Text style={styles.scoreHeadRounds}>
                  {savedResult.rounds} ROUND{savedResult.rounds !== 1 ? 'S' : ''}
                </Text>
              </View>
              <ScoreRow
                team={homeTeam}
                score={savedResult.homeScore}
                kicks={homeKicks}
                isWinner={homeWon}
                isLoser={awayWon}
              />
              <ScoreRow
                team={awayTeam}
                score={savedResult.awayScore}
                kicks={awayKicks}
                isWinner={awayWon}
                isLoser={homeWon}
              />
            </View>
          </View>

          {/* Shot-by-shot grid */}
          <View style={styles.seqShadow}>
            <View style={styles.seqCard}>
              <View style={styles.seqHeader}>
                <Text style={styles.seqTitle}>SHOT-BY-SHOT</Text>
                <Text style={styles.seqHint}>✓ goal · ✗ miss</Text>
              </View>
              <SequenceGrid
                homeTeam={homeTeam}
                awayTeam={awayTeam}
                homeKicks={homeKicks}
                awayKicks={awayKicks}
                totalRounds={totalRounds}
              />
            </View>
          </View>

          {/* Action buttons */}
          <View style={styles.resultActions}>
            <TouchableOpacity style={styles.playAgainBtn} onPress={handlePlayAgain} activeOpacity={0.8}>
              <Text style={styles.playAgainText}>↺ PLAY AGAIN</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.85} onPress={handleBackToMenu} style={styles.backMenuShadow}>
              <LinearGradient {...cardGreen} style={styles.backMenuBtn}>
                <Text style={styles.backMenuText}>BACK TO MENU</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Fallback (unreachable unless phase='result' without savedResult)
  return (
    <SafeAreaView style={styles.root}>
      <Text style={styles.pageTitle}>Loading…</Text>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING[16], paddingBottom: SPACING[32] },

  // Titles
  pageTitle: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 26,
    color: COLORS.gold,
    letterSpacing: 3,
    textAlign: 'center',
    marginTop: SPACING[8],
  },
  pageSubtitle: {
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: SPACING[16],
  },

  // Top bar (shared by team_select + result)
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING[8],
    marginBottom: SPACING[12],
  },
  topBarBack: {
    width: 32,
    height: 32,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.small,
    alignItems: 'center',
    justifyContent: 'center',
    ...PIXEL_SHADOW,
  },
  topBarTitle: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 20,
    color: COLORS.gold,
    letterSpacing: 2.5,
  },
  topBarModeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(250,206,67,0.08)',
    borderWidth: 1,
    borderColor: '#8a6f1f',
    borderRadius: 4,
    ...PIXEL_SHADOW,
  },
  topBarModeText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 10,
    color: COLORS.gold,
    letterSpacing: 2,
  },

  // ── Screen 1 — Mode Select ────────────────────────────────────────────────
  introStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING[12],
    padding: SPACING[12],
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.medium,
    marginBottom: SPACING[12],
    ...PIXEL_SHADOW,
  },
  introIconTile: {
    width: 46,
    height: 46,
    backgroundColor: '#02110d',
    borderWidth: 1,
    borderColor: COLORS.green,
    borderRadius: RADIUS.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introHeading: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 14,
    color: COLORS.textPrimary,
    letterSpacing: 1.5,
  },
  introSub: {
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
    lineHeight: 15,
  },
  modeList: { gap: SPACING[12], marginTop: SPACING[4] },
  modeCardShadow: { borderRadius: RADIUS.medium, ...PIXEL_SHADOW },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING[12],
    paddingVertical: SPACING[12],
    paddingHorizontal: SPACING[16],
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    overflow: 'hidden',
  },
  modeIconBox: {
    width: 60,
    height: 60,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.4)',
    borderRadius: RADIUS.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeBody: { flex: 1 },
  modeTitle: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 16,
    color: COLORS.textPrimary,
    letterSpacing: 1.5,
  },
  modeSub: {
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 3,
    lineHeight: 15,
  },
  modePills: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  modePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modePillGold: {
    backgroundColor: 'rgba(250,206,67,0.08)',
    borderColor: '#8a6f1f',
  },
  modePillText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 9,
    color: COLORS.textSecondary,
    letterSpacing: 1.5,
  },
  modePillTextGold: { color: COLORS.gold },
  modeChev: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 24,
    letterSpacing: 1,
  },
  statsBar: {
    flexDirection: 'row',
    marginTop: SPACING[16],
    padding: SPACING[12],
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.medium,
    ...PIXEL_SHADOW,
  },
  statsCell: { flex: 1, alignItems: 'center', gap: 2 },
  statsNum: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 20,
    color: COLORS.gold,
    letterSpacing: 1,
  },
  statsLbl: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 9,
    color: COLORS.textMuted,
    letterSpacing: 1.5,
    marginTop: 2,
  },

  // ── Screen 2 — Match Setup ────────────────────────────────────────────────
  setupHeroShadow: {
    borderRadius: RADIUS.medium,
    marginTop: SPACING[4],
    marginBottom: SPACING[16],
    ...PIXEL_SHADOW,
  },
  setupHero: {
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.green,
    padding: SPACING[16],
    overflow: 'hidden',
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING[8],
  },
  slotShadow: { flex: 1, borderRadius: RADIUS.medium, ...PIXEL_SHADOW },
  slot: {
    backgroundColor: '#001f18',
    borderRadius: RADIUS.medium,
    borderWidth: 2,
    borderColor: COLORS.green,
    paddingTop: 18,
    paddingBottom: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 4,
    position: 'relative',
  },
  slotTag: {
    position: 'absolute',
    top: -10,
    backgroundColor: '#00150e',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  slotTagText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 9,
    color: COLORS.textMuted,
    letterSpacing: 2.5,
  },
  slotFlag: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  slotFlagEmpty: {
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    borderRadius: RADIUS.small,
  },
  slotPlus: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 32,
    color: COLORS.textMuted,
  },
  slotCode: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 22,
    color: COLORS.textPrimary,
    letterSpacing: 2.5,
  },
  slotHint: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 9,
    color: COLORS.gold,
    letterSpacing: 2,
    opacity: 0.8,
    marginTop: 4,
  },
  setupVs: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 22,
    color: COLORS.gold,
    letterSpacing: 1,
    paddingHorizontal: 2,
  },

  optionsRow: { flexDirection: 'row', gap: SPACING[8], marginTop: SPACING[16] },
  optionCell: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.small,
    paddingHorizontal: 10,
    paddingVertical: 8,
    ...PIXEL_SHADOW,
  },
  optionLabel: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 9,
    color: COLORS.textMuted,
    letterSpacing: 1.5,
  },
  optionValue: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 13,
    color: COLORS.textPrimary,
    letterSpacing: 1,
    marginTop: 2,
  },
  greenDot: { width: 6, height: 6, backgroundColor: '#94C952' },

  previewBox: {
    marginTop: SPACING[12],
    padding: SPACING[12],
    backgroundColor: 'rgba(250,206,67,0.05)',
    borderWidth: 1,
    borderColor: '#8a6f1f',
    borderStyle: 'dashed',
    borderRadius: RADIUS.small,
  },
  previewHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  previewLabel: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 10,
    color: COLORS.gold,
    letterSpacing: 2,
  },
  previewSub: {
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 10,
    color: COLORS.textMuted,
  },
  previewDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  previewDotRow: { flexDirection: 'row', gap: 6, flex: 1 },
  previewDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: COLORS.textMuted,
    opacity: 0.6,
  },
  previewVs: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 12,
    color: COLORS.textMuted,
    letterSpacing: 1,
  },

  kickoffShadow: {
    borderRadius: RADIUS.medium,
    marginBottom: SPACING[12],
    ...PIXEL_SHADOW,
  },
  kickoffBtn: {
    backgroundColor: COLORS.gold,
    borderRadius: RADIUS.medium,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#a27c1c',
  },
  kickoffBtnText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 18,
    color: COLORS.background,
    letterSpacing: 3,
    fontWeight: '800',
  },
  changeModeBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.green,
    borderStyle: 'dashed',
    borderRadius: RADIUS.small,
  },
  changeModeText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 12,
    color: COLORS.textSecondary,
    letterSpacing: 2,
  },

  // ── Bottom-sheet picker ──────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: RADIUS.large,
    borderTopRightRadius: RADIUS.large,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING[12],
    paddingHorizontal: SPACING[16],
    paddingBottom: SPACING[24],
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING[8],
    marginBottom: SPACING[12],
  },
  modalTitle: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 16,
    color: COLORS.gold,
    letterSpacing: 2,
  },
  modalBadge: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignSelf: 'center',
  },
  modalBadgeText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 10,
    color: COLORS.textSecondary,
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  modalClose: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.small,
  },
  modalCloseX: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  searchRow: { marginBottom: SPACING[8] },
  searchInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.small,
    paddingHorizontal: SPACING[12],
    paddingVertical: SPACING[8],
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 13,
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },
  modalList: { flexGrow: 0 },
  modalListInner: { paddingBottom: SPACING[16] },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING[12],
    paddingVertical: SPACING[8],
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    borderStyle: 'dashed',
  },
  modalRowExcluded: { opacity: 0.35 },
  modalRowName: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  modalRowCode: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 12,
    color: COLORS.gold,
    letterSpacing: 1.5,
  },
  modalRowMuted: { color: COLORS.textMuted },
  modalEmpty: {
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingVertical: SPACING[24],
  },

  // ── Screen 3 — Result ─────────────────────────────────────────────────────
  heroShadow: { borderRadius: RADIUS.large, marginBottom: SPACING[12], ...PIXEL_SHADOW },
  hero: {
    padding: SPACING[20],
    alignItems: 'center',
    borderRadius: RADIUS.large,
    borderWidth: 1,
    borderColor: COLORS.gold,
    overflow: 'hidden',
  },
  heroCrown: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 11,
    color: COLORS.gold,
    letterSpacing: 3,
    marginBottom: SPACING[4],
  },
  heroFlagWrap: { marginVertical: SPACING[8] },
  heroNation: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 30,
    color: COLORS.textPrimary,
    letterSpacing: 3,
    lineHeight: 32,
    textAlign: 'center',
  },
  heroWinsPill: {
    marginTop: SPACING[12],
    paddingVertical: 4,
    paddingHorizontal: 16,
    backgroundColor: COLORS.gold,
    borderWidth: 1,
    borderColor: '#a27c1c',
    borderRadius: RADIUS.small,
  },
  heroWinsText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 22,
    color: COLORS.background,
    letterSpacing: 3,
    fontWeight: '800',
  },
  heroMode: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 10,
    color: COLORS.textSecondary,
    letterSpacing: 2,
    marginTop: SPACING[12],
  },

  scoreCardShadow: { borderRadius: RADIUS.medium, marginBottom: SPACING[12], ...PIXEL_SHADOW },
  scoreCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING[12],
  },
  scoreHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    borderStyle: 'dashed',
  },
  scoreHeadLbl: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 10,
    color: COLORS.gold,
    letterSpacing: 2,
  },
  scoreHeadRounds: {
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 10,
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,176,192,0.15)',
    borderStyle: 'dashed',
  },
  scoreSide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING[8],
    minWidth: 0,
  },
  scoreCode: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 18,
    color: COLORS.textPrimary,
    letterSpacing: 1.5,
  },
  scoreBig: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 28,
    color: COLORS.gold,
    letterSpacing: 2,
    paddingHorizontal: 8,
    fontWeight: '800',
  },
  scoreDotsRow: {
    flexDirection: 'row',
    gap: 6,
    flex: 1,
    justifyContent: 'flex-end',
  },
  scoreDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  scoreDotGoal: { backgroundColor: '#94C952', borderColor: '#94C952' },
  scoreDotMiss: { backgroundColor: 'transparent', borderColor: COLORS.red },

  seqShadow: { borderRadius: RADIUS.medium, marginBottom: SPACING[20], ...PIXEL_SHADOW },
  seqCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING[12],
  },
  seqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING[8],
  },
  seqTitle: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 11,
    color: COLORS.gold,
    letterSpacing: 2,
  },
  seqHint: {
    fontFamily: TYPOGRAPHY.fontBody,
    fontSize: 9,
    color: COLORS.textMuted,
  },
  seqRow: { flexDirection: 'row', gap: 4, marginBottom: 4, alignItems: 'center' },
  seqHdrTeam: { width: 46, flexDirection: 'row', alignItems: 'center', gap: 4 },
  seqTm: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 10,
    color: COLORS.textSecondary,
    letterSpacing: 1,
  },
  seqHdr: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 10,
    color: COLORS.textMuted,
    letterSpacing: 1,
  },
  seqCell: {
    flex: 1,
    height: 24,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seqCellGoal: {
    backgroundColor: 'rgba(148,201,82,0.18)',
    borderColor: '#94C952',
  },
  seqCellMiss: {
    backgroundColor: 'rgba(194,52,11,0.14)',
    borderColor: COLORS.red,
  },
  seqCellNA: { backgroundColor: 'rgba(0,0,0,0.2)' },
  seqCellTextGoal: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 14,
    color: '#94C952',
    fontWeight: '800',
  },
  seqCellTextMiss: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 14,
    color: COLORS.red,
    fontWeight: '800',
  },
  seqCellTextNA: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 12,
    color: COLORS.textMuted,
  },

  resultActions: { gap: SPACING[8], marginTop: SPACING[4] },
  playAgainBtn: {
    borderRadius: RADIUS.medium,
    borderWidth: 1.5,
    borderColor: COLORS.green,
    borderStyle: 'dashed',
    paddingVertical: 14,
    alignItems: 'center',
  },
  playAgainText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 14,
    color: COLORS.textPrimary,
    letterSpacing: 2,
  },
  backMenuShadow: { borderRadius: RADIUS.medium, ...PIXEL_SHADOW },
  backMenuBtn: {
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.green,
    paddingVertical: 14,
    alignItems: 'center',
    overflow: 'hidden',
  },
  backMenuText: {
    fontFamily: TYPOGRAPHY.fontHeading,
    fontSize: 15,
    color: COLORS.textPrimary,
    letterSpacing: 2,
  },
});
