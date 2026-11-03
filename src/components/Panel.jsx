import { useEffect, useId, useRef, useState } from 'react';
import { Activity, ChevronLeft, ChevronRight, Circle, CircleDot, CircleMinus, Expand, FlaskConical, Image as ImageIcon, LayoutGrid, Pause, Play, RotateCcw, Route, ScanEye, SlidersHorizontal } from 'lucide-react';
import { columns, labels, stateLabels, photoState, cycleState } from '../data/panel.js';
import './panel.css';

// Coordinates are traced from the supplied close-up, 1153 × 280 px.
// Each pair has its own spacing; labels face outwards from the two LEDs.
const xPositions = [103, 167, 316, 382, 536, 602, 757, 822, 982, 1046];
const yPositions = [62, 106, 148, 191, 232];
const banks = [
  { name: 'Приём · РТ 1–4', short: 'Приём', viewBox: '0 0 246 280' },
  { name: 'Реле РТ 5–9', short: 'РТ 5–9', viewBox: '246 0 226 280' },
  { name: 'Тактовый распределитель', short: 'ТР', viewBox: '472 0 224 280' },
  { name: 'Групповой распределитель', short: 'ГР', viewBox: '666 0 260 280' },
  { name: 'Генератор · Г1–Г8', short: 'Г1–Г8', viewBox: '920 0 233 280' },
];
const bankFor = label => Math.floor(columns.findIndex(column => column.includes(label)) / 2);
const initialLed = (scenario, focusIndicators) => labels.find(label => scenario[label] && scenario[label] !== 'off')
  ?? labels.find(label => Object.hasOwn(scenario, label))
  ?? focusIndicators.find(label => labels.includes(label)) ?? 'ПР ТУ';

export default function Panel({ scenario = {}, expanded = false, onExpand, manual = {}, setManual, onSource, focusIndicators = [], contextNote = '', previewLabel = '', previewKind, onResetPreview }) {
  const [selected, setSelected] = useState(() => initialLed(scenario, focusIndicators));
  const [bank, setBank] = useState(() => bankFor(initialLed(scenario, focusIndicators)));
  const [view, setView] = useState(() => expanded && !previewLabel && focusIndicators.length === 0 && window.innerWidth > 760 ? 'all' : 'section');
  const [paused, setPaused] = useState(false);
  const [preset, setPreset] = useState('scenario');
  const sourceKey = JSON.stringify([scenario, focusIndicators, previewLabel]);
  const previousSourceKey = useRef(sourceKey);
  useEffect(() => {
    if (previousSourceKey.current === sourceKey) return;
    previousSourceKey.current = sourceKey;
    const [nextScenario, nextFocus] = JSON.parse(sourceKey);
    const next = initialLed(nextScenario, nextFocus);
    setPreset('scenario');
    setSelected(next);
    setBank(bankFor(next));
    setView('section');
  }, [sourceKey]);
  const unique = useId().replaceAll(':', '');
  const uid = suffix => `panel-${unique}-${suffix}`;
  const paint = suffix => `url(#${uid(suffix)})`;
  const base = preset === 'photo' ? photoState : preset === 'clear' ? {} : scenario;
  const current = { ...base, ...manual };
  const activeCount = labels.filter(label => current[label] && current[label] !== 'off').length;
  const sectionLabels = columns.slice(bank * 2, bank * 2 + 2).flat();
  const sectionActive = sectionLabels.filter(label => current[label] && current[label] !== 'off').length;
  const hasManual = Object.keys(manual).length > 0;
  const shownLabels = view === 'all' ? labels : sectionLabels;
  const knownCount = preset === 'scenario' ? shownLabels.filter(label => Object.hasOwn(current, label)).length : shownLabels.length;
  const statusFor = label => current[label] ?? (preset === 'scenario' ? 'unknown' : 'off');
  const locationOnly = preset === 'scenario' && previewKind === 'location' && !hasManual;

  function chooseLed(label) {
    setSelected(label);
    setBank(bankFor(label));
    setView('section');
  }
  function cycleLed(label) {
    setSelected(label);
    setBank(bankFor(label));
    setManual(previous => ({ ...previous, [label]: cycleState(current[label] ?? 'off') }));
  }
  function changePreset(value) {
    setPreset(value);
    setManual({});
    if (value === 'scenario') {
      const label = initialLed(scenario, focusIndicators);
      setSelected(label);
      setBank(bankFor(label));
    }
  }
  function changeBank(value) {
    setBank(value);
    setView('section');
    setSelected(columns[value * 2][0]);
  }

  return <section className={`instrument indicator-panel ${expanded ? 'instrument-expanded' : ''}`} aria-label="Панель индикации">
    <header className="ip-header">
      <div><span className="ip-eyebrow">СТАТИВ ДЦ</span><h3>Панель индикации</h3></div>
      <div className="ip-header-actions">
        <button className="ip-icon-button" onClick={() => setPaused(!paused)} aria-label={paused ? 'Продолжить анимацию' : 'Приостановить анимацию'} title={paused ? 'Продолжить анимацию' : 'Приостановить анимацию'}>{paused ? <Play size={18} aria-hidden="true"/> : <Pause size={18} aria-hidden="true"/>}</button>
        {!expanded && <button className="ip-icon-button" onClick={onExpand} aria-label="Развернуть панель" title="Развернуть панель"><Expand size={18} aria-hidden="true"/></button>}
      </div>
    </header>

    <div className="ip-presets" aria-label="Сценарий индикации">
      {[['scenario', 'Текущий шаг', Route], ['photo', 'Как на фото 1', ImageIcon], ['clear', 'Все выключены', Circle]].map(([value, label, Icon]) => <button key={value} onClick={() => changePreset(value)} aria-pressed={preset === value} className={preset === value ? 'active' : ''}><Icon size={16} aria-hidden="true"/><span>{label}</span></button>)}
    </div>

    <div className="ip-view-toolbar">
      <span className="ip-view-label">{view === 'all' ? 'Общий вид' : <>Секция <b>{String(bank + 1).padStart(2, '0')}</b><span> / 05</span></>}</span>
      <button className="ip-view-toggle" aria-pressed={view === 'all'} onClick={() => setView(view === 'all' ? 'section' : 'all')}><LayoutGrid size={15} aria-hidden="true"/>{view === 'all' ? 'Крупнее по секциям' : 'Вся панель'}</button>
    </div>

    {locationOnly && <p className="ip-location-note"><ScanEye size={18} aria-hidden="true"/><span><strong>Только расположение индикаторов</strong>В источнике режим ламп не указан. Свечение и мигание не показаны.</span></p>}

    <div className={`panel-housing ip-housing ip-${view} ${paused ? 'paused' : ''}`}>
      <svg viewBox={view === 'all' ? '0 0 1153 280' : banks[bank].viewBox} className="led-panel" aria-label="Векторная схема 50 светодиодов по фото 1">
        <defs>
          <linearGradient id={uid('metal')} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8c8e87"/><stop offset=".37" stopColor="#b0b2aa"/><stop offset=".67" stopColor="#a4a79e"/><stop offset="1" stopColor="#7c8078"/>
          </linearGradient>
          <linearGradient id={uid('shade')} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#181c19" stopOpacity=".2"/><stop offset=".22" stopColor="#fff" stopOpacity="0"/><stop offset=".82" stopColor="#fff" stopOpacity="0"/><stop offset="1" stopColor="#19201a" stopOpacity=".14"/>
          </linearGradient>
          <filter id={uid('grain')} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency=".75" numOctaves="3" seed="14" stitchTiles="stitch"/>
            <feColorMatrix type="saturate" values="0"/>
          </filter>
          <radialGradient id={uid('rim')} cx="35%" cy="25%" r="75%">
            <stop stopColor="#4d4545"/><stop offset=".6" stopColor="#201d1c"/><stop offset="1" stopColor="#090d09"/>
          </radialGradient>
          <radialGradient id={uid('off')} cx="40%" cy="28%" r="80%">
            <stop stopColor="#3c1823"/><stop offset=".55" stopColor="#261016"/><stop offset="1" stopColor="#110d0c"/>
          </radialGradient>
          <radialGradient id={uid('on')} cx="34%" cy="62%" r="72%">
            <stop stopColor="#ffe5fb"/><stop offset=".28" stopColor="#ff69df"/><stop offset=".64" stopColor="#ff00a6"/><stop offset="1" stopColor="#ac0055"/>
          </radialGradient>
        </defs>
        <rect width="1153" height="280" fill={paint('metal')}/>
        <rect width="1153" height="280" filter={paint('grain')} opacity=".17" className="ip-grain"/>
        <rect width="1153" height="280" fill={paint('shade')}/>
        <path d="M0 1H1153M0 279H1153" stroke="#d4d6cd" strokeOpacity=".28"/>

        {columns.map((column, ci) => column.map((label, ri) => {
          const x = xPositions[ci], y = yPositions[ri];
          const status = statusFor(label);
          const statusText = status === 'unknown' ? 'состояние не задано' : stateLabels[status];
          const glowing = status !== 'off' && status !== 'unknown';
          const isRight = ci % 2 === 1;
          const labelX = x + (isRight ? 17 : -18);
          const isVisible = view === 'all' || Math.floor(ci / 2) === bank;
          const focused = preset === 'scenario' && focusIndicators.includes(label);
          return <g key={label} role="button" tabIndex={isVisible ? 0 : -1} aria-hidden={!isVisible} aria-label={`${label}: ${statusText}. Изменить состояние`} onClick={() => cycleLed(label)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); cycleLed(label); } }} className={`led-cell ${selected === label ? 'selected' : ''} ${focused ? 'is-context-focus' : ''}`}>
            <title>{label}: {statusText}</title>
            <rect x={x - 28} y={y - 21} width="56" height="43" rx="8" className="led-hit"/>
            <text x={labelX} y={y + 5} textAnchor={isRight ? 'start' : 'end'} className="panel-label">
              {label === 'ИНТЕР. ТС' ? <><tspan x={labelX} dy="0">ИНТЕР.</tspan><tspan x={labelX} dy="17">ТС</tspan></> : label === 'ПР ТУ' ? 'ПР. ТУ' : label}
            </text>
            <circle cx={x} cy={y + 1} r="15" fill="#4b4c43" fillOpacity=".45"/>
            {focused && <><circle cx={x} cy={y} r="15.8" className="ip-focus-underlay"/><circle cx={x} cy={y} r="15.8" className="ip-focus-ring"/></>}
            <circle cx={x} cy={y} r="13.5" fill={paint('rim')} stroke="#5d5b52" strokeWidth=".8"/>
            <circle cx={x} cy={y} r="11.7" fill={paint('off')}/>
            <circle cx={x} cy={y} r="11.6" style={{ fill: paint(glowing ? 'on' : 'off') }} className={`led-bulb ${status}`}/>
            <path d={`M${x-8} ${y-7} Q${x-2} ${y-14} ${x+7} ${y-7}`} fill="none" stroke={glowing ? '#ffb0e8' : '#69414d'} strokeWidth="1.8" opacity={glowing ? '.75' : '.23'} className={status === 'blink' || status === 'fast' ? `led-glint ${status}` : ''}/>
            {glowing && <ellipse cx={x-3} cy={y+4} rx="5.7" ry="5.3" fill="#fff8ff" opacity=".96" transform={`rotate(-22 ${x-3} ${y+4})`} className={`led-glint ${status}`}/>}
            {status === 'unknown' && <path d={`M${x-4} ${y}h8`} className="led-unknown-mark"/>}
          </g>;
        }))}
      </svg>
    </div>

    {preset === 'scenario' && focusIndicators.length > 0 && <p className="ip-focus-caption"><ScanEye size={16} aria-hidden="true"/> Обведены индикаторы для текущей проверки</p>}

    {preset === 'scenario' && (previewLabel || contextNote) && <div className={`ip-context ${previewLabel ? 'is-preview' : ''}`}>
      {previewLabel ? <><span className="ip-context-label">{previewKind === 'location' ? 'РАСПОЛОЖЕНИЕ ИНДИКАТОРОВ' : 'ПРИМЕР ИНДИКАЦИИ'}</span><p>{previewLabel}</p>{contextNote && <p className="ip-context-detail">{contextNote}</p>}{onResetPreview && <button onClick={onResetPreview}><ChevronLeft size={14} aria-hidden="true"/> К вопросу</button>}</> : <p>{contextNote}</p>}
    </div>}

    {view === 'section' ? <div className="ip-bank-navigation">
      <button className="ip-icon-button" aria-label="Предыдущая секция панели" disabled={bank === 0} onClick={() => changeBank(bank - 1)}><ChevronLeft size={18} aria-hidden="true"/></button>
      <label className="ip-bank-select"><span className="sr-only">Секция панели</span><select aria-label="Секция панели" value={bank} onChange={event => changeBank(Number(event.target.value))}>{banks.map((item, index) => <option key={item.name} value={index}>{item.name}</option>)}</select></label>
      <button className="ip-icon-button" aria-label="Следующая секция панели" disabled={bank === banks.length - 1} onClick={() => changeBank(bank + 1)}><ChevronRight size={18} aria-hidden="true"/></button>
    </div> : <p className="ip-scroll-hint">Прокрутите схему в сторону или переключитесь на крупные секции.</p>}

    <div className="instrument-legend ip-legend">
      <span><Circle size={16} className="ip-state-icon ip-state-off" aria-hidden="true"/> Выкл.</span><span><CircleDot size={16} className="ip-state-icon ip-state-on" aria-hidden="true"/> Горит</span><span><Activity size={16} className={`ip-state-icon ip-state-blink ${paused ? 'paused' : ''}`} aria-hidden="true"/> Мигает</span>
      {preset === 'scenario' && <span><CircleMinus size={16} className="ip-state-icon ip-state-unknown" aria-hidden="true"/> Не задано</span>}
      <span className="ip-active-count" aria-live="polite">{knownCount < shownLabels.length ? `Задано: ${knownCount} / ${shownLabels.length}` : `${view === 'all' ? activeCount : sectionActive} / ${shownLabels.length} активны`}</span>
    </div>

    <div className="ip-manual-heading"><span><SlidersHorizontal size={16} aria-hidden="true"/>Настроить индикатор</span><button className="ip-reset" onClick={() => setManual({})} aria-label="Сбросить ручные изменения" title="Сбросить ручные изменения"><RotateCcw size={14} aria-hidden="true"/><span>Сбросить</span></button></div>
    <div className="panel-control ip-controls">
      <label><span>Индикатор</span><select aria-label="Индикатор" value={selected} onChange={event => chooseLed(event.target.value)}>{labels.map(label => <option key={label}>{label}</option>)}</select></label>
      <label><span>Состояние</span><select aria-label="Состояние индикатора" value={statusFor(selected)} onChange={event => setManual(previous => ({ ...previous, [selected]: event.target.value }))}><option value="unknown" disabled>Не задано</option><option value="off">Выключен</option><option value="on">Горит</option><option value="blink">Мигает</option><option value="fast">Часто мигает</option></select></label>
    </div>
    <p className="ip-caption">{hasManual ? 'Ручная настройка подсветки' : preset === 'photo' ? 'Статичное состояние с фотографии' : preset === 'clear' ? 'Все индикаторы выключены' : Object.keys(scenario).length ? 'Пример индикации выбранного признака' : focusIndicators.length ? 'Показано расположение; состояние ламп не задано' : 'Выберите симптом или настройте подсветку'}. <button onClick={onSource}><ImageIcon size={14} aria-hidden="true"/>Фото 1</button></p>
    <div className="ip-simulation"><FlaskConical size={15} aria-hidden="true"/><span>Симуляция · ритм условный · без подключения к оборудованию</span></div>
  </section>;
}
