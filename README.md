# ピラティス エクササイズマニュアル（スタッフ研修用）

新人インストラクター向けの、チェア・リフォーマーのエクササイズマニュアルです。
各種目について **写真・目的・セットアップ・方法・呼吸・対象者・注意/禁忌・キュー例・レベル調整** を1枚のカードにまとめています。

## 見方

`index.html` をブラウザで開いてください（サーバー不要）。
器具（チェア／リフォーマー）とレベル（初級／中級／上級）で絞り込みができ、印刷すると1種目1ページで出力されます。

## 収録種目（Vol.1）

| No. | チェア | レベル | リフォーマー | レベル |
|---|---|---|---|---|
| 01 | フットワーク | 初級 | フットワーク | 初級 |
| 02 | シングルレッグ・パンピング | 初級 | ハンドレッド | 中級 |
| 03 | ハムストリング・ストレッチ | 初級 | スーパイン・アームシリーズ | 初級 |
| 04 | マーメイド（シーテッド） | 初級 | ブリッジ（ペルビック・カール） | 初級 |
| 05 | トライセップス・プレス | 中級 | フィート・イン・ストラップ | 初級 |
| 06 | ニーリング・アームプレス | 中級 | ショートボックス（ラウンドバック） | 中級 |
| 07 | スワン | 中級 | エレファント | 中級 |
| 08 | スタンディング・レッグプレス | 中級 | ニーストレッチ（ラウンド） | 中級 |
| 09 | ゴーイング・アップ・フロント | 中級 | ロングストレッチ | 上級 |
| 10 | プルアップ（パイク） | 上級 | マーメイド | 初級 |

## 写真の追加方法

写真はスタジオの器具・スタッフで撮影したものを使う想定です。下記のファイル名で JPG を置くと、カードの図が自動で写真に置き換わります（横長 4:3 推奨）。

```
images/chair/01-footwork.jpg              images/reformer/01-footwork.jpg
images/chair/02-single-leg-pumping.jpg    images/reformer/02-the-hundred.jpg
images/chair/03-hamstring-stretch.jpg     images/reformer/03-supine-arm-series.jpg
images/chair/04-seated-mermaid.jpg        images/reformer/04-bridging-pelvic-curl.jpg
images/chair/05-triceps-press-seated.jpg  images/reformer/05-feet-in-straps.jpg
images/chair/06-kneeling-arm-press.jpg    images/reformer/06-short-box-round-back.jpg
images/chair/07-swan-on-the-chair.jpg     images/reformer/07-elephant.jpg
images/chair/08-standing-leg-press.jpg    images/reformer/08-knee-stretch-round.jpg
images/chair/09-going-up-front.jpg        images/reformer/09-long-stretch.jpg
images/chair/10-pull-up.jpg               images/reformer/10-mermaid.jpg
```

## 種目の追加・修正

内容は `index.html` 内の `EXERCISES` 配列にまとまっています。1種目ずつオブジェクトを追加・編集してください（番号と写真ファイル名は自動で振られます）。

## 注意

- スプリングの色・強さはメーカーによって異なります。本書は「重め／中程度／軽め」と目安の本数で記載しているので、スタジオの設定表と合わせて確認してください。
- 本書は一般的な指導指針です。医師の運動制限がある方、妊娠中・産後の方、急性の痛みがある方は、医療者の指示とスタジオのヒアリングを優先してください。
