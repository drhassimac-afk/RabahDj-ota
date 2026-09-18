import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

export type XoState = {
  board: string[];
  turn: string | null;
  score: { X: number; O: number };
  winLine: number[] | null;
  mySymbol: string;
};

export type ChessState = {
  board: string[][];
  turn: string;
  selected: [number, number] | null;
  captured: { w: string[]; b: string[] };
  myColor: string;
  validMoves: [number, number][];
};

const PIECE_ICON: Record<string, string> = {
  wk: '♔', wq: '♕', wr: '♖', wb: '♗', wn: '♘', wp: '♙',
  bk: '♚', bq: '♛', br: '♜', bb: '♝', bn: '♞', bp: '♟',
};

type Props = {
  activeTab: 'xo' | 'chess';
  xo: XoState | null;
  chess: ChessState | null;
  onSelectTab: (tab: 'xo' | 'chess') => void;
  onXoCell: (index: number) => void;
  onChessCell: (row: number, col: number) => void;
  onResetXo: () => void;
  onResetChess: () => void;
  onBack: () => void;
};

export default function GamesNative({
  activeTab, xo, chess, onSelectTab, onXoCell, onChessCell, onResetXo, onResetChess, onBack,
}: Props) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.top}>
        <TouchableOpacity style={styles.back} onPress={onBack}>
          <Text style={styles.backText}>← رجوع</Text>
        </TouchableOpacity>
        <Text style={styles.title}>الألعاب</Text>
        <View style={{ width: 70 }} />
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, activeTab === 'xo' && styles.tabActive]} onPress={() => onSelectTab('xo')}>
          <Text style={styles.tabText}>إكس أو</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'chess' && styles.tabActive]} onPress={() => onSelectTab('chess')}>
          <Text style={styles.tabText}>شطرنج</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'xo' && xo ? (
        <View style={{ alignItems: 'center' }}>
          <View style={styles.xoBoard}>
            {[0, 1, 2].map((rowIdx) => (
              <View key={rowIdx} style={styles.xoRow}>
                {[0, 1, 2].map((colIdx) => {
                  const i = rowIdx * 3 + colIdx;
                  const v = xo.board[i];
                  const isWin = xo.winLine?.includes(i);
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[styles.xoCell, isWin && styles.xoCellWin]}
                      onPress={() => onXoCell(i)}
                    >
                      <Text style={styles.xoCellText}>{v}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
          <Text style={styles.status}>
            أنت: {xo.mySymbol} — دور: {xo.turn || '-'}{'\n'}
            النتيجة X: {xo.score.X} | O: {xo.score.O}
          </Text>
          <TouchableOpacity style={styles.resetBtn} onPress={onResetXo}>
            <Text style={styles.resetBtnText}>لعبة جديدة</Text>
          </TouchableOpacity>
        </View>
      ) : activeTab === 'xo' ? (
        <View style={styles.emptyGameState}>
          <Text style={styles.emptyGameIcon}>⭕</Text>
          <Text style={styles.emptyGameTitle}>لعبة إكس أو غير جاهزة</Text>
          <Text style={styles.emptyGameSubtitle}>
            انتظر بدء اللعبة أو إعادة الاتصال بالغرفة
          </Text>
        </View>
      ) : null}

      {activeTab === 'chess' && chess ? (
        <View style={{ alignItems: 'center' }}>
          <View style={styles.chessBoard}>
            {chess.board.map((row, r) => (
              <View key={r} style={styles.chessRow}>
                {row.map((piece, c) => {
                  const isSelected = chess.selected && chess.selected[0] === r && chess.selected[1] === c;
                  const isLight = (r + c) % 2 === 0;
                  const isValidMove = chess.validMoves.some((m) => m[0] === r && m[1] === c);
                  return (
                    <TouchableOpacity
                      key={`${r}_${c}`}
                      style={[
                        styles.sq,
                        isLight ? styles.sqLight : styles.sqDark,
                        isSelected && styles.sqSelected,
                      ]}
                      onPress={() => onChessCell(r, c)}
                    >
                      {piece ? <Text style={styles.piece}>{PIECE_ICON[piece]}</Text> : null}
                      {isValidMove && !piece && <View style={styles.moveDot} />}
                      {isValidMove && piece && <View style={styles.captureRing} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
          <Text style={[styles.status, { color: chess.turn === chess.myColor ? '#4ade80' : '#94a3b8' }]}>
            {chess.turn === chess.myColor ? '🟢 دورك الآن' : '⏳ دور الخصم'}
          </Text>
          <Text style={styles.status}>أنت: {chess.myColor === 'w' ? 'أبيض' : 'أسود'}</Text>
          <TouchableOpacity style={styles.resetBtn} onPress={onResetChess}>
            <Text style={styles.resetBtnText}>لعبة جديدة</Text>
          </TouchableOpacity>
        </View>
      ) : activeTab === 'chess' ? (
        <View style={styles.emptyGameState}>
          <Text style={styles.emptyGameIcon}>♟️</Text>
          <Text style={styles.emptyGameTitle}>لعبة الشطرنج غير جاهزة</Text>
          <Text style={styles.emptyGameSubtitle}>
            انتظر بدء اللعبة أو إعادة الاتصال بالغرفة
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const CELL = 38;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1220', paddingHorizontal: 16 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 16 },
  back: { backgroundColor: '#ffffff14', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12 },
  backText: { color: '#fff', fontWeight: '700' },
  title: { color: '#fff', fontSize: 18, fontWeight: '800' },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  tab: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#ffffff22', backgroundColor: '#ffffff0a', alignItems: 'center' },
  tabActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  tabText: { color: '#fff', fontWeight: '700' },
  xoBoard: { marginTop: 10 },
  xoRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  xoCell: { width: 80, height: 80, backgroundColor: '#ffffff12', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  xoCellWin: { backgroundColor: '#16a34a55' },
  xoCellText: { color: '#fff', fontSize: 32, fontWeight: '800' },
  status: { color: '#94a3b8', fontSize: 14, textAlign: 'center', marginTop: 14 },
  resetBtn: { backgroundColor: '#dc2626', paddingVertical: 10, paddingHorizontal: 24, borderRadius: 12, marginTop: 14 },
  resetBtnText: { color: '#fff', fontWeight: '800' },

  emptyGameState: {
    alignItems: 'center',
    paddingVertical: 50,
    paddingHorizontal: 24,
  },
  emptyGameIcon: {
    fontSize: 46,
    marginBottom: 14,
    opacity: 0.45,
  },
  emptyGameTitle: {
    color: '#cbd5e1',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 7,
    textAlign: 'center',
  },
  emptyGameSubtitle: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center',
  },
  chessBoard: { borderWidth: 2, borderColor: '#ffffff22', borderRadius: 8, overflow: 'hidden', marginTop: 10 },
  chessRow: { flexDirection: 'row' },
  sq: { width: CELL, height: CELL, justifyContent: 'center', alignItems: 'center' },
  sqLight: { backgroundColor: '#334155' },
  sqDark: { backgroundColor: '#1e293b' },
  sqSelected: { borderWidth: 3, borderColor: '#f59e0b' },
  piece: { fontSize: 22 },
  moveDot: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: '#4ade80aa' },
  captureRing: { position: 'absolute', width: CELL - 6, height: CELL - 6, borderRadius: 4, borderWidth: 3, borderColor: '#dc2626aa' },
});
