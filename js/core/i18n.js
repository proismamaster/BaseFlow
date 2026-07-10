// Localizzazione UI (Ismail 2026-07-07): Italiano, Inglese, Arabo (RTL), Cinese.
// Ogni elemento traducibile ha data-i18n="chiave" (testo) o data-i18n-ph="chiave"
// (placeholder) o data-i18n-title="chiave" (attributo title). applyLanguage sostituisce
// i testi, persiste la scelta e imposta la direzione (rtl per l'arabo).
const I18N_STORAGE_KEY = 'baseflow-lang';
const I18N_LANGS = ['it', 'en', 'ar', 'zh'];
let currentLang = 'it';

const I18N = {
  // key: [it, en, ar, zh]
  new:            ['Nuovo', 'New', 'جديد', '新建'],
  open:           ['Apri', 'Open', 'فتح', '打开'],
  save:           ['Salva', 'Save', 'حفظ', '保存'],
  undo:           ['Annulla', 'Undo', 'تراجع', '撤销'],
  redo:           ['Ripeti', 'Redo', 'إعادة', '重做'],
  terminal:       ['Terminale', 'Terminal', 'طرفية', '终端'],
  export:         ['Esporta come…', 'Export as…', 'تصدير كـ…', '导出为…'],
  help:           ['Aiuto', 'Help', 'مساعدة', '帮助'],
  cat_interaction:['Interazione', 'Interaction', 'تفاعل', '交互'],
  cat_math:       ['Matematica', 'Math', 'رياضيات', '数学'],
  cat_selection:  ['Selezione', 'Selection', 'تحديد', '选择'],
  cat_loops:      ['Cicli', 'Loops', 'حلقات', '循环'],
  cat_tools:      ['Strumenti', 'Tools', 'أدوات', '工具'],
  blk_input:      ['Ingresso', 'Input', 'إدخال', '输入'],
  blk_output:     ['Uscita', 'Output', 'إخراج', '输出'],
  blk_assign:     ['Assegna', 'Assign', 'إسناد', '赋值'],
  blk_if:         ['Se', 'If', 'إذا', '如果'],
  blk_dowhile:    ['Ripeti-Mentre', 'Do-While', 'كرر-طالما', '重复-当'],
  blk_while:      ['Mentre', 'While', 'طالما', '当循环'],
  blk_for:        ['Per', 'For', 'لأجل', '计数循环'],
  blk_comment:    ['Commento', 'Comment', 'تعليق', '注释'],
  blk_pause:      ['Pausa', 'Pause', 'إيقاف مؤقت', '暂停'],
  blk_draw:       ['Disegno', 'Draw', 'رسم', '绘图'],
  blk_forward:    ['Muovi/Disegna', 'Move/Draw', 'تحرك/ارسم', '移动/绘制'],
  blk_turn:       ['Ruota', 'Turn', 'استدر', '转向'],
  blk_home:       ['Casa', 'Home', 'البداية', '起点'],
  blk_pen:        ['Penna', 'Pen', 'القلم', '画笔'],
  blk_clearscreen:['Pulisci', 'Clear', 'مسح', '清屏'],
  tg_output:      ['Grafica tartaruga', 'Turtle Graphics', 'رسومات السلحفاة', '海龟绘图'],
  tg_clear_btn:   ['Pulisci disegno', 'Clear drawing', 'مسح الرسم', '清除绘图'],
  tg_save:        ['Salva immagine', 'Save image', 'حفظ الصورة', '保存图片'],
  tg_toggle_turtle: ['Mostra/nascondi tartaruga', 'Show/hide turtle', 'إظهار/إخفاء السلحفاة', '显示/隐藏海龟'],
  tg_title:       ['Configura', 'Configure', 'إعداد', '配置'],
  tg_title_forward:['Move/Draw — distanza', 'Move/Draw — distance', 'تحرك/ارسم — المسافة', '移动/绘制 — 距离'],
  tg_title_turn:  ['Ruota — gradi', 'Turn — degrees', 'استدر — الدرجات', '转向 — 角度'],
  tg_title_pen:   ['Penna — stato, colore, spessore', 'Pen — state, color, width', 'القلم — الحالة واللون والسمك', '画笔 — 状态、颜色、粗细'],
  tg_distance:    ['Distanza', 'Distance', 'المسافة', '距离'],
  tg_direction:   ['Direzione', 'Direction', 'الاتجاه', '方向'],
  tg_right:       ['Destra', 'Right', 'يمين', '右'],
  tg_left:        ['Sinistra', 'Left', 'يسار', '左'],
  tg_degrees:     ['Gradi', 'Degrees', 'الدرجات', '度'],
  tg_pen_state:   ['Penna', 'Pen', 'القلم', '画笔'],
  tg_pen_down:    ['Giù (disegna)', 'Down (draws)', 'أسفل (يرسم)', '落笔（绘制）'],
  tg_pen_up:      ['Su (non disegna)', 'Up (no draw)', 'أعلى (لا يرسم)', '抬笔（不绘制）'],
  tg_width:       ['Spessore', 'Width', 'السمك', '粗细'],
  cat_graphics:   ['Grafica', 'Graphics', 'رسومات', '图形'],
  draw_output:    ['Disegno', 'Drawing', 'الرسم', '绘图'],
  draw_title:     ['Configura Disegno', 'Configure Drawing', 'إعداد الرسم', '配置绘图'],
  draw_op:        ['Operazione', 'Operation', 'العملية', '操作'],
  draw_op_line:   ['Linea', 'Line', 'خط', '直线'],
  draw_op_rect:   ['Rettangolo', 'Rectangle', 'مستطيل', '矩形'],
  draw_op_ellipse:['Ellisse', 'Ellipse', 'قطع ناقص', '椭圆'],
  draw_op_text:   ['Testo', 'Text', 'نص', '文本'],
  draw_op_color:  ['Imposta colore', 'Set color', 'تعيين اللون', '设置颜色'],
  draw_op_clear:  ['Pulisci', 'Clear', 'مسح', '清除'],
  draw_text:      ['Testo', 'Text', 'نص', '文本'],
  draw_color:     ['Colore', 'Color', 'اللون', '颜色'],
  draw_fill:      ['Riempi', 'Fill', 'تعبئة', '填充'],
  draw_w:         ['Larghezza', 'Width', 'العرض', '宽度'],
  draw_h:         ['Altezza', 'Height', 'الارتفاع', '高度'],
  close:          ['Chiudi', 'Close', 'إغلاق', '关闭'],
  execute:        ['Esegui', 'Execute', 'تنفيذ', '执行'],
  stop:           ['Ferma', 'Stop', 'إيقاف', '停止'],
  exec_pause:     ['Pausa esecuzione', 'Pause execution', 'إيقاف مؤقت للتنفيذ', '暂停执行'],
  step:           ['Passo', 'Step', 'خطوة', '单步'],
  reset:          ['Reset', 'Reset', 'إعادة تعيين', '重置'],
  clear:          ['Pulisci', 'Clear', 'مسح', '清除'],
  savelog:        ['Salva log', 'Save log', 'حفظ السجل', '保存日志'],
  speed_slow:     ['Lenta', 'Slow', 'بطيء', '慢速'],
  speed_normal:   ['Normale', 'Normal', 'عادي', '正常'],
  speed_fast:     ['Veloce', 'Fast', 'سريع', '快速'],
  speed_instant:  ['Istantanea', 'Instant', 'فوري', '即时'],
  var_title:      ['VARIABILI', 'VARIABLES', 'المتغيرات', '变量'],
  var_name:       ['Nome', 'Name', 'الاسم', '名称'],
  var_type:       ['Tipo', 'Type', 'النوع', '类型'],
  var_value:      ['Valore', 'Value', 'القيمة', '值'],
  var_dup:        ['Esiste già una variabile con questo nome.', 'A variable with this name already exists.', 'يوجد بالفعل متغير بهذا الاسم.', '已存在同名变量。'],
  var_delete:     ['Elimina variabile', 'Delete variable', 'حذف المتغير', '删除变量'],
  var_type_int:    ['Intero', 'Integer', 'عدد صحيح', '整数'],
  var_type_float:  ['Decimale', 'Float', 'عدد عشري', '浮点数'],
  var_type_string: ['Stringa', 'String', 'سلسلة', '字符串'],
  edit_title:     ['Modifica nodo', 'Edit Node', 'تحرير العقدة', '编辑节点'],
  ctx_edit:       ['Modifica', 'Edit', 'تحرير', '编辑'],
  ctx_cut:        ['Taglia', 'Cut', 'قص', '剪切'],
  ctx_copy:       ['Copia', 'Copy', 'نسخ', '复制'],
  ctx_paste:      ['Incolla', 'Paste', 'لصق', '粘贴'],
  delete:         ['Elimina', 'Delete', 'حذف', '删除'],
  del_block_confirm: ['Eliminare questo blocco e i suoi {n} nodi interni?', 'Delete this block and its {n} inner nodes?', 'هل تريد حذف هذه الكتلة و{n} من عقدها الداخلية؟', '删除此方块及其 {n} 个内部节点？'],
  del_err_struct: ['Struttura interna del blocco non valida.', 'Invalid internal block structure.', 'بنية الكتلة الداخلية غير صالحة.', '方块内部结构无效。'],
  del_err_exit:   ['Punto di uscita del blocco non calcolabile.', "The block's exit point cannot be computed.", 'تعذّر حساب نقطة خروج الكتلة.', '无法计算方块的出口点。'],
  del_err_join:   ['Struttura del blocco IF inattesa: ricongiunzione non valida.', 'Unexpected IF block structure: invalid reconnection.', 'بنية كتلة IF غير متوقعة.', 'IF 方块结构异常：连接点无效。'],
  del_err_loopexit: ["L'uscita del ciclo cade dentro il blocco stesso.", "The loop exit falls inside the block itself.", 'مخرج الحلقة يقع داخل الكتلة نفسها.', '循环出口落在方块内部。'],
  save_project:   ['Salva progetto', 'Save project', 'حفظ المشروع', '保存项目'],
  cancel:         ['Annulla', 'Cancel', 'إلغاء', '取消'],
  edit_ph:        ['Inserisci le informazioni del nodo', 'Enter node information', 'أدخل معلومات العقدة', '输入节点信息'],
  filename_label: ['Nome file (senza estensione):', 'File name (without extension):', 'اسم الملف (بدون امتداد):', '文件名（不含扩展名）：'],
  filename_ph:    ['Inserisci il nome del file', 'Insert file name', 'أدخل اسم الملف', '输入文件名'],
  value_ph:       ['Inserisci un valore…', 'Enter a value…', 'أدخل قيمة…', '输入一个值…'],
  unsaved:        ['Vuoi continuare senza salvare?', 'Do you want to continue without saving?', 'هل تريد المتابعة دون حفظ؟', '是否不保存并继续？'],
  yes:            ['Sì', 'Yes', 'نعم', '是'],
  no:             ['No', 'No', 'لا', '否'],
  send:           ['Invia', 'Send', 'إرسال', '发送'],
  settings:        ['Impostazioni', 'Settings', 'الإعدادات', '设置'],
  console_settings:['Impostazioni del terminale', 'Terminal settings', 'إعدادات الطرفية', '终端设置'],
  cset_output:     ['Output', 'Output', 'المخرجات', '输出'],
  cset_cond:       ['Esiti condizioni (if)', 'Condition results (if)', 'نتائج الشروط', '条件结果'],
  cset_loop:       ['Esiti cicli', 'Loop results', 'نتائج الحلقات', '循环结果'],
  cset_debug:      ['Debug', 'Debug', 'تصحيح', '调试'],
  watch_title:     ['Variabili', 'Variables', 'المتغيرات', '变量'],
  theme_customize: ['Personalizza tema', 'Customize theme', 'تخصيص السمة', '自定义主题'],
  theme_reset:     ['Ripristina', 'Reset', 'إعادة تعيين', '重置'],
  theme_create:    ['Crea nuovo tema', 'Create new theme', 'إنشاء سمة جديدة', '新建主题'],
  theme_load:      ['Carica tema', 'Load theme', 'تحميل سمة', '加载主题'],
  theme_save:      ['Salva tema', 'Save theme', 'حفظ السمة', '保存主题'],
  theme_name:      ['Nome del tema', 'Theme name', 'اسم السمة', '主题名称'],
  theme_name_ph:   ['Il mio tema', 'My theme', 'سمتي', '我的主题'],
  theme_custom_group:['I miei temi', 'My themes', 'سماتي', '我的主题'],
  theme_name_req:  ['Dai un nome al tema prima di salvarlo.', 'Give the theme a name before saving.', 'أعطِ اسمًا للسمة قبل الحفظ.', '保存前请为主题命名。'],
  theme_load_err:  ['File tema non valido.', 'Invalid theme file.', 'ملف سمة غير صالح.', '主题文件无效。'],
  for_bad_name:    ['Nome variabile non valido: solo lettere, numeri e underscore, senza spazi.', 'Invalid variable name: letters, digits and underscore only, no spaces.', 'اسم متغير غير صالح.', '变量名无效。'],
  for_missing:     ['Compila inizio, fine e passo del ciclo For.', 'Fill in the For loop start, end and step.', 'أكمل قيم حلقة For.', '请填写 For 循环的起止和步长。'],
  theme_light:    ['Chiaro', 'Light', 'فاتح', '浅色'],
  theme_dark:     ['Scuro', 'Dark', 'داكن', '深色'],
  theme_retro:    ['Retro', 'Retro', 'ريترو', '复古'],
  theme_bw:       ['Bianco/Nero', 'B&W', 'أبيض وأسود', '黑白'],
  theme_ocean:    ['Oceano', 'Ocean', 'محيط', '海洋'],
  theme_chalk:    ['Lavagna', 'Chalkboard', 'سبورة', '黑板'],
  theme_neon:     ['Neon', 'Neon', 'نيون', '霓虹'],
  theme_contrast: ['Alto contrasto', 'High contrast', 'تباين عالٍ', '高对比度'],
  assign_hint:    ['Assegna un valore', 'Assign a value', 'إسناد قيمة', '赋值'],
  clear_canvas:   ['Svuota', 'Clear', 'مسح', '清空'],
  unsaved_dot:    ['Modifiche non salvate', 'Unsaved changes', 'تغييرات غير محفوظة', '未保存的更改'],
  tip_clear:      ['Svuota il canvas', 'Clear the canvas', 'مسح اللوحة', '清空画布'],
  tip_theme:      ["Tema dell'interfaccia", 'Interface theme', 'سمة الواجهة', '界面主题'],
  tip_hide_vars:  ['Nascondi il pannello variabili', 'Hide the variables panel', 'إخفاء لوحة المتغيرات', '隐藏变量面板'],
  tip_show_vars:  ['Mostra le variabili', 'Show the variables', 'إظهار المتغيرات', '显示变量'],
  tip_resize:     ['Trascina per ridimensionare il pannello', 'Drag to resize the panel', 'اسحب لتغيير حجم اللوحة', '拖动以调整面板大小'],
  tip_runspeed:   ["Velocità animazione Run", 'Run animation speed', 'سرعة حركة التشغيل', '运行动画速度'],
  tip_savelog:    ["Scarica l'output della console come file di testo", 'Download the console output as a text file', 'تنزيل مخرجات الطرفية كملف نصي', '将控制台输出下载为文本文件'],
  tip_font_dec:   ['Riduci dimensione caratteri', 'Decrease font size', 'تصغير حجم الخط', '减小字体'],
  tip_font_inc:   ['Ingrandisci dimensione caratteri', 'Increase font size', 'تكبير حجم الخط', '增大字体'],
  tip_font_reset: ['Dimensione carattere predefinita', 'Default font size', 'حجم الخط الافتراضي', '默认字体大小'],
  tip_dock:       ['Aggancia a destra / sgancia come popup', 'Dock right / undock as popup', 'إرساء لليمين / فصل كنافذة', '停靠右侧/浮动窗口'],
  tip_zoom_in:    ['Zoom avanti', 'Zoom in', 'تكبير', '放大'],
  tip_zoom_out:   ['Zoom indietro', 'Zoom out', 'تصغير', '缩小'],
  tip_zoom_reset: ['Reset zoom', 'Reset zoom', 'إعادة تعيين التكبير', '重置缩放'],
  tip_terminal:   ['Apri/chiudi terminale', 'Open/close terminal', 'فتح/إغلاق الطرفية', '打开/关闭终端'],
  tip_console_help:['Apri la guida del terminale', 'Open the terminal guide', 'افتح دليل الطرفية', '打开终端指南'],
  tip_mobile:     ['Attiva/disattiva terminale mobile (finestra spostabile)', 'Toggle mobile terminal (movable window)', 'تبديل الطرفية المتنقلة (نافذة قابلة للتحريك)', '切换移动终端（可移动窗口）'],
  term_mobile:    ['Mobile', 'Mobile', 'متنقل', '移动'],
  nd_start:       ['Start', 'Start', 'بداية', '开始'],
  nd_end:         ['End', 'End', 'نهاية', '结束'],
  tip_settings:   ['Impostazioni applicazione', 'Application settings', 'إعدادات التطبيق', '应用设置'],
  tip_block_help: ['Guida al blocco: cosa fa e come si usa', 'Block help: what it does and how to use it', 'دليل الكتلة: ماذا تفعل وكيف تُستخدم', '方块指南：作用与用法'],
  settings_title: ['Impostazioni', 'Settings', 'الإعدادات', '设置'],
  console_title:  ['Console', 'Console', 'الطرفية', '控制台'],
  settings_general:['Generali', 'General', 'عام', '常规'],
  settings_lang:  ['Lingua', 'Language', 'اللغة', '语言'],
  settings_theme: ['Tema', 'Theme', 'السمة', '主题'],
  settings_appearance:['Aspetto', 'Appearance', 'المظهر', '外观'],
  settings_exec:  ['Esecuzione', 'Execution', 'التنفيذ', '执行'],
  settings_speed: ['Velocità animazione', 'Animation speed', 'سرعة الحركة', '动画速度'],
  settings_console:['Messaggi del terminale', 'Terminal messages', 'رسائل الطرفية', '终端消息'],
  settings_dark:  ['Modalità scura', 'Dark mode', 'الوضع الداكن', '深色模式'],
  settings_theme_edit:['Crea tema', 'Create theme', 'إنشاء سمة', '创建主题'],
  settings_done:  ['Fatto', 'Done', 'تم', '完成'],
  err_not_declared_node: ['Nel nodo {n}: {v} non \u00e8 stata dichiarata.', 'In node {n}: {v} has not been declared.', 'في العقدة {n}: {v} لم يتم تعريفه.', '在节点 {n} 中：{v} 尚未声明。'],
  err_not_declared: ['{v} non \u00e8 stata dichiarata.', '{v} has not been declared.', '{v} لم يتم تعريفه.', '{v} 尚未声明。'],
  err_var_not_declared: ['Variabile {v} non dichiarata.', 'Variable {v} not declared.', 'المتغير {v} غير معرّف.', '变量 {v} 未声明。'],
  err_empty_node: ['Il nodo {n} \u00e8 vuoto. Controlla il flusso.', 'Node {n} is empty. Please check your flow.', 'العقدة {n} فارغة. تحقق من المخطط.', '节点 {n} 为空，请检查流程。'],
  err_infinite_loop: ['Esecuzione interrotta dopo {n} passi: possibile ciclo infinito.', 'Execution stopped after {n} steps: possible infinite loop.', 'توقّف التنفيذ بعد {n} خطوة: حلقة لا نهائية محتملة.', '执行 {n} 步后停止：可能是无限循环。'],
  err_for_syntax: ['Sintassi del ciclo For non valida: {e}', 'Invalid for loop syntax: {e}', 'صيغة حلقة For غير صالحة: {e}', 'For 循环语法无效：{e}'],
  err_for_init: ['Sintassi di inizializzazione non valida: {e}', 'Invalid initialization syntax: {e}', 'صيغة التهيئة غير صالحة: {e}', '初始化语法无效：{e}'],
  err_for_init_expr: ['Nel nodo {n}: espressione di inizializzazione del For non valida {e}', 'In node {n}: invalid for-init expression {e}', 'في العقدة {n}: تعبير تهيئة For غير صالح {e}', '在节点 {n} 中：for 初始化表达式无效 {e}'],
  err_assign_syntax: ['Nel nodo {n}: sintassi di assegnazione errata. Usa [Variabile] = [Valore]', 'In node {n}: wrong assign syntax. Use [Variable] = [Value]', 'في العقدة {n}: صيغة إسناد خاطئة. استخدم [المتغير] = [القيمة]', '在节点 {n} 中：赋值语法错误。请使用 [变量] = [值]'],
  err_invalid_expr: ['Nel nodo {n}: espressione non valida {e}', 'In node {n}: invalid expression {e}', 'في العقدة {n}: تعبير غير صالح {e}', '在节点 {n} 中：表达式无效 {e}'],
  err_incr_expr: ['Nel nodo {n}: espressione di incremento non valida {e}', 'In node {n}: invalid increment expression {e}', 'في العقدة {n}: تعبير الزيادة غير صالح {e}', '在节点 {n} 中：递增表达式无效 {e}'],
  err_incr_syntax: ['Nel nodo {n}: sintassi di incremento non valida "{e}". Usa i++, i--, i+=n, i-=n oppure i=espressione', 'In node {n}: invalid increment syntax "{e}". Use i++, i--, i+=n, i-=n, or i=expression', 'في العقدة {n}: صيغة زيادة غير صالحة "{e}".', '在节点 {n} 中：递增语法无效 "{e}"。请使用 i++、i--、i+=n、i-=n 或 i=表达式'],
  err_condition: ['Nella condizione: {e}', 'In condition: {e}', 'في الشرط: {e}', '在条件中：{e}'],
  err_input_int: ['Input non valido. Devi inserire un numero intero.', 'Invalid input. You have to insert an integer number.', 'إدخال غير صالح. يجب إدخال عدد صحيح.', '输入无效。必须输入一个整数。'],
  err_input_real: ['Input non valido. Devi inserire un numero reale.', 'Invalid input. You have to insert a real number.', 'إدخال غير صالح. يجب إدخال عدد حقيقي.', '输入无效。必须输入一个实数。'],
  err_graphics_expr: ['Nel nodo {n}: espressione grafica non valida "{e}"', 'In node {n}: invalid graphics expression "{e}"', 'في العقدة {n}: تعبير رسومي غير صالح "{e}"', '在节点 {n} 中：图形表达式无效 "{e}"'],
  ok:          ['OK', 'OK', 'موافق', '确定'],
  runtime_error: ['Errore di esecuzione', 'Runtime error', 'خطأ أثناء التنفيذ', '运行时错误'],
  rt_block:      ['blocco', 'block', 'الكتلة', '方块'],
  download:    ['Scarica', 'Download', 'تنزيل', '下载'],
  export_copied: ['Codice copiato negli appunti!', 'Code copied to clipboard!', 'تم نسخ الكود إلى الحافظة!', '代码已复制到剪贴板！'],
  for_title:   ['Configura ciclo For', 'Configure For loop', 'إعداد حلقة For', '配置 For 循环'],
  for_var:     ['Variabile:', 'Variable:', 'المتغير:', '变量：'],
  for_init:    ['Valore iniziale:', 'Initial value:', 'القيمة الأولية:', '初始值：'],
  for_final:   ['Valore finale:', 'Final value:', 'القيمة النهائية:', '最终值：'],
  for_dir:     ['Direzione:', 'Direction:', 'الاتجاه:', '方向：'],
  for_inc:     ['Incrementa', 'Increment', 'تزايد', '递增'],
  for_dec:     ['Decrementa', 'Decrement', 'تناقص', '递减'],
  for_step:    ['Valore passo:', 'Step value:', 'قيمة الخطوة:', '步长：'],
  tut_next:   ['Avanti', 'Next', 'التالي', '下一步'],
  tut_back:   ['Indietro', 'Back', 'رجوع', '上一步'],
  tut_done:   ['Fine', 'Done', 'تم', '完成'],
  tut_start:  ['Benvenuto! Questo tour ti guida nella creazione di un flowchart.', 'Welcome! This tour will guide you through creating a flowchart.', 'مرحبًا! ستوجّهك هذه الجولة خلال إنشاء مخطط انسيابي.', '欢迎！本导览将带你创建流程图。'],
  tut_table:  ['Questa tabella serve a dichiarare le variabili. Compilando TUTTE le celle di una riga aggiungi una nuova variabile.', 'This table is for declaring variables. By filling ALL the cells of a row you add a new variable.', 'هذا الجدول لإعلان المتغيرات. بملء كل خلايا الصف تضيف متغيرًا جديدًا.', '此表用于声明变量。填满一行的所有单元格即可添加新变量。'],
  tut_name:   ['Nella prima cella scegli il nome della variabile.', 'In the first cell you choose the variable name.', 'في الخلية الأولى تختار اسم المتغير.', '在第一个单元格中选择变量名。'],
  tut_type:   ['Qui selezioni il tipo della variabile.', 'Here you select the variable type.', 'هنا تختار نوع المتغير.', '在此选择变量类型。'],
  tut_value:  ['Qui imposti il valore iniziale.', 'Here you set the initial value.', 'هنا تحدد القيمة الأولية.', '在此设置初始值。'],
  tut_canvas: ['Qui appariranno i tuoi blocchi.', 'This is where your blocks will appear.', 'هنا ستظهر الكتل الخاصة بك.', '你的方块将显示在这里。'],
  tut_arrows: ['Clicca sulle frecce per aggiungere nuovi blocchi.', 'Click on the arrows to add new blocks.', 'انقر على الأسهم لإضافة كتل جديدة.', '点击箭头以添加新方块。'],
  tut_nodes:  ['Clicca sui blocchi per modificarli (Start ed End non sono modificabili).', 'Click blocks to edit them (Start and End are not editable).', 'انقر على الكتل لتحريرها (لا يمكن تعديل البداية والنهاية).', '点击方块进行编辑（开始和结束不可编辑）。'],
  tut_blocks: ['Cliccando una freccia scegli il blocco da inserire: Interazione (Input/Output), Matematica (Assegna), Selezione (If), Cicli (While/For/Do-While), Grafica tartaruga (Move/Draw, Turn, Home, Pen, Clear) e Strumenti (Commento, Pausa). Input/Output sono parallelogrammi, Assegna un rettangolo, If un rombo, i cicli esagoni; Commento e Pausa sono marcatori non eseguibili.', 'When you click an arrow you choose the block to insert: Interaction (Input/Output), Math (Assign), Selection (If), Loops (While/For/Do-While), Turtle Graphics (Move/Draw, Turn, Home, Pen, Clear) and Tools (Comment, Pause). Input/Output are parallelograms, Assign a rectangle, If a diamond, loops are hexagons; Comment and Pause are non-executing markers.', 'عند النقر على سهم تختار الكتلة: تفاعل (إدخال/إخراج)، رياضيات (إسناد)، تحديد (إذا)، حلقات (طالما/لأجل/كرر-طالما)، رسومات السلحفاة (تحرك/ارسم، استدر، البداية، القلم، مسح) وأدوات (تعليق، إيقاف مؤقت). الإدخال/الإخراج متوازيات أضلاع، الإسناد مستطيل، إذا مُعيّن، الحلقات سداسيات؛ التعليق والإيقاف علامات غير قابلة للتنفيذ.', '点击箭头时可选择要插入的方块：交互（输入/输出）、数学（赋值）、选择（如果）、循环（While/For/Do-While）、海龟绘图（移动/绘制、转向、起点、画笔、清屏）和工具（注释、暂停）。输入/输出为平行四边形，赋值为矩形，如果为菱形，循环为六边形；注释与暂停为不执行的标记。'],
  tut_toolbar:['Questa e\' la barra degli strumenti.', 'This is the toolbar.', 'هذا شريط الأدوات.', '这是工具栏。'],
  tut_new:    ['Crea un nuovo flowchart.', 'Create a new flowchart.', 'أنشئ مخططًا جديدًا.', '创建新流程图。'],
  tut_open:   ['Apri i tuoi flowchart salvati.', 'Open your saved flowcharts.', 'افتح مخططاتك المحفوظة.', '打开已保存的流程图。'],
  tut_savebtn:['Scarica i tuoi progetti.', 'Download your projects.', 'نزّل مشاريعك.', '下载你的项目。'],
  tut_terminal:['Apri il terminale per eseguire il flowchart.', 'Open the terminal to run the flowchart.', 'افتح الطرفية لتشغيل المخطط.', '打开终端以运行流程图。'],
  tut_export: ['Ed esportalo in Python, JavaScript, C, C++, Java o come immagine PNG/JPG/PDF!', 'And export it as Python, JavaScript, C, C++, Java, or a PNG/JPG/PDF diagram!', 'وصدّره كـ Python أو JavaScript أو C أو C++ أو Java أو صورة PNG/JPG/PDF!', '并可导出为 Python、JavaScript、C、C++、Java 或 PNG/JPG/PDF 图像！'],
  tut_edit_explain:['Questo popup permette di modificare le informazioni di un blocco (nodo).', 'This popup lets you edit the information of a block (node).', 'تتيح لك هذه النافذة تعديل معلومات الكتلة (العقدة).', '此弹窗可编辑方块（节点）的信息。'],
  tut_edit_generic:['Qui puoi cambiare il testo o il valore del nodo selezionato.', 'Here you can change the text or value of the selected node.', 'هنا يمكنك تغيير نص أو قيمة العقدة المحددة.', '在此可更改所选节点的文本或值。'],
  tut_edit_input:['Nei nodi Input inserisci il nome della variabile da leggere (deve essere gia\' dichiarata).', 'In Input nodes enter the name of the variable to read (it must already be declared).', 'في عقد الإدخال أدخل اسم المتغير المراد قراءته (يجب أن يكون معلنًا).', '在输入节点中填写要读取的变量名（须已声明）。'],
  tut_edit_print:['Nei nodi Output scrivi il testo da mostrare. Usa apici per il testo e + per unire testo e variabili, es: "Risultato: " + x', 'In Output nodes type the text to display. Use quotes for text and + to join text and variables, e.g. "Result: " + x', 'في عقد الإخراج اكتب النص المراد عرضه. استخدم علامات الاقتباس للنص و+ لدمج النص والمتغيرات، مثال: "النتيجة: " + x', '在输出节点中输入要显示的文本。文本用引号，用 + 连接文本与变量，例如："结果：" + x'],
  tut_edit_assign:['Nei nodi Assegna imposta un valore a una variabile dichiarata: [NOME] = [VALORE].', 'In Assign nodes set a value to a declared variable: [NAME] = [VALUE].', 'في عقد الإسناد عيّن قيمة لمتغير معلن: [الاسم] = [القيمة].', '在赋值节点中为已声明变量赋值：[名称] = [值]。'],
  tut_edit_if:['I nodi If servono a decidere. Scrivi una condizione (es: x > 5). Il flusso segue il ramo True o False.', 'If nodes are for decisions. Write a condition (e.g. x > 5). The flow follows the True or False branch.', 'عقد "إذا" للقرارات. اكتب شرطًا (مثل x > 5). يتبع المسار فرع True أو False.', '如果节点用于判断。写一个条件（如 x > 5），流程按 True 或 False 分支走。'],
  tut_edit_while:['I nodi While ripetono finche\' la condizione e\' vera (es: i < 10).', 'While nodes repeat while the condition is true (e.g. i < 10).', 'عقد "طالما" تتكرر ما دام الشرط صحيحًا (مثل i < 10).', 'While 节点在条件为真时重复（如 i < 10）。'],
  tut_edit_for:['I nodi For sono cicli contati. Scrivi init;condizione;incremento (es: i = 0; i < 5; 1).', 'For nodes are counted loops. Write init;condition;increment (e.g. i = 0; i < 5; 1).', 'عقد "لأجل" حلقات معدودة. اكتب التهيئة;الشرط;الزيادة (مثل i = 0; i < 5; 1).', 'For 节点是计数循环。写 初始化;条件;增量（如 i = 0; i < 5; 1）。'],
  tut_edit_do:['I nodi Do-While sono come i While ma il blocco viene eseguito almeno una volta (condizione controllata dopo).', 'Do-While nodes are like While but the block always runs at least once (condition checked after).', 'عقد "كرر-طالما" مثل "طالما" لكن الكتلة تُنفّذ مرة واحدة على الأقل (يُفحص الشرط بعدها).', 'Do-While 节点类似 While，但方块至少执行一次（之后检查条件）。'],
  tut_edit_comment:['I nodi Commento sono note che non vengono eseguite: servono solo a documentare il flowchart.', 'Comment nodes are notes that are not executed: they only document the flowchart.', 'عقد التعليق ملاحظات لا تُنفّذ: فقط لتوثيق المخطط.', '注释节点是不执行的说明，仅用于记录流程图。'],
  tut_edit_pause:['I nodi Pausa sono marcatori non eseguibili (utili come segnaposto/pausa visiva).', 'Pause nodes are non-executing markers (useful as a placeholder / visual pause).', 'عقد الإيقاف علامات غير قابلة للتنفيذ (مفيدة كعلامة/إيقاف بصري).', '暂停节点是不执行的标记（用作占位/视觉暂停）。'],
  tut_edit_forward:['Move/Draw (Muovi/Disegna): muove la tartaruga in avanti della distanza indicata; se la penna e\' giu\' lascia una traccia.', 'Move/Draw: moves the turtle forward by the given distance; if the pen is down it leaves a trail.', 'تحرك/ارسم: يحرك السلحفاة للأمام بالمسافة المحددة؛ إذا كان القلم منخفضًا يترك أثرًا.', '移动/绘制：使海龟按指定距离前进；若落笔则留下轨迹。'],
  tut_edit_turn:  ['Ruota (Turn): gira la direzione della tartaruga di N gradi, a destra o a sinistra.', 'Turn: rotates the turtle direction by N degrees, right or left.', 'استدر: يدير اتجاه السلحفاة بمقدار N درجة يمينًا أو يسارًا.', '转向：将海龟方向旋转 N 度（左或右）。'],
  tut_edit_home:  ['Casa (Home): riporta la tartaruga al centro della tela con direzione verso l\'alto. Non ha impostazioni.', 'Home: returns the turtle to the center facing up. It has no settings.', 'البداية: تعيد السلحفاة إلى المركز متجهة للأعلى. بلا إعدادات.', '起点：将海龟移回中心并朝上。无设置。'],
  tut_edit_pen:   ['Penna (Pen): imposta la penna su/giu\', il colore e lo spessore del tratto.', 'Pen: sets the pen up/down, and the stroke color and width.', 'القلم: يضبط القلم أعلى/أسفل واللون وسمك الخط.', '画笔：设置画笔抬/落、颜色与粗细。'],
  tut_edit_gclear:['Pulisci (Clear): cancella il disegno e riporta la tartaruga a casa. Non ha impostazioni.', 'Clear: erases the drawing and sends the turtle home. It has no settings.', 'مسح: يمسح الرسم ويعيد السلحفاة للبداية. بلا إعدادات.', '清屏：清除绘图并让海龟归位。无设置。'],
  tut_edit_turtle:['I blocchi Grafica sono la grafica tartaruga di Flowgorithm: Move/Draw muove la tartaruga (e disegna se la penna è giù), Turn la ruota, Home la riporta al centro, Pen imposta penna/colore/spessore, Clear pulisce. Il disegno appare nella tela durante l\'esecuzione.', 'Graphics blocks are Flowgorithm turtle graphics: Move/Draw moves the turtle (drawing if the pen is down), Turn rotates it, Home returns it to center, Pen sets pen/color/width, Clear clears the screen. The drawing appears on the canvas during execution.', 'كتل الرسومات هي رسومات السلحفاة في Flowgorithm: تحرك/ارسم يحرك السلحفاة (ويرسم إذا كان القلم منخفضًا)، استدر يديرها، البداية يعيدها للمركز، القلم يضبط القلم/اللون/السمك، مسح يمسح الشاشة.', '图形块是 Flowgorithm 的海龟绘图：移动/绘制移动海龟（落笔时绘制），转向旋转它，起点回到中心，画笔设置画笔/颜色/粗细，清屏清除。执行时绘图显示在画布上。'],
  tut_edit_save:['Clicca qui per salvare le modifiche.', 'Click here to save your changes.', 'انقر هنا لحفظ التغييرات.', '点击此处保存更改。'],
  tut_edit_close:['Oppure chiudi il popup senza salvare.', 'Or close the popup without saving.', 'أو أغلق النافذة دون حفظ.', '或不保存并关闭弹窗。'],
  tut_con_intro:['Questo e\' il terminale: qui esegui il flowchart e vedi l\'output.', 'This is the terminal: here you run the flowchart and see the output.', 'هذه هي الطرفية: هنا تشغّل المخطط وترى المخرجات.', '这是终端：在此运行流程图并查看输出。'],
  tut_con_output:['Quest\'area mostra l\'output del flowchart, inclusi errori e risultati.', 'This area shows the flowchart output, including errors and results.', 'تعرض هذه المنطقة مخرجات المخطط، بما في ذلك الأخطاء والنتائج.', '此区域显示流程图输出，包括错误和结果。'],
  tut_con_input:['Se il flowchart richiede input, scrivilo qui e premi Invia (o Invio).', 'If the flowchart needs input, type it here and press Send (or Enter).', 'إذا احتاج المخطط إلى إدخال، اكتبه هنا واضغط إرسال (أو Enter).', '若流程图需要输入，在此输入并按发送（或回车）。'],
  tut_con_buttons:['Usa questi pulsanti per controllare l\'esecuzione: esegui tutto, passo-passo, reset, oppure pulisci/chiudi il terminale.', 'Use these buttons to control execution: run all, step by step, reset, or clear/close the terminal.', 'استخدم هذه الأزرار للتحكم بالتنفيذ: تشغيل الكل، خطوة بخطوة، إعادة تعيين، أو مسح/إغلاق الطرفية.', '用这些按钮控制执行：全部运行、单步、重置，或清空/关闭终端。']
};

function i18nText(key) {
  const idx = I18N_LANGS.indexOf(currentLang);
  const entry = I18N[key];
  if (!entry) return null;
  return entry[idx >= 0 ? idx : 0];
}

// Traduzione con segnaposto {nome} (Ismail 2026-07-09d): usata per i messaggi d'errore
// runtime, che contengono parti dinamiche (numero del nodo, nome della variabile, dettaglio).
function i18nFormat(key, params) {
  let s = i18nText(key);
  if (s == null) return null;
  if (params) for (const k in params) { s = s.split('{' + k + '}').join(String(params[k])); }
  return s;
}
// Messaggio d'errore localizzato con fallback alla chiave (le chiavi err_* esistono sempre).
function errMsg(key, params) {
  const s = i18nFormat(key, params);
  return (s != null) ? s : key;
}

function applyLanguage(lang) {
  if (I18N_LANGS.indexOf(lang) === -1) lang = 'it';
  if (typeof document === 'undefined' || !document.querySelectorAll) return;
  // testo
  document.querySelectorAll('[data-i18n]').forEach(function (el) {
    const t = i18nText(el.getAttribute('data-i18n'));
    if (t !== null && t !== undefined) el.textContent = t;
  });
  // placeholder
  document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
    const t = i18nText(el.getAttribute('data-i18n-ph'));
    if (t !== null && t !== undefined) el.setAttribute('placeholder', t);
  });
  // title (tooltip)
  document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
    const t = i18nText(el.getAttribute('data-i18n-title'));
    if (t !== null && t !== undefined) el.setAttribute('title', t);
  });
  // direzione: arabo = RTL
  if (document.documentElement) {
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  }
  const sel = document.getElementById('lang-select');
  if (sel && sel.value !== lang) sel.value = lang;
  // Ridisegna il canvas: i nomi dei blocchi (Start/End/If/While/...) seguono la lingua.
  try { if (typeof draw === 'function' && typeof nodi !== 'undefined' && nodi) draw(nodi); } catch (e) { /* non bloccante */ }
  try { if (typeof updateVarTypeOptions === 'function') updateVarTypeOptions(); } catch (e) {}
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(I18N_STORAGE_KEY, lang); } catch (e) { /* non bloccante */ }
}

function setLanguage(lang) { applyLanguage(lang); }

function loadLanguagePreference() {
  let lang = 'it';
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(I18N_STORAGE_KEY);
      if (saved && I18N_LANGS.indexOf(saved) !== -1) lang = saved;
    }
  } catch (e) { lang = 'it'; }
  applyLanguage(lang);
}
