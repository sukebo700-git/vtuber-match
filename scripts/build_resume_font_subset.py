#!/usr/bin/env python3
"""
履歴書生成専用のフォントサブセットを作る。
対象文字: ASCII + 日本語句読点/記号 + ひらがな + カタカナ
        + JIS X 0208相当(第一・第二水準漢字、Shift_JISのデコード可能領域から機械抽出)。
これで常用漢字を含む一般的な日本語文章はほぼ網羅できる。
極めて稀な人名漢字(JIS第三・第四水準相当)は対象外(既知の限界としてREADMEに明記)。
"""
import subprocess
from fontTools.ttLib import TTCollection

SRC_TTC = "/usr/share/fonts/opentype/noto/NotoSansCJK-{weight}.ttc"
FACE_INDEX = 0  # Noto Sans CJK JP

with open("jisx0208_unicodes.txt") as f:
    JIS_UNICODES = f.read().strip()

BASE_RANGES = [
    "U+0020-007E",  # ASCII
    "U+00A0-00FF",  # ラテン1補助
    "U+2000-206F",  # 一般句読点
    "U+3000-303F",  # 日本語句読点・記号
    "U+3040-309F",  # ひらがな
    "U+30A0-30FF",  # カタカナ
    "U+FF00-FFEF",  # 半角・全角形
]

def extract_face(ttc_path, index, out_path):
    tc = TTCollection(ttc_path)
    tc.fonts[index].save(out_path)

def subset(src_otf, out_otf):
    unicodes = ",".join(BASE_RANGES) + "," + JIS_UNICODES
    cmd = [
        "fonttools", "subset", src_otf,
        f"--output-file={out_otf}",
        f"--unicodes={unicodes}",
        "--layout-features=*",
        "--glyph-names", "--symbol-cmap", "--legacy-cmap",
        "--notdef-glyph", "--notdef-outline", "--recommended-glyphs",
        "--name-IDs=*", "--name-legacy", "--name-languages=*",
    ]
    subprocess.run(cmd, check=True)

def main():
    jobs = [("Regular", "lib/resume/fonts/NotoSansJP-ResumeSubset-Regular.otf"),
            ("Bold", "lib/resume/fonts/NotoSansJP-ResumeSubset-Bold.otf")]
    for weight, out_path in jobs:
        tmp_full = f"/tmp/NotoSansCJKjp-{weight}-full.otf"
        extract_face(SRC_TTC.format(weight=weight), FACE_INDEX, tmp_full)
        subset(tmp_full, out_path)
        print(f"generated: {out_path}")

if __name__ == "__main__":
    main()
