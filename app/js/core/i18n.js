// Localizzazione UI (Ismail 2026-07-07): Italiano, Inglese, Arabo (RTL), Cinese.
// Ogni elemento traducibile ha data-i18n="chiave" (testo) o data-i18n-ph="chiave"
// (placeholder) o data-i18n-title="chiave" (attributo title). applyLanguage sostituisce
// i testi, persiste la scelta e imposta la direzione (rtl per l'arabo).
const I18N_STORAGE_KEY = 'baseflow-lang';
const I18N_LANGS = ['it', 'en', 'ar', 'zh'];
// FIX (Ismail 2026-07-19, "metti inglese come default"): era 'it' -- non coerente col resto
// del sito, dove privacy.html/cookies.html usano gia' 'en' come fallback dichiarato ("fallback
// senza preferenza salvata e' 'en', coerente col resto del testo della pagina"). Riallineato
// anche manual.html nello stesso turno (i suoi 5 punti con fallback 'it').
let currentLang = 'en';

const I18N = {
  // key: [it, en, ar, zh]
  new:            ['Nuovo', 'New', 'جديد', '新建'],
  open:           ['Apri', 'Open', 'فتح', '打开'],
  save:           ['Salva', 'Save', 'حفظ', '保存'],
  undo:           ['Annulla', 'Undo', 'تراجع', '撤销'],
  redo:           ['Ripeti', 'Redo', 'إعادة', '重做'],
  terminal:       ['Terminale', 'Terminal', 'طرفية', '终端'],
  export:         ['Esporta come…', 'Export as…', 'تصدير كـ…', '导出为…'],
  export_format:  ['Formato', 'Format', 'التنسيق', '格式'],
  help:           ['Aiuto', 'Help', 'مساعدة', '帮助'],
  // R13-K (Ismail 2026-07-12): tooltip del pulsante libro in toolbar (apre manual.html).
  manual:         ['Manuale', 'Manual', 'الدليل', '手册'],
  // WP-M (Ismail 2026-07-20): pulsante More/Show-less della header mobile a 2 righe.
  more:           ['Di più', 'More', 'المزيد', '更多'],
  show_less:      ['Mostra meno', 'Show less', 'عرض أقل', '收起'],
  // WP-M2 (Ismail 2026-07-20): nuove impostazioni Prestazioni.
  perf_lowres:    ['Risoluzione canvas ridotta (più veloce)', 'Reduced canvas resolution (faster)', 'دقة لوحة مخفّضة (أسرع)', '降低画布分辨率（更快）'],
  perf_conmax:    ['Limita lo storico del terminale (300 righe)', 'Limit terminal history (300 lines)', 'تحديد سجل الطرفية (300 سطر)', '限制终端历史（300行）'],
  // WP-M5s (Ismail 2026-07-21): modalita' per PC lenti, attiva solo a velocita' Istantanea.
  perf_turbo:     ['Turbo su Istantanea (niente evidenziazione né righe di servizio)', 'Turbo on Instant (no block highlight, no service lines)', 'وضع سريع مع "فوري" (بدون إبراز الكتل ولا أسطر الخدمة)', '“瞬时”涡轮模式（不高亮块，不显示服务信息）'],
  // WP-M5t (Ismail 2026-07-21): la protezione anti-ciclo-infinito diventa disattivabile.
  perf_loopguard: ['Protezione anti-ciclo infinito (ferma dopo 50000 passi)', 'Infinite-loop protection (stop after 50000 steps)', 'الحماية من الحلقات اللانهائية (إيقاف بعد 50000 خطوة)', '无限循环保护（50000 步后停止）'],
  // WP-M5z (Ismail 2026-07-21): indicatore FPS diagnostico.
  perf_fps:       ['Mostra contatore FPS (diagnostica)', 'Show FPS counter (diagnostics)', 'إظهار عداد الإطارات FPS (تشخيص)', '显示 FPS 计数器（诊断）'],
  // WP-M: avviso quando Shepherd (CDN) non e' caricato e il tutorial non puo' partire.
  tut_unavailable:['Tutorial non disponibile (libreria non caricata): controlla la connessione e riprova.',
                   'Tutorial unavailable (library not loaded): check your connection and retry.',
                   'الدليل التفاعلي غير متاح (المكتبة غير محمّلة): تحقق من الاتصال وأعد المحاولة.',
                   '教程不可用（库未加载）：请检查网络连接后重试。'],
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
  // Messaggi RUNTIME del terminale (Ismail 2026-07-17): prima erano hardcoded in inglese e non
  // seguivano la lingua. Le parti tra {…} sono CODICE dell'utente (condizioni/assegnazioni) e
  // NON vanno tradotte. La categoria (cond/loop/output) viene passata ESPLICITA al printMessage,
  // cosi' il filtro del terminale non dipende piu' dal testo (che ora e' tradotto).
  run_is_true:    ['è vero', 'is true', 'صحيح', '为真'],
  run_is_false:   ['è falso', 'is false', 'خطأ', '为假'],
  run_if:         ['Se: {c}', 'If: {c}', 'إذا: {c}', '如果：{c}'],
  run_if_res:     ['Se: {c} {r}', 'If: {c} {r}', 'إذا: {c} {r}', '如果：{c} {r}'],
  run_while:      ['Mentre: {c}', 'While: {c}', 'طالما: {c}', '当：{c}'],
  run_while_res:  ['Mentre: {c} {r}', 'While: {c} {r}', 'طالما: {c} {r}', '当：{c} {r}'],
  run_do_res:     ['Ripeti: {c} {r}', 'Do: {c} {r}', 'كرر: {c} {r}', '执行：{c} {r}'],
  run_for:        ['Per: {v} = {val}', 'For: {v} = {val}', 'لأجل: {v} = {val}', '计数循环：{v} = {val}'],
  run_for_cond:   ['Condizione Per: {c} {r}', 'For Condition: {c} {r}', 'شرط لأجل: {c} {r}', '计数条件：{c} {r}'],
  run_assign:     ['Assegna: {info}', 'Assign: {info}', 'إسناد: {info}', '赋值：{info}'],
  run_do:         ['Ripeti: {c}', 'Do: {c}', 'كرر: {c}', '执行：{c}'],
  run_do_enter:   ['Ripeti: entro nel corpo (eseguito almeno una volta)', 'Do: entering body (runs at least once)', 'كرر: الدخول إلى الجسم (يُنفَّذ مرة واحدة على الأقل)', '执行：进入循环体（至少执行一次）'],
  run_input:      ['Input: {info}', 'Input: {info}', 'إدخال: {info}', '输入：{info}'],
  run_end:        ['Fine.', 'End.', 'انتهى.', '结束。'],
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
  var_type_int:    ['Intero', 'Integer', 'صحيح', '整数'],
  var_type_float:  ['Decimale', 'Float', 'عشري', '浮点数'],
  var_type_string: ['Stringa', 'String', 'سلسلة', '字符串'],
  // Ismail 2026-07-20: nuovo tipo Boolean (true/false) — variables.js/execute.js/i18n.js/
  // multiTranslation.js/pythonTranslation.js/index.html, vedi JOURNAL per il dettaglio.
  var_type_bool:   ['Booleano', 'Boolean', 'منطقي', '布尔值'],
  // WP-M2 (Ismail 2026-07-20): tipo Array (con seconda select per il tipo degli elementi).
  var_type_array:  ['Array', 'Array', 'مصفوفة', '数组'],
  // WP-M3 (Ismail 2026-07-20): dimensione dichiarata + griglia celle.
  var_size:        ['Dimensione (numero di celle)', 'Size (number of cells)', 'الحجم (عدد الخلايا)', '大小（单元格数量）'],
  // WP-M4n (Ismail 2026-07-21): un array e' valido solo con tipo elementi E dimensione.
  var_type_choose: ['Tipo…', 'Type…', 'النوع…', '类型…'],
  var_err_array_elem: ['Scegli il tipo degli elementi dell\'array.',
                       'Choose the type of the array elements.',
                       'اختر نوع عناصر المصفوفة.',
                       '请选择数组元素的类型。'],
  tip_array_cells: ['Mostra/nascondi le celle dell\'array', 'Show/hide the array cells', 'إظهار/إخفاء خلايا المصفوفة', '显示/隐藏数组单元格'],
  // WP-M5 (audit sicurezza 2026-07-21): file con variabili non valide (tipo sconosciuto,
  // array troppo grande, celle di tipo incoerente) -- rifiutato, progetto aperto intatto.
  load_bad_variables: ['Il file contiene variabili non valide e non è stato caricato.',
                       'The file contains invalid variables and was not loaded.',
                       'يحتوي الملف على متغيرات غير صالحة ولم يتم تحميله.',
                       '文件包含无效的变量，未被加载。'],
  var_err_array_size: ['La dimensione deve essere un numero intero tra 0 e 1000.', 'The size must be a whole number between 0 and 1000.', 'يجب أن يكون الحجم عددًا صحيحًا بين 0 و1000.', '大小必须是 0 到 1000 之间的整数。'],
  // WP-M4 (mockup di Ismail): etichetta dell'espansore "▾ celle [n]" + errore conteggio lista.
  var_cells:       ['celle', 'cells', 'خلايا', '单元格'],
  var_err_array_count: ['Hai scritto {got} elementi ma la dimensione è {want}: usa un solo valore (per tutte le celle) o esattamente {want} elementi.',
                        'You wrote {got} elements but the size is {want}: use a single value (for all cells) or exactly {want} elements.',
                        'كتبت {got} عنصرًا لكن الحجم {want}: استخدم قيمة واحدة (لكل الخلايا) أو {want} عنصرًا بالضبط.',
                        '你写了 {got} 个元素，但大小是 {want}：请用一个值（应用于所有单元格）或恰好 {want} 个元素。'],
  var_err_array:   ['Elementi non validi: separali con virgole; ogni elemento deve rispettare il tipo scelto (es. 1, 2, 3).',
                    'Invalid elements: separate them with commas; each element must match the chosen type (e.g. 1, 2, 3).',
                    'عناصر غير صالحة: افصلها بفواصل؛ يجب أن يطابق كل عنصر النوع المختار (مثال: 1, 2, 3).',
                    '元素无效：请用逗号分隔；每个元素必须符合所选类型（例如 1, 2, 3）。'],
  // Ismail 2026-07-20 (round successivo): etichette per le <option> della select true/false
  // usata come campo VALORE quando il tipo e' bool (variables.js, _boolValueLabel). Testo
  // esteso quando la sidebar e' larga; abbreviato alla prima lettera tradotta (V/F, T/F...)
  // sotto la stessa soglia "narrow" gia' usata per il tipo (Array.from(...)[0], al sicuro
  // anche con lettere fuori dal BMP). Il VALORE dell'<option> resta sempre "true"/"false"
  // (letterale del linguaggio, safeEval.js) — solo il testo mostrato e' tradotto.
  bool_true:  ['Vero', 'True', 'صحيح', '真'],
  bool_false: ['Falso', 'False', 'خطأ', '假'],
  // R13-L (Ismail 2026-07-12): hint del popover di editing valori (doppio click sulla cella Valore).
  var_value_popover_hint: ['Invio per confermare · Esc per annullare', 'Enter to confirm · Esc to cancel', 'Enter للتأكيد · Esc للإلغاء', '按 Enter 确认 · 按 Esc 取消'],
  edit_title:     ['Modifica nodo', 'Edit Node', 'تحرير العقدة', '编辑节点'],
  ctx_edit:       ['Modifica', 'Edit', 'تحرير', '编辑'],
  ctx_cut:        ['Taglia', 'Cut', 'قص', '剪切'],
  ctx_copy:       ['Copia', 'Copy', 'نسخ', '复制'],
  ctx_paste:      ['Incolla', 'Paste', 'لصق', '粘贴'],
  ctx_copy_selection: ['Copia selezione', 'Copy selection', 'نسخ التحديد', '复制所选'],
  ctx_cut_selection: ['Taglia selezione', 'Cut selection', 'قص التحديد', '剪切所选'],
  ctx_delete_selection: ['Elimina selezione', 'Delete selection', 'حذف التحديد', '删除所选'],
  del_group_confirm: ['Eliminare {n} blocchi?', 'Delete {n} blocks?', 'حذف {n} كتل؟', '删除 {n} 个方块？'],
  delete:         ['Elimina', 'Delete', 'حذف', '删除'],
  // WP-M11: scritta centrata al posto del campo, nei blocchi senza impostazioni (Pausa/Casa/Pulisci).
  no_params:      ['Nessun parametro', 'No parameters', 'لا توجد معاملات', '无参数'],
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
  // R13-D (Ismail 2026-07-12): identita' progetto (header) + campo Autore nel save-popup.
  author_label:   ['Autore:', 'Author:', 'المؤلف:', '作者：'],
  author_ph:      ['Nome autore', 'Author name', 'اسم المؤلف', '作者姓名'],
  untitled_project: ['Senza nome', 'Untitled', 'بدون عنوان', '无标题'],
  unknown_author: ['Autore sconosciuto', 'Unknown author', 'مؤلف غير معروف', '未知作者'],
  saved_state:    ['Salvato', 'Saved', 'تم الحفظ', '已保存'],
  // R14-B.2 (Ismail 2026-07-13): "project_identity_tip" rimossa -- era il testo statico del
  // vecchio title nativo di #project-identity (sempre "Stato del progetto"/generico), ora
  // sostituito dal tooltip dinamico (nome+autore+stato) scritto in data-tip da
  // updateProjectIdentity() (execute.js), mostrato dal tooltip istantaneo di ux.js.
  // R13-D punto 4 (Ismail 2026-07-12, decisione approvata): Salva e Salva-con-nome restano
  // ENTRAMBI -- tooltip dedicati che spiegano la differenza (prima entrambi i pulsanti
  // mostravano solo l'etichetta breve "Salva"/"Salva con nome" come tooltip, poco chiaro).
  tip_save:       ['Salva: silenzioso se il progetto ha gia\' un nome, altrimenti chiede nome e autore', 'Save: silent if the project already has a name, otherwise asks for name and author', 'حفظ: صامت إذا كان للمشروع اسم بالفعل، وإلا يطلب الاسم والمؤلف', '保存：如果项目已有名称则静默保存，否则会询问名称和作者'],
  tip_save_as:    ['Salva con nome: chiede sempre nome e autore (rinomina o cambia autore)', 'Save as: always asks for name and author (rename or change author)', 'حفظ باسم: يطلب دائمًا الاسم والمؤلف (لإعادة التسمية أو تغيير المؤلف)', '另存为：始终询问名称和作者（用于重命名或更改作者）'],
  save_current_project: ['Progetto attuale: {name}', 'Currently: {name}', 'المشروع الحالي: {name}', '当前项目：{name}'],
  value_ph:       ['Inserisci un valore…', 'Enter a value…', 'أدخل قيمة…', '输入一个值…'],
  unsaved:        ['Vuoi continuare senza salvare?', 'Do you want to continue without saving?', 'هل تريد المتابعة دون حفظ؟', '是否不保存并继续？'],
  unsaved_title:  ['Modifiche non salvate', 'Unsaved changes', 'تغييرات غير محفوظة', '未保存的更改'],
  // R12-B (Ismail 2026-07-11): messaggio CONTESTUALE del dialog "Modifiche non salvate" quando
  // il nome del file e' noto (currentFileName, state.js) -- {file} col pattern gia' usato da
  // export_downloaded/err_*. Senza nome noto il dialog riusa la chiave generica "unsaved" sopra.
  unsaved_msg_named: ['Vuoi salvare le modifiche a {file} prima di continuare?', 'Do you want to save the changes to {file} before continuing?', 'هل تريد حفظ التغييرات في {file} قبل المتابعة؟', '是否要在继续之前保存对 {file} 的更改？'],
  tip_hide_terminal: ['Nascondi terminale', 'Hide terminal', 'إخفاء الطرفية', '隐藏终端'],
  dont_save:      ['Non salvare', "Don't save", 'عدم الحفظ', '不保存'],
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
  // WP-M (Ismail 2026-07-20): pulsante "Imposta" dell'editor tema -- applica senza salvare.
  theme_apply:     ['Imposta', 'Apply', 'تطبيق', '应用'],
  theme_create:    ['Crea nuovo tema', 'Create new theme', 'إنشاء سمة جديدة', '新建主题'],
  theme_load:      ['Carica tema', 'Load theme', 'تحميل سمة', '加载主题'],
  theme_save:      ['Salva tema', 'Save theme', 'حفظ السمة', '保存主题'],
  theme_name:      ['Nome del tema', 'Theme name', 'اسم السمة', '主题名称'],
  theme_name_ph:   ['Il mio tema', 'My theme', 'سمتي', '我的主题'],
  theme_custom_group:['I miei temi', 'My themes', 'سماتي', '我的主题'],
  theme_name_req:  ['Dai un nome al tema prima di salvarlo.', 'Give the theme a name before saving.', 'أعطِ اسمًا للسمة قبل الحفظ.', '保存前请为主题命名。'],
  theme_load_err:  ['File tema non valido.', 'Invalid theme file.', 'ملف سمة غير صالح.', '主题文件无效。'],
  // Gruppi ed etichette dell'editor "Crea nuovo tema" (Ismail 2026-07-10)
  theme_grp_ui:      ['Interfaccia', 'Interface', 'الواجهة', '界面'],
  theme_grp_nodes:   ['Nodi', 'Nodes', 'العقد', '节点'],
  theme_grp_turtle:  ['Grafica (tartaruga)', 'Turtle graphics', 'رسومات السلحفاة', '海龟图形'],
  theme_grp_arcs:    ['Archi & etichette', 'Arrows & labels', 'الأسهم والتسميات', '箭头和标签'],
  theme_grp_exec:    ['Esecuzione', 'Execution', 'التنفيذ', '执行'],
  // R12-E/E2 (Ismail 2026-07-11): nuovo gruppo editor tema per i controlli del terminale (Stop).
  theme_grp_console: ['Terminale', 'Terminal', 'الطرفية', '终端'],
  theme_var_bg:          ['Sfondo pagina', 'Page background', 'خلفية الصفحة', '页面背景'],
  theme_var_surface:     ['Pannelli/superficie', 'Panels/surface', 'اللوحات/السطح', '面板/表面'],
  theme_var_primary:     ['Pulsanti/colore principale', 'Buttons/primary color', 'الأزرار/اللون الأساسي', '按钮/主色'],
  theme_var_primarydark: ['Colore principale (scuro/hover)', 'Primary color (dark/hover)', 'اللون الأساسي (داكن/تمرير)', '主色（深色/悬停）'],
  theme_var_accent:      ['Accento', 'Accent', 'لون مميز', '强调色'],
  theme_var_border:      ['Bordi', 'Borders', 'الحدود', '边框'],
  theme_var_text:        ['Testo', 'Text', 'النص', '文本'],
  // Nomi nodi/blocchi (Start, If, While...) NON duplicati qui: l'editor tema riusa le
  // chiavi nd_*/blk_* gia' esistenti piu' sotto, cosi' l'etichetta e' sempre identica
  // a quella mostrata sul blocco vero e proprio, in ogni lingua.
  theme_var_line:      ['Linee/archi', 'Lines/arrows', 'الخطوط/الأسهم', '线条/箭头'],
  theme_var_true:      ['Vero/True', 'True', 'صحيح', '真'],
  theme_var_false:     ['Falso/False', 'False', 'خطأ', '假'],
  theme_var_archover:  ['Arco (hover)', 'Arrow (hover)', 'السهم (تمرير)', '箭头（悬停）'],
  theme_var_execnode: ['Nodo in esecuzione', 'Running node', 'العقدة قيد التنفيذ', '执行中的节点'],
  theme_var_execedge: ['Arco percorso', 'Traversed arrow', 'السهم المقطوع', '已遍历的箭头'],
  theme_var_execerr:  ['Blocco in errore', 'Block in error', 'كتلة بها خطأ', '出错的模块'],
  theme_var_nodetext: ['Testo blocchi', 'Block text', 'نص الكتل', '模块文字'],
  // R12-E/E1 (Ismail 2026-07-11): var gia' esistenti in CSS/JS ma mancanti nell'editor tema.
  theme_var_arcdrag:  ['Arco (drag)', 'Arrow (drag)', 'السهم (سحب)', '箭头（拖动）'],
  theme_var_nodesel:  ['Blocco selezionato', 'Selected block', 'الكتلة المحددة', '选中的方块'],
  // R12-E/E2: nuova var per il pulsante Stop del terminale (prima rosso fisso).
  theme_var_stopbtn:  ['Pulsante Stop', 'Stop button', 'زر الإيقاف', '停止按钮'],
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
  nd_start:       ['Inizio', 'Start', 'بداية', '开始'],
  nd_end:         ['Fine', 'End', 'نهاية', '结束'],
  tip_settings:   ['Impostazioni applicazione', 'Application settings', 'إعدادات التطبيق', '应用设置'],
  tip_block_help: ['Guida al blocco: cosa fa e come si usa', 'Block help: what it does and how to use it', 'دليل الكتلة: ماذا تفعل وكيف تُستخدم', '方块指南：作用与用法'],
  settings_title: ['Impostazioni', 'Settings', 'الإعدادات', '设置'],
  console_title:  ['Console', 'Console', 'الطرفية', '控制台'],
  settings_general:['Generali', 'General', 'عام', '常规'],
  settings_lang:  ['Lingua', 'Language', 'اللغة', '语言'],
  settings_theme: ['Tema', 'Theme', 'السمة', '主题'],
  settings_appearance:['Aspetto', 'Appearance', 'المظهر', '外观'],
  settings_view:  ['Vista', 'View', 'العرض', '视图'],
  view_grid:      ['Griglia sul canvas', 'Canvas grid', 'شبكة على اللوحة', '画布网格'],
  settings_exec:  ['Esecuzione', 'Execution', 'التنفيذ', '执行'],
  settings_speed: ['Velocità animazione', 'Animation speed', 'سرعة الحركة', '动画速度'],
  settings_console:['Messaggi del terminale', 'Terminal messages', 'رسائل الطرفية', '终端消息'],
  settings_dark:  ['Modalità scura', 'Dark mode', 'الوضع الداكن', '深色模式'],
  settings_theme_edit:['Crea tema', 'Create theme', 'إنشاء سمة', '创建主题'],
  settings_done:  ['Fatto', 'Done', 'تم', '完成'],
  err_infinite_loop: ['Esecuzione interrotta dopo {n} passi: possibile ciclo infinito.', 'Execution stopped after {n} steps: possible infinite loop.', 'توقّف التنفيذ بعد {n} خطوة: حلقة لا نهائية محتملة.', '执行 {n} 步后停止：可能是无限循环。'],
  err_assign_syntax: ['Nel nodo {n}: sintassi di assegnazione errata. Usa [Variabile] = [Valore]', 'In node {n}: wrong assign syntax. Use [Variable] = [Value]', 'في العقدة {n}: صيغة إسناد خاطئة. استخدم [المتغير] = [القيمة]', '在节点 {n} 中：赋值语法错误。请使用 [变量] = [值]'],
  err_incr_syntax: ['Nel nodo {n}: sintassi di incremento non valida "{e}". Usa i++, i--, i+=n, i-=n oppure i=espressione', 'In node {n}: invalid increment syntax "{e}". Use i++, i--, i+=n, i-=n, or i=expression', 'في العقدة {n}: صيغة زيادة غير صالحة "{e}".', '在节点 {n} 中：递增语法无效 "{e}"。请使用 i++、i--、i+=n、i-=n 或 i=表达式'],
  err_condition: ['Nella condizione: {e}', 'In condition: {e}', 'في الشرط: {e}', '在条件中：{e}'],
  err_div_zero: ['Nel nodo {n}: divisione per zero.', 'In node {n}: division by zero.', 'في العقدة {n}: القسمة على صفر.', '在节点 {n} 中：除以零。'],
  err_type_mismatch: ['Nel nodo {n}: non puoi assegnare un valore di tipo {got} a una variabile di tipo {type}.', 'In node {n}: cannot assign a {got} value to a {type} variable.', 'في العقدة {n}: لا يمكن إسناد قيمة من النوع {got} إلى متغير من النوع {type}.', '在节点 {n} 中：无法将 {got} 类型的值赋给 {type} 类型的变量。'],
  err_input_int: ['Input non valido. Devi inserire un numero intero.', 'Invalid input. You have to insert an integer number.', 'إدخال غير صالح. يجب إدخال عدد صحيح.', '输入无效。必须输入一个整数。'],
  err_input_real: ['Input non valido. Devi inserire un numero reale.', 'Invalid input. You have to insert a real number.', 'إدخال غير صالح. يجب إدخال عدد حقيقي.', '输入无效。必须输入一个实数。'],
  err_input_bool: ['Input non valido. Devi inserire true o false.', 'Invalid input. You have to insert true or false.', 'إدخال غير صالح. يجب إدخال true أو false.', '输入无效。必须输入 true 或 false。'],
  // WP-M2 (Ismail 2026-07-20): errori del tipo Array (indicizzazione + input).
  err_index_int: ['Nel nodo {n}: l\'indice di un array deve essere un numero intero.', 'In node {n}: an array index must be an integer.', 'في العقدة {n}: يجب أن يكون فهرس المصفوفة عددًا صحيحًا.', '在节点 {n} 中：数组索引必须是整数。'],
  err_index_range: ['Nel nodo {n}: indice {i} fuori dai limiti (lunghezza array: {len}).', 'In node {n}: index {i} out of bounds (array length: {len}).', 'في العقدة {n}: الفهرس {i} خارج الحدود (طول المصفوفة: {len}).', '在节点 {n} 中：索引 {i} 超出范围（数组长度：{len}）。'],
  err_not_array: ['Nel nodo {n}: la variabile indicizzata con [ ] non è un array.', 'In node {n}: the variable indexed with [ ] is not an array.', 'في العقدة {n}: المتغير المفهرس بـ [ ] ليس مصفوفة.', '在节点 {n} 中：用 [ ] 索引的变量不是数组。'],
  // WP-M5b (Ismail 2026-07-21): caso dedicato all'array VUOTO. Col messaggio generico di
  // err_index_range si leggeva "indice 0 fuori dai limiti (lunghezza array: 0)", che fa
  // cercare l'errore nell'indice mentre il problema e' che l'array non ha nessuna cella.
  // WP-M5g (Ismail 2026-07-21): le stringhe vanno fra virgolette anche nella dichiarazione,
  // cosi' un nome senza virgolette puo' significare "il valore di quest'altra variabile".
  var_err_string_quotes: ['Le stringhe vanno fra virgolette: "testo". Un nome senza virgolette indica un\'altra variabile.', 'Strings must be quoted: "text". A name without quotes refers to another variable.', 'يجب وضع النصوص بين علامتي اقتباس: "نص". الاسم بدون علامات اقتباس يشير إلى متغير آخر.', '字符串必须加引号："文本"。不加引号的名称表示引用另一个变量。'],
  // WP-M5f (Ismail 2026-07-21): errori delle conversioni carattere<->codice ASCII.
  err_chr_range: ['Nel nodo {n}: Chr() richiede un codice di carattere valido (intero da 0 a 1114111), ricevuto {v}.', 'In node {n}: Chr() needs a valid character code (integer from 0 to 1114111), got {v}.', 'في العقدة {n}: تتطلب Chr() رمز حرف صالحًا (عدد صحيح من 0 إلى 1114111)، وردَ {v}.', '在节点 {n} 中：Chr() 需要有效的字符编码（0 到 1114111 之间的整数），收到的是 {v}。'],
  err_asc_empty: ['Nel nodo {n}: Asc() richiede un carattere, non una stringa vuota.', 'In node {n}: Asc() needs a character, not an empty string.', 'في العقدة {n}: تتطلب Asc() حرفًا، وليس نصًا فارغًا.', '在节点 {n} 中：Asc() 需要一个字符，而不是空字符串。'],
  err_index_empty: ['Nel nodo {n}: l\'array è vuoto (dimensione 0), non ha celle da leggere o scrivere.', 'In node {n}: the array is empty (size 0), it has no cells to read or write.', 'في العقدة {n}: المصفوفة فارغة (الحجم 0)، ولا تحتوي على خلايا للقراءة أو الكتابة.', '在节点 {n} 中：数组为空（大小为 0），没有可读写的单元格。'],
  err_input_array: ['Input non valido. Inserisci gli elementi separati da virgole; ogni elemento deve essere di tipo {type}.', 'Invalid input. Enter the elements separated by commas; each element must be of type {type}.', 'إدخال غير صالح. أدخل العناصر مفصولة بفواصل؛ يجب أن يكون كل عنصر من النوع {type}.', '输入无效。请输入用逗号分隔的元素；每个元素必须是 {type} 类型。'],
  // WP-M3: l'input di un array intero deve fornire esattamente {want} elementi (dimensione dichiarata).
  err_input_array_size: ['Input non valido. Servono esattamente {want} elementi separati da virgole (dimensione dichiarata).', 'Invalid input. Exactly {want} comma-separated elements are required (declared size).', 'إدخال غير صالح. مطلوب بالضبط {want} عنصرًا مفصولة بفواصل (الحجم المعلن).', '输入无效。需要恰好 {want} 个用逗号分隔的元素（声明的大小）。'],
  err_graphics_expr: ['Nel nodo {n}: espressione grafica non valida "{e}"', 'In node {n}: invalid graphics expression "{e}"', 'في العقدة {n}: تعبير رسومي غير صالح "{e}"', '在节点 {n} 中：图形表达式无效 "{e}"'],
  // S11 P13.3 (round 15-B, Ismail 2026-07-15): Turn eseguito senza direzione scelta
  // (Destra/Sinistra) -- a editing resta neutro (nessun errore), solo l'esecuzione lo segnala.
  err_turn_no_dir: ['Nel nodo {n}: il blocco Turn non ha una direzione (Destra/Sinistra) impostata.', 'In node {n}: the Turn block has no direction (Right/Left) set.', 'في العقدة {n}: كتلة Turn لا تحتوي على اتجاه محدد (يمين/يسار).', '在节点 {n} 中：转向（Turn）方块未设置方向（右/左）。'],
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
  // WP-M6f (Ismail 2026-07-21, "rendi piu' coerente il tutorial guidato, punti giusti, ordinato
  // e che segua l'ordine (es. nella toolbar), per tutti i blocchi"): i passi della toolbar ora
  // seguono l'ORDINE REALE dei pulsanti nel DOM e li coprono tutti; i blocchi hanno un passo per
  // ogni sezione della palette, nell'ordine in cui appaiono.
  // WP-M6h/M6i (Ismail 2026-07-21): tutorial riscritto -- un passo per comando, palette che si
  // apre da sola, spiegazione dei blocchi spostata sul "?" della palette, "?" nelle impostazioni.
  tip_palette_help: ['Spiega tutti i blocchi, uno a uno', 'Explain every block, one by one', 'شرح كل الكتل، واحدة تلو الأخرى', '逐个讲解所有块'],
  tip_settings_help: ['A cosa serve ogni impostazione', 'What each setting is for', 'ما فائدة كل إعداد', '每项设置的用途'],
  tut_palette_open: ['Ecco la finestra dei blocchi: si apre cosi\', ogni volta che clicchi una freccia. Da qui scegli il blocco da inserire nel punto che hai indicato.', 'Here is the blocks window: it opens like this every time you click an arrow. From here you pick the block to insert at the point you indicated.', 'هذه نافذة الكتل: تُفتح هكذا في كل مرة تنقر فيها على سهم. من هنا تختار الكتلة المراد إدراجها في الموضع الذي حددته.', '这就是块窗口：每次点击箭头时都会这样打开。你可以从这里选择要插入到指定位置的块。'],
  tut_blocks_short: ['Ogni blocco ha una spiegazione dedicata: con questo punto di domanda te li mostro tutti, uno alla volta, con la stessa descrizione del manuale.', 'Every block has its own explanation: this question mark walks you through all of them, one at a time, with the same description as the manual.', 'لكل كتلة شرح خاص بها: علامة الاستفهام هذه تعرضها كلها، واحدة تلو الأخرى، بالوصف نفسه الموجود في الدليل.', '每个块都有自己的说明：点击这个问号可以逐个浏览全部块，说明与手册一致。'],
  tut_btn_run: ['<strong>Esegui</strong> — lancia il programma dall\'inizio alla fine. Si ferma solo su un blocco Pausa o su un errore.', '<strong>Run</strong> — runs the program from start to finish. It stops only at a Pause block or on an error.', '<strong>تشغيل</strong> — ينفّذ البرنامج من البداية إلى النهاية. ولا يتوقف إلا عند كتلة إيقاف مؤقت أو عند حدوث خطأ.', '<strong>运行</strong>——从头到尾执行程序。只有遇到暂停块或错误时才会停止。'],
  tut_btn_step: ['<strong>Passo</strong> — esegue UN blocco alla volta. E\' il modo migliore per capire cosa fa il programma: dopo ogni passo vedi i valori aggiornati nella tabella.', '<strong>Step</strong> — runs ONE block at a time. It is the best way to understand what the program does: after each step you see the updated values in the table.', '<strong>خطوة</strong> — ينفّذ كتلة واحدة في كل مرة. وهي أفضل طريقة لفهم ما يفعله البرنامج: بعد كل خطوة ترى القيم المحدَّثة في الجدول.', '<strong>单步</strong>——一次执行一个块。这是理解程序行为的最佳方式：每走一步都能在表中看到更新后的值。'],
  tut_btn_pause: ['<strong>Pausa</strong> — sospende l\'esecuzione sul blocco corrente senza perdere nulla: i valori restano, e riprendi con Esegui o Passo.', '<strong>Pause</strong> — suspends execution on the current block without losing anything: the values stay, and you resume with Run or Step.', '<strong>إيقاف مؤقت</strong> — يعلّق التنفيذ عند الكتلة الحالية دون فقدان أي شيء: تبقى القيم، وتستأنف بـ«تشغيل» أو «خطوة».', '<strong>暂停</strong>——在当前块挂起执行且不丢失任何内容：变量值保留，可用"运行"或"单步"继续。'],
  tut_btn_stop: ['<strong>Ferma</strong> — conclude l\'esecuzione e riporta le variabili ai valori dichiarati. La prossima volta si riparte dall\'inizio.', '<strong>Stop</strong> — ends the run and brings the variables back to their declared values. Next time it starts again from the beginning.', '<strong>إيقاف</strong> — ينهي التنفيذ ويعيد المتغيرات إلى قيمها المُصرَّح بها. وفي المرة القادمة يبدأ من جديد.', '<strong>停止</strong>——结束运行并把变量恢复为声明值。下次将从头开始。'],
  tut_btn_reset: ['<strong>Reset</strong> — riporta tutto allo stato iniziale: nessun blocco evidenziato, variabili ai valori dichiarati, disegno della tartaruga pulito.', '<strong>Reset</strong> — brings everything back to the initial state: no block highlighted, variables at their declared values, turtle drawing cleared.', '<strong>إعادة تعيين</strong> — يعيد كل شيء إلى الحالة الأولية: لا كتلة مُبرَزة، والمتغيرات عند قيمها المُصرَّح بها، ورسم السلحفاة ممسوح.', '<strong>重置</strong>——将一切恢复到初始状态：不高亮任何块，变量回到声明值，海龟绘图被清除。'],
  // Impostazioni, un passo per controllo.
  tut_set_lang: ['La lingua di tutta l\'app, manuale e tutorial compresi.', 'The language of the whole app, manual and tutorial included.', 'لغة التطبيق بأكمله، بما في ذلك الدليل والدليل التفاعلي.', '整个应用的语言，包括手册和教程。'],
  tut_set_theme: ['Il tema dei colori. Con l\'editor puoi crearne uno tuo: i colori scelti valgono ovunque, canvas, popup, terminale e manuale.', 'The colour theme. With the editor you can build your own: the chosen colours apply everywhere — canvas, popups, terminal and manual.', 'سمة الألوان. ويمكنك بالمحرّر إنشاء سمة خاصة بك: تُطبَّق الألوان المختارة في كل مكان — اللوحة والنوافذ والطرفية والدليل.', '配色主题。你可以用编辑器创建自己的主题：所选颜色在各处生效——画布、弹窗、终端和手册。'],
  tut_set_grid: ['Mostra una griglia sullo sfondo del canvas: aiuta ad allineare i blocchi a occhio. E\' solo visiva, non cambia il programma.', 'Shows a grid behind the canvas: it helps to align blocks by eye. It is purely visual and does not change the program.', 'تعرض شبكة خلف اللوحة: تساعد على محاذاة الكتل بالعين. وهي مرئية فقط ولا تغيّر البرنامج.', '在画布背景上显示网格：便于目测对齐块。它只是视觉效果，不会改变程序。'],
  // WP-M6j: i quattro filtri dei messaggi del terminale, prima non spiegati dal tour.
  tut_set_msg_output: ['<strong>Output</strong> — le stampe del tuo programma, cioe\' cio\' che scrivono i blocchi Uscita. Questa voce conviene tenerla sempre accesa: e\' il risultato.', '<strong>Output</strong> — your program\'s prints, i.e. whatever the Output blocks write. Best kept always on: it is the result.', '<strong>الإخراج</strong> — مطبوعات برنامجك، أي ما تكتبه كتل الإخراج. من الأفضل إبقاؤه مفعّلًا دائمًا: فهو النتيجة.', '<strong>输出</strong>——你的程序的打印内容，即输出块写出的内容。建议始终开启：这就是结果。'],
  tut_set_msg_cond: ['<strong>Esiti condizioni</strong> — per ogni If mostra se la condizione e\' risultata vera o falsa. Utile per capire perche\' il flusso ha preso un ramo invece dell\'altro.', '<strong>Condition results</strong> — for each If it shows whether the condition came out true or false. Useful to understand why the flow took one branch instead of the other.', '<strong>نتائج الشروط</strong> — يعرض لكل «إذا» ما إذا كان الشرط صحيحًا أم خاطئًا. مفيد لفهم سبب اختيار التدفق لفرع دون آخر.', '<strong>条件结果</strong>——对每个 If 显示条件为真还是为假。有助于理解流程为什么走了这个分支而不是另一个。'],
  tut_set_msg_loop: ['<strong>Esiti cicli</strong> — la stessa cosa per While, For e Do-While: a ogni giro dice se il ciclo continua o esce. Su cicli lunghi puo\' produrre molte righe: e\' la prima da spegnere se il terminale si riempie.', '<strong>Loop results</strong> — the same for While, For and Do-While: at each round it says whether the loop continues or exits. On long loops it can produce many lines: it is the first one to turn off if the terminal fills up.', '<strong>نتائج الحلقات</strong> — الأمر نفسه لـ While وFor وDo-While: يخبرك في كل دورة إن كانت الحلقة تستمر أم تخرج. وفي الحلقات الطويلة قد ينتج أسطرًا كثيرة: وهو أول ما تُطفئه إذا امتلأت الطرفية.', '<strong>循环结果</strong>——对 While、For 和 Do-While 同理：每轮告知循环是继续还是退出。长循环会产生很多行：终端刷屏时最先关掉它。'],
  tut_set_msg_debug: ['<strong>Debug</strong> — i messaggi di servizio dell\'ambiente (esecuzione avviata, terminale pulito, ecc.). Non riguardano il tuo programma: spegnili se ti distraggono.', '<strong>Debug</strong> — the environment\'s service messages (execution started, console cleared, etc.). They are not about your program: turn them off if they distract you.', '<strong>التصحيح</strong> — رسائل خدمة البيئة (بدء التنفيذ، مسح الطرفية، إلخ). لا تتعلق ببرنامجك: أطفئها إن كانت تشتّتك.', '<strong>调试</strong>——环境的服务消息（执行开始、控制台已清空等）。它们与你的程序无关：如果干扰你，可以关掉。'],
  tut_set_anim: ['Riduce le animazioni dell\'interfaccia. Utile se il computer e\' lento o se le transizioni ti danno fastidio.', 'Reduces interface animations. Useful if your computer is slow or if transitions bother you.', 'يقلّل حركات الواجهة. مفيد إذا كان جهازك بطيئًا أو إذا كانت الانتقالات تزعجك.', '减少界面动画。如果电脑较慢，或者过渡效果让你不适，可以启用。'],
  tut_set_hover: ['Evidenzia archi e blocchi al passaggio del mouse. Spegnerlo alleggerisce il disegno sui diagrammi molto grandi.', 'Highlights arrows and blocks on mouse hover. Turning it off lightens drawing on very large diagrams.', 'يُبرز الأسهم والكتل عند مرور المؤشر. وإيقافه يخفّف الرسم في المخططات الكبيرة جدًا.', '鼠标悬停时高亮箭头和块。关闭它可减轻超大图表的绘制负担。'],
  tut_set_lowres: ['Disegna il canvas a risoluzione ridotta: piu\' veloce, leggermente meno nitido. Da provare se lo scorrimento e\' a scatti.', 'Draws the canvas at reduced resolution: faster, slightly less sharp. Worth trying if scrolling stutters.', 'يرسم اللوحة بدقة مخفّضة: أسرع وأقل حدّة قليلًا. جرّبه إذا كان التمرير متقطعًا.', '以较低分辨率绘制画布：更快，略微不够清晰。如果滚动卡顿，值得一试。'],
  tut_set_conmax: ['Tiene nel terminale solo le ultime ~300 righe. Su un ciclo lungo evita che la finestra accumuli migliaia di righe e rallenti.', 'Keeps only the last ~300 lines in the terminal. On a long loop it prevents the window from piling up thousands of lines and slowing down.', 'يحتفظ في الطرفية بآخر ~300 سطر فقط. وفي الحلقات الطويلة يمنع تراكم آلاف الأسطر وتباطؤ النافذة.', '终端只保留最后约 300 行。在长循环中可避免窗口堆积上千行而变慢。'],
  tut_set_turbo: ['Solo a velocita\' Istantanea: toglie l\'evidenziazione del blocco, aggiorna la tabella piu\' di rado e lascia in console solo l\'output. Il risultato non cambia, cambia quanto vedi mentre succede.', 'Only at Instant speed: drops the block highlight, refreshes the table less often and leaves only the output in the console. The result does not change, only how much you see while it happens.', 'عند السرعة الفورية فقط: يلغي إبراز الكتلة، ويحدّث الجدول بوتيرة أقل، ويترك في الطرفية المخرجات فقط. لا تتغير النتيجة، بل مقدار ما تراه أثناء التنفيذ.', '仅在瞬时速度下生效：取消块高亮，降低表格刷新频率，控制台只保留输出。结果不变，改变的只是过程中你能看到多少。'],
  tut_set_loopguard: ['Ferma l\'esecuzione dopo 50000 passi, per non restare bloccati in un ciclo infinito. Puoi spegnerla se hai un programma che quei passi li fa davvero.', 'Stops execution after 50000 steps, so you do not get stuck in an infinite loop. You can turn it off if you have a program that legitimately needs those steps.', 'يوقف التنفيذ بعد 50000 خطوة كي لا تعلق في حلقة لانهائية. ويمكنك تعطيله إذا كان لديك برنامج يحتاج فعلًا إلى هذا العدد.', '在 50000 步后停止执行，以免陷入无限循环。如果你的程序确实需要这么多步，可以关闭它。'],
  tut_set_fps: ['Mostra i fotogrammi al secondo in basso a destra. Non accelera nulla: serve a capire se un rallentamento viene dal disegno o da altro.', 'Shows frames per second in the bottom right corner. It does not speed anything up: it helps to tell whether a slowdown comes from drawing or from something else.', 'يعرض عدد الإطارات في الثانية أسفل يمين الشاشة. لا يُسرّع شيئًا: بل يساعد على معرفة ما إذا كان البطء من الرسم أم من شيء آخر.', '在右下角显示每秒帧数。它不会加速任何东西：只是帮助判断卡顿来自绘制还是其他原因。'],
  tut_saveas:     ['Con "Salva con nome" scegli ogni volta dove salvare e con che nome: utile per tenere piu\' versioni dello stesso esercizio.', '"Save as" lets you choose the location and name every time: handy to keep several versions of the same exercise.', 'يتيح لك "حفظ باسم" اختيار المكان والاسم في كل مرة: مفيد للاحتفاظ بعدة نسخ من التمرين نفسه.', '"另存为"每次都可以选择保存位置和名称：便于为同一个练习保留多个版本。'],
  tut_undoredo:   ['Annulla e Ripeti tornano indietro (o riavanti) sulle modifiche al diagramma: inserimenti, spostamenti, cancellazioni. Da tastiera: Ctrl/Cmd+Z e Ctrl/Cmd+Y.', 'Undo and Redo step back (or forward) through diagram changes: insertions, moves, deletions. From the keyboard: Ctrl/Cmd+Z and Ctrl/Cmd+Y.', 'يتيح التراجع والإعادة الرجوع (أو التقدّم) في تغييرات المخطط: الإضافات والنقل والحذف. من لوحة المفاتيح: Ctrl/Cmd+Z و Ctrl/Cmd+Y.', '撤销和重做可以在图表修改（插入、移动、删除）之间前后切换。键盘快捷键：Ctrl/Cmd+Z 和 Ctrl/Cmd+Y。'],
  tut_execgroup:  ['Questo e\' il gruppo di esecuzione, nell\'ordine in cui lo userai: <strong>Esegui</strong> lancia tutto il programma, <strong>Passo</strong> avanza di un blocco alla volta (il modo migliore per capire cosa succede), <strong>Pausa</strong> sospende senza perdere i valori, <strong>Ferma</strong> conclude e riporta le variabili ai valori dichiarati, <strong>Reset</strong> riazzera tutto.', 'This is the execution group, in the order you will use it: <strong>Run</strong> starts the whole program, <strong>Step</strong> advances one block at a time (the best way to understand what happens), <strong>Pause</strong> suspends without losing the values, <strong>Stop</strong> ends the run and brings the variables back to their declared values, <strong>Reset</strong> clears everything.', 'هذه مجموعة التنفيذ، بالترتيب الذي ستستخدمه: <strong>تشغيل</strong> يبدأ البرنامج كاملًا، و<strong>خطوة</strong> يتقدّم كتلة واحدة في كل مرة (أفضل طريقة لفهم ما يجري)، و<strong>إيقاف مؤقت</strong> يعلّق التنفيذ دون فقدان القيم، و<strong>إيقاف</strong> ينهي التشغيل ويعيد المتغيرات إلى قيمها المُصرَّح بها، و<strong>إعادة تعيين</strong> يمسح كل شيء.', '这是执行按钮组，按你使用的顺序排列：<strong>运行</strong>启动整个程序，<strong>单步</strong>一次前进一个块（理解程序行为的最佳方式），<strong>暂停</strong>挂起但不丢失变量值，<strong>停止</strong>结束运行并把变量恢复为声明值，<strong>重置</strong>清除一切。'],
  tut_speed:      ['La velocita\' dell\'animazione. Con "Istantanea" il programma gira senza attese: e\' quella da usare sui cicli lunghi. Le altre rallentano l\'evidenziazione per farti seguire il flusso blocco per blocco.', 'The animation speed. With "Instant" the program runs with no delays: use it for long loops. The others slow the highlight down so you can follow the flow block by block.', 'سرعة الحركة. مع "فوري" يعمل البرنامج بلا انتظار: استخدمها مع الحلقات الطويلة. أما البقية فتُبطئ الإبراز لتتابع التدفق كتلة كتلة.', '动画速度。选择"瞬时"时程序不带延迟地运行：适合长循环。其他选项会放慢高亮显示，方便你逐块跟踪流程。'],
  tut_settings:   ['Le impostazioni: lingua, tema (con editor per crearne uno tuo), griglia sul canvas, messaggi del terminale e le opzioni Prestazioni, utili se il computer fatica sui programmi lunghi.', 'Settings: language, theme (with an editor to build your own), canvas grid, terminal messages and the Performance options, useful if your computer struggles with long programs.', 'الإعدادات: اللغة، والسمة (مع محرّر لإنشاء سمة خاصة بك)، وشبكة اللوحة، ورسائل الطرفية، وخيارات الأداء المفيدة إذا كان جهازك يتعثّر مع البرامج الطويلة.', '设置：语言、主题（含自建主题的编辑器）、画布网格、终端消息，以及在电脑运行长程序吃力时有用的性能选项。'],
  tut_manualbtn:  ['Il manuale completo: tutti i blocchi, la sintassi delle espressioni, le funzioni matematiche e gli errori piu\' comuni. Si apre qui dentro e segue lingua e tema che hai scelto.', 'The full manual: every block, expression syntax, math functions and the most common errors. It opens right here and follows the language and theme you picked.', 'الدليل الكامل: كل الكتل، وقواعد التعبيرات، والدوال الرياضية، وأكثر الأخطاء شيوعًا. يُفتح هنا ويتبع اللغة والسمة اللتين اخترتهما.', '完整手册：所有块、表达式语法、数学函数以及最常见的错误。它在此处打开，并跟随你选择的语言和主题。'],
  // Un passo per SEZIONE della palette, nell'ordine in cui compaiono.
  tut_pal_io:     ['<strong>Interazione</strong> — <em>Input</em> chiede un valore all\'utente e lo mette in una variabile; <em>Output</em> stampa nel terminale. Sono i due parallelogrammi: da qui entrano ed escono i dati del tuo programma.', '<strong>Interaction</strong> — <em>Input</em> asks the user for a value and stores it in a variable; <em>Output</em> prints to the terminal. They are the two parallelograms: this is where your program\'s data comes in and goes out.', '<strong>التفاعل</strong> — <em>إدخال</em> يطلب قيمة من المستخدم ويضعها في متغير؛ و<em>إخراج</em> يطبع في الطرفية. وهما متوازيا الأضلاع: من هنا تدخل بيانات برنامجك وتخرج.', '<strong>交互</strong>——<em>输入</em>向用户索取一个值并存入变量；<em>输出</em>打印到终端。它们是两个平行四边形：程序的数据由此进出。'],
  tut_pal_math:   ['<strong>Matematica</strong> — <em>Assegna</em> calcola un\'espressione e ne mette il risultato in una variabile (<code>x = a + b</code>, <code>a[i] = 0</code>). E\' il blocco che userai piu\' spesso.', '<strong>Math</strong> — <em>Assign</em> evaluates an expression and stores the result in a variable (<code>x = a + b</code>, <code>a[i] = 0</code>). It is the block you will use most often.', '<strong>الرياضيات</strong> — <em>إسناد</em> يحسب تعبيرًا ويضع نتيجته في متغير (<code>x = a + b</code>، <code>a[i] = 0</code>). وهي الكتلة التي ستستخدمها أكثر من غيرها.', '<strong>数学</strong>——<em>赋值</em>计算一个表达式并把结果存入变量（<code>x = a + b</code>、<code>a[i] = 0</code>）。这是你最常用的块。'],
  tut_pal_sel:    ['<strong>Selezione</strong> — <em>If</em> e\' il rombo: valuta una condizione e manda il flusso sul ramo Vero o su quello Falso. I due rami si ricongiungono da soli piu\' in basso.', '<strong>Selection</strong> — <em>If</em> is the diamond: it evaluates a condition and sends the flow down the True or the False branch. The two branches rejoin by themselves further down.', '<strong>الاختيار</strong> — <em>إذا</em> هو المعيّن: يقيّم شرطًا ويوجّه التدفق إلى الفرع الصحيح أو الخاطئ. ويلتقي الفرعان تلقائيًا في الأسفل.', '<strong>选择</strong>——<em>If</em> 是菱形：它判断一个条件，把流程送往"真"或"假"分支。两个分支会在下方自动汇合。'],
  tut_pal_loops:  ['<strong>Cicli</strong> — gli esagoni, nell\'ordine: <em>Do-While</em> esegue il corpo e POI verifica (quindi almeno una volta), <em>While</em> verifica prima, <em>For</em> ripete un numero di volte deciso da un contatore. Nel For i campi accettano anche variabili ed espressioni, non solo numeri.', '<strong>Loops</strong> — the hexagons, in order: <em>Do-While</em> runs the body and THEN checks (so at least once), <em>While</em> checks first, <em>For</em> repeats a number of times driven by a counter. In the For, the fields also accept variables and expressions, not just numbers.', '<strong>الحلقات</strong> — الأشكال السداسية، بالترتيب: <em>Do-While</em> ينفّذ الجسم ثم يتحقق (أي مرة واحدة على الأقل)، و<em>While</em> يتحقق أولًا، و<em>For</em> يكرّر عددًا من المرات يحدده عدّاد. وفي For تقبل الحقول متغيرات وتعبيرات أيضًا، وليس أرقامًا فقط.', '<strong>循环</strong>——六边形，按顺序：<em>Do-While</em> 先执行循环体再判断（因此至少执行一次），<em>While</em> 先判断，<em>For</em> 由计数器决定重复次数。For 的字段也接受变量和表达式，不只是数字。'],
  tut_pal_tools:  ['<strong>Strumenti</strong> — <em>Commento</em> annota il diagramma e <em>Pausa</em> funziona da breakpoint: durante un Esegui il flusso ci si ferma, e riparte con Esegui o Passo. Nessuno dei due cambia il risultato del programma.', '<strong>Tools</strong> — <em>Comment</em> annotates the diagram and <em>Pause</em> acts as a breakpoint: during a Run the flow stops there and resumes with Run or Step. Neither of them changes the program\'s result.', '<strong>الأدوات</strong> — <em>تعليق</em> يشرح المخطط، و<em>إيقاف مؤقت</em> يعمل كنقطة توقف: أثناء التشغيل يتوقف التدفق عندها ويستأنف بـ«تشغيل» أو «خطوة». ولا يغيّر أي منهما نتيجة البرنامج.', '<strong>工具</strong>——<em>注释</em>用于标注图表，<em>暂停</em>相当于断点：运行时流程会在此停下，用"运行"或"单步"继续。两者都不会改变程序结果。'],
  tut_pal_gfx:    ['<strong>Grafica tartaruga</strong> — <em>Move/Draw</em> muove la tartaruga (disegnando se la penna e\' giu\'), <em>Turn</em> la ruota, <em>Home</em> la riporta al centro, <em>Pen</em> alza/abbassa la penna e ne sceglie colore e spessore, <em>Clear</em> pulisce il disegno. Il disegno appare in un pannello a parte e resta finche\' non fermi o modifichi il programma.', '<strong>Turtle graphics</strong> — <em>Move/Draw</em> moves the turtle (drawing if the pen is down), <em>Turn</em> rotates it, <em>Home</em> brings it back to the centre, <em>Pen</em> raises/lowers the pen and picks colour and width, <em>Clear</em> wipes the drawing. The drawing appears in a separate panel and stays until you stop or change the program.', '<strong>رسوميات السلحفاة</strong> — <em>تحرّك/ارسم</em> يحرّك السلحفاة (ويرسم إذا كان القلم منخفضًا)، و<em>استدر</em> يدوّرها، و<em>المنزل</em> يعيدها إلى المركز، و<em>القلم</em> يرفع/يخفض القلم ويختار لونه وسمكه، و<em>مسح</em> يمسح الرسم. ويظهر الرسم في لوحة منفصلة ويبقى حتى توقف البرنامج أو تعدّله.', '<strong>海龟绘图</strong>——<em>移动/绘制</em>移动海龟（若画笔落下则绘制），<em>转向</em>旋转它，<em>回原点</em>让它回到中心，<em>画笔</em>抬起/落下画笔并选择颜色与粗细，<em>清除</em>擦掉图形。绘图显示在独立面板中，并会一直保留，直到你停止或修改程序。'],
  tut_blocks: ['Cliccando una freccia scegli il blocco da inserire: Interazione (Input/Output), Matematica (Assegna), Selezione (If), Cicli (While/For/Do-While), Grafica tartaruga (Move/Draw, Turn, Home, Pen, Clear) e Strumenti (Commento, Pausa). Input/Output sono parallelogrammi, Assegna un rettangolo, If un rombo, i cicli esagoni; Commento e Pausa sono marcatori non eseguibili.', 'When you click an arrow you choose the block to insert: Interaction (Input/Output), Math (Assign), Selection (If), Loops (While/For/Do-While), Turtle Graphics (Move/Draw, Turn, Home, Pen, Clear) and Tools (Comment, Pause). Input/Output are parallelograms, Assign a rectangle, If a diamond, loops are hexagons; Comment and Pause are non-executing markers.', 'عند النقر على سهم تختار الكتلة: تفاعل (إدخال/إخراج)، رياضيات (إسناد)، تحديد (إذا)، حلقات (طالما/لأجل/كرر-طالما)، رسومات السلحفاة (تحرك/ارسم، استدر، البداية، القلم، مسح) وأدوات (تعليق، إيقاف مؤقت). الإدخال/الإخراج متوازيات أضلاع، الإسناد مستطيل، إذا مُعيّن، الحلقات سداسيات؛ التعليق والإيقاف علامات غير قابلة للتنفيذ.', '点击箭头时可选择要插入的方块：交互（输入/输出）、数学（赋值）、选择（如果）、循环（While/For/Do-While）、海龟绘图（移动/绘制、转向、起点、画笔、清屏）和工具（注释、暂停）。输入/输出为平行四边形，赋值为矩形，如果为菱形，循环为六边形；注释与暂停为不执行的标记。'],
  tut_toolbar:['Questa e\' la barra degli strumenti.', 'This is the toolbar.', 'هذا شريط الأدوات.', '这是工具栏。'],
  // WP-M (Ismail 2026-07-20): il pulsante "Nuovo file" e' stato rimosso (doppione di Svuota):
  // lo step del tutorial ora punta a #clear-btn e il testo descrive Svuota.
  tut_new:    ['Svuota il canvas e riparti da un progetto nuovo.', 'Clear the canvas and start a new project.', 'امسح اللوحة وابدأ مشروعًا جديدًا.', '清空画布并开始新项目。'],
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
  tut_edit_while:['Ripete un gruppo di blocchi <strong>finche\' la condizione resta vera</strong>, controllandola <strong>prima</strong> di ogni giro: se e\' gia\' falsa all\'inizio, il corpo non viene eseguito nemmeno una volta. Usalo quando non sai in anticipo quante ripetizioni serviranno (es. <code>saldo &gt; 0</code>). Attenzione: qualcosa dentro il ciclo deve poter rendere FALSA la condizione, altrimenti non finisce piu\'. Se il numero di giri lo conosci, e\' piu\' chiaro un For; se il corpo deve girare almeno una volta, un Do-While.', 'Repeats a group of blocks <strong>while the condition stays true</strong>, checking it <strong>before</strong> each round: if it is already false at the start, the body never runs. Use it when you do not know in advance how many repetitions you need (e.g. <code>balance &gt; 0</code>). Careful: something inside the loop must be able to make the condition FALSE, otherwise it never ends. If you know the number of rounds, a For is clearer; if the body must run at least once, a Do-While.', 'يكرّر مجموعة من الكتل <strong>ما دام الشرط صحيحًا</strong>، ويتحقق منه <strong>قبل</strong> كل دورة: فإذا كان خاطئًا منذ البداية، لا يُنفَّذ الجسم ولو مرة. استخدمه عندما لا تعرف مسبقًا عدد التكرارات المطلوبة (مثل <code>الرصيد &gt; 0</code>). انتبه: يجب أن يكون في داخل الحلقة ما يجعل الشرط خاطئًا، وإلا فلن تنتهي أبدًا. وإذا كنت تعرف عدد الدورات فإن For أوضح؛ وإذا وجب تنفيذ الجسم مرة واحدة على الأقل فاستخدم Do-While.', '<strong>只要条件为真</strong>就重复执行一组块，并在每轮<strong>之前</strong>检查条件：如果一开始就为假，循环体一次也不会执行。当你事先不知道需要重复多少次时使用它（例如 <code>余额 &gt; 0</code>）。注意：循环体内必须有能让条件变为假的东西，否则永远不会结束。如果知道轮数，用 For 更清晰；如果循环体必须至少执行一次，用 Do-While。'],
  tut_edit_for:['Ripete un gruppo di blocchi un numero di volte deciso da un <strong>contatore</strong>. Non si scrive a mano: un dialog chiede la <em>variabile</em>, il valore <em>iniziale</em>, quello <em>finale</em>, la <em>direzione</em> (cresce o cala) e il <em>passo</em> — BaseFlow compone da solo l\'intestazione. I tre campi valore accettano anche variabili ed espressioni (<code>n - 1</code>, <code>a.length</code>). Usalo quando sai <strong>quante volte</strong> ripetere; se invece dipende da una condizione che cambia strada facendo, usa While.', 'Repeats a group of blocks a number of times driven by a <strong>counter</strong>. You do not write it by hand: a dialog asks for the <em>variable</em>, the <em>initial</em> and <em>final</em> values, the <em>direction</em> (up or down) and the <em>step</em> — BaseFlow builds the header for you. The three value fields also accept variables and expressions (<code>n - 1</code>, <code>a.length</code>). Use it when you know <strong>how many times</strong> to repeat; if it depends on a condition that changes as you go, use While.', 'يكرّر مجموعة من الكتل عددًا من المرات يحدده <strong>عدّاد</strong>. ولا تكتبه يدويًا: يسألك مربع حوار عن <em>المتغير</em> والقيمة <em>الأولية</em> و<em>النهائية</em> و<em>الاتجاه</em> (تصاعدي أو تنازلي) و<em>الخطوة</em> — ويؤلف BaseFlow الترويسة بنفسه. وتقبل حقول القيم الثلاثة متغيرات وتعبيرات أيضًا (<code>n - 1</code>، <code>a.length</code>). استخدمه عندما تعرف <strong>كم مرة</strong> تريد التكرار؛ أما إذا كان الأمر يعتمد على شرط يتغيّر أثناء العمل فاستخدم While.', '按<strong>计数器</strong>决定的次数重复执行一组块。不需要手写：对话框会询问<em>变量</em>、<em>初始值</em>、<em>结束值</em>、<em>方向</em>（递增或递减）和<em>步长</em>——BaseFlow 会自动组装循环头。三个值字段也接受变量和表达式（<code>n - 1</code>、<code>a.length</code>）。当你知道要重复<strong>多少次</strong>时使用它；如果次数取决于运行中变化的条件，请改用 While。'],
  tut_edit_do:['Ripete un gruppo di blocchi e controlla la condizione <strong>alla fine</strong> di ogni giro: quindi il corpo viene eseguito <strong>sempre almeno una volta</strong>, anche se la condizione e\' subito falsa. E\' la scelta giusta quando la condizione dipende da qualcosa che accade DENTRO il ciclo — il caso tipico e\' chiedere un dato all\'utente e ripetere finche\' non e\' valido: la domanda va fatta almeno una volta. Se invece la condizione va verificata PRIMA di entrare, usa While.', 'Repeats a group of blocks and checks the condition <strong>at the end</strong> of each round: so the body always runs <strong>at least once</strong>, even if the condition is false from the start. It is the right choice when the condition depends on something that happens INSIDE the loop — the typical case is asking the user for a value and repeating until it is valid: the question has to be asked at least once. If the condition must be checked BEFORE entering, use While instead.', 'يكرّر مجموعة من الكتل ويتحقق من الشرط <strong>في نهاية</strong> كل دورة: لذلك يُنفَّذ الجسم <strong>مرة واحدة على الأقل</strong> دائمًا، حتى لو كان الشرط خاطئًا منذ البداية. وهو الخيار الصحيح عندما يعتمد الشرط على شيء يحدث <strong>داخل</strong> الحلقة — والحالة النموذجية هي طلب قيمة من المستخدم وتكرار الطلب حتى تكون صالحة: فالسؤال يجب أن يُطرح مرة واحدة على الأقل. أما إذا وجب التحقق من الشرط <strong>قبل</strong> الدخول، فاستخدم While.', '重复执行一组块，并在每轮<strong>结束时</strong>检查条件：因此循环体<strong>至少执行一次</strong>，即使条件一开始就为假。当条件取决于循环<strong>内部</strong>发生的事情时，它就是正确的选择——典型场景是向用户索取一个值并不断重复直到输入合法：这个提问至少要进行一次。如果条件必须在进入<strong>之前</strong>判断，请改用 While。'],
  tut_edit_comment:['I nodi Commento sono note che non vengono eseguite: servono solo a documentare il flowchart.', 'Comment nodes are notes that are not executed: they only document the flowchart.', 'عقد التعليق ملاحظات لا تُنفّذ: فقط لتوثيق المخطط.', '注释节点是不执行的说明，仅用于记录流程图。'],
  tut_edit_pause:['E\' un <strong>punto di sospensione</strong>: durante un Esegui il flusso lo attraversa e si ferma li\', lasciando a schermo i valori di quel momento. Si riparte con Esegui o Passo. Serve a guardare com\'e\' messo il programma a meta\' strada senza doverlo eseguire tutto a velocita\' lenta — l\'equivalente di un breakpoint. Non cambia il risultato: toglierlo non altera cosa fa il programma.', 'It is a <strong>suspension point</strong>: during a Run the flow passes through it and stops there, leaving the current values on screen. You resume with Run or Step. It lets you inspect the program halfway without running the whole thing at slow speed — the equivalent of a breakpoint. It does not change the result: removing it does not alter what the program does.', 'إنها <strong>نقطة تعليق</strong>: أثناء التشغيل يمر التدفق بها ويتوقف عندها، تاركًا القيم الحالية على الشاشة. وتستأنف بـ«تشغيل» أو «خطوة». تتيح لك فحص حالة البرنامج في منتصف الطريق دون تشغيله كاملًا بسرعة بطيئة — أي ما يعادل نقطة التوقف. ولا تغيّر النتيجة: إزالتها لا تغيّر ما يفعله البرنامج.', '它是一个<strong>暂停点</strong>：运行时流程会经过它并停在那里，把当时的值留在屏幕上。用"运行"或"单步"继续。它让你在中途查看程序状态，而不必用慢速跑完整个程序——相当于断点。它不改变结果：删掉它不会改变程序的行为。'],
  tut_edit_forward:['Move/Draw (Muovi/Disegna): muove la tartaruga in avanti della distanza indicata; se la penna e\' giu\' lascia una traccia.', 'Move/Draw: moves the turtle forward by the given distance; if the pen is down it leaves a trail.', 'تحرك/ارسم: يحرك السلحفاة للأمام بالمسافة المحددة؛ إذا كان القلم منخفضًا يترك أثرًا.', '移动/绘制：使海龟按指定距离前进；若落笔则留下轨迹。'],
  tut_edit_turn:  ['Ruota (Turn): scegli Destra o Sinistra per la direzione, poi scrivi i Gradi (0-360) di rotazione. La tartaruga non si sposta: cambia solo l\'orientamento che useranno i successivi blocchi Move/Draw.', 'Turn: choose Right or Left for the direction, then enter the Degrees (0-360) to rotate. The turtle does not move; it only changes the heading used by the next Move/Draw blocks.', 'استدر: اختر يمين أو يسار للاتجاه، ثم أدخل عدد الدرجات (0-360) للدوران. السلحفاة لا تتحرك، بل يتغيّر اتجاهها فقط لتُستخدمه كتل تحرك/ارسم التالية.', '转向：选择"右"或"左"作为方向，再输入旋转的度数（0-360）。海龟本身不移动，只改变后续"移动/绘制"方块所使用的朝向。'],
  tut_edit_home:  ['Casa (Home): riporta la tartaruga al centro della tela con direzione verso l\'alto. Non ha impostazioni.', 'Home: returns the turtle to the center facing up. It has no settings.', 'البداية: تعيد السلحفاة إلى المركز متجهة للأعلى. بلا إعدادات.', '起点：将海龟移回中心并朝上。无设置。'],
  tut_edit_pen:   ['Penna (Pen): scegli Giu\' (disegna) per lasciare una traccia durante i movimenti, oppure Su (non disegna) per spostare la tartaruga senza disegnare. Colore e Spessore impostano il colore e lo spessore del tratto usato dai successivi blocchi Move/Draw (non modificano cio\' che e\' gia\' stato disegnato).', 'Pen: choose Down (draws) to leave a trail while moving, or Up (no drawing) to move the turtle without drawing. Color and Width set the stroke color and thickness used by the next Move/Draw blocks (they do not change lines already drawn).', 'القلم: اختر أسفل (يرسم) لترك أثر أثناء الحركة، أو أعلى (لا يرسم) لتحريك السلحفاة دون رسم. اللون والسُمك يحددان لون وسُمك الخط المستخدم في كتل تحرك/ارسم التالية (لا يغيّران ما تم رسمه بالفعل).', '画笔：选择"落笔（绘制）"以在移动时留下轨迹，或选择"抬笔（不绘制）"以移动海龟而不作画。颜色和粗细设置的是之后"移动/绘制"方块所用线条的颜色与粗细（不会改变已画好的线条）。'],
  tut_edit_gclear:['Pulisci (Clear): cancella il disegno e riporta la tartaruga a casa. Non ha impostazioni.', 'Clear: erases the drawing and sends the turtle home. It has no settings.', 'مسح: يمسح الرسم ويعيد السلحفاة للبداية. بلا إعدادات.', '清屏：清除绘图并让海龟归位。无设置。'],
  tut_edit_turtle:['I blocchi Grafica sono la grafica tartaruga di Flowgorithm: Move/Draw muove la tartaruga (e disegna se la penna è giù), Turn la ruota, Home la riporta al centro, Pen imposta penna/colore/spessore, Clear pulisce. Il disegno appare nella tela durante l\'esecuzione.', 'Graphics blocks are Flowgorithm turtle graphics: Move/Draw moves the turtle (drawing if the pen is down), Turn rotates it, Home returns it to center, Pen sets pen/color/width, Clear clears the screen. The drawing appears on the canvas during execution.', 'كتل الرسومات هي رسومات السلحفاة في Flowgorithm: تحرك/ارسم يحرك السلحفاة (ويرسم إذا كان القلم منخفضًا)، استدر يديرها، البداية يعيدها للمركز، القلم يضبط القلم/اللون/السمك، مسح يمسح الشاشة.', '图形块是 Flowgorithm 的海龟绘图：移动/绘制移动海龟（落笔时绘制），转向旋转它，起点回到中心，画笔设置画笔/颜色/粗细，清屏清除。执行时绘图显示在画布上。'],
  tut_edit_save:['Clicca qui per salvare le modifiche.', 'Click here to save your changes.', 'انقر هنا لحفظ التغييرات.', '点击此处保存更改。'],
  tut_edit_close:['Oppure chiudi il popup senza salvare.', 'Or close the popup without saving.', 'أو أغلق النافذة دون حفظ.', '或不保存并关闭弹窗。'],
  tut_con_intro:['Questo e\' il terminale: qui esegui il flowchart e vedi l\'output.', 'This is the terminal: here you run the flowchart and see the output.', 'هذه هي الطرفية: هنا تشغّل المخطط وترى المخرجات.', '这是终端：在此运行流程图并查看输出。'],
  tut_con_output:['Quest\'area mostra l\'output del flowchart, inclusi errori e risultati.', 'This area shows the flowchart output, including errors and results.', 'تعرض هذه المنطقة مخرجات المخطط، بما في ذلك الأخطاء والنتائج.', '此区域显示流程图输出，包括错误和结果。'],
  tut_con_input:['Se il flowchart richiede input, scrivilo qui e premi Invia (o Invio).', 'If the flowchart needs input, type it here and press Send (or Enter).', 'إذا احتاج المخطط إلى إدخال، اكتبه هنا واضغط إرسال (أو Enter).', '若流程图需要输入，在此输入并按发送（或回车）。'],
  tut_con_buttons:['Usa questi pulsanti per controllare l\'esecuzione: esegui tutto, passo-passo, reset, oppure pulisci/chiudi il terminale.', 'Use these buttons to control execution: run all, step by step, reset, or clear/close the terminal.', 'استخدم هذه الأزرار للتحكم بالتنفيذ: تشغيل الكل، خطوة بخطوة، إعادة تعيين، أو مسح/إغلاق الطرفية.', '用这些按钮控制执行：全部运行、单步、重置，或清空/关闭终端。'],
  // ---- WP-B / B1 (round 11): popup di conferma coerenti, alert()/confirm() nativi sostituiti ----
  load_invalid_title: ['File non valido', 'Invalid file', 'ملف غير صالح', '文件无效'],
  load_parse_err: ['Errore nel file JSON: {msg}', 'Error parsing JSON file: {msg}', 'خطأ في تحليل ملف JSON: {msg}', 'JSON 文件解析错误：{msg}'],
  // 2026-07-19 — formato .bflow con controllo di integrità (checksum).
  load_corrupt_title: ['File corrotto', 'Corrupted file', 'ملف تالف', '文件已损坏'],
  load_corrupt_checksum: ['Il file è danneggiato o incompleto: il controllo di integrità non corrisponde (probabile corruzione o salvataggio interrotto). Il flowchart attualmente aperto non è stato modificato.', 'The file is damaged or incomplete: the integrity check does not match (likely corruption or an interrupted save). The currently open flowchart was not changed.', 'الملف تالف أو غير مكتمل: فحص السلامة غير مطابق (على الأرجح تلف أو حفظ متوقّف). لم يتم تغيير المخطط المفتوح حاليًا.', '文件已损坏或不完整：完整性校验不匹配（可能损坏或保存中断）。当前打开的流程图未被更改。'],
  load_newer_version: ['Questo file è stato creato con una versione più recente di BaseFlow (formato v{v}) e non può essere aperto qui. Aggiorna l\'app.', 'This file was created with a newer version of BaseFlow (format v{v}) and cannot be opened here. Please update the app.', 'أُنشئ هذا الملف بإصدار أحدث من BaseFlow (تنسيق v{v}) ولا يمكن فتحه هنا. يُرجى تحديث التطبيق.', '此文件由更新版本的 BaseFlow（格式 v{v}）创建，无法在此打开。请更新应用。'],
  load_too_big: ['File troppo grande per essere un flowchart BaseFlow: caricamento rifiutato per sicurezza. Il flowchart attualmente aperto non è stato modificato.', 'File too large to be a BaseFlow flowchart: loading refused for safety. The currently open flowchart was not changed.', 'الملف كبير جدًا بحيث لا يمكن أن يكون مخطط BaseFlow: رُفض التحميل للسلامة. لم يتم تغيير المخطط المفتوح حاليًا.', '文件太大，不可能是 BaseFlow 流程图：为安全起见拒绝加载。当前打开的流程图未被更改。'],
  dup_branch_unsupported: ['I blocchi con rami (if/cicli) non sono ancora duplicabili in profondità.', 'Blocks with branches (if/loops) cannot be deep-duplicated yet.', 'لا يمكن حاليًا نسخ الكتل ذات الفروع (إذا/حلقات) نسخًا عميقًا.', '带分支的方块（如果/循环）暂不支持深度复制。'],
  export_downloaded: ['{label} scaricato come {file}!', '{label} downloaded as {file}!', 'تم تنزيل {label} باسم {file}!', '{label} 已下载为 {file}！'],
  // S9 P9.1 (round 15-B, Ismail 2026-07-15): la libreria PDF e' ora locale (js/vendor/), non
  // piu' da CDN -- il messaggio non parla piu' di "connessione a Internet" (fuorviante ora
  // che funziona offline), resta un avviso generico per il raro caso in cui lo script non
  // si carichi comunque.
  pdf_unavailable: ["PDF export non disponibile: la libreria PDF non si e' caricata correttamente.", 'PDF export unavailable: the PDF library failed to load.', 'تصدير PDF غير متاح: تعذّر تحميل مكتبة PDF بشكل صحيح.', 'PDF 导出不可用：PDF 库未能正确加载。'],
  // ---- WP-B / B3 (round 11): Salva vs Salva con nome ----
  save_as: ['Salva con nome', 'Save as', 'حفظ باسم', '另存为'],
  // ---- WP-A / A1+A4 (round 11): campo Assegna a 2 righe + newline Output ----
  assign_var_label: ['Variabile', 'Variable', 'المتغير', '变量'],
  assign_val_label: ['Valore', 'Value', 'القيمة', '值'],
  out_newline: ['A capo dopo la stampa', 'New line after printing', 'سطر جديد بعد الطباعة', '打印后换行'],
  // ---- WP-D3 (round 11): impostazioni performance ----
  perf_title:      ['Prestazioni', 'Performance', 'الأداء', '性能'],
  perf_reduce_anim:['Riduci animazioni', 'Reduce animations', 'تقليل الرسوم المتحركة', '减少动画'],
  perf_hover:      ['Evidenzia frecce al passaggio del mouse', 'Highlight arrows on hover', 'إبراز الأسهم عند المرور بالماوس', '鼠标悬停时高亮箭头'],
  // ---- WP-D1 esteso (round 11/12, Ismail 2026-07-13): messaggi runtime hardcoded ----
  // execute.js: printMessage(...) senza categoria esplicita -- va SEMPRE passata 'debug'
  // esplicitamente insieme a queste chiavi (vedi report), altrimenti classifyConsoleMsg()
  // (che riconosce il testo INGLESE originale via regex) non le classifica piu' come
  // 'debug' una volta tradotte e finiscono nella categoria 'output' (sempre visibile).
  exec_stopped:   ['Esecuzione interrotta dall\'utente.', 'Execution stopped by user.', 'تم إيقاف التنفيذ بواسطة المستخدم.', '执行已被用户停止。'],
  console_cleared:['Console pulita.', 'Console cleared.', 'تم مسح الطرفية.', '控制台已清空。'],
  exec_paused:    ['⏸ Esecuzione in pausa. Premi Esegui o Passo per continuare.', '⏸ Execution paused. Press Run or Step to continue.', '⏸ تم إيقاف التنفيذ مؤقتًا. اضغط تشغيل أو خطوة للمتابعة.', '⏸ 执行已暂停。按运行或单步继续。'],
  exec_breakpoint:['⏸ Breakpoint (Pausa). Premi Esegui o Passo per continuare.', '⏸ Breakpoint (Pause). Press Run or Step to continue.', '⏸ نقطة توقف (إيقاف مؤقت). اضغط تشغيل أو خطوة للمتابعة.', '⏸ 断点（暂停）。按运行或单步继续。'],
  flow_reset:     ['Flusso reimpostato. Pronto per una nuova esecuzione.', 'Flow reset. Ready to execute again.', 'تمت إعادة تعيين المخطط. جاهز لتنفيذ جديد.', '流程已重置，可以重新执行。'],
  // variables.js: errori di validazione riga variabile.
  var_err_int:    ['Il valore deve essere un intero valido.', 'The value must be a valid integer.', 'يجب أن تكون القيمة عددًا صحيحًا صالحًا.', '该值必须是有效的整数。'],
  var_err_float:  ['Il valore deve essere un numero decimale valido.', 'The value must be a valid decimal number.', 'يجب أن تكون القيمة رقمًا عشريًا صالحًا.', '该值必须是有效的小数。'],
  var_err_bool:   ['Il valore deve essere true o false.', 'The value must be true or false.', 'يجب أن تكون القيمة true أو false.', '该值必须是 true 或 false。'],
  var_err_name:   ['Nome variabile non valido (deve iniziare con una lettera e contenere solo lettere e numeri).', 'Invalid variable name (it must start with a letter and contain only letters and numbers).', 'اسم متغير غير صالح (يجب أن يبدأ بحرف ويحتوي فقط على أحرف وأرقام).', '变量名无效（必须以字母开头，且只能包含字母和数字）。'],
  var_err_invalid_data: ['Dati non validi.', 'Invalid data.', 'بيانات غير صالحة.', '数据无效。'],
  // interaction.js: feedback copia/incolla (_clipMsg, categoria 'debug' gia' di default).
  clip_start_end_uncopyable: ['Start/End non si copiano.', 'Start/End cannot be copied.', 'لا يمكن نسخ عقدتي البداية/النهاية.', '开始/结束节点无法复制。'],
  clip_copied:    ['Copiato: {type}', 'Copied: {type}', 'تم النسخ: {type}', '已复制：{type}'],
  clip_copy_struct_err: ['Copia: struttura del blocco non riconosciuta.', 'Copy: block structure not recognized.', 'نسخ: بنية الكتلة غير معروفة.', '复制：无法识别方块结构。'],
  clip_copy_ext_err: ['Copia: il blocco ha collegamenti esterni non gestiti.', 'Copy: the block has unhandled external links.', 'نسخ: الكتلة تحتوي على روابط خارجية غير مدعومة.', '复制：该方块存在未处理的外部连接。'],
  clip_copied_block: ['Copiato blocco {type} ({n} nodi)', 'Copied block {type} ({n} nodes)', 'تم نسخ كتلة {type} ({n} عقدة)', '已复制 {type} 方块（{n} 个节点）'],
  clip_group_none_selected: ['Copia selezione: nessun blocco selezionato.', 'Copy selection: no block selected.', 'نسخ التحديد: لم يتم تحديد أي كتلة.', '复制所选：未选择任何方块。'],
  clip_group_noncontig: ['Copia: la selezione non e\' un blocco contiguo.', 'Copy: the selection is not a contiguous block.', 'نسخ: التحديد ليس كتلة متجاورة.', '复制：所选内容不是连续的方块。'],
  clip_group_ext_err: ['Copia: il gruppo ha collegamenti esterni non gestiti.', 'Copy: the group has unhandled external links.', 'نسخ: المجموعة تحتوي على روابط خارجية غير مدعومة.', '复制：该组存在未处理的外部连接。'],
  clip_copied_group: ['Copiata selezione ({units} unita\', {n} nodi)', 'Copied selection ({units} units, {n} nodes)', 'تم نسخ التحديد ({units} وحدة، {n} عقدة)', '已复制所选（{units} 个单元，{n} 个节点）'],
  clip_empty:     ['Niente da incollare.', 'Nothing to paste.', 'لا يوجد شيء للصق.', '没有可粘贴的内容。'],
  clip_select_target: ['Seleziona un arco/blocco dove incollare.', 'Select an arrow/block where to paste.', 'حدد سهمًا/كتلة للصق فيها.', '请选择要粘贴到的箭头/方块。'],
  clip_paste_root_fail: ['Incolla: inserimento della radice fallito.', 'Paste: root insertion failed.', 'لصق: فشل إدراج الجذر.', '粘贴：根节点插入失败。'],
  clip_paste_group_fail: ['Incolla: inserimento del gruppo fallito.', 'Paste: group insertion failed.', 'لصق: فشل إدراج المجموعة.', '粘贴：组插入失败。'],
  clip_select_after: ['Seleziona un blocco dopo cui incollare.', 'Select a block after which to paste.', 'حدد كتلة تريد اللصق بعدها.', '请选择要在其后粘贴的方块。'],
  clip_paste_impossible: ['Impossibile incollare qui.', 'Cannot paste here.', 'لا يمكن اللصق هنا.', '无法粘贴到此处。'],
  // popups.js: placeholder di sintassi nel campo For (edit rapido testuale).
  for_edit_ph:    ['es. i=0;i<10;i++', 'e.g. i=0;i<10;i++', 'مثال: i=0;i<10;i++', '例：i=0;i<10;i++'],
  // exportUnified.js: avviso blocchi non validi + placeholder flowchart vuoto + istruzioni PDF.
  export_invalid_warn: ['{n} blocco/i con contenuto non valido ({list}): il codice potrebbe essere incompleto.', '{n} block(s) with invalid content ({list}): the generated code might be incomplete.', '{n} كتلة/كتل تحتوي محتوى غير صالح ({list}): قد يكون الكود الناتج غير مكتمل.', '{n} 个方块内容无效（{list}）：生成的代码可能不完整。'],
  export_empty:   ['Flowchart vuoto', 'Empty flowchart', 'مخطط فارغ', '空流程图'],
  pdf_instructions: ['Esportazione PDF: clicca "{btn}" per salvare il diagramma come PDF di una pagina (ritagliato al contenuto).', 'PDF export: click "{btn}" to save the diagram as a one-page PDF (cropped to content).', 'تصدير PDF: انقر على "{btn}" لحفظ المخطط كملف PDF من صفحة واحدة (مقصوص حسب المحتوى).', 'PDF 导出：点击"{btn}"将图表保存为单页 PDF（按内容裁剪）。'],
  // WP-D7 (round 15-D, Ismail 2026-07-17): avviso per grafi molto grandi nell'export immagine/PDF
  // (ora ad alta risoluzione, vedi renderCroppedCanvas -- un grafo enorme puo' produrre un file pesante/lento).
  export_large_warn: ['Il grafo è molto grande: l\'export ad alta risoluzione potrebbe essere lento o produrre un file pesante.', 'The diagram is very large: high-resolution export might be slow or produce a heavy file.', 'المخطط كبير جدًا: قد يكون التصدير بدقة عالية بطيئًا أو ينتج ملفًا كبير الحجم.', '图表非常大：高分辨率导出可能会很慢或生成较大的文件。'],
  // R13-K (Ismail 2026-07-12): manual_link (WP-D5) rimossa -- il manuale non e' piu' un link
  // nel footer (vedi la nuova chiave "manual", pulsante libro in toolbar, sopra nel file).
  // ---- S3 P8.4 (round 15-B, Ismail 2026-07-15): etichette V/F/Prossimo/Fatto degli archi
  // IF/ciclo (prima "True"/"False"/"Next"/"Done" hard-coded in rendering.js, mai tradotte),
  // messaggio iniziale della console, testi statici del footer -- ora tradotti come il resto.
  label_true:     ['Vero', 'True', 'صحيح', '真'],
  label_false:    ['Falso', 'False', 'خطأ', '假'],
  label_next:     ['Prossimo', 'Next', 'التالي', '下一步'],
  label_done:     ['Fatto', 'Done', 'تم', '完成'],
  console_ready:  ['> Console pronta...', '> Console ready...', '> الطرفية جاهزة...', '> 控制台就绪...'],
  footer_credits: ['Creato da Matteo Artifoni e Ismail Barakat | Progetto educativo open source.', 'Created by Matteo Artifoni and Ismail Barakat | Open source educational project.', 'من إنشاء Matteo Artifoni وIsmail Barakat | مشروع تعليمي مفتوح المصدر.', '由 Matteo Artifoni 和 Ismail Barakat 创建 | 开源教育项目。'],
  footer_thanks_pre: ['Grazie a', 'Thanks to', 'شكرًا لـ', '感谢'],
  footer_thanks_post: ['e alle altre librerie open source.', 'and other open source libraries.', 'وباقي المكتبات مفتوحة المصدر.', '以及其他开源库。'],
  footer_privacy: ['Informativa sulla privacy', 'Privacy Policy', 'سياسة الخصوصية', '隐私政策'],
  footer_cookie:  ['Informativa sui cookie', 'Cookie Policy', 'سياسة ملفات تعريف الارتباط', 'Cookie 政策'],
  footer_portfolio: ['Portfolio', 'Portfolio', 'السيرة الذاتية', '作品集'],
  // ---- S3 P3.2 (round 15-B, Ismail 2026-07-15): revisione testi err_* NON di competenza di
  // Fable (che possiede err_div_zero/err_type_mismatch, casi gravi round 15 WP-2) -- testi
  // resi meno tecnici (es. "identificatore non permesso" instradato da _evalErrMsg su
  // err_not_declared_node ora dice chiaramente "la variabile ... non e' stata dichiarata"),
  // placeholder {n}/{v}/{e} invariati (usati da execute.js/errMsg, non toccati).
  err_not_declared_node: ['Nel nodo {n}: la variabile "{v}" non è stata dichiarata.', 'In node {n}: the variable "{v}" has not been declared.', 'في العقدة {n}: المتغيّر "{v}" لم يتم تعريفه.', '在节点 {n} 中：变量 "{v}" 尚未声明。'],
  err_uninit_var: ['Nel nodo {n}: la variabile "{v}" non è stata inizializzata (nessun valore assegnato).', 'In node {n}: the variable "{v}" has not been initialized (no value assigned).', 'في العقدة {n}: المتغيّر "{v}" لم تتم تهيئته (لم يتم إسناد قيمة).', '在节点 {n} 中：变量 "{v}" 尚未初始化（未赋值）。'],
  err_not_declared: ['La variabile "{v}" non è stata dichiarata.', 'The variable "{v}" has not been declared.', 'المتغيّر "{v}" لم يتم تعريفه.', '变量 "{v}" 尚未声明。'],
  err_var_not_declared: ["Impossibile leggere l'input: la variabile \"{v}\" non è stata dichiarata.", 'Cannot read input: the variable "{v}" has not been declared.', 'تعذّرت قراءة الإدخال: المتغيّر "{v}" لم يتم تعريفه.', '无法读取输入：变量 "{v}" 尚未声明。'],
  err_empty_node: ['Il nodo {n} è vuoto: inserisci il contenuto prima di eseguire.', 'Node {n} is empty: fill it in before running.', 'العقدة {n} فارغة: أدخل محتواها قبل التنفيذ.', '节点 {n} 为空：请先填写内容再执行。'],
  err_for_syntax: ['Il ciclo Per non è scritto correttamente: {e}', 'The For loop is not written correctly: {e}', 'حلقة "لأجل" غير مكتوبة بشكل صحيح: {e}', 'For 循环写法不正确：{e}'],
  err_for_init: ["L'inizializzazione del ciclo Per non è valida: {e}", "The For loop's initialization is not valid: {e}", 'تهيئة حلقة "لأجل" غير صالحة: {e}', 'For 循环的初始化无效：{e}'],
  err_for_init_expr: ["Nel nodo {n}: l'espressione di inizializzazione del ciclo Per non è valida: {e}", 'In node {n}: the For loop initialization expression is not valid: {e}', 'في العقدة {n}: تعبير تهيئة حلقة "لأجل" غير صالح: {e}', '在节点 {n} 中：For 循环的初始化表达式无效：{e}'],
  err_invalid_expr: ['Nel nodo {n}: espressione non valida: {e}', 'In node {n}: invalid expression: {e}', 'في العقدة {n}: تعبير غير صالح: {e}', '在节点 {n} 中：表达式无效：{e}'],
  err_incr_expr: ["Nel nodo {n}: l'espressione di incremento non è valida: {e}", 'In node {n}: the increment expression is not valid: {e}', 'في العقدة {n}: تعبير الزيادة غير صالح: {e}', '在节点 {n} 中：递增表达式无效：{e}']
};

function i18nText(key) {
  const idx = I18N_LANGS.indexOf(currentLang);
  const entry = I18N[key];
  if (!entry) return null;
  return entry[idx >= 0 ? idx : 0];
}

// Come i18nText, ma sostituisce i placeholder {nome} nel testo risolto con i valori
// dell'oggetto `params` (es. i18nFormat('err_div_zero', {n: 3}) -> "Nel nodo 3: ...").
function i18nFormat(key, params) {
  let s = i18nText(key);
  if (s === null || s === undefined) return null;
  if (params) {
    Object.keys(params).forEach(function (k) {
      s = s.split('{' + k + '}').join(params[k]);
    });
  }
  return s;
}

// Alias semantico di i18nFormat usato dai messaggi di errore runtime (execute.js/
// throwError): stesso meccanismo, fallback sulla chiave stessa se la traduzione manca
// (mai una stringa vuota/undefined mostrata in un popup di errore).
function errMsg(key, params) {
  // Ismail 2026-07-17: registra l'ultima chiave/params dell'errore, cosi' throwError() (execute.js)
  // puo' salvarli sull'elemento e retranslateConsole() ri-tradurre l'errore al cambio lingua.
  try { if (typeof window !== 'undefined') window._bfLastErrInfo = { key: key, params: params || {} }; } catch (e) {}
  return i18nFormat(key, params) || key;
}

// RECOVERY NOTE (Ismail 2026-07-15, round 15-B S3): applyLanguage/setLanguage/
// loadLanguagePreference sono state ricostruite dopo un troncamento accidentale del file
// durante un edit di S3 (il resto del file, incluso l'intero oggetto I18N, non e' stato
// toccato). Comportamento verificato contro tools/i18n-audit.js (smoke test
// runApplyLanguageSmoke) e tutti i call-site nel resto del codebase: data-i18n/-ph/-title
// (applyLanguage sostituisce testo/placeholder/title), setLanguage(this.value) inline in
// index.html (#lang-select), sync di #lang-select in settings.js/openSettingsPopup,
// R14-E _bfSidebarLiveResizeTick (init.js riga 9, applyLanguage elencata esplicitamente
// tra le sorgenti che devono passare dal tick condiviso invece di updateZoomOffset/
// centerGraph diretti), loadLanguagePreference chiamata da init.js/window.onload.
function applyLanguage(lang) {
  currentLang = lang;
  try { localStorage.setItem(I18N_STORAGE_KEY, lang); } catch (e) {}
  document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  document.documentElement.setAttribute('lang', lang);
  const ls = document.getElementById('lang-select');
  if (ls) ls.value = lang;

  document.querySelectorAll('[data-i18n]').forEach(function (el) {
    const t = i18nText(el.getAttribute('data-i18n'));
    if (t !== null && t !== undefined) el.textContent = t;
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
    const t = i18nText(el.getAttribute('data-i18n-ph'));
    if (t !== null && t !== undefined) el.setAttribute('placeholder', t);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
    const t = i18nText(el.getAttribute('data-i18n-title'));
    if (t !== null && t !== undefined) el.setAttribute('title', t);
  });

  // Ismail 2026-07-17: il TIPO delle variabili (select nella tabella Variabili) e' etichettato
  // via _varTypeLabel()/updateVarTypeOptions() (variables.js), NON via data-i18n -> al cambio
  // lingua NON veniva ri-etichettato, quindi le variabili gia' presenti restavano nella lingua
  // precedente finche' non si ri-selezionava il tipo (che richiama updateVarTypeOptions). Qui lo
  // si richiama esplicitamente cosi' i tipi seguono subito la nuova lingua.
  if (typeof updateVarTypeOptions === 'function') { try { updateVarTypeOptions(); } catch (e) {} }

  // Ismail 2026-07-20: stesso discorso per le <option> Vero/Falso della select-valore delle
  // variabili Boolean (variables.js, updateBoolValueOptions/_boolValueLabel) — non passano da
  // data-i18n, quindi vanno ri-etichettate esplicitamente al cambio lingua.
  if (typeof updateBoolValueOptions === 'function') { try { updateBoolValueOptions(); } catch (e) {} }

  // Ismail 2026-07-17: ri-traduce anche il TERMINALE gia' stampato (righe runtime con key/params
  // salvati da _termMsg/printMessage in execute.js) -> cambiando lingua a run/pausa/finito anche
  // le righe vecchie passano alla nuova lingua, non solo quelle nuove.
  if (typeof retranslateConsole === 'function') { try { retranslateConsole(); } catch (e) {} }

  // WP-M (Ismail 2026-07-20): l'etichetta del pulsante More/Show-less della header mobile
  // non passa da data-i18n (testo dinamico a due stati) -- ri-etichettata esplicitamente.
  if (typeof window !== 'undefined' && typeof window._bfRefreshMoreLabel === 'function') { try { window._bfRefreshMoreLabel(); } catch (e) {} }

  // Ridisegna il canvas: etichette nodi (nodeDisplayLabel, state.js) e le label V/F/
  // Prossimo/Fatto degli archi IF/ciclo (S3 P8.4, rendering.js) seguono la lingua attiva.
  if (typeof draw === 'function' && typeof nodi !== 'undefined') draw(nodi);

  // R14-E: tick condiviso invece di updateZoomOffset()/centerGraph() diretti -- il cambio
  // lingua puo' cambiare la direzione RTL/LTR e quindi lo spazio disponibile per il
  // canvas. Stesso pattern/fallback di run()/closeConsole() (execute.js) e
  // toggleVariables() (variables.js).
  if (typeof _bfSidebarLiveResizeTick === 'function') {
    _bfSidebarLiveResizeTick();
    setTimeout(_bfSidebarLiveResizeTick, 240);
  } else if (typeof window !== 'undefined') {
    if (typeof window.syncLayoutVars === 'function') window.syncLayoutVars();
    if (typeof updateZoomOffset === 'function') updateZoomOffset();
    if (typeof centerGraph === 'function') centerGraph();
  }

  // WP-N9-bis (Ismail 2026-07-17): la maniglia di resize della barra Variabili restava nella
  // posizione LTR dopo il passaggio ad ARABO finche' non la si toccava. La logica di place() e'
  // corretta (toccandola si sistema): il problema e' il TIMING -- il tick condiviso e' DEBOUNCED
  // (_bfSidebarRafPending, puo' venire "inghiottito") e puo' girare PRIMA che il flip LTR<->RTL
  // della griglia #main si sia assestato nel layout. Qui si richiama place() DIRETTAMENTE (fuori
  // dal debounce) dopo che il layout della nuova direzione e' assestato: doppio rAF (post-layout)
  // + due ritardi di sicurezza. Cosi' la maniglia segue subito il cambio di direzione, sempre.
  if (typeof window !== 'undefined' && typeof window._bfPlaceSidebarHandle === 'function') {
    var _bfPlaceHandleSafe = function () { try { window._bfPlaceSidebarHandle(); } catch (e) {} };
    var _raf = window.requestAnimationFrame || function (fn) { return setTimeout(fn, 16); };
    _raf(function () { _raf(_bfPlaceHandleSafe); }); // dopo 2 frame = layout della nuova direzione assestato
    setTimeout(_bfPlaceHandleSafe, 120);
    setTimeout(_bfPlaceHandleSafe, 360);
  }
}

function setLanguage(lang) { applyLanguage(lang); }

// Chiamata da js/core/init.js (window.onload) per applicare la lingua salvata (o 'it' di
// default) prima del primo draw.
function loadLanguagePreference() {
  let lang = currentLang;
  try {
    const saved = localStorage.getItem(I18N_STORAGE_KEY);
    if (saved && I18N_LANGS.indexOf(saved) !== -1) lang = saved;
  } catch (e) {}
  applyLanguage(lang);
}
