import { CLIP_DEMO_YOUTUBE_ID } from "@/lib/constants";

/**
 * 切り抜き動画の作例。YouTube Shorts を埋め込む。
 *
 * 「テロップ・縦動画化・演出まで自動」と文章で説明するより、30秒の実物を
 * 見せたほうが速い。動画は公式チャンネルに上げたものを使う(サイトから
 * 直接配信すると転送量がかかるうえ、公式チャンネルの再生数にもならない)。
 *
 * **動画IDが未設定の間は何も表示しない。** 空の埋め込み枠や
 * 「準備中」の箱を出すくらいなら、無いほうがましなので。
 */
export function ClipDemoVideo() {
  if (!CLIP_DEMO_YOUTUBE_ID) return null;

  return (
    <div className="clip-demo">
      <div className="clip-demo-frame">
        <iframe
          src={`https://www.youtube.com/embed/${CLIP_DEMO_YOUTUBE_ID}?rel=0&playsinline=1`}
          title="切り抜きショート動画の作例"
          loading="lazy"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
      <p className="clip-demo-note">実際にこのシステムが自動で作った作例です。</p>
    </div>
  );
}
