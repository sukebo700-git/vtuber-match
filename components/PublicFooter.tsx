export function PublicFooter() {
  return (
    <footer className="public-footer">
      <nav aria-label="フッター">
        <a href="/swipe">スワイプ</a>
        <a href="/creator">配信者用</a>
        <a href="/viewer">視聴者用</a>
        <a href="/diagnosis">タイプ診断</a>
        <a href="/help">ヘルプ</a>
        <a href="/terms">利用規約</a>
        <a href="/commercial-disclosure">特商法</a>
      </nav>

      <div className="footer-cta-row">
        <a className="footer-cta primary" href="/swipe">
          推しを探す
        </a>
        <a className="footer-cta" href="/creator/apply">
          VTuberとして無料掲載
        </a>
      </div>

      <p>
        VtuberMatchは、VTuber配信者と新しい推しを探したい視聴者をつなぐマッチングサービスです。
      </p>
    </footer>
  );
}
