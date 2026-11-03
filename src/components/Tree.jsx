import { useState } from 'react';
import { GitBranch, ChevronRight, ArrowUpRight, Search, ChevronsUpDown, FileImage, X } from 'lucide-react';
import { graph, categories, subtreeMatches, resultsCount } from '../data/diagnostics.js';
import './tree.css';

const questionIds = Object.entries(graph)
  .filter(([id, node]) => id !== 'start' && node.type === 'question')
  .map(([id]) => id);

function resultCount(id) {
  const node = graph[id];
  return node.type === 'result' ? 1 : node.options.reduce((sum, option) => sum + resultCount(option.next), 0);
}

function resultLabel(count) {
  const remainder = count % 100;
  const word = remainder > 10 && remainder < 20 ? 'результатов' : count % 10 === 1 ? 'результат' : count % 10 >= 2 && count % 10 <= 4 ? 'результата' : 'результатов';
  return `${count} ${word}`;
}

function branchMatches(id, label, query) {
  return !query || (label ?? '').toLocaleLowerCase('ru').includes(query) || subtreeMatches(id, query);
}

function Branch({ id, label, onNavigate, query, collapsed, onToggle }) {
  const node = graph[id];
  if (!branchMatches(id, label, query)) return null;
  const isQuestion = node.type === 'question';
  const open = !collapsed.has(id);
  const childrenId = `tree-children-${id}`;
  const childrenQuery = query && [label, node.title].some(text => (text ?? '').toLocaleLowerCase('ru').includes(query)) ? '' : query;

  return <li className={`tree-node ${node.type}`}>
    {isQuestion ? <>
      <div className="tree-node-line">
        <button
          className="tree-toggle"
          aria-expanded={open}
          aria-controls={childrenId}
          aria-label={`${open ? 'Свернуть' : 'Развернуть'} ветку: ${node.title}`}
          onClick={() => onToggle(id)}
        >
          <ChevronRight size={18} className={open ? 'rotated' : ''} />
        </button>
        <button className="tree-node-link tree-question-link" onClick={() => onNavigate(id)}>
          <span>{label ?? node.title}</span>
          <ArrowUpRight size={16} aria-hidden="true" />
        </button>
      </div>
      {label && label !== node.title && <p className="tree-question-text">{node.title}</p>}
      <ul id={childrenId} className="tree-children" hidden={!open}>
        {node.options.map(option => <Branch
          key={option.next}
          id={option.next}
          label={option.label}
          onNavigate={onNavigate}
          query={childrenQuery}
          collapsed={collapsed}
          onToggle={onToggle}
        />)}
      </ul>
    </> : <button className="tree-node-link tree-result-link" onClick={() => onNavigate(id)}>
      <span className="tree-result-condition"><span className="tree-terminal-dot" />{label ?? node.title}<ArrowUpRight size={16} aria-hidden="true" /></span>
      {label && label !== node.title && <span className="tree-result-title">{node.title}</span>}
      <span className="tree-result-source"><FileImage size={13} aria-hidden="true" />Фото {node.sourceIds.join(', ')}<span className="tree-result-action">Открыть результат</span></span>
    </button>}
  </li>;
}

export default function Tree({ onNavigate }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [searchCollapsed, setSearchCollapsed] = useState(() => new Set());
  const normalizedQuery = query.trim().toLocaleLowerCase('ru');
  const activeCollapsed = normalizedQuery ? searchCollapsed : collapsed;
  const setActiveCollapsed = normalizedQuery ? setSearchCollapsed : setCollapsed;
  const allCollapsed = questionIds.every(id => activeCollapsed.has(id));
  const visible = categories.filter(category =>
    (filter === 'all' || category.next === filter)
    && branchMatches(category.next, category.label, normalizedQuery)
  );

  function changeQuery(value) {
    setQuery(value);
    setSearchCollapsed(new Set());
  }

  function toggle(id) {
    setActiveCollapsed(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function resetFilters() {
    changeQuery('');
    setFilter('all');
  }

  return <div className="tree-view">
    <div className="page-eyebrow"><GitBranch size={15} /> ОБЩАЯ КАРТА</div>
    <h1>Всё дерево диагностики<span className="accent-dot">.</span></h1>
    <p className="page-description">Проследите путь от симптома к возможной причине. Любой узел можно открыть в пошаговом режиме.</p>

    <div className="tree-toolbar">
      <label className="search-box tree-search">
        <Search size={19} aria-hidden="true" />
        <input value={query} onChange={event => changeQuery(event.target.value)} placeholder="Симптом, блок или индикатор" aria-label="Поиск по дереву" />
        {query && <button className="tree-search-clear" type="button" aria-label="Очистить поиск по дереву" onClick={() => changeQuery('')}><X size={17} /></button>}
      </label>
      <label className="tree-filter">
        <span className="sr-only">Раздел дерева</span>
        <select value={filter} onChange={event => setFilter(event.target.value)} aria-label="Раздел дерева">
          <option value="all">Все разделы</option>
          {categories.map(category => <option key={category.next} value={category.next}>{category.label}</option>)}
        </select>
      </label>
      <button className="button secondary tree-expand-all" onClick={() => setActiveCollapsed(allCollapsed ? new Set() : new Set(questionIds))}>
        <ChevronsUpDown size={17} />{allCollapsed ? 'Развернуть всё' : 'Свернуть всё'}
      </button>
    </div>

    <div className="tree-root">
      <span className="tree-root-icon"><GitBranch size={25} /></span>
      <div><strong>Диагностика устройств ДЦ</strong><span>{categories.length} разделов <i /> {resultsCount} результатов <i /> 5 фотографий</span></div>
      <span className="tree-root-tag">КАРТА ПРИЗНАКОВ</span>
    </div>
    {(normalizedQuery || filter !== 'all') && <div className="tree-filter-status" role="status">
      <span>Показано разделов: <strong>{visible.length} из {categories.length}</strong>{normalizedQuery && <> · Поиск «{query.trim()}»</>}</span>
      <button className="text-button" onClick={resetFilters}>Сбросить фильтры</button>
    </div>}

    <div className="tree-grid">
      {visible.map(category => <section className="tree-group" key={category.next} aria-labelledby={`tree-group-${category.next}`}>
        <header>
          <span className="branch-index">{String(categories.indexOf(category) + 1).padStart(2, '0')}</span>
          <div className="tree-group-heading"><h2 id={`tree-group-${category.next}`}>{category.label}</h2><span>{resultLabel(resultCount(category.next))}</span></div>
          <button className="icon-button tree-group-open" aria-label={`Открыть раздел: ${category.label}`} title="Открыть в пошаговом режиме" onClick={() => onNavigate(category.next)}><ArrowUpRight size={19} /></button>
        </header>
        <ul className="tree-branches"><Branch id={category.next} onNavigate={onNavigate} query={normalizedQuery && category.label.toLocaleLowerCase('ru').includes(normalizedQuery) ? '' : normalizedQuery} collapsed={activeCollapsed} onToggle={toggle} /></ul>
      </section>)}
    </div>

    {!visible.length && <div className="empty-state tree-empty"><span className="tree-empty-icon"><Search size={28} /></span><h2>Совпадений нет</h2><p>Попробуйте другое обозначение блока или выберите все разделы.</p><button className="button secondary" onClick={resetFilters}>Сбросить поиск</button></div>}
  </div>;
}
