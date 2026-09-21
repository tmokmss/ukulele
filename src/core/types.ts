export type SourceKind = 'none' | 'mic' | 'synth';

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
  bpm: number;
  bpc: number;
  n: number;
  okRate: number;
  meanAbs: number | null;
  src: SourceKind;
};
