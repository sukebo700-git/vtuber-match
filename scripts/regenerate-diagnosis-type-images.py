from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


BASE = Path("public/diagnosis/types")
BACKUP = Path("public/diagnosis/types-original")
FONT_BOLD = "C:/Windows/Fonts/meiryob.ttc"

TEXTS = {
    1: ("CALM", "1. 深夜ラジオ型", "夜更けに\n刺さる声", "余韻で推される、\n語り手タイプ"),
    2: ("WILD", "2. 収拾不能型", "予定外こそ\n見せ場", "カオスを味方にする、\nライブ職人タイプ"),
    3: ("HOOK", "3. 沼製造機型", "気づけば\n通ってる", "距離感づくりがうまい、\n沼タイプ"),
    4: ("LIVE", "4. 配信廃人型", "また\n配信してる", "配信が生活の中心、\n継続力タイプ"),
    5: ("IDEA", "5. 企画中毒型", "次の企画が\n止まらない", "飽きさせない、\n発明家タイプ"),
    6: ("GEEK", "6. オタク暴走型", "好きが\n止まらない", "知識と熱量で語る、\n知識の暴走タイプ"),
    7: ("GRIT", "7. 勝つまで寝ない型", "勝つまで\n終われない", "執念で突破する、\n負けず嫌いタイプ"),
    8: ("HOME", "8. 古参量産型", "初見が\n常連になる", "居場所を作る、\nホームタイプ"),
    9: ("CARE", "9. コメント救急隊型", "コメント\n拾います", "コメント欄を温める、\n優しいヒーロータイプ"),
    10: ("SOFT", "10. 作業用BGM型", "日常に\n溶け込む", "生活に寄り添う、\n癒しのタイプ"),
    11: ("FEST", "11. お祭り騒ぎ型", "みんなで\n騒ぎたい", "盛り上げ上手な、\nお祭り大好きタイプ"),
    12: ("PURE", "12. 愛され天然型", "自然体で\n愛される", "素直さが魅力の、\n自然体タイプ"),
    13: ("STAR", "13. 主役体質型", "視線を\n集める", "自然と中心になる、\n主役タイプ"),
    14: ("DEEP", "14. 配信深海魚型", "静かに\n深く刺さる", "濃いファンを育てる、\n深海タイプ"),
    15: ("OVER", "15. 限界突破型", "限界を\n超え続ける", "勢いで壁を越える、\n挑戦者タイプ"),
    16: ("SHOW", "16. エンタメ怪獣型", "全部盛りで\n楽しませる", "記憶に残る、\nエンタメ怪獣型"),
}


def fit_font(draw: ImageDraw.ImageDraw, text: str, max_width: int, start_size: int, min_size: int) -> ImageFont.FreeTypeFont:
    for size in range(start_size, min_size - 1, -2):
        font = ImageFont.truetype(FONT_BOLD, size)
        if max(draw.textlength(line, font=font) for line in text.split("\n")) <= max_width:
            return font
    return ImageFont.truetype(FONT_BOLD, min_size)


def draw_stroked_text(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    font: ImageFont.FreeTypeFont,
    stroke_width: int,
    spacing: int,
) -> None:
    draw.multiline_text(
        xy,
        text,
        font=font,
        fill="white",
        stroke_width=stroke_width,
        stroke_fill="black",
        spacing=spacing,
    )


def main() -> None:
    for number, (code, title, main_text, sub_text) in TEXTS.items():
        source = BACKUP / f"{number}.png"
        if not source.exists():
            source = BASE / f"{number}.png"

        with Image.open(source).convert("RGBA") as image:
            original_width, original_height = image.size
            scale = 4 if original_width < 800 else 1
            image = image.resize((original_width * scale, original_height * scale), Image.Resampling.LANCZOS)
            image = image.filter(ImageFilter.UnsharpMask(radius=1.2, percent=110, threshold=2))
            width, height = image.size

            overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
            overlay_draw = ImageDraw.Draw(overlay)
            panel_width = int(width * 0.48)
            overlay_draw.rectangle([0, 0, panel_width, height], fill=(8, 8, 18, 255))
            overlay_draw.rectangle([0, 0, width, int(height * 0.25)], fill=(8, 8, 18, 255))
            image = Image.alpha_composite(image, overlay)
            draw = ImageDraw.Draw(image)

            margin = int(width * 0.035)
            max_width = panel_width - margin * 2
            code_font = fit_font(draw, code, max_width, int(height * 0.074), int(height * 0.046))
            title_font = fit_font(draw, title, max_width, int(height * 0.052), int(height * 0.034))
            main_font = fit_font(draw, main_text, max_width, int(height * 0.135), int(height * 0.07))
            sub_font = fit_font(draw, sub_text, max_width, int(height * 0.048), int(height * 0.031))

            draw_stroked_text(draw, (margin, int(height * 0.02)), code, code_font, max(4, int(height * 0.006)), int(height * 0.01))
            draw_stroked_text(draw, (margin, int(height * 0.125)), title, title_font, max(3, int(height * 0.005)), int(height * 0.01))
            draw_stroked_text(draw, (margin, int(height * 0.31)), main_text, main_font, max(5, int(height * 0.008)), int(height * 0.035))

            accent_x = margin
            accent_y = int(height * 0.78)
            draw.ellipse(
                [accent_x, accent_y, accent_x + int(height * 0.09), accent_y + int(height * 0.09)],
                fill=(255, 93, 145, 230),
            )
            draw_stroked_text(
                draw,
                (margin + int(height * 0.12), int(height * 0.765)),
                sub_text,
                sub_font,
                max(3, int(height * 0.005)),
                int(height * 0.012),
            )

            output = BASE / f"{number}.png"
            image.save(output, "PNG", optimize=True)
            print(f"{output.name}: {image.size}")


if __name__ == "__main__":
    main()
