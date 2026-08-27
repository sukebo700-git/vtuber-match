#!/usr/bin/env python
"""文字起こしの精度を正解テキストと突き合わせて採点する。

    python score.py --in work/bench/voice.m4a --truth assets/benchmark-truth.txt
    python score.py --in work/bench/voice.m4a --truth assets/benchmark-truth.txt \
                    --dict assets/terms-sample.txt        # 固有名詞辞書あり
    python score.py --compare work/bench/voice.m4a        # 辞書あり/なしを一括比較

CER（文字誤り率）に加えて、固有名詞が1語ずつ拾えているかを個別に判定する。
CERは全体の傾向を示すが、実務上は固有名詞の正解率の方が体感品質に効く。
"""

from __future__ import annotations

import argparse
import re
import sys
import time
import unicodedata
from pathlib import Path

from cliplib.probe import ProbeError, probe
from cliplib.render import extract_audio, extract_audio_only
from cliplib.transcribe import transcribe

ROOT = Path(__file__).resolve().parent

# 体感品質に直結する語。表記ゆれも正解として扱う
KEY_TERMS: list[tuple[str, list[str]]] = [
    ("モンハンワイルズ", []),
    ("ゼンゼロ", ["ゼンレスゾーンゼロ"]),
    ("エペ", ["APEX", "エーペックス"]),
    ("スト6", ["ストリートファイター6", "スト6", "ストシックス"]),
    ("にじさんじ", ["ニジサンジ"]),
    ("ホロライブ", []),
    ("ぶいすぽ", ["ブイスポ", "VSPO", "ぶいすぽっ"]),
    ("あにまーれ", ["アニマーレ"]),
    ("ななしいんく", ["ナナシインク", "774inc"]),
    ("ナーロン", []),
    ("ミゼリィ", []),
    ("たろう2000", ["タロウ2000", "たろう二千"]),
    ("XxKotaroxX", ["コタロー", "Kotaro"]),
    ("しゃけ弁当", ["シャケ弁当"]),
    ("同接", ["同時接続"]),
    ("スパチャ", []),
    ("てぇてぇ", ["テェテェ"]),
    ("ガチ恋距離", []),
    ("歌枠", []),
    ("初見", []),
    ("切り抜き", []),
    ("草", []),
]


def normalize(text: str) -> str:
    """CER計算用の正規化。句読点・記号・空白を落とし、全角半角を統一する。"""
    text = unicodedata.normalize("NFKC", text)
    text = re.sub(r"[\s、。，．,\.!！?？「」『』（）\(\)…・:：;；\-ー−—~〜\"']", "", text)
    return text.lower()


def edit_distance(a: str, b: str) -> int:
    """レーベンシュタイン距離。O(len(a)*len(b)) メモリはO(min)。"""
    if len(a) < len(b):
        a, b = b, a
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def prepare_audio(source: Path, workdir: Path, start: float, dur: float) -> Path:
    audio = workdir / "score_audio.ogg"
    try:
        info = probe(source)
        extract_audio(source, audio, start, dur, info.audio_tracks[0].audio_index)
    except ProbeError as exc:
        if "映像ストリーム" not in str(exc):
            raise
        extract_audio_only(source, audio, start, dur)
    return audio


def run_once(
    audio: Path, backend: str, terms_path: Path | None, use_hotwords: bool = True
) -> tuple[str, float]:
    prompt = ""
    if terms_path:
        terms = [t.strip() for t in terms_path.read_text(encoding="utf-8").splitlines() if t.strip()]
        prompt = "、".join(terms[:200])
    began = time.monotonic()
    words = transcribe(
        audio, backend=backend, language="ja", prompt=prompt, use_hotwords=use_hotwords
    )
    elapsed = time.monotonic() - began
    return "".join(w.text for w in words), elapsed


def report(label: str, hyp: str, truth: str, elapsed: float) -> dict:
    n_hyp, n_truth = normalize(hyp), normalize(truth)
    dist = edit_distance(n_hyp, n_truth)
    cer = dist / max(1, len(n_truth))

    hits, misses = [], []
    for term, aliases in KEY_TERMS:
        if any(normalize(c) in n_hyp for c in [term, *aliases]):
            hits.append(term)
        else:
            misses.append(term)
    term_rate = len(hits) / len(KEY_TERMS)

    print(f"\n{'=' * 60}")
    print(f"  {label}")
    print(f"{'=' * 60}")
    print(f"  CER（文字誤り率）  : {cer:6.1%}   （編集距離 {dist} / 正解 {len(n_truth)}文字）")
    print(f"  固有名詞の正解率   : {term_rate:6.1%}   （{len(hits)}/{len(KEY_TERMS)}語）")
    print(f"  処理時間           : {elapsed:.1f}秒")
    if misses:
        print(f"  拾えなかった語     : {' / '.join(misses)}")
    return {"label": label, "cer": cer, "term_rate": term_rate, "hyp": hyp, "misses": misses}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="input", required=True)
    ap.add_argument("--truth", default="assets/benchmark-truth.txt")
    ap.add_argument("--dict", dest="terms", default=None)
    ap.add_argument("--backend", default="faster-whisper")
    ap.add_argument("--start", type=float, default=0.0)
    ap.add_argument("--dur", type=float, default=600.0)
    ap.add_argument("--compare", action="store_true", help="辞書あり/なしを比較する")
    ap.add_argument("--save", default="", help="文字起こし結果の保存先")
    args = ap.parse_args()

    source = Path(args.input)
    if not source.is_absolute():
        source = ROOT / source
    truth_path = Path(args.truth)
    if not truth_path.is_absolute():
        truth_path = ROOT / truth_path
    truth = truth_path.read_text(encoding="utf-8")

    workdir = ROOT / "work" / "bench"
    workdir.mkdir(parents=True, exist_ok=True)
    audio = prepare_audio(source, workdir, args.start, args.dur)
    print(f"素材: {source.name}  →  {audio.stat().st_size / 1024:.0f} KB")

    results = []
    if args.compare:
        terms = ROOT / "assets" / "terms-sample.txt"
        hyp, el = run_once(audio, args.backend, None)
        results.append(report(f"{args.backend} / 辞書なし", hyp, truth, el))
        hyp, el = run_once(audio, args.backend, terms, use_hotwords=False)
        results.append(report(f"{args.backend} / initial_prompt", hyp, truth, el))
        hyp, el = run_once(audio, args.backend, terms, use_hotwords=True)
        results.append(report(f"{args.backend} / hotwords", hyp, truth, el))

        a, b = results[0], results[-1]
        print(f"\n{'=' * 60}\n  辞書の効果\n{'=' * 60}")
        print(f"  CER            : {a['cer']:.1%} → {b['cer']:.1%}  ({b['cer'] - a['cer']:+.1%})")
        print(f"  固有名詞正解率 : {a['term_rate']:.1%} → {b['term_rate']:.1%}  ({b['term_rate'] - a['term_rate']:+.1%})")
        recovered = set(a["misses"]) - set(b["misses"])
        lost = set(b["misses"]) - set(a["misses"])
        if recovered:
            print(f"  辞書で拾えた語 : {' / '.join(sorted(recovered))}")
        if lost:
            print(f"  辞書で失った語 : {' / '.join(sorted(lost))}")
    else:
        terms_path = Path(args.terms) if args.terms else None
        if terms_path and not terms_path.is_absolute():
            terms_path = ROOT / terms_path
        hyp, el = run_once(audio, args.backend, terms_path)
        results.append(report(f"{args.backend} / 辞書{'あり' if terms_path else 'なし'}", hyp, truth, el))

    if args.save:
        out = Path(args.save)
        if not out.is_absolute():
            out = ROOT / out
        out.write_text("\n\n".join(f"### {r['label']}\n{r['hyp']}" for r in results), encoding="utf-8")
        print(f"\n文字起こし結果: {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
