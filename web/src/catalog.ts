import { type Conditions, type Decisions, type OrderId, soakMinutes } from '../../shared/engine';

export interface Option {
  value: string | number;
  label: string;
  desc: string;
}

export interface Field {
  key: keyof Decisions;
  label: string;
  options: (d: Partial<Decisions>) => Option[];
}

export interface Step {
  id: string;
  phase: string;
  title: string;
  /** 杜氏の判断ポイント */
  point: string;
  /** 蔵人からの報告（条件に応じたヒント） */
  report?: (c: Conditions, d: Partial<Decisions>) => string;
  fields: Field[];
}

export const ORDER_INFO: Record<OrderId, { title: string; detail: string }> = {
  competition: {
    title: '全国新酒鑑評会に出す大吟醸を',
    detail: '「今年こそ金賞を」。華やかな香りと、雑味のない綺麗な酒質が求められます。',
  },
  shokuchu: {
    title: '料理を引き立てる食中酒を',
    detail: '地元の料理店から。香りは控えめに、ほどよい旨味と酸、後味のキレを。',
  },
  kanzake: {
    title: '燗で旨い、濃醇な酒を',
    detail: '燗酒好きの常連から。温めて膨らむ旨味としっかりした酸を。',
  },
  banshaku: {
    title: '毎日の晩酌酒を手頃な価格で',
    detail: '地元向けの定番酒。原価を抑えつつ、飲み飽きないキレと綺麗さを。',
  },
};

export const HARDNESS_LABEL = { soft: '軟らかめ（溶けやすい）', normal: '平年並み', hard: '硬め（溶けにくい）' } as const;
export const WINTER_LABEL = { cold: '厳冬（寒い）', normal: '平年並み', warm: '暖冬' } as const;

export const ROLE_INFO: Record<string, { name: string; reading: string; desc: string }> = {
  toji: { name: '杜氏', reading: 'とうじ', desc: '酒造りの最高責任者。蔵元の注文を受け、蔵人を率いて全工程を指揮する。' },
  kashira: { name: '頭', reading: 'かしら', desc: '杜氏の補佐役。現場のまとめ役で、醪の管理など杜氏の右腕を務める。' },
  koji: { name: '麹屋（代師）', reading: 'こうじや', desc: '麹造りの責任者。「一麹、二酛、三造り」と言われる最重要工程を担う。' },
  moto: { name: '酛屋', reading: 'もとや', desc: '酒母（酛）造りの責任者。健全な酵母を大量に育てる。' },
  kama: { name: '釜屋', reading: 'かまや', desc: '洗米・浸漬・蒸米の責任者。米の吸水と蒸し具合を担う。' },
};

const soakOptions = (d: Partial<Decisions>): Option[] => {
  const mins = soakMinutes(d.polish ?? 60);
  return [
    { value: 0, label: `短め（${mins[0]}分）`, desc: '吸水を控え、硬めの蒸米に。軟らかい米向け。' },
    { value: 1, label: `標準（${mins[1]}分）`, desc: '平年並みの米に合わせた吸水。' },
    { value: 2, label: `長め（${mins[2]}分）`, desc: 'しっかり吸水させる。硬く溶けにくい米向け。' },
  ];
};

export const STEPS: Step[] = [
  {
    id: 'veteran',
    phase: '蔵入り',
    title: '蔵人の配置',
    point:
      '杜氏は冬の間、蔵人たちと寝食を共にしながら酒を造ります。誰をどの持ち場に置くかは杜氏の大切な仕事。経験豊富なベテランを一人、どこに置きますか？',
    report: (c) =>
      `今年の米は「${HARDNESS_LABEL[c.hardness]}」、冬は「${WINTER_LABEL[c.winter]}」の見込みです。弱点になりそうな持ち場を補いましょう。`,
    fields: [
      {
        key: 'veteran',
        label: 'ベテランの持ち場',
        options: () => [
          { value: 'kama', label: '釜屋', desc: '洗米・浸漬・蒸しの失敗を半減。米の状態が読みにくい年に。' },
          { value: 'koji', label: '麹屋', desc: '麹の失敗を半減し、香りと旨味も少し向上。' },
          { value: 'moto', label: '酛屋', desc: '酒母の雑菌リスクを大きく軽減。生酛・山廃や暖冬に。' },
          { value: 'kashira', label: '頭', desc: '醪の温度管理のぶれを軽減。繊細な吟醸造りに。' },
        ],
      },
    ],
  },
  {
    id: 'rice',
    phase: '原料処理',
    title: '原料米を選ぶ',
    point: '酒の個性は米で決まります。酒造好適米は大粒で、中心に「心白」があり麹菌が入りやすい。価格と注文のバランスで選びます。',
    fields: [
      {
        key: 'rice',
        label: '原料米',
        options: () => [
          { value: 'yamadanishiki', label: '山田錦', desc: '酒米の王様。香り・旨味・綺麗さのバランスが最高。高価。' },
          { value: 'omachi', label: '雄町', desc: '幻の酒米。ふくよかで濃厚な旨味。高価。' },
          { value: 'gohyakumangoku', label: '五百万石', desc: '淡麗でキレのある酒に。手頃。' },
          { value: 'miyamanishiki', label: '美山錦', desc: 'すっきり爽やか。寒冷地の酒米。手頃。' },
          { value: 'hanmai', label: '一般米（飯米）', desc: '食用米。安価だが溶けにくく雑味が出やすい。' },
        ],
      },
    ],
  },
  {
    id: 'polish',
    phase: '原料処理',
    title: '精米歩合を決める',
    point:
      '米の外側にはタンパク質や脂質が多く、雑味の元になります。削るほど綺麗で香り高い酒になりますが、原価は上がります。精米歩合は「残した割合」です。',
    fields: [
      {
        key: 'polish',
        label: '精米歩合',
        options: () => [
          { value: 35, label: '35%', desc: '鑑評会レベルの超高精白。大吟醸。' },
          { value: 50, label: '50%', desc: '大吟醸を名乗れる精白。' },
          { value: 60, label: '60%', desc: '吟醸を名乗れる精白。' },
          { value: 70, label: '70%', desc: '米の旨味が残る。本醸造・純米酒。' },
        ],
      },
    ],
  },
  {
    id: 'soak',
    phase: '原料処理',
    title: '洗米・浸漬（限定吸水）',
    point:
      'よく磨いた米は短時間で一気に水を吸います。杜氏はストップウォッチを手に、その年の米の硬さを見て秒単位で吸水を止めます。蒸米の出来が麹と醪のすべてを左右します。',
    report: (c) =>
      ({
        soft: '釜屋より「今年の米は軟らかい。水をすぐ吸いますぜ」',
        normal: '釜屋より「米の具合は平年並みです」',
        hard: '釜屋より「今年の米は硬い。なかなか水を吸いません」',
      })[c.hardness],
    fields: [{ key: 'soak', label: '浸漬時間', options: soakOptions }],
  },
  {
    id: 'koji',
    phase: '製麹',
    title: '麹を造る',
    point:
      '「一麹、二酛、三造り」。麹は米のでんぷんを糖に変える酵素の源です。麹室（こうじむろ）で約2日、杜氏と麹屋は夜通し温度と湿度を見守ります。',
    report: (c) =>
      c.hardness === 'hard'
        ? '麹屋より「米が硬く、菌糸が中まで入りにくい。少し時間をかけたい」'
        : '麹屋より「破精（はぜ）の回りは順調です。いつも通りの時間で出せそうです」',
    fields: [
      {
        key: 'koji',
        label: '麹のタイプ',
        options: () => [
          { value: 'tsukihaze', label: '突きハゼ', desc: '菌糸が内部に深く食い込む。吟醸向き。香り・キレ。' },
          { value: 'sohaze', label: '総ハゼ', desc: '表面全体に菌が回る。旨味たっぷりの濃醇酒向き。' },
        ],
      },
      {
        key: 'dekoji',
        label: '出麹（でこうじ）の時間',
        options: () => [
          { value: 40, label: '40時間', desc: '早めに出す。酵素控えめ、すっきり。' },
          { value: 45, label: '45時間', desc: '標準。' },
          { value: 50, label: '50時間', desc: '長めに育てる。酵素が強く旨味が増す。' },
        ],
      },
    ],
  },
  {
    id: 'shubo',
    phase: '酒母',
    title: '酒母（酛）を造る',
    point:
      '酒母は優良な酵母を大量に育てた「酒のもと」。乳酸の力で雑菌を抑えます。乳酸を加える速醸か、自然の乳酸菌を育てる生酛系かは、蔵の伝統と杜氏の腕の見せ所です。',
    report: (c) =>
      ({
        cold: '酛屋より「今年は寒い。生酛を育てるには好都合です」',
        normal: '酛屋より「平年並みの冷え込みです」',
        warm: '酛屋より「暖冬で蔵が暖かい。生酛系は雑菌が心配です」',
      })[c.winter],
    fields: [
      {
        key: 'shubo',
        label: '酒母の造り方',
        options: () => [
          { value: 'sokujo', label: '速醸酛', desc: '乳酸を添加。約2週間。安定してすっきり。' },
          { value: 'kimoto', label: '生酛', desc: '山卸し（櫂ですり潰す）を行う伝統製法。約1か月。複雑で力強い。' },
          { value: 'yamahai', label: '山廃酛', desc: '山卸しを廃した生酛系。濃醇で酸がしっかり。' },
        ],
      },
    ],
  },
  {
    id: 'yeast',
    phase: '酒母',
    title: '酵母を選ぶ',
    point: '酵母はアルコールと香りを生み出します。香りの高い酵母ほど低温を好み、温度管理が繊細になります。',
    fields: [
      {
        key: 'yeast',
        label: '酵母',
        options: () => [
          { value: 'k7', label: '協会7号', desc: '穏やかな香り。発酵力が強く温度変化に強い。' },
          { value: 'k9', label: '協会9号', desc: '華やかな吟醸香。吟醸造りの定番。' },
          { value: 'k1801', label: '協会1801号', desc: 'リンゴのような高い香り。低温を好み繊細。' },
        ],
      },
    ],
  },
];

export const MOROMI_POINT =
  '醪（もろみ）は、麹・蒸米・水を3回に分けて仕込む「三段仕込み」から始まります。タンクの中では糖化と発酵が同時に進む「並行複発酵」。杜氏は毎日、品温とボーメ（糖分の目安）を測り、タンクを冷やすか温めるかを決めます。';

export const MOROMI_STAGES = ['前半（初期の発酵）', '中盤（発酵の最盛期）', '後半（仕上げ）'];

export const FINISH_STEPS: Step[] = [
  {
    id: 'pressTiming',
    phase: '上槽',
    title: '搾る時期を決める',
    point: '醪を搾る「上槽」の日を決めるのは杜氏です。早く搾れば甘くふくよかに、引っ張れば辛口でキレのある酒になります。',
    fields: [
      {
        key: 'pressTiming',
        label: '上槽の時期',
        options: () => [
          { value: 'early', label: '早めに搾る', desc: '甘口・ふくよか。' },
          { value: 'standard', label: '予定通り', desc: '計画通りのバランス。' },
          { value: 'late', label: '引っ張る', desc: '辛口・キレ。過発酵に注意。' },
        ],
      },
    ],
  },
  {
    id: 'alcohol',
    phase: '上槽',
    title: '醸造アルコールを添加するか',
    point: '搾る直前に少量の醸造アルコールを加えると、香りが引き出され軽快な酒になります。加えなければ「純米」を名乗れます。',
    fields: [
      {
        key: 'alcohol',
        label: 'アル添',
        options: () => [
          { value: 'none', label: '添加しない（純米）', desc: '米と米麹だけ。旨味が素直に出る。' },
          { value: 'added', label: '少量添加', desc: '香りが立ち、軽快でキレのある酒に。' },
        ],
      },
    ],
  },
  {
    id: 'press',
    phase: '上槽',
    title: '搾り方を選ぶ',
    point: '同じ醪でも搾り方で品質が変わります。鑑評会の出品酒は、圧をかけずに滴る雫だけを集めることもあります。',
    fields: [
      {
        key: 'press',
        label: '搾り方',
        options: () => [
          { value: 'fukuro', label: '袋吊り（雫取り）', desc: '吊るした袋から滴る雫だけ。最も綺麗だが手間と原価がかかる。' },
          { value: 'fune', label: '槽搾り', desc: '伝統の「槽（ふね）」でゆっくり搾る。まろやか。' },
          { value: 'yabuta', label: '自動圧搾機', desc: '効率的で安定。' },
        ],
      },
    ],
  },
  {
    id: 'hiire',
    phase: '火入れ・貯蔵',
    title: '火入れ',
    point: '約65℃で加熱し、酵素の働きを止めて火落ち菌を殺菌します。回数で酒の表情が変わります。',
    fields: [
      {
        key: 'hiire',
        label: '火入れ',
        options: () => [
          { value: 'nama', label: '生酒（火入れなし）', desc: 'フレッシュで香り高い。要冷蔵。' },
          { value: 'once', label: '1回（生詰め・生貯蔵）', desc: '新鮮さと安定の中間。' },
          { value: 'twice', label: '2回（通常）', desc: '落ち着いた味わいで品質が安定。燗にも向く。' },
        ],
      },
    ],
  },
];
