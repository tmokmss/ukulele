/**
 * 楽譜の JSON を、アプリに貼る前に確かめる。
 *
 *   npm run score -- path/to/song.json
 *
 * 読めれば中身の要約を出し、読めなければアプリと同じエラー文を出して終了コード1。
 * 楽譜を書くのは Claude なので、書いたら必ずこれを通してから渡す。
 * (tsconfig の include には入れていない。@types/node を足さずに vite-node で動かす)
 */
import { readFileSync } from 'node:fs';
import { parseScore, scoreTimeline } from '../src/core/score';
import { canJudgeChords, MIN_CHORD_SEC, shortestSlotSec, totalBeats } from '../src/core/timeline';

const path = process.argv[2];
if (!path) {
  console.error('使い方: npm run score -- <楽譜のJSONファイル>');
  process.exit(2);
}

const result = parseScore(readFileSync(path, 'utf8'));
if (!result.ok) {
  console.error(`読めません:\n${result.error}`);
  process.exit(1);
}

const score = result.score;
const tl = scoreTimeline(score);
const bpm = score.bpm ?? 70;
const beats = totalBeats(tl)!;
const sec = (beats * 60) / bpm;
const mm = Math.floor(sec / 60);
const ss = String(Math.round(sec % 60)).padStart(2, '0');

console.log(`OK 「${score.title}」`);
console.log(`  ${score.bars}小節 / ${score.beatsPerBar}拍子 / ${bpm} BPM${score.repeat > 1 ? ` / ${score.repeat}周` : ''} → ${mm}:${ss}`);
console.log(`  コード ${score.chords.join(' ')} (${score.slots.length}個)`);
if (score.sections.length > 1) {
  console.log(`  セクション ${score.sections.map((s) => `${s.name || '無名'}(${s.bars}小節×${s.repeat})`).join(' ')}`);
}
console.log(
  score.hits.length
    ? `  ストローク ${score.strum ?? 'セクションごと'} → 1周 ${score.hits.length} 打`
    : '  ストローク指定なし (コードの切れ目だけ採点)',
);
console.log(
  canJudgeChords(tl, bpm)
    ? '  コードも採点できる'
    : `  リズムだけ採点 (いちばん短いコードが ${shortestSlotSec(tl, bpm).toFixed(2)}秒 < ${MIN_CHORD_SEC}秒)`,
);
