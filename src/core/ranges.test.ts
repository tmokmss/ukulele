/**
 * 一時停止とシークがあると、練習した範囲は「0拍目から止めた拍まで」ではなくなる。
 * 飛ばしたところを数えず、弾き直したところを二重に数えないのがここの仕事。
 */
import { describe, expect, it } from 'vitest';
import { addSpan, cutSpans, inSpans, type Span } from './ranges';

describe('addSpan', () => {
  it('離れた区間はそのまま並ぶ', () => {
    let s: Span[] = [];
    s = addSpan(s, 0, 8);
    s = addSpan(s, 16, 24);
    expect(s).toEqual([
      [0, 8],
      [16, 24],
    ]);
  });

  it('弾き直した区間は1つにまとまる', () => {
    let s: Span[] = [];
    s = addSpan(s, 0, 16);
    s = addSpan(s, 8, 20);
    expect(s).toEqual([[0, 20]]);
  });

  it('端が接する区間はつながる', () => {
    expect(addSpan([[0, 8]], 8, 12)).toEqual([[0, 12]]);
  });

  it('間を埋める区間は、前後ごと1つになる', () => {
    const s = addSpan(
      [
        [0, 4],
        [12, 16],
      ],
      3,
      13,
    );
    expect(s).toEqual([[0, 16]]);
  });

  it('長さのない区間は足さない', () => {
    const s: Span[] = [[0, 4]];
    expect(addSpan(s, 6, 6)).toBe(s);
    expect(addSpan(s, 6, 5)).toBe(s);
  });
});

describe('cutSpans', () => {
  const spans: Span[] = [
    [0, 8],
    [16, 24],
  ];
  it('切った位置から先を落とす', () => {
    expect(cutSpans(spans, 20)).toEqual([
      [0, 8],
      [16, 20],
    ]);
    expect(cutSpans(spans, 12)).toEqual([[0, 8]]);
    expect(cutSpans(spans, 0)).toEqual([]);
  });

  it('先まで弾き直すと、元の長さに戻る', () => {
    expect(addSpan(cutSpans(spans, 18), 18, 24)).toEqual([
      [0, 8],
      [16, 24],
    ]);
  });

  it('まだ通っていないところで切っても、何も変わらない', () => {
    expect(cutSpans(spans, 30)).toEqual(spans);
  });
});

describe('inSpans', () => {
  const spans: Span[] = [
    [0, 8],
    [16, 24],
  ];
  it('区間の中だけ true。終わりの拍は含まない', () => {
    expect(inSpans(spans, 0)).toBe(true);
    expect(inSpans(spans, 7.9)).toBe(true);
    expect(inSpans(spans, 8)).toBe(false);
    expect(inSpans(spans, 12)).toBe(false);
    expect(inSpans(spans, 16)).toBe(true);
  });
});
