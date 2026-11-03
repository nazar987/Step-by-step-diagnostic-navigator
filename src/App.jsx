import { useEffect, useRef, useState } from 'react';
import { Activity, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Check, ChevronRight, CircleHelp, CircuitBoard, ClipboardList, FileImage, GitBranch, History, Info, Layers, ListChecks, Monitor, Radio, RadioTower, RotateCcw, Search, Send, Settings2, ShieldCheck, Smartphone, WifiOff } from 'lucide-react';
import { categories, graph, findPath, resultsCount, sources, validatePath } from './data/diagnostics.js';
import { getIndicationContext, getAnswerPreview } from './data/indication.js';
import { version as appVersion } from '../package.json';
import Panel from './components/Panel.jsx';
import Tree from './components/Tree.jsx';
import Modal from './components/Modal.jsx';

const STORAGE_KEY = 'dc-navigator-session-v1';
function loadSession() {
  try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); return { path: validatePath(saved?.path), note: typeof saved?.note === 'string' ? saved.note : '' }; }
  catch { return { path: ['start'], note: '' }; }
}
const categoryShort = ['Контроль ЛП', 'Контроль ТС', 'Состав групп', 'Приём ЦС и ТУ', 'Приём ЦС', 'Приём ТУ', 'Команды ТУ', 'Статив и реле'];
const categoryIcons = [Activity, CircuitBoard, Layers, RadioTower, Radio, Send, ListChecks, Settings2];

function Materials({ initial = 2 }) {
  const [selected, setSelected] = useState(initial);
  const [originalSize, setOriginalSize] = useState(false);
  const source = sources.find(s => s.id === selected);
  return <div className="materials"><div className="material-tabs">{sources.map(s => <button key={s.id} className={selected === s.id ? 'active' : ''} onClick={() => { setSelected(s.id); setOriginalSize(false); }}>Фото {s.id}</button>)}</div><h3>{source.title}</h3><p>{source.description}</p><button className="text-button source-open" onClick={() => setOriginalSize(!originalSize)}>{originalSize ? 'Вписать в окно' : 'Оригинальный размер'} <Search size={15}/></button><div className={`source-image-scroll ${originalSize ? 'original' : ''}`}><img src={`./sources/${source.file}`} alt={`Фото ${source.id}: ${source.title}`} /></div></div>;
}

function Reference({ openSource }) {
  return <div className="reference"><div className="page-eyebrow"><BookOpen size={14}/> ПОД РУКОЙ</div><h1>Памятка и источники<span className="accent-dot">.</span></h1><p className="page-description">Материалы, на которых построен прототип. Проверки и ограничения сохранены с привязкой к фотографиям.</p>
    <div className="reference-banner"><Info size={20}/><div><strong>Диагностическая база требует технической сверки</strong><p>Вопросы организуют строки исходной таблицы. Результаты содержат возможные причины; порядок проверки и неоднозначные индексы нужно согласовать со специалистом.</p></div></div>
    <div className="reference-grid"><article className="white-card"><span className="eyebrow">ИЗ ФОТО 5</span><h2>Предварительные проверки</h2><ol><li>Проверить наличие питания М, U1, U2 (в исходнике: 11,5–13,5 В).</li><li>Проверить индикацию светодиодов и положение исполнительных реле.</li><li>В исходнике далее указано снятие КЛ-ТС — техническая операция, требующая штатного порядка работ.</li></ol><button className="text-button" onClick={() => openSource(5)}>Посмотреть оригинал <ArrowUpRight size={14}/></button></article>
    <article className="white-card"><span className="eyebrow">ИЗ ФОТО 4</span><h2>Питание на ЛУЛ</h2><table><thead><tr><th>Контакт</th><th>Цепь</th><th>Значение</th></tr></thead><tbody><tr><td>18</td><td>U2</td><td>+24 В</td></tr><tr><td>12</td><td>U1</td><td>+12 В</td></tr><tr><td>6</td><td>М</td><td>−12 В</td></tr></tbody></table><p className="muted small">Эту таблицу нельзя смешивать с диапазоном питания из фото 5 без уточнения точек измерения.</p></article>
    <article className="white-card"><span className="eyebrow">ОГРАНИЧЕНИЯ ИЗ ФОТО 5</span><h2>Отдельные указания</h2><p>«7СТ и 13СТ только 12V».</p><p>Контроль перегона (ДЦ) — только со станции отправления (НЗП, ЧЗП).</p><button className="text-button" onClick={() => openSource(5)}>Посмотреть оригинал <ArrowUpRight size={14}/></button></article>
    <article className="white-card"><span className="eyebrow">КАК ЧИТАТЬ ПАНЕЛЬ</span><h2>Подсветка — иллюстрация</h2><p>Расположение повторяет фото 1. Мигание и ускоренное переключение показаны условно: в исходниках нет эталонного ритма или полной циклограммы.</p><p className="muted small">Ручные изменения панели не используются как ответы диагностики.</p></article></div>
    <h2 className="section-heading">Исходные фотографии <span>05</span></h2><div className="source-grid">{sources.map(s => <button className="source-card" key={s.id} onClick={() => openSource(s.id)}><div className="source-thumb"><img src={`./sources/${s.file}`} alt="" loading="lazy"/><span>ФОТО {s.id}</span></div><strong>{s.title}</strong><ArrowUpRight size={17}/></button>)}</div>
  </div>;
}

export default function App() {
  const [session] = useState(loadSession);
  const [path, setPath] = useState(session.path);
  const [note, setNote] = useState(session.note);
  const [mode, setMode] = useState('wizard');
  const [modal, setModal] = useState(null);
  const [manual, setManual] = useState({});
  const [saveError, setSaveError] = useState(false);
  const [search, setSearch] = useState('');
  const [previewId, setPreviewId] = useState(null);
  const headingRef = useRef(null);
  const currentId = path.at(-1), node = graph[currentId];
  const isStart = currentId === 'start', isResult = node.type === 'result';
  const currentCategory = categories.findIndex(c => c.next === path[1]);
  const scenario = path.length > 1 ? getAnswerPreview(path.at(-2), currentId).scenario : (node.panel ?? {});
  const indicationContext = getIndicationContext(currentId);
  const previewOption = !isStart && node.options?.find(option => option.next === previewId);
  const answerPreview = previewOption ? getAnswerPreview(currentId, previewId) : null;
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ path, note })); setSaveError(false); } catch { setSaveError(true); } }, [path, note]);
  useEffect(() => { setManual({}); setSearch(''); setPreviewId(null); }, [currentId]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [mode]);
  function navigate(id) { const nextPath = findPath(id); if (!nextPath) return; setManual({}); setPreviewId(null); setPath(nextPath); setMode('wizard'); window.scrollTo({ top: 0, behavior: 'instant' }); requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true })); }
  function reset() { setPath(['start']); setNote(''); setManual({}); setMode('wizard'); setModal(null); }
  const openSource = id => setModal({ type: 'source', id });
  const options = (node.options ?? []).filter(o => `${o.label} ${o.hint ?? ''}`.toLocaleLowerCase('ru').includes(search.toLocaleLowerCase('ru')));
  function clearPreview() { setPreviewId(null); setManual({}); }
  function previewAnswer(nextId) {
    setManual({}); setPreviewId(nextId);
    if (window.matchMedia('(max-width: 1100px)').matches) setModal({ type: 'panel' });
  }
  const panelProps = {
    scenario: answerPreview?.scenario ?? scenario,
    focusIndicators: answerPreview?.focusIndicators ?? indicationContext.focusIndicators,
    contextNote: answerPreview?.note ?? indicationContext.note,
    previewLabel: previewOption?.label ?? '', onResetPreview: clearPreview,
    manual, setManual, onSource: () => openSource(1),
  };
  return <div className="app-shell">
    <aside className="sidebar"><button className="brand" onClick={() => setMode('wizard')} aria-label="ДЦ Навигатор — диагностика"><span className="brand-symbol"><GitBranch size={23}/></span><span className="brand-wordmark">ДЦ <b>Навигатор</b><small>ДИАГНОСТИЧЕСКАЯ ПАМЯТКА</small></span></button>
      <div className="sidebar-label">РАБОЧЕЕ ПРОСТРАНСТВО</div><nav className="main-nav" aria-label="Основная навигация">{[['wizard', Activity, 'Пошаговая диагностика'], ['tree', GitBranch, 'Всё дерево'], ['reference', BookOpen, 'Памятка и источники']].map(([value, Icon, title]) => <button key={value} className={mode === value ? 'active' : ''} onClick={() => setMode(value)} aria-current={mode === value ? 'page' : undefined} aria-label={title}><Icon size={18}/><span className="nav-label-full">{title}</span><span className="nav-label-short" aria-hidden="true">{value === 'wizard' ? 'Диагностика' : value === 'tree' ? 'Всё дерево' : 'Памятка'}</span>{mode === value && <i/>}</button>)}</nav>
      <div className="sidebar-separator"/><div className="sidebar-label">РАЗДЕЛЫ ДИАГНОСТИКИ <span>08</span></div><nav className="category-nav" aria-label="Разделы диагностики">{categories.map((c,i) => <button key={c.next} className={currentCategory === i && mode === 'wizard' ? 'selected' : ''} onClick={() => navigate(c.next)}><span>{String(i+1).padStart(2,'0')}</span>{categoryShort[i]}<ChevronRight size={13}/></button>)}</nav>
      <div className="sidebar-bottom"><span className="offline-badge"><WifiOff size={14}/> Работает без интернета</span><p>Локальная база · прототип {appVersion}</p><div className="platforms"><Monitor size={14}/><span>Desktop</span><span>·</span><Smartphone size={14}/><span>Android</span></div></div>
    </aside>
    <div className="workspace"><header className="topbar"><div className="topbar-crumb">Устройства ДЦ <ChevronRight size={13}/><strong>{mode === 'tree' ? 'Дерево алгоритма' : mode === 'reference' ? 'База материалов' : 'Диагностика'}</strong></div><div className="topbar-actions"><span className="prototype-tag"><i/> Локальная памятка</span><button className="button secondary small-button" aria-label="Начать заново" title="Начать заново" onClick={() => setModal({ type: 'reset' })}><RotateCcw size={16}/><span>Начать заново</span></button></div></header>
      <main>
        {mode === 'tree' ? <Tree onNavigate={navigate}/> : mode === 'reference' ? <Reference openSource={openSource}/> : <>
          <div className="page-eyebrow"><span className="small-square"/> ПОШАГОВАЯ ДИАГНОСТИКА <span className="eyebrow-rule"/></div>
          <div className="heading-row"><div><h1>{isStart ? <><span className="hero-title-full">Диагностика ДЦ</span><span className="hero-title-short">Диагностика ДЦ</span><span className="accent-dot">.</span></> : isResult ? <>Возможные причины<span className="accent-dot">.</span></> : <>Уточним наблюдения<span className="accent-dot">.</span></>}</h1><p className="page-description">{isStart ? 'Выберите симптом — навигатор проведёт по нужной ветке алгоритма.' : isResult ? 'По выбранным признакам и исходной таблице неисправностей.' : categories[currentCategory]?.label}</p></div><div className="step-badge"><span>{String(path.length).padStart(2,'0')}</span><small>{isResult ? 'РЕЗУЛЬТАТ' : 'ТЕКУЩИЙ ШАГ'}</small></div></div>
          <div className="stepper" aria-label="Этапы диагностики"><span className={isStart ? 'current' : 'done'}><i>{isStart ? '1' : <Check size={12}/>}</i>Симптом</span><div/><span className={!isStart && !isResult ? 'current' : isResult ? 'done' : ''}><i>{isResult ? <Check size={12}/> : '2'}</i>Уточнение</span><div/><span className={isResult ? 'current' : ''}><i>3</i>Результат</span></div>
          <button className="mobile-panel-shortcut" aria-label="Открыть панель индикации" onClick={() => setModal({ type: 'panel' })}><span className="shortcut-icon"><CircuitBoard size={24}/></span><span><strong>Панель индикации</strong><small>Схема устройства и состояния ламп</small></span><ArrowUpRight size={20}/></button>
          <div className="diagnostic-layout"><div className="diagnostic-main">
            {!isStart && <div className="path-crumbs"><button onClick={() => navigate('start')}>Начало</button>{path.slice(1).map((id,i) => <span key={id}><ChevronRight size={12}/><button onClick={() => navigate(id)} aria-current={i === path.length-2 ? 'step' : undefined}>{i === 0 ? categoryShort[currentCategory] : graph[id].type === 'result' ? 'Результат' : `Уточнение ${i}`}</button></span>)}</div>}
            <div className="question-heading"><span className="eyebrow">{isResult ? 'ПО ИСХОДНОЙ ТАБЛИЦЕ' : isStart ? '01 / ВЫБОР СИМПТОМА' : `${String(path.length).padStart(2,'0')} / УТОЧНЕНИЕ ПРИЗНАКА`}</span><h2 tabIndex={-1} ref={headingRef}>{node.title}</h2>{node.description && <p>{node.description}</p>}</div>
            {isResult ? <div className="result-card"><div className="result-label"><CircleHelp size={18}/> Возможные причины, указанные в источнике</div><ul>{node.causes.map((cause,i) => <li key={i}><span>{String(i+1).padStart(2,'0')}</span><p>{cause}</p></li>)}</ul>{node.note && <div className="result-note"><Info size={17}/><p>{node.note}</p></div>}<div className="result-source"><span><FileImage size={16}/> Фото {node.sourceIds.join(', ')} · {node.row}</span><button onClick={() => openSource(node.sourceIds[0])}>Сверить с оригиналом <ArrowUpRight size={14}/></button></div><details className="excerpt"><summary>Формулировка признака из таблицы</summary><p>{node.excerpt}</p></details></div> : <>
              {isStart && <label className="search-box symptom-search"><Search size={16}/><input aria-label="Найти симптом" placeholder="Найти симптом…" value={search} onChange={e => setSearch(e.target.value)}/><span>8 разделов</span></label>}
              <div className={`options ${isStart ? 'symptom-options' : ''}`}>{options.map(o => { const index = node.options.indexOf(o); const Icon = categoryIcons[index]; const hasPreview = !isStart && getAnswerPreview(currentId, o.next).available; return <div key={o.next} className={`answer-option ${previewId === o.next ? 'preview-active' : ''}`}><button className="option-card" onClick={() => navigate(o.next)}><span className="option-index">{isStart ? <Icon size={23}/> : String(index+1).padStart(2,'0')}</span><span className="option-text"><strong>{o.label}</strong>{o.hint && <small>{o.hint}</small>}</span><ArrowUpRight className="option-arrow" size={18}/></button>{hasPreview && <button className="answer-preview" aria-label={`Показать индикацию: ${o.label}`} aria-pressed={previewId === o.next} onClick={() => previewAnswer(o.next)}><CircuitBoard size={15}/><span>Показать индикацию</span><ArrowUpRight size={14}/></button>}</div>; })}</div>
              {!options.length && <div className="empty-state"><p>Такой симптом не найден.</p><button className="text-button" onClick={() => setSearch('')}>Сбросить поиск</button></div>}
              {!isStart && <button className="unknown-button" onClick={() => setModal({ type: 'unknown' })}><CircleHelp size={17}/>Не могу определить / мой случай не описан<ChevronRight size={15}/></button>}
            </>}
            <div className="step-actions">{!isStart && <button className="button secondary" onClick={() => { setPath(path.slice(0,-1)); requestAnimationFrame(() => headingRef.current?.focus()); }}><ArrowLeft size={15}/> Назад</button>}<button className="text-button" onClick={() => setMode('tree')}><GitBranch size={15}/> Смотреть всё дерево <ArrowRight size={14}/></button></div>
            {!isStart && <label className="notes-label"><ClipboardList size={16}/>Заметка по текущему разбору<textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Номер ЛП, наблюдаемый индикатор, условия проявления…" rows={3}/><small>{saveError ? 'Не удалось сохранить локально — заметка доступна до закрытия приложения.' : 'Сохраняется локально вместе с выбранным маршрутом.'}</small></label>}
          </div><aside className="diagnostic-aside"><div className="aside-heading"><span>Панель индикации</span><span className="outline-tag">По фото устройства</span></div><Panel key={currentId} {...panelProps} onExpand={() => setModal({ type: 'panel' })}/>
            <div className="context-card"><div className="context-icon"><BookOpen size={18}/></div><div><h3>{isStart ? 'Основа — ваши материалы' : 'Источник текущего шага'}</h3><p>{isStart ? `5 фотографий, 8 разделов и ${resultsCount} диагностических результатов.` : `Фото ${node.sourceIds.join(', ')}. Откройте оригинал, если нужно уточнить обозначение.`}</p><button className="text-button" onClick={() => openSource(node.sourceIds[0])}>Открыть источник <ArrowUpRight size={14}/></button></div></div>
            {path.length > 1 && <div className="route-card"><h3><History size={16}/> Пройденный маршрут</h3><ol>{path.map((id,i) => <li key={id}><i className={i === path.length-1 ? 'current' : ''}/><button onClick={() => navigate(id)}>{i === 0 ? 'Выбор симптома' : (graph[path[i-1]].options.find(o => o.next === id)?.label ?? graph[id].title)}</button></li>)}</ol></div>}
            <div className="verification-note"><ShieldCheck size={17}/><p>Причины перенесены из таблицы. Неоднозначные места отмечены в результатах и требуют сверки.</p></div>
          </aside></div>
        </>}
      </main><footer className="footer"><span><i className="status-dot"/>{saveError ? 'Локальное сохранение недоступно' : 'Локальная база доступна'}</span><span>ДЦ Навигатор <b>v{appVersion}</b><span className="footer-extra"> · По материалам 5 фотографий</span></span></footer>
    </div>
    {modal?.type === 'source' && <Modal title="Исходные материалы" wide onClose={() => setModal(null)}><Materials initial={modal.id}/></Modal>}
    {modal?.type === 'panel' && <Modal title="Панель индикации · фото 1" wide onClose={() => setModal(null)}><Panel {...panelProps} expanded/></Modal>}
    {modal?.type === 'unknown' && <Modal title="Недостаточно наблюдений" onClose={() => setModal(null)}><div className="unknown-content"><CircleHelp size={32}/><h3>Выбирать ответ наугад не нужно</h3><p>Для этого шага нет достоверного ответа. Посмотрите исходную строку или сохраните наблюдения в заметке. Навигатор не назначает причину для неописанного сочетания признаков.</p><div className="modal-actions"><button className="button primary" onClick={() => openSource(node.sourceIds[0])}>Открыть источник <ArrowUpRight size={16}/></button><button className="button secondary" onClick={() => setModal(null)}>Вернуться к шагу</button></div></div></Modal>}
    {modal?.type === 'reset' && <Modal title="Начать новый разбор?" onClose={() => setModal(null)}><p>Текущий маршрут, заметка и ручная подсветка будут сброшены.</p><div className="modal-actions"><button className="button primary" onClick={reset}>Начать заново</button><button className="button secondary" onClick={() => setModal(null)}>Продолжить текущий</button></div></Modal>}
  </div>;
}
