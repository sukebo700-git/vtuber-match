"""VtuberMatch 切り抜きShorts 生成ライブラリ。

運営PC上で動くローカルCLI用。サーバ実装(Cloud Run worker)へ移す際も
このモジュール構成をそのまま持ち込めるよう、I/Oは引数で受け取る形にしている。
"""

__all__ = ["config", "probe", "transcribe", "subtitle", "render"]
