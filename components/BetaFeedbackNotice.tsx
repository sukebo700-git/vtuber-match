export function BetaBanner() {
  return (
    <div className="beta-notice-banner" role="note">
      <span className="beta-notice-badge">βテスト中</span>
      <p>
        文字化けやレイアウト崩れなど気になる点があれば、下記の連絡先まで教えていただけると助かります。
      </p>
    </div>
  );
}

export function SupportContactNote() {
  return (
    <p className="support-contact-note">
      不具合のご報告・お問い合わせは
      <a href="https://x.com/VtuberMatch" target="_blank" rel="noreferrer">X(@VtuberMatch)のDM</a>
      または
      <a href="mailto:vtubermatch@gmail.com">vtubermatch@gmail.com</a>
      までお気軽にどうぞ。
    </p>
  );
}
