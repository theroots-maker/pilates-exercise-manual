/**
 * THE ROOTS Pilates カルテ自動作成
 *
 * カウンセリングフォームが送信されると、このスプレッドシートにお客様ごとのカルテシートを1枚作る。
 * カルテは「項目 ｜ お客様の回答 ｜ 区切り ｜ 深掘りの質問 ｜ ヒアリングメモ」の5列。
 * お悩みのチェック項目は1つずつ行に分け、右側にヒアリング用の質問とメモ欄を付ける。
 * APIキーを登録すると、Claudeが回答を読んで「まとめ」欄（初回メニュー案など）も埋める。
 *
 * 使い方は karte/README.md を参照。
 */

const CONFIG = {
  // カウンセリングフォームのID（フォーム編集画面のURL /forms/d/〇〇〇/edit の〇〇〇）
  FORM_ID: '1lqI0UutG_kcm8EhLqjeTVoxeAZ4PWcRk4WJkItlJQQI',
  // この言葉を含むチェックボックスの質問は、選択肢ごとに深掘り行を作る
  CONCERN_KEYWORDS: ['お悩み', '直したい', '気になる'],
  MODEL: 'claude-opus-5-5',
  TIMEZONE: 'Asia/Tokyo',
};

const SHEET = {
  HOWTO: '使い方',
  INDEX: 'お客様一覧',
  LOG: 'セッション記録',
  EX: '種目一覧',
};

const COLOR = {
  header: '#3f7f6f',
  headerText: '#ffffff',
  section: '#dcebe6',
  answer: '#f3f6fa',
  question: '#fbfaf7',
  memo: '#fff8e1',
  divider: '#b9b2a6',
  title: '#2b2a28',
};

// ---------------------------------------------------------------------------
// 深掘りの質問
// ---------------------------------------------------------------------------

// お悩みの選択肢すべてに付ける基本の質問
const BASE_CONCERN_QUESTIONS = [
  'どんな時に気になりますか？（場面・時間帯・姿勢）',
  'なんで気になりますか？（痛い・見た目・困っていること）',
  'いつ頃からですか？きっかけはありますか？',
  'つらさは0〜10でどのくらいですか？',
  '良くなったら何をしたいですか？',
];

// 選択肢の言葉に応じて追加する質問（キーワードは部分一致）
const EXTRA_CONCERN_QUESTIONS = [
  { keys: ['猫背', '巻き肩', '姿勢', 'ストレートネック'], questions: [
    '写真や鏡で気づきましたか？誰かに言われましたか？',
    'デスクワークやスマホは1日何時間くらいですか？',
  ]},
  { keys: ['腰痛'], questions: [
    '反ると痛いですか？丸めると痛いですか？',
    '足のしびれや、病院で言われた診断（ヘルニア・すべり症など）はありますか？',
  ]},
  { keys: ['肩こり', '首の痛み'], questions: [
    '頭痛や腕のしびれは一緒に出ますか？',
    '座っている時間は1日どのくらいですか？',
  ]},
  { keys: ['頭痛', '目の疲れ'], questions: [
    'どのくらいの頻度ですか？薬は飲みますか？',
  ]},
  { keys: ['肩の痛み', '肩関節', '肘', '手首', '膝', '足、足指', '踵', '殿部の痛み'], questions: [
    'どの動きで痛みますか？腫れや熱っぽさはありますか？',
    '病院で診てもらったことはありますか？',
  ]},
  { keys: ['しびれ'], questions: [
    'しびれる範囲はどこですか？常にですか、動いた時だけですか？',
  ]},
  { keys: ['骨盤', 'O脚', 'X脚', '足の長さ', '側弯'], questions: [
    '靴の減り方や、スカートが回るなどで気づきましたか？',
  ]},
  { keys: ['女性特有', '生理', 'PMS', '更年期'], questions: [
    '話せる範囲で、どんな時に困っていますか？',
    '通院や服薬はありますか？',
  ]},
  { keys: ['冷え', '体温', '便秘'], questions: [
    '睡眠・食事・水分・運動の習慣はどうですか？',
  ]},
  { keys: ['顔', 'エラ', 'くびれ'], questions: [
    'どんな見た目になれたら嬉しいですか？',
  ]},
];

// チェックボックス以外の質問に付ける深掘り（質問タイトルの部分一致）
const ITEM_QUESTIONS = [
  { keys: ['きっかけ', '知った'], questions: ['数あるスタジオの中で、決め手は何でしたか？'] },
  { keys: ['来店の動機', '動機'], questions: ['今までのところで、何が合わなかったですか？'] },
  { keys: ['行ったこと', '解決するために'], questions: [
    'やってみてどうでしたか？変化はありましたか？',
    '続かなかった・合わなかった理由はありますか？',
  ]},
  { keys: ['なりたい姿', '理想', '目標'], questions: [
    'それが叶ったら、どんな毎日になっていますか？',
    'いつ頃までに、を目安にしますか？',
  ]},
  { keys: ['大切なご予定', '予定'], questions: [
    'その日はどんな姿で過ごしたい・写りたいですか？',
    '服装は決まっていますか？（気になる部位の確認）',
  ]},
  { keys: ['服薬'], questions: ['何のお薬ですか？運動の制限は言われていますか？'] },
  { keys: ['事前にお伝え', 'レッスン受講に関して'], questions: ['当日、気をつけてほしいことはありますか？'] },
];

// 当日に確認・記入する欄
const DAY_ONE_ROWS = [
  ['既往歴・手術歴', 'これまでの大きな怪我や手術はありますか？'],
  ['妊娠の可能性', 'ある場合はうつ伏せ種目・スワンは行わない'],
  ['仕事・生活', '仕事内容、座っている時間、運動歴'],
  ['姿勢評価（横）', '頭部前方／巻き肩／胸椎後弯／反り腰／骨盤後傾'],
  ['姿勢評価（前・後）', '肩の高さ差／骨盤の高さ差／O脚・X脚'],
  ['動きの評価', 'フットワークやロールダウンで気づいたこと'],
];

// ---------------------------------------------------------------------------
// 種目一覧（スタッフ用マニュアル Vol.1）
// ---------------------------------------------------------------------------

const EXERCISES = [
  {"id": "C01", "app": "チェア", "ja": "フットワーク", "lv": "初級", "spring": "重め（2本を高め〜中程度）", "purpose": "下肢（股関節・膝・足首）のアライメントを整える／上半身を高く保ったまま脚を動かす体幹の安定を学ぶ／レッスン冒頭のウォームアップと、脚の評価", "target": "初めてチェアを使う方／膝や股関節のアライメントを整えたい方／ランナー・歩行を安定させたい方／高齢者の下肢筋力づくり", "caution": "膝に痛みがある時は、ペダルを下まで押し切らず可動域を小さくする／座位で腰が丸まる方は、座面にクッションを入れて骨盤を立てやすくする／膝の過伸展（押し切った時に膝が反る）に注意"},
  {"id": "C02", "app": "チェア", "ja": "シングルレッグ・パンピング", "lv": "初級", "spring": "中程度（2本を中程度）", "purpose": "片脚ずつ動かして左右差を確認・修正する／片脚動作中の骨盤の安定性を高める", "target": "左右の脚力やクセに差がある方／片脚立ちが不安定な方／スポーツ（走る・跳ぶ）をしている方", "caution": "押す脚の膝が内側に入る場合はスプリングを重くして回数を減らす／股関節の手術後は、浮かせる脚の屈曲角度に医師の制限がないか確認"},
  {"id": "C03", "app": "チェア", "ja": "ハムストリング・ストレッチ", "lv": "初級", "spring": "中程度（2本を中程度〜軽め）", "purpose": "もも裏と背面をストレッチしながら腹筋で背骨を丸める感覚をつくる／腕で押す動きと体幹の連動を学ぶ", "target": "もも裏が硬く前屈が苦手な方／デスクワークで背中が固まっている方／腹筋を使った背骨の丸め方を覚えたい初心者", "caution": "骨粗鬆症・椎間板ヘルニアの方は背骨を丸める動き（屈曲）を避ける／血圧が高い方・めまいのある方は頭を下げる時間を短く、立ち上がりはゆっくり／ペダルから手が滑らないよう、手は常にペダル中央に"},
  {"id": "C04", "app": "チェア", "ja": "マーメイド（シーテッド）", "lv": "初級", "spring": "軽め（1本を中程度）", "purpose": "体側（わき腹）を伸ばし、背骨の側屈の可動性を高める／呼吸で肋骨を広げる感覚をつくる", "target": "わき腹や背中が硬く、呼吸が浅い方／肩こりのある方／ゴルフ・テニスなど体をひねる・倒すスポーツの方", "caution": "肩に痛みがある方は、頭上に上げる腕を肩の高さまでにする／反対側の坐骨が浮かないように（腰へのねじれを防ぐ）"},
  {"id": "C05", "app": "チェア", "ja": "トライセップス・プレス", "lv": "中級", "spring": "軽め〜中程度（1〜2本）", "purpose": "二の腕（上腕三頭筋）の強化／肩をすくめずに押す、肩甲骨の安定を学ぶ", "target": "二の腕を引き締めたい方／肩が前に巻きやすい（猫背）方／上半身の筋力が不足している方", "caution": "肩の前側に痛みがある方、肩関節の脱臼歴がある方は避けるか可動域をごく小さく／手首に痛みがある場合はペダルの持ち方を変えるか中止"},
  {"id": "C06", "app": "チェア", "ja": "ニーリング・アームプレス", "lv": "中級", "spring": "中程度（1〜2本）", "purpose": "背中（広背筋）と体幹をつなげて使う／腕で押す時に背骨をニュートラルに保つ練習", "target": "猫背・肩が上がりやすい方／腕と体幹をつなげる感覚を覚えたい方／プランク系種目の準備段階の方", "caution": "膝に痛みがある方は厚めのマットやクッションを使う。膝立ちが難しければ中止／肩の痛みがある方は可動域を小さく"},
  {"id": "C07", "app": "チェア", "ja": "スワン", "lv": "中級", "spring": "中程度（1〜2本）", "purpose": "背骨を反らす（伸展）力と可動性を高める／胸を開いて姿勢を改善する", "target": "猫背・巻き肩の方／デスクワークで胸が閉じている方／背中の筋力を高めたい方", "caution": "腰椎すべり症・脊柱管狭窄症の方は背骨を反らす動きを避ける／妊娠中はうつ伏せにならない／腰に詰まり感が出たら可動域を小さく"},
  {"id": "C08", "app": "チェア", "ja": "スタンディング・レッグプレス", "lv": "中級", "spring": "中程度（1〜2本）", "purpose": "片脚立ちでのバランスと骨盤の安定／支持脚側の股関節（中殿筋）を働かせる", "target": "転倒予防をしたい高齢者（手すり付きのチェア推奨）／片脚立ちがふらつく方／ゴルフ・ランニングなど片脚支持が多いスポーツの方", "caution": "バランスに不安がある方は、スタッフが横で補助するか壁・バーを持ってもらう／支持脚の膝を反らせすぎない／足首の捻挫直後は避ける"},
  {"id": "C09", "app": "チェア", "ja": "ゴーイング・アップ・フロント（ステップアップ）", "lv": "中級", "spring": "軽め〜中程度（軽いほど難しい）", "purpose": "階段昇降のような機能的な脚力の強化／脚を伸ばす時の骨盤・体幹のコントロール", "target": "日常の階段昇降を楽にしたい方／お尻（大殿筋）を鍛えたい方／スポーツ選手の下肢強化", "caution": "転倒リスクがあるため、初回は必ずスタッフが横で補助する／膝に痛みがある方、バランスに不安がある方は避ける／座面の膝がつま先より大きく内側に入らないように"},
  {"id": "C10", "app": "チェア", "ja": "プルアップ（パイク）", "lv": "上級", "spring": "軽め〜中程度（1〜2本）", "purpose": "お腹の引き込みで骨盤を持ち上げる強い体幹コントロール／肩周りの安定性と上半身の支持力", "target": "基本の体幹コントロールができている中上級者／肩・腕の支持力を高めたい方／アスリート", "caution": "手首・肩に痛みがある方は行わない／高血圧・緑内障の方は頭が下がる姿勢を避ける／ペダルから足が外れるとチェアが跳ね上がるため、初回は必ずスタッフが補助する"},
  {"id": "R01", "app": "リフォーマー", "ja": "フットワーク", "lv": "初級", "spring": "重め（例：強いスプリング3〜4本）", "purpose": "下肢のアライメントと、脚を動かす間の骨盤・体幹の安定を学ぶ／全身の血流を上げるウォームアップ／その日の身体の状態（左右差・痛み）の確認", "target": "すべての初回のお客様／膝・股関節のアライメントを整えたい方／運動不足の方・高齢者／ウォームアップとして全員", "caution": "膝の過伸展がある方は伸ばし切る手前で止める／股関節の人工関節の方は、広いスタンスや深い屈曲に医師の制限がないか確認／キャリッジが勢いよく戻ってストッパーに当たらないように"},
  {"id": "R02", "app": "リフォーマー", "ja": "ハンドレッド", "lv": "中級", "spring": "中程度（例：強いスプリング1〜2本）", "purpose": "呼吸と腹筋の持久力を高める／全身を温め、体幹で頭と脚を支える力をつける", "target": "腹筋の持久力を高めたい方／呼吸が浅い方／レッスンの前半で体を温めたい時", "caution": "首が痛い・首に力が入る方は頭を下ろしたまま行う／骨粗鬆症の方は頭を持ち上げる（体幹屈曲）動きを避け、頭を下ろして行う／腰が浮く場合は脚の角度を高くする（テーブルトップへ戻す）／産後で腹直筋離開がある方はお腹が盛り上がらないか確認"},
  {"id": "R03", "app": "リフォーマー", "ja": "スーパイン・アームシリーズ", "lv": "初級", "spring": "軽め（例：軽いスプリング1本〜強いスプリング1本）", "purpose": "肩甲骨を安定させたまま腕を動かす練習／腕の動きに負けない体幹（肋骨と骨盤）の安定", "target": "初心者の上半身入門／肩こり・巻き肩の方／肩のリハビリ後期で、医師の許可がある方", "caution": "肩に痛みがある方は可動域を痛みのない範囲に限定／腕を上げた時に肋骨が浮く（腰が反る）場合は、可動域を小さく／ストラップを持ったまま手を離さない（キャリッジが急に戻る）"},
  {"id": "R04", "app": "リフォーマー", "ja": "ブリッジ（ペルビック・カール）", "lv": "初級", "spring": "中程度〜重め（例：強いスプリング2〜3本）", "purpose": "背骨を一つずつ動かす（分節運動）感覚をつくる／お尻ともも裏の強化", "target": "腰や背中が固まっている方／お尻の筋力が弱い方／産後の骨盤底筋・体幹の再教育（医師の許可後）", "caution": "首に体重が乗るほど高く上げない／骨粗鬆症の方は背骨を丸めずニュートラルのまま持ち上げる（ヒップリフト）／もも裏がつる場合はスプリングを重くし、足をフットバーに近づける"},
  {"id": "R05", "app": "リフォーマー", "ja": "フィート・イン・ストラップ（フロッグ／レッグサークル）", "lv": "初級", "spring": "中程度（例：強いスプリング1〜2本）", "purpose": "股関節の可動性を高める／脚を動かしている間の骨盤の安定／内もも・もも裏の強化とストレッチ", "target": "股関節が硬い方／腰痛予防に骨盤の安定を身につけたい方／内ももを引き締めたい方", "caution": "脚を下ろした時に腰が反る場合は、脚を下ろす角度を高くする／股関節の人工関節の方は、深い屈曲・内旋を避ける（医師の指示を確認）／ストラップが足から外れないよう、足の位置を毎回確認"},
  {"id": "R06", "app": "リフォーマー", "ja": "ショートボックス（ラウンドバック）", "lv": "中級", "spring": "軽め（例：強いスプリング1本／フットストラップ使用）", "purpose": "背骨を丸めたまま体を支える腹筋の強化／骨盤を後傾させるコントロールを学ぶ", "target": "腹筋を強化したい方／ハンドレッドなどができるようになった中級者／姿勢の保持力を高めたい方", "caution": "骨粗鬆症・椎間板ヘルニアの方は背骨の屈曲なので行わない／腰に痛みがある方は倒れる範囲を小さく／フットストラップに足がしっかり入っているか必ず確認（後ろへ落下する危険）"},
  {"id": "R07", "app": "リフォーマー", "ja": "エレファント", "lv": "中級", "spring": "中程度（例：強いスプリング1〜2本。軽いほど難しい）", "purpose": "腹筋で脚を引き寄せる力をつける／もも裏とふくらはぎのストレッチ／手で支える時の肩の安定", "target": "もも裏が硬い方／腹筋で下半身を動かす感覚を身につけたい中級者／ハムストリング・ストレッチ（チェア）ができた方", "caution": "手首・肩に痛みがある方は行わない／高血圧・緑内障の方は頭が下がる姿勢を避ける／キャリッジの上に立つ・降りる時は必ずスプリングを付けた状態で、スタッフが支える"},
  {"id": "R08", "app": "リフォーマー", "ja": "ニーストレッチ（ラウンド）", "lv": "中級", "spring": "中程度（例：強いスプリング1〜2本）", "purpose": "体幹を固定したまま股関節だけを動かす力／上半身で支えながら下半身を動かすコーディネーション", "target": "体幹を安定させて脚を動かす練習をしたい方／ランナー・スポーツ選手／エレファントの前段階として", "caution": "膝に痛みがある方は膝の下にパッドを置くか、行わない／手首に痛みがある場合は避ける／背中が反らないように。反るとキャリッジが大きく動きすぎて腰を痛める"},
  {"id": "R09", "app": "リフォーマー", "ja": "ロングストレッチ", "lv": "上級", "spring": "軽め〜中程度（例：強いスプリング1本＋軽め1本）", "purpose": "動くキャリッジの上でプランクを保つ全身の安定性／肩と体幹の強さ", "target": "床のプランクを30秒以上正しく保てる方／全身の強さを高めたい上級者・アスリート", "caution": "手首・肩に痛みがある方は行わない／腰が落ちて反る場合は即中止して、ニーストレッチやエレファントに戻す／乗り降りの際は必ずスタッフが補助し、スプリングを付けたまま"},
  {"id": "R10", "app": "リフォーマー", "ja": "マーメイド", "lv": "初級", "spring": "軽め（例：軽いスプリング1本）", "purpose": "体側を伸ばし、背骨の側屈の可動性を高める／呼吸を深め、レッスンのクールダウンとして整える", "target": "全員（クールダウンとして）／わき腹・背中が硬い方／呼吸が浅い方／ゴルフなど回旋系スポーツの方", "caution": "膝や股関節が痛い方は、横座りではなくあぐらや足を下ろした座り方にする／肩の痛みがある方は頭上の腕を肩の高さまで／反対側の坐骨が大きく浮かないように"},
];

// ---------------------------------------------------------------------------
// メニュー
// ---------------------------------------------------------------------------

function onOpen() {
  SpreadsheetApp.getUi().createMenu('カルテ')
    .addItem('初期設定（最初に1回）', 'setup')
    .addItem('最新の回答からカルテを作る', 'createFromLatest')
    .addItem('お名前で回答を探してカルテを作る', 'createByName')
    .addSeparator()
    .addItem('Claude APIキーを登録', 'setApiKey')
    .addToUi();
}

function setup() {
  const ss = SpreadsheetApp.getActive();
  buildHowto_(ss);
  buildIndex_(ss);
  buildLog_(ss);
  buildExercises_(ss);
  const first = ss.getSheetByName('シート1') || ss.getSheetByName('Sheet1');
  if (first && ss.getSheets().length > 1 && first.getLastRow() === 0) ss.deleteSheet(first);

  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'onFormSubmit')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('onFormSubmit').forForm(CONFIG.FORM_ID).onFormSubmit().create();

  SpreadsheetApp.getUi().alert('初期設定が終わりました。これからフォームが送信されるたびにカルテが自動で作られます。');
}

function setApiKey() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt('Claude APIキーを登録', 'sk-ant- から始まるキーを貼り付けてください。空欄でOKを押すと削除します。', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  const key = res.getResponseText().trim();
  const props = PropertiesService.getScriptProperties();
  if (key) { props.setProperty('ANTHROPIC_API_KEY', key); ui.alert('登録しました。'); }
  else { props.deleteProperty('ANTHROPIC_API_KEY'); ui.alert('削除しました。まとめ欄は空欄で作られます。'); }
}

// ---------------------------------------------------------------------------
// カルテ作成
// ---------------------------------------------------------------------------

function onFormSubmit(e) {
  createKarte_(e.response);
}

function createFromLatest() {
  const responses = FormApp.openById(CONFIG.FORM_ID).getResponses();
  if (!responses.length) { SpreadsheetApp.getUi().alert('まだ回答がありません。'); return; }
  const sheet = createKarte_(responses[responses.length - 1]);
  SpreadsheetApp.getActive().setActiveSheet(sheet);
}

function createByName() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt('お名前で探す', 'フォームに入力されたお名前（一部でも可）', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  const q = normalize_(res.getResponseText());
  if (!q) return;
  const responses = FormApp.openById(CONFIG.FORM_ID).getResponses();
  for (let i = responses.length - 1; i >= 0; i--) {
    const name = findAnswer_(readAnswers_(responses[i]), ['名前']);
    if (name && normalize_(name).indexOf(q) !== -1) {
      const sheet = createKarte_(responses[i]);
      SpreadsheetApp.getActive().setActiveSheet(sheet);
      return;
    }
  }
  ui.alert('見つかりませんでした。');
}

function createKarte_(response) {
  const ss = SpreadsheetApp.getActive();
  if (!ss.getSheetByName(SHEET.INDEX)) { buildIndex_(ss); buildLog_(ss); buildExercises_(ss); }

  const answers = readAnswers_(response);
  const name = findAnswer_(answers, ['名前']) || '名前なし';
  const submitted = response.getTimestamp();
  const sheet = ss.insertSheet(uniqueSheetName_(ss, name + '_' + fmtDate_(submitted, 'MMdd')));

  const rows = [];        // [A, B, D, E]
  const styles = [];      // 'title' | 'meta' | 'head' | 'section' | 'item' | 'concern'
  const add = (style, a, b, d, e) => { rows.push([a || '', b || '', d || '', e || '']); styles.push(style); };

  add('title', 'THE ROOTS Pilates カルテ｜' + name + ' 様');
  add('meta', '受付日', fmtDate_(submitted, 'yyyy/MM/dd'), '担当', '');
  add('head', '項目', 'お客様の回答', '深掘りの質問', 'ヒアリングメモ');

  add('section', 'カウンセリングシート');
  let birthdayRow = 0;
  answers.forEach(item => {
    if (item.isConcern) {
      add('section', item.title + '（チェックした項目ごと）');
      item.values.forEach(v => add('concern', 'お悩み', v, bullets_(concernQuestions_(v)), ''));
      return;
    }
    add('item', shortTitle_(item.title), item.text, bullets_(itemQuestions_(item.title)), '');
    if (item.title.indexOf('生年月日') !== -1) birthdayRow = rows.length;
  });

  add('section', 'まとめ（Claudeが作成。スタッフが書き換えてOK）');
  const summaryStart = rows.length + 1;
  const SUMMARY_KEYS = [
    ['summary', '主訴まとめ'],
    ['check_points', '初回に確認すること'],
    ['avoid', '避ける候補の種目'],
    ['first_menu', '初回メニュー案'],
    ['plan', '予定までのプラン'],
  ];
  SUMMARY_KEYS.forEach(([, label]) => add('item', label, '', '', ''));

  add('section', '初回の当日記入');
  DAY_ONE_ROWS.forEach(([label, hint]) => add('item', label, '', hint, ''));
  add('item', 'メモ', '', '', '');

  writeKarte_(sheet, rows, styles);

  if (birthdayRow) {
    const r = birthdayRow;
    const birthday = parseDate_(sheet.getRange(r, 2).getDisplayValue());
    if (birthday) {
      sheet.getRange(r, 2).setValue(birthday).setNumberFormat('yyyy/mm/dd');
      sheet.insertRowAfter(r);
      sheet.getRange(r + 1, 1, 1, 5).setValues([['年齢', '=DATEDIF(B' + r + ',TODAY(),"Y")&"歳"', '', '', '']]);
      styleRow_(sheet, r + 1, 'item');
    }
  }
  const offset = birthdayRow && sheet.getRange(birthdayRow + 1, 1).getValue() === '年齢' ? 1 : 0;

  // Claudeのまとめ（失敗してもカルテは残す）
  try {
    const result = summarize_(answers);
    const values = result
      ? SUMMARY_KEYS.map(([key]) => [result[key] || ''])
      : SUMMARY_KEYS.map((_, i) => [i === 0 ? 'APIキー未登録のため空欄です（メニュー「カルテ」→「Claude APIキーを登録」）' : '']);
    sheet.getRange(summaryStart + offset, 2, values.length, 1).setValues(values);
  } catch (err) {
    sheet.getRange(summaryStart + offset, 2).setValue('まとめの作成に失敗しました：' + err.message);
  }

  addToIndex_(ss, sheet, name, submitted, answers);
  return sheet;
}

function writeKarte_(sheet, rows, styles) {
  const values = rows.map(r => [r[0], r[1], '', r[2], r[3]]);
  sheet.getRange(1, 1, values.length, 5).setValues(values);
  sheet.setColumnWidth(1, 150);
  sheet.setColumnWidth(2, 300);
  sheet.setColumnWidth(3, 10);
  sheet.setColumnWidth(4, 300);
  sheet.setColumnWidth(5, 380);
  sheet.getRange(1, 1, values.length, 5)
    .setFontFamily('Arial').setVerticalAlignment('top').setWrap(true);
  styles.forEach((s, i) => styleRow_(sheet, i + 1, s));
  sheet.setFrozenRows(3);
  sheet.setHiddenGridlines(true);
}

function styleRow_(sheet, r, style) {
  const row = sheet.getRange(r, 1, 1, 5);
  const divider = sheet.getRange(r, 3);
  switch (style) {
    case 'title':
      sheet.getRange(r, 1, 1, 5).merge().setFontSize(15).setFontWeight('bold').setFontColor(COLOR.title);
      sheet.setRowHeight(r, 36);
      return;
    case 'meta':
      sheet.getRange(r, 1).setFontWeight('bold');
      sheet.getRange(r, 4).setFontWeight('bold').setHorizontalAlignment('right');
      break;
    case 'head':
      row.setBackground(COLOR.header).setFontColor(COLOR.headerText).setFontWeight('bold');
      break;
    case 'section':
      sheet.getRange(r, 1, 1, 2).merge();
      sheet.getRange(r, 4, 1, 2).merge();
      row.setBackground(COLOR.section).setFontWeight('bold');
      break;
    case 'item':
    case 'concern':
      sheet.getRange(r, 1).setFontWeight('bold');
      sheet.getRange(r, 2).setBackground(COLOR.answer);
      sheet.getRange(r, 4).setBackground(COLOR.question).setFontColor('#5f5a53');
      sheet.getRange(r, 5).setBackground(COLOR.memo);
      row.setBorder(true, true, true, true, true, false, '#e3ded6', SpreadsheetApp.BorderStyle.SOLID);
      if (style === 'concern') sheet.getRange(r, 2).setFontWeight('bold');
      break;
  }
  if (style !== 'title') divider.setBackground(COLOR.divider);
}

function addToIndex_(ss, karte, name, submitted, answers) {
  const index = ss.getSheetByName(SHEET.INDEX);
  const r = index.getLastRow() + 1;
  const link = '=HYPERLINK("#gid=' + karte.getSheetId() + '","カルテを開く")';
  const event = findAnswer_(answers, ['大切なご予定', '予定']) || '';
  const count = '=COUNTIF(\'' + SHEET.LOG + '\'!B:B,B' + r + ')';
  const last = '=IF(F' + r + '=0,"",MAXIFS(\'' + SHEET.LOG + '\'!A:A,\'' + SHEET.LOG + '\'!B:B,B' + r + '))';
  index.getRange(r, 1, 1, 8).setValues([[submitted, name, link, event, '', count, last, '']]);
  index.getRange(r, 1).setNumberFormat('yyyy/mm/dd');
  index.getRange(r, 7).setNumberFormat('yyyy/mm/dd');
}

// ---------------------------------------------------------------------------
// フォーム回答の読み取り
// ---------------------------------------------------------------------------

function readAnswers_(response) {
  return response.getItemResponses().map(ir => {
    const item = ir.getItem();
    const title = item.getTitle();
    const raw = ir.getResponse();
    const values = Array.isArray(raw) ? raw.map(String) : [String(raw)];
    const isCheckbox = item.getType() === FormApp.ItemType.CHECKBOX;
    const isConcern = isCheckbox && CONFIG.CONCERN_KEYWORDS.some(k => title.indexOf(k) !== -1);
    return { title: title, values: values, text: values.join('、'), isConcern: isConcern };
  }).filter(a => a.text.trim() !== '');
}

function findAnswer_(answers, keys) {
  const hit = answers.find(a => keys.some(k => a.title.indexOf(k) !== -1));
  return hit ? hit.text : '';
}

function concernQuestions_(option) {
  const extra = [];
  EXTRA_CONCERN_QUESTIONS.forEach(g => {
    if (g.keys.some(k => option.indexOf(k) !== -1)) g.questions.forEach(q => extra.push(q));
  });
  return BASE_CONCERN_QUESTIONS.concat(extra);
}

function itemQuestions_(title) {
  const hit = ITEM_QUESTIONS.find(g => g.keys.some(k => title.indexOf(k) !== -1));
  return hit ? hit.questions : [];
}

// ---------------------------------------------------------------------------
// Claude によるまとめ
// ---------------------------------------------------------------------------

const SUMMARY_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: '主訴と目標を2〜3文で' },
    check_points: { type: 'string', description: '初回に口頭で確認すべきこと。種目選びや安全に関わるもの' },
    avoid: { type: 'string', description: '回答から考えられる、避ける・様子を見る種目（番号付き）と条件' },
    first_menu: { type: 'string', description: '初回メニュー案。種目一覧の番号と名前で、順番に' },
    plan: { type: 'string', description: '大切な予定までの数週間の進め方。予定がなければ最初の1か月の進め方' },
  },
  required: ['summary', 'check_points', 'avoid', 'first_menu', 'plan'],
  additionalProperties: false,
};

function summarize_(answers) {
  const key = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!key) return null;

  const today = fmtDate_(new Date(), 'yyyy/MM/dd');
  const exerciseList = EXERCISES.map(e =>
    e.id + ' ' + e.ja + '（' + e.app + '・' + e.lv + '）注意：' + e.caution).join('\n');
  const system =
    'あなたはピラティススタジオ THE ROOTS Pilates のインストラクターを手伝うアシスタントです。' +
    'お客様のカウンセリングシートの回答を読み、初回レッスンを担当するスタッフ向けのまとめを日本語で書きます。' +
    '診断はしないでください。痛みやしびれ、通院歴など医療者の判断が必要そうなものは「確認すること」に入れてください。' +
    '種目はスタジオのマニュアルにある下の20種目から選び、番号（C＝チェア、R＝リフォーマー）を付けてください。' +
    '各項目は箇条書きにせず、短い文で書いてください。\n\n' +
    '種目一覧：\n' + exerciseList;
  const user = '今日の日付：' + today + '\n\nカウンセリングシートの回答：\n' +
    answers.map(a => '■ ' + shortTitle_(a.title) + '\n' + a.text).join('\n\n');

  const body = {
    model: CONFIG.MODEL,
    max_tokens: 16000,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SUMMARY_SCHEMA } },
    fallbacks: 'default',
    system: system,
    messages: [{ role: 'user', content: user }],
  };
  let res = callClaude_(key, body, true);
  if (res.getResponseCode() === 400) {
    // fallbacks が使えない場合は外してもう一度
    delete body.fallbacks;
    res = callClaude_(key, body, false);
  }
  if (res.getResponseCode() !== 200) {
    throw new Error('Claude API ' + res.getResponseCode() + ' ' + res.getContentText().slice(0, 300));
  }
  const msg = JSON.parse(res.getContentText());
  if (msg.stop_reason === 'refusal') throw new Error('Claudeが回答を返しませんでした（refusal）');
  if (msg.stop_reason === 'max_tokens') throw new Error('出力が途中で切れました');
  const text = msg.content.filter(b => b.type === 'text').map(b => b.text).join('');
  return JSON.parse(text);
}

function callClaude_(key, body, withFallback) {
  const headers = { 'x-api-key': key, 'anthropic-version': '2023-06-01' };
  if (withFallback) headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';
  return UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: headers,
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  });
}

// ---------------------------------------------------------------------------
// 固定シートの作成
// ---------------------------------------------------------------------------

function headerRow_(sheet, headers, widths) {
  sheet.getRange(1, 1, 1, headers.length).setValues([headers])
    .setBackground(COLOR.header).setFontColor(COLOR.headerText).setFontWeight('bold')
    .setFontFamily('Arial').setWrap(true).setVerticalAlignment('middle');
  widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));
  sheet.setFrozenRows(1);
}

function getOrCreate_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function buildHowto_(ss) {
  const sh = getOrCreate_(ss, SHEET.HOWTO);
  sh.clear();
  const lines = [
    ['使い方'],
    ['1. お客様がカウンセリングフォームを送信すると、お客様ごとのカルテシートが自動でできます。お客様一覧の「カルテを開く」から移動できます。'],
    ['2. カルテの左側（青）がフォームの回答、灰色の線より右側が深掘り欄です。「深掘りの質問」を参考にヒアリングし、黄色の「ヒアリングメモ」に書き込みます。'],
    ['3. お悩みはチェックした項目ごとに1行ずつ分かれています。'],
    ['4. 「まとめ」欄はClaudeが書いた案です。スタッフの判断で書き換えてください。'],
    ['5. レッスンのたびに、セッション記録シートに1回1行で記入します。お名前はプルダウンで選べます。'],
    [''],
    ['自動で作られなかったとき'],
    ['メニュー「カルテ」→「最新の回答からカルテを作る」または「お名前で回答を探してカルテを作る」で作れます。'],
    [''],
    ['個人情報の取り扱い'],
    ['住所・生年月日・体の情報を含むため、共有はスタッフのみにしてください。「リンクを知っている全員」での共有は使わないでください。'],
  ];
  sh.getRange(1, 1, lines.length, 1).setValues(lines).setWrap(true).setFontFamily('Arial');
  [1, 8, 11].forEach(r => sh.getRange(r, 1).setFontWeight('bold').setFontSize(12));
  sh.setColumnWidth(1, 760);
  sh.setHiddenGridlines(true);
  ss.setActiveSheet(sh);
  ss.moveActiveSheet(1);
}

function buildIndex_(ss) {
  const sh = getOrCreate_(ss, SHEET.INDEX);
  headerRow_(sh, ['受付日', 'お名前', 'カルテ', '大切な予定', '担当', '来店回数', '最終来店日', 'メモ'],
    [90, 140, 100, 220, 80, 70, 90, 260]);
  ss.setActiveSheet(sh);
  ss.moveActiveSheet(2);
}

function buildLog_(ss) {
  const sh = getOrCreate_(ss, SHEET.LOG);
  headerRow_(sh, ['日付', 'お名前', '回数', '実施種目（番号）', 'スプリング・調整',
    '痛み 開始前（0〜10）', '痛み 終了後（0〜10）', '体の変化・気づき', '次回への申し送り', '担当'],
    [90, 140, 50, 220, 180, 80, 80, 240, 240, 80]);
  sh.getRange('C1').setFormula(
    '={"回数";ARRAYFORMULA(IF(B2:B="",,COUNTIFS(B2:B,B2:B,ROW(B2:B),"<="&ROW(B2:B))))}');
  sh.getRange('A2:A').setNumberFormat('yyyy/mm/dd');
  sh.getRange('B2:B').setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInRange(ss.getSheetByName(SHEET.INDEX).getRange('B2:B'), true)
    .setAllowInvalid(true).build());
  sh.getRange('F2:G').setDataValidation(SpreadsheetApp.newDataValidation()
    .requireNumberBetween(0, 10).setAllowInvalid(false)
    .setHelpText('0〜10の数字で入力してください').build());
  sh.getRange('D1').setNote('種目一覧シートの番号で記入（例：R01, R04, C04）');
}

function buildExercises_(ss) {
  const sh = getOrCreate_(ss, SHEET.EX);
  sh.clear();
  headerRow_(sh, ['番号', '器具', '種目', 'レベル', 'スプリング', '目的', 'おすすめの対象', '注意・禁忌'],
    [50, 90, 180, 60, 180, 320, 300, 380]);
  const rows = EXERCISES.map(e => [e.id, e.app, e.ja, e.lv, e.spring, e.purpose, e.target, e.caution]);
  if (rows.length) {
    sh.getRange(2, 1, rows.length, 8).setValues(rows)
      .setWrap(true).setVerticalAlignment('top').setFontFamily('Arial');
  }
  sh.getRange(rows.length + 3, 1).setValue('出典：THE ROOTS Pilates スタッフ用エクササイズマニュアル Vol.1')
    .setFontStyle('italic').setFontColor('#77726b');
}

// ---------------------------------------------------------------------------
// 小さな道具
// ---------------------------------------------------------------------------

function bullets_(list) {
  return list.map(q => '・' + q).join('\n');
}

function shortTitle_(title) {
  const first = String(title).split('\n')[0].replace(/[（(]$/, '').trim();
  return first.length > 40 ? first.slice(0, 40) + '…' : first;
}

function normalize_(s) {
  return String(s).replace(/[\s　]/g, '');
}

function fmtDate_(d, pattern) {
  return Utilities.formatDate(d, CONFIG.TIMEZONE, pattern);
}

function parseDate_(s) {
  const m = String(s).match(/(\d{4})[\/\-年](\d{1,2})[\/\-月](\d{1,2})/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

function uniqueSheetName_(ss, base) {
  const clean = base.replace(/[\[\]\*\?\/\\:]/g, '').slice(0, 90);
  let name = clean, n = 2;
  while (ss.getSheetByName(name)) name = clean + '(' + n++ + ')';
  return name;
}
