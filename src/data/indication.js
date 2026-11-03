import { graph, findPath } from './diagnostics.js';
import { labels } from './panel.js';

// Фокус — куда смотреть. Он не задаёт состояние лампы и не описывает норму.
const tr = labels.filter(label => /^ТР\d+$/.test(label) || label === 'ВЫХ. ТР');
const gr = labels.filter(label => /^ГР\d+$/.test(label));
const generator = labels.filter(label => /^Г[1-8]$/.test(label));
const rt = labels.filter(label => /^[1-9]РТ[12]$/.test(label));
const unique = items => [...new Set(items)].filter(label => labels.includes(label));
const contexts = {
  start: { focusIndicators: [], note: 'Выберите симптом, чтобы увидеть связанные с ним индикаторы.' },
  lp: {
    focusIndicators: [...tr, ...gr, ...generator, 'ВКЛ. ЛГ', 'ИНТЕР. ТС'],
    note: 'Сопоставьте работу распределителей ТС, Г1–Г8, ВКЛ. ЛГ и ИНТЕР. ТС с вариантами ответа. Выделение показывает расположение индикаторов, а не их состояние.',
  },
  'lp-stopped': {
    focusIndicators: ['ПР ЦС'],
    note: 'ПР ЦС выделен для ориентира. Вопрос относится к щелчкам самого реле ЦС: светодиод не подтверждает этот признак.',
  },
  ts: {
    focusIndicators: [...tr, ...gr, ...generator],
    note: 'Обратите внимание на ТР, ГР и Г1–Г8. Последовательность и эталонный ритм переключения в исходнике не заданы.',
  },
  groups: {
    focusIndicators: gr,
    note: 'Выделены индикаторы группового распределителя. Для отсутствующей или лишней группы состояние светодиодов в таблице не указано.',
  },
  both: {
    focusIndicators: ['ПР ЦС'],
    note: 'Проверьте, мигает ли ПР ЦС в течение указанного в ответе интервала 6–7 секунд. Питание смещения — отдельное измерение, его нельзя определить по этой панели.',
  },
  'both-air': {
    focusIndicators: ['ПР ЦС'],
    note: 'ПР ЦС относится к уже выбранному признаку потери приёма. Для нового ответа наблюдайте реле АИР отдельно: его собственного индикатора на панели нет.',
  },
  cs: {
    focusIndicators: ['ПР ЦС'],
    note: 'Наблюдайте ПР ЦС в течение 6–7 секунд и сопоставьте состояние распределителей ТС с формулировкой ответа.',
  },
  tu: {
    focusIndicators: ['ПР ТУ'],
    note: 'Наблюдайте ПР ТУ именно при приёме сигнала ТУ: гаснет он или продолжает гореть.',
  },
  'tu-tr': {
    focusIndicators: ['ПР ТУ', ...rt],
    note: 'ПР ТУ относится к предыдущему ответу. РТ выделены как ориентиры выходных цепей ТУ; их свечение само по себе не подтверждает исправность тактового распределителя.',
  },
  commands: {
    focusIndicators: rt,
    note: 'Найдите постоянно горящий светодиод РТ и запишите его номер. Выделены все РТ; неисправный номер заранее не назначен.',
  },
  rack: {
    focusIndicators: tr,
    note: 'ТР выделены только для варианта об увеличенной скорости. Состояние реле АИР и якоря реле ЦС наблюдается отдельно: соответствующих индикаторов реле на этой панели нет.',
  },
};

const normalNodes = new Set(['lp-normal', 'ts-active', 'ts-passive']);
const offPanelNodes = {
  'both-power': 'Этот ответ относится к измерению питания. Состояние светодиодов в этой строке не указано.',
  'rack-air': 'Состояние реле АИР наблюдается отдельно. Его индикатор на панели не показан.',
  'rack-cs': 'Состояние якоря реле ЦС наблюдается отдельно. ПР ЦС не является индикатором положения этого якоря.',
  'ts-opto': 'Серые и коричневые оптроны из этой строки на панели фото 1 не показаны.',
};

export function getIndicationContext(nodeId) {
  const node = graph[nodeId];
  if (!node) return { focusIndicators: [], note: 'Для этого шага нет описания индикации.' };
  if (contexts[nodeId]) return { ...contexts[nodeId], focusIndicators: unique(contexts[nodeId].focusIndicators) };
  if (offPanelNodes[nodeId]) return { focusIndicators: [], note: offPanelNodes[nodeId] };
  if (nodeId === 'rack-tr') return { focusIndicators: [...tr], note: 'Наблюдайте скорость ТР. Эталонная частота и последовательность работы ТР в исходнике не заданы.' };

  const path = findPath(nodeId) ?? [];
  const parentId = [...path.slice(0, -1)].reverse().find(id => contexts[id]);
  const inheritedFocus = contexts[parentId]?.focusIndicators ?? [];
  if (normalNodes.has(nodeId)) return {
    focusIndicators: unique(inheritedFocus),
    note: 'Эталон нормальной индикации в исходнике не задан. Выделение показывает только связанные индикаторы; их состояние не имитируется.',
  };
  const ownPattern = Object.keys(node.panel ?? {});
  return {
    focusIndicators: unique(ownPattern.length ? ownPattern : inheritedFocus),
    note: ownPattern.length
      ? 'Показан пример признака из выбранной строки. Остальные индикаторы не задают нормальный режим.'
      : 'Для этого ответа отдельный рисунок индикации не задан. Выделены связанные индикаторы без назначения их состояния.',
  };
}

export function getAnswerPreview(fromId, nextId) {
  const from = graph[fromId];
  const next = graph[nextId];
  if (!next || !from?.options?.some(option => option.next === nextId)) return {
    scenario: {}, focusIndicators: [], note: 'Для этого перехода нет описания индикации.', available: false,
  };

  const context = getIndicationContext(nextId);
  const ownPattern = next.panel ?? {};
  const inherited = Object.assign({}, ...(findPath(fromId) ?? []).map(id => graph[id].panel ?? {}));
  // Эти ответы не описывают состояние панели. Общий рисунок родительского
  // вопроса не должен превращаться в якобы наблюдаемое погасание ламп.
  const scenario = normalNodes.has(nextId) || offPanelNodes[nextId]
    ? {}
    : Object.fromEntries(Object.entries({ ...inherited, ...ownPattern }).filter(([label]) => labels.includes(label)));
  const hasOwnPattern = Object.keys(ownPattern).length > 0;
  const hasPattern = Object.keys(scenario).length > 0;
  const focusIndicators = unique([...context.focusIndicators, ...Object.keys(scenario)]);
  const notes = [context.note];
  if (hasPattern && !hasOwnPattern) notes.push('Состояние показанных ламп унаследовано с предыдущего шага; отдельный рисунок для этого ответа не описан.');
  if (next.note) notes.push(next.note);
  if (hasPattern) notes.push('Мигание условное: эталонная частота и циклограмма в исходнике не заданы.');

  return { scenario, focusIndicators, note: notes.join(' '), available: hasPattern || focusIndicators.length > 0 };
}
