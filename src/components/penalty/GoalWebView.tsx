import React, { useRef, useCallback, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import WebView, { WebViewMessageEvent } from 'react-native-webview';
import { PENALTY_GAME_HTML } from './penaltyGameHtml';
import { GoalZone, GKDive, ShotOutcome } from '../../types/penalty';

const { width: SCREEN_W } = Dimensions.get('window');
const VIEW_H = Math.round(SCREEN_W * 0.72); // ~72% of screen width, keeps goal proportional

interface GoalWebViewProps {
  /** When non-null, trigger the shot animation */
  pendingShot: {
    zone:     GoalZone;
    gkDive:   GKDive;
    outcome:  ShotOutcome;
  } | null;
  onAnimDone: (outcome: ShotOutcome) => void;
  onReady:    () => void;
}

export default function GoalWebView({ pendingShot, onAnimDone, onReady }: GoalWebViewProps) {
  const webViewRef  = useRef<WebView>(null);
  const isReady     = useRef(false);
  const lastShotKey = useRef<string | null>(null);

  // Send a shoot command whenever pendingShot changes
  useEffect(() => {
    if (!pendingShot || !isReady.current) return;

    // Deduplicate: build a key from zone+gkDir+gkHeight+outcome
    const key = `${pendingShot.zone}-${pendingShot.gkDive.direction}-${pendingShot.gkDive.height}-${pendingShot.outcome}`;
    if (key === lastShotKey.current) return;
    lastShotKey.current = key;

    const msg = JSON.stringify({
      type:     'shoot',
      zone:     pendingShot.zone,
      gkDir:    pendingShot.gkDive.direction,
      gkHeight: pendingShot.gkDive.height,
      outcome:  pendingShot.outcome,
    });
    webViewRef.current?.injectJavaScript(`
      window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify(msg)} }));
      true;
    `);
  }, [pendingShot]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'ready') {
          isReady.current = true;
          onReady();
        } else if (data.type === 'animDone') {
          onAnimDone(data.outcome as ShotOutcome);
        }
      } catch (_) {}
    },
    [onAnimDone, onReady],
  );

  // Reset scene when pendingShot becomes null (new kick)
  useEffect(() => {
    if (pendingShot !== null) return;
    if (!isReady.current) return;
    lastShotKey.current = null;
    webViewRef.current?.injectJavaScript(`
      window.dispatchEvent(new MessageEvent('message', { data: '{"type":"reset"}' }));
      true;
    `);
  }, [pendingShot]);

  return (
    <View style={[styles.container, { height: VIEW_H }]}>
      <WebView
        ref={webViewRef}
        source={{ html: PENALTY_GAME_HTML }}
        style={styles.webview}
        originWhitelist={['*']}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        renderLoading={() => (
          <View style={styles.loader}>
            <ActivityIndicator color="#ffd700" size="large" />
          </View>
        )}
        startInLoadingState
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#0a5c1a',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a5c1a',
  },
});
