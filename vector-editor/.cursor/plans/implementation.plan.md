# План імплементації vector-editor

Редактор — локальний SPA інтегрований в VSCode як розширення для SVG, у якому документ є кривими Безьє, а оболонка працює як у Blender: режими Object і Edit, Outliner, стек модифікаторів і одна шина команд для кнопок і shortcuts. Репозиторій зараз порожній: `App` лише вставляє `router-outlet`, `routes` порожній, `app.config.ts` підключає router і глобальні обробники помилок, залежності — Angular 22.1, `@angular/cdk`, Router і Vitest. Сесія і документ лежать у signals; evaluated-геометрія є `computed()` від джерельного шляху і стека; панелі цей стан тільки читають. MVP закриває відкриття і збереження `.svg`, pan/zoom, виділення і переміщення об’єктів, правку якорів і handles, перо, шари, суцільний колір і чотири неруйнівні модифікатори. Текст, градієнтні сітки, 3D, спільне редагування і mesh-геометрія в цей обсяг не входять. Нижче зафіксована модель, команди, екран і фази; наприкінці — чотири рішення, які варто підтвердити до коду.

## Цілі MVP і те, що йде після

MVP вважається готовим, коли в браузері можна:

- створити документ, відкрити `.svg` і зберегти його назад одним файлом;
- панорамувати і масштабувати полотно;
- в Object Mode виділити об’єкти і змінити їхній transform;
- в Edit Mode виділити якорі та сегменти, рухати якір і handles;
- намалювати шлях пером;
- задати суцільні fill і stroke, зібрати шари, ховати і блокувати об’єкти;
- накласти array, mirror, bevel і boolean, змінити порядок стека і зробити Apply;
- скасувати і повторити ці дії з панелі History і з клавіатури;
- дістатись виділення з клавіатури через Outliner, з видимим фокусом.

Після MVP: інструменти фігур Illustrator (rectangle, ellipse, polygon, star, line), curvature і anchor-point (convert), scissors, join, smooth, pencil, eraser, shape builder, rotate/reflect/shear як окремі інструменти, snapping і напрямні, градієнти, текст, сітки, символи, clipping і mask, кілька артбордів, хмара і спільне редагування, 3D. Окремого mesh з vertex, edge і face в моделі не з’являється.

## Глосарій

| Термін Blender або Illustrator | Термін у продукті | Поле в моделі |
| --- | --- | --- |
| Artboard | Документ | `Document` |
| Layer | Шар | `Layer` |
| Path / object | Векторний об’єкт | `VectorObject` |
| Anchor point | Якір | `Anchor.position` |
| Direction handle (in / out) | Handle in / handle out | `Anchor.handleIn`, `Anchor.handleOut` |
| Path segment (line або cubic) | Сегмент | `Segment.kind`: `line` \| `cubic` |
| Object Mode | Object Mode | `Session.mode = 'object'` |
| Edit Mode | Edit Mode | `Session.mode = 'edit'` |
| Active object | Активний об’єкт | `Session.activeObjectId` |
| Vertex select / edge select | Виділення якорів / сегментів | `Session.editSelectionKind`, `selectedAnchorIds`, `selectedSegmentIds` |
| Modifier stack | Стек модифікаторів | `VectorObject.modifiers` |
| Evaluated result | Обчислений шлях | `EvaluatedGeometry` (`computed`) |
| Apply | Apply | команда `modifier.apply` |
| Outliner | Outliner / Layers | дерево `Layer` + `VectorObject` |
| Fill / stroke | Колір | `Style` |
| Swatches | Color Collections | `Document.swatches` |
| Undo stack | History | `History.entries`, `History.index` |
| Keymap | Shortcuts | `ShortcutMap` → ті самі команди |

У UI «вершина» означає якір. Окремого типу Vertex у моделі немає.

## Типи документа

Імена нижче — контракт моделі. Оновлення тільки заміною значення (`set` / `update` новим об’єктом).

`Document`: `id`, `name`, `viewBox` (початково `0 0 1200 800`), `layers`, `objects`, `swatches`.

`Layer`: `id`, `name`, `visible`, `locked`, `order`.

`VectorObject`: `id`, `name`, `layerId`, `visible`, `locked`, `source`, `style`, `transform`, `modifiers`.

`ObjectTransform`: `x`, `y`, `rotation`, `scaleX`, `scaleY`. Transform належить об’єкту і в стек модифікаторів не входить.

`Style`: `fill` (`string | null`), `stroke` (`string | null`), `strokeWidth`, `fillRule` (`nonzero` | `evenodd`). Суцільний колір. `evenodd` потрібен діркам після boolean.

`SourcePath`: `{ subpaths: readonly Subpath[] }`.

`Subpath`: `closed`, `anchors`, `segments`.

`Anchor`: `id`, `position`, `handleIn | null`, `handleOut | null`. Координати handles абсолютні в локальному просторі об’єкта, як контрольні точки SVG `C`.

`Segment`: `id`, `kind: 'line' | 'cubic'`, `fromId`, `toId`. У cubic криву задають `handleOut` початку і `handleIn` кінця. Якщо handle відсутній, контрольна точка збігається з якорем. Замкнений підшлях має сегмент з останнього якоря в перший.

`Modifier` (дискримінант `type`):

- `array`: `count`, `offsetX`, `offsetY`, `enabled`
- `mirror`: `axis: 'x' | 'y' | 'xy'`, `enabled` (вісь через центр bounds входу на цьому кроці стека)
- `bevel`: `distance`, `join: 'bevel' | 'miter' | 'round'`, `miterLimit`, `enabled`
- `boolean`: `operation: 'union' | 'difference' | 'intersect'`, `operandId`, `enabled`

`EvaluatedGeometry`: `{ objectId, subpaths, diagnostics }`. Це похідне значення, у `Document` не записується. `diagnostics` — текст помилки модифікатора для панелі (відкритий шлях у boolean, цикл operand, зниклий operand).

`Swatch`: `id`, `name`, `color`.

`Session`: `document`, `viewport` (`panX`, `panY`, `zoom`), `mode`, `tool`, `editSelectionKind` (`anchor` | `segment`), `activeObjectId`, `selectedObjectIds`, `selectedAnchorIds`, `selectedSegmentIds`, `history`, `gesture` (`null` або тимчасовий жест до `pointerup`).

## Межа Core / UI

Єдиний маршрут `''` ліниво вантажить сторінку редактора. Стан сесії один, у `@Service`-singleton. Панелі і viewport отримують його через `inject()` і читають signals. Похідні речі (`EvaluatedGeometry`, списки для Outliner, підписи History) — `computed()`. Поля Options, які мають триматися купи з поточним виділенням, — `linkedSignal()`. Чернетка числового поля живе у формі Signal Forms; у документ вона потрапляє командою на blur або Enter.

Будь-яка зміна документа, режиму і виділення — це команда. Обробник чистий: попередній зріз стану замінюється новим. Жест перетягування оновлює документ на кожен рух, але в History лягає одним записом: перша команда жесту відкриває запис, наступні до `pointerup` замінюють його кінцевий знімок.

| Команда | Payload | Що замінює | Запис у History |
| --- | --- | --- | --- |
| `session.setMode` | `mode` | режим; при вході в Edit лишає `activeObjectId`, скидає виділення якорів; при виході скидає якір і сегмент | так |
| `session.setTool` | `tool` | активний інструмент | ні |
| `session.setEditSelectionKind` | `anchor` \| `segment` | фільтр виділення в Edit | ні |
| `session.setViewport` | `panX`, `panY`, `zoom` | viewport | ні |
| `session.select` | `target`, `ids`, `op: replace \| add \| toggle \| clear` | виділення і за потреби `activeObjectId` | так |
| `document.new` | — | новий `Document` 1200×800, один шар | так |
| `document.replace` | `Document` | увесь документ після імпорту | так |
| `object.translate` | `ids`, `dx`, `dy` | `transform` об’єктів | так, злиття жесту |
| `object.setTransform` | `id`, `transform` | transform одного об’єкта з Options | так |
| `object.rotate` | `ids`, `deltaDeg` | `rotation` | так, злиття жесту |
| `object.scale` | `ids`, `factor` | `scaleX`, `scaleY` | так, злиття жесту |
| `object.delete` | `ids` | об’єкти і посилання boolean на них | так |
| `object.duplicate` | `ids` | копії з новими id | так |
| `object.setFlags` | `id`, `name?`, `visible?`, `locked?` | метадані об’єкта | так |
| `object.reorder` | `id`, `layerId`, `index` | шар і порядок | так |
| `path.translateAnchors` | `objectId`, `anchorIds`, `dx`, `dy` | `source` | так, злиття жесту |
| `path.setAnchor` | `objectId`, `anchorId`, `position` | один якір | так |
| `path.setHandle` | `objectId`, `anchorId`, `slot: in \| out`, `position`, `breakLink` | handle; без `breakLink` протилежний handle дзеркалиться | так, злиття жесту |
| `path.setSegmentKind` | `objectId`, `segmentId`, `kind` | сегмент; у `cubic` handles за замовчуванням на третинах | так |
| `path.deleteAnchors` | `objectId`, `anchorIds` | якорі і суміжні сегменти | так |
| `path.insertAnchorOnSegment` | `objectId`, `segmentId`, `t` | новий якір на сегменті | так |
| `pen.begin` | `position` | новий об’єкт, перший якір, перехід в Edit, інструмент лишається pen | так |
| `pen.addPoint` | `objectId`, `position`, `handleOut` | якір і сегмент від попереднього | так |
| `pen.finish` | `objectId`, `closed` | прапор `closed` підшляху | так |
| `style.set` | `objectIds`, частковий `Style` | стиль | так |
| `swatch.add` | `name`, `color` | `Document.swatches` | так |
| `swatch.apply` | `swatchId`, `fill` \| `stroke`, `objectIds` | стиль через той самий ефект, що `style.set` | так |
| `modifier.add` | `objectId`, `type` | новий модифікатор у кінці стека | так |
| `modifier.update` | `objectId`, `modifierId`, patch | параметри або `enabled` | так |
| `modifier.remove` | `objectId`, `modifierId` | стек | так |
| `modifier.reorder` | `objectId`, `modifierId`, `index` | порядок стека | так |
| `modifier.apply` | `objectId`, `modifierId` | `source` стає evaluated префікса стека до цього модифікатора включно; цей префікс зникає зі стека | так |
| `modifier.applyAll` | `objectId` | `source` стає повним evaluated, стек порожній | так |
| `layer.add` | `name` | шари | так |
| `layer.update` | `id`, `name?`, `visible?`, `locked?` | шар | так |
| `layer.reorder` | `id`, `index` | порядок шарів | так |
| `history.undo` | — | індекс і відновлений знімок | ні |
| `history.redo` | — | індекс і відновлений знімок | ні |
| `history.jump` | `index` | стрибок по знімках | ні |

`file.open` і `file.save` командами документа не є. UI читає файл, парсер будує `Document`, далі йде `document.replace`. Збереження читає поточний стан і віддає Blob.

Потік undo: обробник кладе знімок `{ document, mode, selection }` і людську мітку команди. `history.undo` / `redo` / `jump` підставляють знімок у signals сесії. Viewport, інструмент і `editSelectionKind` у знімок не входять. `EvaluatedGeometry` у знімок не входить: після відновлення `computed()` рахує її знову.

## Хто рахує evaluated path

Функції в `core/eval` чисті. Сервіс сесії віддає на кожен `objectId` свій `computed()`. Залежності: `source`, `transform`, `modifiers` цього об’єкта і, для boolean, evaluated operand.

Порядок на об’єкті:

1. Вхід — `source` у локальному просторі.
2. Модифікатори з індексу 0 до кінця. У списку верхній застосований першим, як у Blender.
3. Потім `transform` у простір документа, якщо на стеку немає boolean. Boolean сам переводить обидві сторони в простір документа (див. нижче), і подальший transform хазяїна до результату вже не додається: він увійшов у операнди.

Array і mirror рахує власний код, без бібліотеки. Вони копіюють підшляхи і переносять якорі та handles, тож кубічні сегменти зберігаються.

Boolean і bevel рахує одна бібліотека: `clipper2-ts` (TypeScript-порт Clipper2, ліцензія BSL-1.0). Вона дає `union`, `difference`, `intersect` і `inflatePaths` з `JoinType` Bevel, Miter і Round. Власний boolean по кривих у MVP не пишемо: перетини кубічних, дірки і самоперетини — окремий проєкт. Clipper працює на ламаних, тому крок `flatten` ріже кубічні адаптивно, поки відхилення більше за 0.25 одиниці документа, множить координати на 1000 (внутрішня ціла сітка Clipper) і після операції ділить назад. Результат цього кроку — підшляхи з сегментів `line`. Усе, що в стеку стоїть вище bevel або boolean, уже бачить ламану. Те, що нижче, ще може бути кривими. Apply записує в `source` саме цю ламану.

Boolean бере evaluated operand (його повний стек і його transform) і поточний результат хазяїна, обидва в просторі документа. Дірки лишаються підшляхами того самого об’єкта; `fillRule` результату — `evenodd`. Цикл A→B→A, відсутній operand і operand, що збігається з хазяїном, не змінюють геометрію цього кроку і пишуть `diagnostics`.

Інвалідація окремим прапорцем не робиться: зміна прочитаних signals перераховує `computed()`. Важка частина (bevel, boolean) під час жесту не ганяється на кожен `pointermove`: до `pointerup` лишається попередній evaluated цих модифікаторів, array і mirror оновлюються одразу. Це відкрите рішення 4.

## Макет екрана

Верхня смуга: New, Open, Save, індикатор режиму, Undo, Redo. Ліва вузька колонка: Select, Direct select, Pen. Центр: viewport, один tab stop. Права колонка: sidenav у такому порядку секцій. Ліва колонка і секція Tools шлють `session.setTool`.

**Outliner / Layers.** Дерево шарів і об’єктів: око, замок, ім’я, порядок. Виділення тут і на полотні — одна команда `session.select`. Це клавіатурний шлях до виділення: `role="tree"`, стрілки, Enter виділяє. Око і замок — окремі кнопки в рядку.

**Options.** Залежить від режиму і виділення, див. нижче. Змішане виділення показує спільні поля; розбіжні числові поля порожні, доки користувач не введе значення.

**Modificators.** Стек активного об’єкта: додати, увімкнути, параметри, порядок, Apply, Apply all, текст `diagnostics`.

**Tools.** Ті самі три інструменти, поточний позначений `aria-pressed`.

**Color.** Fill, stroke, «немає», `strokeWidth` для виділених об’єктів. Команда `style.set`.

**Color Collections.** Зразки документа. Клік по зразку шле `swatch.apply`. Новий зразок — `swatch.add` з поточного fill.

**Preview.** Другий SVG лише з evaluated-шляхів, без якорів і без pointer-подій, з підписом секції. Для допоміжних технологій це огляд, не друга робоча область.

**History.** Список міток і поточний індекс. Активація рядка шле `history.jump`.

Options виділеного об’єкта (Object Mode): ім’я, шар, visible, locked, x, y, rotation, scaleX, scaleY, число підшляхів і якорів як текст. Колір тут не дублюється.

Options виділеного якоря (Edit Mode): x, y якоря, x, y handle in, x, y handle out, вид вихідного сегмента (`line` | `cubic`). Кілька якорів: зсув dx, dy однією командою `path.translateAnchors`, абсолютні координати лише коли значення спільне.

## Object Mode і Edit Mode

Object Mode виділяє об’єкти. Останній доданий у виділення стає `activeObjectId`. Перетягування рухає всі виділені. Клік по якорю в цьому режимі інструментом Select об’єкт не розбирає.

Edit Mode редагує `source` лише активного об’єкта. Інші об’єкти намальовані тьмяно і влучання не приймають. Виділення якорів і сегментів попереднього сеансу Edit для цього об’єкта скидається при вході. Клавіші `1` і `2` міняють `editSelectionKind`. Поверх джерельних якорів малюється evaluated-результат; тягати можна тільки якорі джерела. Щоб змінити активний об’єкт, треба повернутися в Object Mode.

Shortcuts однієї клавіші залежать від режиму: `G`, `R`, `S` в Object Mode шлють `object.translate` / `object.rotate` / `object.scale`, в Edit Mode — ті самі класи руху для виділених якорів (`path.translateAnchors` і обертання та масштаб якорів навколо їхнього спільного центру). `Delete` в Object Mode — `object.delete`, в Edit Mode — `path.deleteAnchors` або видалення сегмента через заміну підшляху тими самими командами шляху.

## Інструменти MVP

**Select.** Події: клік по evaluated-заливці або обвідці → `session.select` об’єкта; Shift додає; клік по порожньому → `clear`; рамка по порожньому → `replace` або `add`; перетяг виділеного → жест transform. У Edit Mode ті самі події б’ють по якорях і сегментах джерела активного об’єкта. Курсор: стрілка, під час перетягування — `grabbing`.

**Direct select.** Подія по якорю або handle: якщо режим Object, спочатку `session.setMode` у `edit` з цим об’єктом як активним, далі `session.select` якоря. Перетяг якоря — `path.translateAnchors`. Перетяг handle — `path.setHandle`; Alt ставить `breakLink: true`. Курсор: стрілка прямого виділення, на handle — `crosshair`.

**Pen.** Перший клік в Object Mode — `pen.begin` (новий об’єкт і вхід в Edit). Наступні кліки — `pen.addPoint`. Протяг під час кліку задає `handleOut`. Клік у перший якір — `pen.finish` з `closed: true`. Enter — `pen.finish` з `closed: false`. Escape скасовує останню точку через `history.undo` поточного кроку пера. Курсор: `crosshair`.

Інструменти Illustrator поза MVP: rectangle, ellipse, polygon, star, line, arc, curvature, convert-anchor, scissors, knife, join, smooth, blob, pencil, eraser, shape builder, type, gradient, eyedropper, width, blend, mesh, free transform, reflect, shear.

## Модифікатори

Спільне для всіх: `enabled` вимикає крок, не скидаючи параметри. Порядок змінює результат, бо кожен крок бачить вихід попереднього. Apply запікає префікс стека в `source` і прибирає цей префікс. Ідентифікатори якорів після Apply нові; виділення якорів цього об’єкта скидається тією самою командою.

**Array.** `count` від 1 (оригінал входить у число), `offsetX`, `offsetY` в одиницях документа. Відкритий шлях копіюється відкритим. Стоїть перед mirror — дзеркалиться вся сітка. Стоїть після mirror — тиражується вже віддзеркалена форма.

**Mirror.** Вісь `x`, `y` або обидві, через центр bounds поточного входу. Кінці на осі не зшиваються: копія є окремим підшляхом. Відкритий шлях лишається відкритим.

**Bevel.** `distance` і `join`. Нульова дистанція лишає вхід як є. Додатна розширює, від’ємна стискає. Відкритий шлях Clipper замикає в смугу навколо лінії (`EndType`, що дає контур уздовж штриха). Джерело до Apply лишається відкритим; evaluated уже замкнений. Після bevel у стеку кривих немає.

**Boolean.** `operation` і `operandId` іншого об’єкта. Відкритий підшлях у хазяїна або в operand: крок пропущений, у панелі діагностика, джерело не замикається само. Union збирає контури, difference вирізає operand, intersect лишає перетин. Operand уже з власним стеком: bevel на operand до difference ріже розширеним контуром; bevel після boolean розширює вже вирізану форму.

## Import / export SVG

У файлі для інших програм: кореневий `svg` з `viewBox`, групи `g` як шари, `path` з evaluated-геометрією в атрибуті `d`, presentation-атрибути `fill`, `stroke`, `stroke-width`, `fill-rule`. Transform в атрибут не виноситься: у `d` он уже в просторі документа, тому файл виглядає так само поза редактором.

Дані редактора лишаються поруч, в тому самому файлі. Спосіб зберігання стека зафіксований: JSON в атрибуті `data-vector-editor` на кожному `path`. Всередині: `version`, `name`, `source`, `transform`, `modifiers`, `locked`. На `svg` — `data-vector-editor-document` з версією формату, іменем документа і `swatches`. На `g` — `data-vector-editor-layer` з id шару, ім’ям і прапорами. Окремий sidecar не використовується: користувач відкриває і зберігає один `.svg`.

Імпорт з атрибутом відновлює `source` і стек з JSON, а `d` ігнорує як кеш вигляду. Імпорт без атрибута робить `source` з `d`, стек порожній. `M`, `L`, `H`, `V`, `C` стають якорями і сегментами. `S`, `Q`, `T` розгортаються в кубічні. `A` наближається кубічними і в моделі дугою не живе. `Z` ставить `closed`. `rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon` при імпорті стають підшляхами. `text`, `image`, `use`, градієнти, фільтри, clip і mask у MVP пропускаються; UI показує, скільки вузлів пропущено. Експорт після Apply пише запечений `source` і порожній стек у JSON.

## History

Undo і redo — команди `history.undo`, `history.redo`, `history.jump`. Запис — це мітка і знімок `{ document, mode, selection }`, зроблений до застосування команди. Жест перетягування дає один запис. `history.undo` сам запис не створює.

Панель History показує мітки від старіших до новіших, поточний індекс і гілку, відрізану redo (кроки після індексу неактивні). Активований рядок викликає `history.jump`. Нова команда відкидає гілку redo.

## Shortcuts MVP

Працюють, коли фокус у viewport або на документовому корені редактора і не в текстовому полі. Tab у sidenav лишається переходом фокуса.

| Клавіші | Команда | Конфлікт з браузером |
| --- | --- | --- |
| Tab у фокусі viewport | `session.setMode` | Забирає перехід фокуса. Обробляти лише у viewport, у панелях не чіпати |
| V | `session.setTool` select | немає |
| A | `session.setTool` direct-select | немає. У Blender це select all; тут select all лишається на Ctrl+A |
| P | `session.setTool` pen | немає |
| 1 / 2 в Edit | `session.setEditSelectionKind` | немає |
| G / R / S | translate / rotate / scale поточного режиму | немає |
| Enter | підтвердити жест або `pen.finish` | немає |
| Escape | скасувати жест або останню точку пера; без жесту — `session.select` clear | немає |
| Delete, X | delete поточного режиму | Backspace не використовуємо: у частини браузерів це назад по історії |
| Shift+клік | `session.select` add | немає |
| Shift+D | `object.duplicate` | немає |
| H | `object.setFlags` visible | немає |
| Ctrl+A | виділити всі об’єкти або всі якорі режиму | Виділяє текст сторінки. `preventDefault`, коли фокус не в полі |
| Ctrl+Z | `history.undo` | Undo в полях вводу. У полі не перехоплювати |
| Ctrl+Shift+Z | `history.redo` | те саме |
| Ctrl+O | відкрити файл | Діалог відкриття сторінки. `preventDefault` |
| Ctrl+S | зберегти файл | Збереження HTML. `preventDefault` |
| Пробел+перетяг, середня кнопка | `session.setViewport` pan | Пробел прокручує сторінку. Лише у viewport |
| Колесо | zoom до курсора | Ctrl+колесо збільшує сторінку. Над viewport завжди `preventDefault`, включно з Ctrl |

`Ctrl+Y` не призначається. Клавіші `3` немає: граней у моделі немає.

## Структура каталогів

Один маршрут, сервіси через `@Service` і `inject()`. Нових пакетів немає до фази 10.

```text
src/
  main.ts
  styles.scss
  app/
    app.ts                      фаза 1: корінь з outlet
    app.html
    app.config.ts               лишається provideRouter
    app.routes.ts               фаза 1: lazy ''
    app.spec.ts                 фаза 1: прибрати очікування h1, якого в шаблоні немає
    shell/                      фаза 1
    core/
      model/                    фаза 2: Document, Layer, VectorObject, Anchor, Segment, Style, Modifier
      session.service.ts       фаза 1–2
      eval/                     фази 9–10: array, mirror, flatten, bevel, boolean
      io/                       фаза 8: svg-import, svg-export
    commands/
      command.ts                фаза 1: тип команд, далі розширюється
      command-bus.service.ts
      history.ts                фаза 3: знімки; панель у фазі 7
    keymap/                     фаза 1, доповнення в кожній фазі
    viewport/                   фаза 1 каркас; 2 камера; 3–5 hit-test і tools/
    panels/
      outliner/                 фаза 3
      options/                  фази 3–4
      modifiers/                фаза 9
      tools/                    фаза 1
      color/                    фаза 6
      swatches/                 фаза 6
      preview/                  фаза 6
      history/                  фаза 7
```

## Фази

### Фаза 1. Оболонка і шина команд

Обсяг: макет на всю висоту, вісім секцій з порожнім станом, ліва колонка інструментів, верхня смуга, viewport як один tab stop з видимим фокусом. Сесія тримає режим і інструмент. Кнопки і V, A, P, Tab шлють одні й ті самі команди.

Файли: `app.routes.ts`, `shell/`, `core/session.service.ts`, `commands/command.ts`, `commands/command-bus.service.ts`, `keymap/`, `viewport/` (порожнє полотно), заглушки `panels/*`, заміна `app.spec.ts`.

Залежності: вже наявні Angular і CDK. Нових пакетів немає.

Критерій у браузері: сторінка відкривається, фокус видно на viewport і на кнопках секцій, Tab у viewport міняє підпис режиму, той самий перехід спрацьовує кнопкою, V/A/P міняють інструмент, у панелях Tab переходить між контрольами.

### Фаза 2. Документ і камера

Обсяг: типи моделі, `document.new`, один тестовий кубічний шлях у новому документі, малювання `source` у SVG, pan і zoom.

Файли: `core/model/`, розширення сесії і команд, `viewport` камера.

Залежності: фаза 1.

Критерій у браузері: після New видно криву на полотні 1200×800; колесо змінює масштаб до курсора; середня кнопка і пробел у фокусі viewport зсувають вид; Ctrl+колесо над полотном не масштабує сторінку браузера.

### Фаза 3. Object Mode

Обсяг: hit-test evaluated заливка/обвідка, рамка, `session.select`, переміщення жестом одним записом History, Outliner, Options об’єкта, Ctrl+Z для переміщення.

Файли: `viewport/hit-test`, `viewport/tools/select`, `commands/history.ts`, `panels/outliner`, `panels/options`.

Залежності: фаза 2.

Критерій у браузері: клік виділяє об’єкт, Shift додає другий, рядок Outliner виділяє той самий об’єкт, перетяг зміщує transform, Enter у полі Options ставить координату, Ctrl+Z повертає попереднє місце одним кроком.

### Фаза 4. Edit Mode

Обсяг: якір і handles поверх джерела, direct select, клавіші 1 і 2, Options якоря, переміщення якорів і handles, видалення якоря.

Файли: overlay у `viewport/`, `viewport/tools/direct-select`, команди `path.*`, гілка Options для якоря.

Залежності: фаза 3.

Критерій у браузері: Tab на виділеному об’єкті показує якорі; перетяг якоря змінює криву; перетяг handle гне сегмент; Alt ламає зв’язку handles; Options якоря змінює координату; Delete прибирає якір; Ctrl+Z відновлює його; в Object Mode ті самі точки більше не перетягуються інструментом Select.

### Фаза 5. Перо

Обсяг: `pen.begin`, `pen.addPoint`, `pen.finish`, замикання кліком у перший якір.

Файли: `viewport/tools/pen`, обробники pen у `commands/`.

Залежності: фаза 4.

Критерій у браузері: з Object Mode перо створює об’єкт, переходить в Edit і малює кубічний шлях протягуванням; клік у старт замикає контур; Enter лишає шлях відкритим; після цього direct select рухає нові якорі.

### Фаза 6. Колір, шари, preview

Обсяг: `style.set`, зразки, видимість і замок шару та об’єкта, preview evaluated без ручок.

Файли: `panels/color`, `panels/swatches`, доповнення Outliner, `panels/preview`, команди шарів і зразків.

Залежності: фаза 5.

Критерій у браузері: fill і stroke міняють полотно і preview; зразок застосовує колір; око в Outliner ховає об’єкт на полотні; замок забороняє перетяг.

### Фаза 7. Панель History

Обсяг: список уже записаних міток, jump, redo-гілка. Механізм знімків уже є з фази 3.

Файли: `panels/history`.

Залежності: фаза 6.

Критерій у браузері: серія рухів дає окремі рядки; жест — один рядок; вибір старішого рядка відкочує документ; новий рух прибирає сірі майбутні кроки; Ctrl+Shift+Z йде вперед по списку.

### Фаза 8. Відкрити і зберегти SVG

Обсяг: парсер і серіалізатор без модифікаторів, діалог файлу, завантаження Blob, пропуск непідтриманих вузлів з лічильником.

Файли: `core/io/`, кнопки Open/Save, `Ctrl+O` / `Ctrl+S`.

Залежності: фаза 7. Пакета для SVG немає: парсер на `DOMParser`.

Критерій у браузері: збережений файл відкривається знову з тими самими якорями, кольором і шарами; `rect` і `circle` стають шляхами; текстовий вузол не ламає імпорт і показаний у лічильнику пропусків; Ctrl+S не відкриває діалог збереження сторінки.

### Фаза 9. Array і Mirror

Обсяг: панель стека, evaluated для цих двох модифікаторів, порядок, Apply, запис JSON у `data-vector-editor`.

Файли: `core/eval/array`, `core/eval/mirror`, `panels/modifiers`, розширення io.

Залежності: фаза 8. Порядок рядків стека — вже наявний `@angular/cdk` drag-drop, нового пакета немає.

Критерій у браузері: array дає копії зі зсувом, mirror віддзеркалює їх; зворотний порядок дає іншу форму; Apply залишає копії після видалення модифікатора; збережений файл у редакторі відновлює стек, а в звичайному переглядачі SVG показує evaluated `d`.

### Фаза 10. Bevel і Boolean

Обсяг: flatten, виклик `clipper2-ts`, діагностика відкритого шляху і циклу, дірки як підшляхи з `evenodd`.

Файли: `core/eval/flatten`, `bevel`, `boolean`, параметри в панелі модифікаторів.

Залежності: фаза 9 і пакет `clipper2-ts`.

Критерій у браузері: difference двох замкнених фігур вирізає отвір; union і intersect відрізняються; bevel з `join: bevel` зрізає кути evaluated-контуру; відкритий шлях у boolean показує помилку і не змінює форму; під час перетягування boolean не смикається на кожен піксель і оновлюється на відпусканні; Apply запікає ламану, після чого якорі лежать на прямих сегментах.

### Фаза 11. Доступність viewport

Обсяг: порядок фокуса, контраст ручок і виділення, імена секцій, оголошення поточного виділення, axe по оболонці.

Файли: шаблони `shell/` і `panels/`, підписи viewport.

Залежності: фаза 10.

Критерій у браузері: з клавіатури без миші можна відкрити секції, дійти до об’єкта в Outliner, виділити його Enter, перемкнути Edit і побачити фокус; у текстовому полі Ctrl+Z не перехоплюється редактором; перевірка axe оболонки без критичних порушень.

## Ризики

**Boolean і bevel на кривих.** Clipper бачить ламану. Дрібні петлі, майже дотичні перетини і дуже гострі кути дають зайві точки або щілину біля допуску 0.25. Після Apply крива вже не відновлюється. Це приймається: джерело береже криві, доки модифікатор не запечений.

**Ціна evaluated.** Boolean тягне flatten обох об’єктів. Перерахунок на кожен `pointermove` під час перетягування операнда буде помітним уже на кількох сотнях сегментів. Тому Clipper-кроки відкладені до кінця жесту, а array і mirror лишаються на сигналах. Якщо стеків багато, `computed()` тримається по одному об’єкту, а не на весь документ одним перерахунком.

**Hit-testing якорів.** Ціль якоря мала. Влучання рахується в пікселях екрана (поріг близько 6px), з радіусом, що не залежить від zoom. Ручка не перехоплює якір: спочатку handle, потім якір, потім сегмент, потім заливка. Об’єкт зі стеком виділяється по evaluated-контуру, а в Edit Mode якорі б’ються по `source`.

**Доступність SVG-viewport.** Окремі вузли SVG не стають tab stop. Фокус один — на контейнері полотна, з видимим кільцем. Виділення з клавіатури йде через Outliner. Зміна виділення оголошується коротко через живий регіон (ім’я об’єкта або число якорів). Колір виділення тримає контраст до білого полотна і до типової заливки.

## Відкриті рішення

До старту відповідної фази достатньо підтвердити чотири пункти. План уже написаний під рекомендацію в кожному.

1. **Центр rotate/scale кількох об’єктів.** Рекомендація: кожен об’єкт навколо центру власних bounds. Спільний центр виділення — після MVP.
2. **Перо в Object Mode.** Рекомендація: перший клік створює об’єкт і входить в Edit Mode, інструмент лишається Pen.
3. **Direct select в Object Mode.** Рекомендація: влучання в якір перемикає Edit Mode на цей об’єкт і виділяє якір. Окремого виділення якорів поза Edit Mode немає, щоб shortcuts лишались прив’язаними до режиму.
4. **Clipper під час жесту.** Рекомендація: bevel і boolean до `pointerup` тримають попередній результат, array і mirror оновлюються одразу.

План на підтвердження. Коду і змін у репозиторії немає.