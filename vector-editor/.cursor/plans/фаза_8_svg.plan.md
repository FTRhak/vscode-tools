---
name: Фаза 8 SVG
overview: "Додати відкриття і збереження одного SVG: три режими в діалозі Save, парсер чужих файлів на DOMParser і відновлення документа командою document.replace. Стек модифікаторів у цій фазі лишається порожнім."
todos:
  - id: io-parse
    content: "Парсер SVG: контур, фігури, шари, атрибути редактора, лічильник пропусків"
    status: completed
  - id: io-write
    content: "Серіалізатор трьох режимів: d у просторі документа, JSON без непорожнього стека"
    status: completed
  - id: file-ui
    content: document.replace, FileActions, діалог Save, Open/Save і Ctrl+O/Ctrl+S, статус пропусків
    status: completed
  - id: verify
    content: Юніти кругового шляху і чужого SVG; у браузері перевірити Save, Open і Ctrl+S
    status: completed
isProject: false
---

# Фаза 8. Відкрити і зберегти SVG

Обсяг із [implementation.plan.md](c:\Projects\vscode-tools\vector-editor\.cursor\plans\implementation.plan.md): парсер і серіалізатор без модифікаторів, діалог файлу, завантаження Blob, пропуск непідтриманих вузлів із лічильником. `file.open` і `file.save` командами документа не є: UI читає файл, парсер будує `Document`, далі йде `document.replace`.

Нового пакета немає. Парсер — `DOMParser`. `@angular/cdk` уже стоїть і дає пастку фокуса діалогу.

Поза фазою: evaluated-стек, непорожній `modifiers`, drag-drop модифікаторів. Запис JSON уже має ключ `modifiers`, але письменник завжди кладе `[]`, а читач цей ключ ігнорує. Фаза 9 підставить стек і почне писати в `d` evaluated-геометрію.

## Три режими Save

Діалог перед записом. Типовий вибір — All data. Скасування нічого не пише.

У всіх режимах атрибут `d` — контур у просторі документа: до якорів і handles застосована та сама матриця, що малює viewport (`scale`, потім `rotate`, потім `translate` з [scene.ts](c:\Projects\vscode-tools\vector-editor\src\app\viewport\scene.ts)). Файл у звичайному переглядачі виглядає так само. Координати — вже наявний `sourceToPathData` (до трьох знаків).

- **All data.** Атрибути редактора і презентація. Приховане теж у файлі (`display="none"`). Повторне відкриття відновлює ті самі id, локальні якорі, transform, імена, видимість, замки, шари і зразки. `d` ігнорується як кеш.
- **Optimized.** Той самий JSON із локальним `source` і `transform`, іменами, видимістю і шарами-групами. Немає зразків, замків і внутрішніх id: документ, шари, об’єкти, якорі і сегменти після відкриття отримують нові id, `locked` скрізь `false`, `swatches` порожні. Сегменти в JSON посилаються на якорі індексом.
- **Minimal.** Лише видимі `path` у порядку малювання, без груп і без атрибутів редактора. Transform запечений у `d`. Повторне відкриття збирає один шар і ідентичний transform.

## Формат атрибутів

Корінь `svg` з `xmlns` і `viewBox`. Група `g` — шар, у порядку `order`. Об’єкт — `path` із `fill`, `stroke`, `stroke-width`, `fill-rule` (`none`, коли колір `null`).

- `data-vector-editor-document`: `version: 1`, `name`; у All data ще `id` і `swatches`.
- `data-vector-editor-layer`: `name`, `visible`; у All data ще `id` і `locked`.
- `data-vector-editor`: `version: 1`, `name`, `source`, `transform`, `modifiers: []`; у All data ще `locked` і id всередині `source`. `id` об’єкта в All data — атрибут `id` елемента.

Імпорт з атрибутом об’єкта бере `source` і `transform` з JSON. Імпорт без атрибута будує `source` з `d` або з фігури і ставить ідентичний transform.

## Імпорт чужого SVG

Чисті функції в `src/app/core/io/`.

Команди контуру абсолютні і відносні: `M L H V C Z` стають якорями і сегментами; `S Q T` розгортаються в кубічні; `A` наближається кубічними (дуга ріжеться на частини не більші за 90°). Кілька підшляхів лишаються кількома `subpaths` одного об’єкта. `style` перекриває presentation-атрибути. Невідомий `fill`/`stroke` через `url()` стає `null`. Бракує `viewBox` — беруться `width`/`height`, інакше `0 0 1200 800`.

`rect` (з `rx`/`ry`), `circle`, `ellipse`, `line`, `polyline`, `polygon` стають підшляхами. `transform` на фігурі чи групі запікається в координати. Прямий `g` під `svg` — шар; вкладений `g` зливається в цей шар. Фігури-сусіди групи отримують власний шар, щоб порядок малювання збігся з файлом.

`text`, `image`, `use`, `foreignObject`, градієнти, фільтри, `clipPath` і `mask` пропускаються цілим піддеревом. Лічильник — число таких елементів. Порожній або битий файл документ не замінює.

## Сесія і файлові дії

`document.replace` з payload `Document` у [command.ts](c:\Projects\vscode-tools\vector-editor\src\app\commands\command.ts). Обробка поруч із `document.new` у [session.service.ts](c:\Projects\vscode-tools\vector-editor\src\app\core\session.service.ts): новий документ, режим `object`, порожнє виділення, `penObjectId` скидається. Viewport і інструмент не чіпаються. Мітка History — `Open`, тож Undo повертає попередній документ.

`FileActions` у `shell/` тримає прихований `<input type="file" accept=".svg,image/svg+xml">`, сигнал діалогу і короткий статус. Open читає текст, парсить і шле `document.replace`. Save збирає рядок і віддає Blob через тимчасове посилання з ім’ям документа. Кнопки Open і Save у [top-bar.html](c:\Projects\vscode-tools\vector-editor\src\app\shell\top-bar\top-bar.html) перестають бути `disabled`; Save неактивний, доки документа немає. Після відкриття з пропусками `aria-live="polite"` у верхній смузі пише «Skipped N nodes.» Помилка читання лишає документ і пише «Could not read this SVG.»

Ctrl+O і Ctrl+S у [keymap.service.ts](c:\Projects\vscode-tools\vector-editor\src\app\keymap\keymap.service.ts) викликають ті самі дії і завжди `preventDefault`, крім поля вводу. Ctrl+S без документа теж не віддає збереження сторінці браузера.

Діалог: `role="dialog"`, `aria-modal="true"`, група радіокнопок, Save і Cancel, Escape закриває, фокус входить у діалог і повертається на кнопку Save. Пастка — `CdkTrapFocus` з уже наявного CDK.

Існуючий тест [editor-page.spec.ts](c:\Projects\vscode-tools\vector-editor\src\app\shell\editor-page.spec.ts) очікує, що Open і Save лишаються вимкненими. Його треба оновити: після New обидві кнопки активні.

## Перевірка

Юніти io: круговий All data зберігає якорі, handles, transform, колір, шари, замок і зразки; Optimized дає нові id, порожні зразки і `locked: false`, геометрія та transform ті самі; Minimal пише лише видимі path без груп, а імпорт збирає їх в один шар. Окремо: `rect` і `circle` стають замкненими шляхами; `text` збільшує лічильник і не зриває сусідній `path`; відносні команди, `S`/`Q`/`T` і дуга. `document.replace` пише один крок Open і Undo повертає попередній документ.

У браузері: Save обирає All data, файл відкривається знову з тими самими якорями, кольором і шарами; окремий SVG з `rect`, `circle` і `text` показує фігури як шляхи і лічильник пропусків; Ctrl+S відкриває діалог редактора і не діалог збереження сторінки.
