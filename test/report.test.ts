/**
 * カードに乗せる採点は、タイミングの語 (ジャスト/早め/遅め) と
 * コードが合っていたかの印 (✓/✗/?) の2つだけを持つ。詳しい文章とは別物。
 */
import { describe, expect, it } from 'vitest';
import { cardVerdict } from '../src/core/report';
import type { SegmentResult } from '../src/core/types';

function result(over: Partial<SegmentResult> = {}): SegmentResult {
  return { s: 0, chord: 'C', off: 0, heard: true, ok: true, best: 'C', weak: [], ...over };
}

describe('cardVerdict', () => {
  it('音が拾えなければ「聞こえず」', () => {
    expect(cardVerdict(result({ off: null, heard: false, ok: false, best: null }))).toEqual({
      tone: 'miss',
      mark: '',
      label: '聞こえず',
    });
  });

  it('ズレの大きさで tone が変わる', () => {
    expect(cardVerdict(result({ off: 0.02 })).tone).toBe('good');
    expect(cardVerdict(result({ off: -0.05 })).tone).toBe('good');
    expect(cardVerdict(result({ off: 0.08 })).tone).toBe('warn');
    expect(cardVerdict(result({ off: -0.2 })).tone).toBe('miss');
  });

  it('遅れは「遅め」、先走りは「早め」、範囲内は「ジャスト」', () => {
    expect(cardVerdict(result({ off: 0.15 })).label).toBe('遅め');
    expect(cardVerdict(result({ off: -0.15 })).label).toBe('早め');
    expect(cardVerdict(result({ off: 0.01 })).label).toBe('ジャスト');
  });

  it('コードが合っていれば ✓、違えば ✗、判定できなければ ?', () => {
    expect(cardVerdict(result({ heard: true, ok: true })).mark).toBe('✓');
    expect(cardVerdict(result({ heard: true, ok: false, best: 'C7' })).mark).toBe('✗');
    expect(cardVerdict(result({ heard: false, ok: false, best: null })).mark).toBe('?');
  });

  it('タイミングとコードの判定は独立している', () => {
    // ジャストでもコードが違えば ✗ が付く
    expect(cardVerdict(result({ off: 0.01, ok: false, best: 'Am' }))).toEqual({
      tone: 'good',
      mark: '✗',
      label: 'ジャスト',
    });
  });
});
