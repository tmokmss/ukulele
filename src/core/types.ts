export type SourceKind = 'none' | 'mic';

/** 何を練習するか。drill は進行の繰り返し、score は読み込んだ楽譜 */
export type PracticeMode = 'drill' | 'score';

export type Settings = {
  bpm: number;
  /** 1コードあたりの拍数 */
  bpc: number;
  /** 練習時間 (秒)。0 は「止めるまで」 */
  sessionSec: number;
  clickOn: boolean;
  /** 入出力の遅延補正 (ms)。null はマイク接続時に自動推定する */
  calibMs: number | null;
  /** オンセット検出の感度 1..10 */
  sens: number;
  prog: string[];
  mode: PracticeMode;
  /** 楽譜の JSON。書きかけでもそのまま持っておく */
  scoreText: string;
};

/** 練習のいまの位置。文言は report.ts が組み立てる */
export type TickInfo = {
  /** いまの拍。カウントイン中は負 */
  beat: number;
  /** いま鳴らすべきコードの絶対番号。カウントイン中は -1 */
  slot: number;
  /** 残り秒。終わりが決まっていなければ null */
  leftSec: number | null;
};

/** コード1つぶんの採点結果 */
export type SegmentResult = {
  /** 何コード目か (0始まり) */
  s: number;
  chord: string;
  /** 拍とのズレ (秒)。音が拾えなければ null */
  off: number | null;
  /** コード判定できるだけの音量があったか */
  heard: boolean;
  /** 狙ったコードとして通ったか */
  ok: boolean;
  /** いちばん近いと判定されたコード */
  best: string | null;
  /** 鳴りが弱い構成音のピッチクラス */
  weak: number[];
};

export type HistoryEntry = {
  ts: number;
  prog: string;
  /** 楽譜モードのときの曲名。進行の練習では持たない */
  title?: string;
  bpm: number;
  bpc: number;
  n: number;
  okRate: number;
  meanAbs: number | null;
};
