export function PublicFooter() {
  return (
    <footer className="public-footer">
      <nav aria-label="フッター">
        <a href="/swipe">スワイプ</a>
        <a href="/creator">配信者用</a>
        <a href="/viewer">視聴者用</a>
        <a href="/diagnosis">タイプ診断</a>
        <a href="/help">ヘルプ</a>
      </nav>

      <div className="footer-cta-row">
        <a className="footer-cta primary" href="/swipe">
          推しを探す
        </a>
        <a className="footer-cta" href="/creator/apply">
          Vtuberとして無料登録
        </a>
      </div>

      <p>
        Vtuberマッチは、Vtuber配信者と新しい推しを探したい視聴者をつなぐマッチングサービスです。
      </p>
    </footer>
  );
}
