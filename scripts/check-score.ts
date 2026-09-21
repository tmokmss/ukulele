/**
 * 楽譜が読めるか確かめる。
 *
 *   npm run score                     songs/ 全部
 *   npm run score -- songs/foo.json   1つだけ
 *
 * 読めれば中身の要約を出し、読めなければアプリと同じエラー文を出して終了コード1。
 * 楽譜を書くのは Claude なので、コミットする前に必ずこれを通す。
 * (tsconfig の include には入れていない。@types/node を足さずに vite-node で動かす)
 */
import { readdirSync, readFileSync } from 'node:fs';
import { parseScore } from '../src/core/score';
import { scoreTimeline } from '../src/core/score';
import { canJudgeChords, MIN_CHORD_SEC, shortestSlotSec, totalBeats } from '../src/core/timeline';

const SONG_DIR = 'songs';

const args = process.argv.slice(2);
const paths = args.length ? args : readdirSync(SONG_DIR).filter((f) => f.endsWith('.json')).map((f) => `${SONG_DIR}/${f}`);

if (!paths.length) {
  console.error(`${SONG_DIR}/ に楽譜がありません。`);
  process.exit(2);
}

let bad = 0;
for (const path of paths) {
  const result = parseScore(readFileSync(path, 'utf8'));
  if (!result.ok) {
    bad++;
    console.error(`NG ${path}\n${result.error.replace(/^/gm, '   ')}`);
    continue;
  }

  const score = result.score;
  const tl = scoreTimeline(score);
  const bpm = score.bpm ?? 70;
  const sec = ((totalBeats(tl) ?? 0) * 60) / bpm;
  const time = `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

  console.log(`OK ${path} 「${score.title}」`);
  console.log(
    `   ${score.bars}小節 / ${score.beatsPerBar}拍子 / ${bpm} BPM${score.repeat > 1 ? ` / ${score.repeat}周` : ''} → ${time}`,
  );
  console.log(`   コード ${score.chords.join(' ')} (${score.slots.length}個)`);
  if (score.sections.length > 1) {
    console.log(`   セクション ${score.sections.map((s) => `${s.name || '無名'}(${s.bars}小節×${s.repeat})`).join(' ')}`);
  }
  console.log(
    score.hits.length
      ? `   ストローク ${score.strum ?? 'セクションごと'} → 1周 ${score.hits.length} 打`
      : '   ストローク指定なし (コードの切れ目だけ採点)',
  );
  console.log(
    canJudgeChords(tl, bpm)
      ? '   コードも採点できる'
      : `   リズムだけ採点 (いちばん短いコードが ${shortestSlotSec(tl, bpm).toFixed(2)}秒 < ${MIN_CHORD_SEC}秒)`,
  );
}

if (bad) {
  console.error(`\n${bad} 件読めませんでした。`);
  process.exit(1);
}
