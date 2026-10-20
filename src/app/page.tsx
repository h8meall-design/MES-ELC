'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

// Инициализируем Supabase прямо здесь
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

// ============================================================
// ТИПЫ
// ============================================================
type Area = 
  | 'disassembly' | 'washing' | 'drying' | 'kis' | 'machining' 
  | 'welding' | 'unwinding' | 'winding' | 'kitting' | 'assembly' | 'balancing';
type NodeStatus = 'pending' | 'in_progress' | 'done';
type MotorStatus = 
  | 'pending_approval' | 'revision' | 'rejected' | 'cancelled' | 'approved' 
  | 'awaiting_repair' | 'disassembly' | 'in_repair' | 'ready_for_kitting' | 'kitting' | 'assembly' | 'ready' | 'issued';

type Role = 'customer' | 'planner' | 'receiver' | 'worker' | 'technologist';
type RepairType = 'СР' | 'КР' | 'Др.';

interface MotorLog { timestamp: string; user: string; action: string; details?: string; }
interface Attachment { id: string; url: string; timestamp: string; author: string; stage: string; }
interface TemplateDefect { id: string; label: string; targetArea: Area | 'none'; }
interface TemplateStep { area: Area; estTime: number; }
interface TemplateNode { id: string; name: string; baseRoute: TemplateStep[]; defects: TemplateDefect[]; }

interface FlowDefect { id: string; label: string; }
interface FlowNode { id: string; name: string; color: string; defects: FlowDefect[]; }

interface FlowBlock {
  id: string;
  area: Area;
  estTime: number;
  task: string;
  plannerNote?: string;
  x: number;
  y: number;
  kind: 'start' | 'end-tests' | 'normal';
  nodes?: FlowNode[];
  defects?: FlowDefect[];
}

interface FlowConnection {
  id: string;
  fromBlockId: string;
  fromPortId?: string;
  toBlockId: string;
}

interface DefectTemplate {
  id: string;
  name: string;
  nodes: TemplateNode[];
  flowBlocks?: FlowBlock[];
  flowConnections?: FlowConnection[];
}

interface MotorStep {
  area: Area;
  estTime: number;
  startedAt?: string;
  finishedAt?: string;
  workerNote?: string;
  plannerNote?: string;
  task?: string;
  accumulatedMs?: number;
  pausedAt?: string;
  _blockId?: string;
}

interface MotorNode {
  id: string;
  name: string;
  status: NodeStatus;
  route: MotorStep[];
  currentIndex: number;
}

interface Motor {
  id: string;
  batchId: string;
  customerShop: string;
  customerName: string;
  customerPhone: string;
  repairType?: RepairType;
  model: string;
  serialNumber: string;
  power: string;
  rpm: string;
  complaint: string;
  scheduledDate: string;
  status: MotorStatus;
  createdAt: string;
  scheduleStartedAt?: string;
  acceptedAt?: string;
  readyAt?: string;
  shippedAt?: string;
  cellNumber?: string;
  inspectorName?: string;
  foundDefects?: string[];
  defectNote?: string;
  lastTemplateId?: string;
  lastCheckedDefectIds?: string[];
  lastDefectDate?: string;
  lastCellNumber?: string;
  defectSelections?: Record<string, string>;
  notes?: string;
  notesLogs?: MotorLog[];
  workerNote?: string;
  attachments: Attachment[];
  logs: MotorLog[];
  nodes: MotorNode[];
  extraSteps?: MotorStep[];
  selectedTemplateId?: string;
  checkedDefectIds?: string[];
}

// ============================================================
// КОНВЕРТАЦИЯ Supabase <-> клиент (camelCase ↔ snake_case)
// ============================================================
function toDbMotor(m: Motor) {
  return {
    id: m.id,
    batch_id: m.batchId,
    customer_shop: m.customerShop,
    customer_name: m.customerName,
    customer_phone: m.customerPhone,
    repair_type: m.repairType ?? null,
    model: m.model,
    serial_number: m.serialNumber,
    power: m.power,
    rpm: m.rpm,
    complaint: m.complaint,
    scheduled_date: m.scheduledDate,
    status: m.status,
    created_at: m.createdAt,
    schedule_started_at: m.scheduleStartedAt ?? null,
    accepted_at: m.acceptedAt ?? null,
    ready_at: m.readyAt ?? null,
    shipped_at: m.shippedAt ?? null,
    cell_number: m.cellNumber ?? null,
    inspector_name: m.inspectorName ?? null,
    found_defects: m.foundDefects ?? null,
    defect_note: m.defectNote ?? null,
    last_template_id: m.lastTemplateId ?? null,
    last_checked_defect_ids: m.lastCheckedDefectIds ?? null,
    last_defect_date: m.lastDefectDate ?? null,
    last_cell_number: m.lastCellNumber ?? null,
    defect_selections: m.defectSelections ?? null,
    notes: m.notes ?? null,
    notes_logs: m.notesLogs ?? null,
    worker_note: m.workerNote ?? null,
    attachments: m.attachments ?? [],
    logs: m.logs ?? [],
    nodes: m.nodes ?? [],
    extra_steps: m.extraSteps ?? null,
    selected_template_id: m.selectedTemplateId ?? null,
    checked_defect_ids: m.checkedDefectIds ?? null,
  };
}

function fromDbMotor(row: any): Motor {
  return {
    id: row.id,
    batchId: row.batch_id ?? '',
    customerShop: row.customer_shop ?? '',
    customerName: row.customer_name ?? '',
    customerPhone: row.customer_phone ?? '',
    repairType: row.repair_type ?? undefined,
    model: row.model ?? '',
    serialNumber: row.serial_number ?? '',
    power: row.power ?? '',
    rpm: row.rpm ?? '',
    complaint: row.complaint ?? '',
    scheduledDate: row.scheduled_date ?? '',
    status: row.status,
    createdAt: row.created_at ?? new Date().toISOString(),
    scheduleStartedAt: row.schedule_started_at ?? undefined,
    acceptedAt: row.accepted_at ?? undefined,
    readyAt: row.ready_at ?? undefined,
    shippedAt: row.shipped_at ?? undefined,
    cellNumber: row.cell_number ?? undefined,
    inspectorName: row.inspector_name ?? undefined,
    foundDefects: row.found_defects ?? undefined,
    defectNote: row.defect_note ?? undefined,
    lastTemplateId: row.last_template_id ?? undefined,
    lastCheckedDefectIds: row.last_checked_defect_ids ?? undefined,
    lastDefectDate: row.last_defect_date ?? undefined,
    lastCellNumber: row.last_cell_number ?? undefined,
    defectSelections: row.defect_selections ?? undefined,
    notes: row.notes ?? undefined,
    notesLogs: row.notes_logs ?? undefined,
    workerNote: row.worker_note ?? undefined,
    attachments: row.attachments ?? [],
    logs: row.logs ?? [],
    nodes: row.nodes ?? [],
    extraSteps: row.extra_steps ?? undefined,
    selectedTemplateId: row.selected_template_id ?? undefined,
    checkedDefectIds: row.checked_defect_ids ?? undefined,
  };
}

function toDbTemplate(t: DefectTemplate) {
  return {
    id: t.id,
    name: t.name,
    nodes: t.nodes ?? [],
    flow_blocks: t.flowBlocks ?? null,
    flow_connections: t.flowConnections ?? null,
  };
}

function fromDbTemplate(row: any): DefectTemplate {
  return {
    id: row.id,
    name: row.name,
    nodes: row.nodes ?? [],
    flowBlocks: row.flow_blocks ?? undefined,
    flowConnections: row.flow_connections ?? undefined,
  };
}

// ============================================================
// КОНСТАНТЫ
// ============================================================
const AREA_LABELS: Record<Area, string> = {
  disassembly: 'Разборка', washing: 'Мойка', drying: 'Сушка/Пропитка', 
  kis: 'КИС', machining: 'Механика', welding: 'Сварка', 
  unwinding: 'Размотка', winding: 'Обмотка', kitting: 'Комплектовка', 
  assembly: 'Сборка', balancing: 'Балансировка',
};

const AREA_COLORS: Record<Area, string> = {
  disassembly: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  washing: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  drying: 'bg-orange-100 text-orange-800 border-orange-300',
  kis: 'bg-pink-100 text-pink-800 border-pink-300',
  machining: 'bg-blue-100 text-blue-800 border-blue-300',
  welding: 'bg-red-100 text-red-800 border-red-300',
  unwinding: 'bg-purple-100 text-purple-800 border-purple-300',
  winding: 'bg-violet-100 text-violet-800 border-violet-300',
  kitting: 'bg-teal-100 text-teal-800 border-teal-300',
  assembly: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  balancing: 'bg-lime-100 text-lime-800 border-lime-300',
};

const AREA_ORDER: Area[] = ['washing', 'unwinding', 'winding', 'machining', 'balancing', 'welding', 'drying', 'kis'];
const FULL_ROUTE: Area[] = ['disassembly', 'washing', 'unwinding', 'winding', 'machining', 'balancing', 'welding', 'drying', 'kis', 'kitting', 'assembly'];
const NODE_AREA_OPTIONS: Area[] = FULL_ROUTE;

const MOTOR_STATUS_LABELS: Record<MotorStatus, string> = {
  pending_approval: 'На согласовании', revision: 'На доработке', rejected: 'Отклонена', cancelled: 'Отменена',
  approved: 'Согласована (ожидает завоза)', awaiting_repair: 'Ожидает разборки',
  disassembly: 'На разборке', in_repair: 'В работе', ready_for_kitting: 'Готов к КИС',
  kitting: 'Комплектовка', assembly: 'Сборка', ready: 'Готова к выдаче', issued: 'Выдана',
};

const MOTOR_STATUS_COLORS: Record<MotorStatus, string> = {
  pending_approval: 'bg-orange-100 text-orange-800 border-orange-300',
  revision: 'bg-red-100 text-red-800 border-red-300',
  rejected: 'bg-slate-200 text-slate-500 border-slate-300 line-through',
  cancelled: 'bg-slate-200 text-slate-500 border-slate-300 line-through',
  approved: 'bg-blue-100 text-blue-800 border-blue-300',
  awaiting_repair: 'bg-slate-200 text-slate-800 border-slate-400',
  disassembly: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  in_repair: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  ready_for_kitting: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  kitting: 'bg-teal-100 text-teal-800 border-teal-300',
  assembly: 'bg-amber-100 text-amber-800 border-amber-300',
  ready: 'bg-green-100 text-green-800 border-green-300',
  issued: 'bg-slate-100 text-slate-500 border-slate-300',
};

const BLOCK_W = 180;
const BLOCK_H = 90;
const NODE_START_X = 20;
const NODE_START_Y = 30;
const NODE_W = 160;
const NODE_H_MIN = 40;
const NODE_GAP = 10;
const DEFECT_ROW_H = 24;
const OK_ROW_H = 22;

const NODE_COLORS = [
  { value: 'blue',   label: 'Синий',      border: 'border-blue-500',   bg: 'bg-blue-50' },
  { value: 'red',    label: 'Красный',    border: 'border-red-500',    bg: 'bg-red-50' },
  { value: 'green',  label: 'Зелёный',    border: 'border-green-500',  bg: 'bg-green-50' },
  { value: 'purple', label: 'Фиолетовый', border: 'border-purple-500', bg: 'bg-purple-50' },
  { value: 'amber',  label: 'Жёлтый',     border: 'border-amber-500',  bg: 'bg-amber-50' },
  { value: 'pink',   label: 'Розовый',    border: 'border-pink-500',   bg: 'bg-pink-50' },
  { value: 'teal',   label: 'Бирюзовый',  border: 'border-teal-500',   bg: 'bg-teal-50' },
];

// ============================================================
// ХЕЛПЕРЫ
// ============================================================
function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function formatDuration(ms: number) {
  if (ms < 0) return '0ч 0м';
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}ч ${minutes}м`;
}

function stepWorkMs(step: MotorStep): number {
  let ms = step.accumulatedMs || 0;
  if (step.startedAt) ms += Date.now() - new Date(step.startedAt).getTime();
  return ms;
}

function stepFactTime(step: MotorStep): string {
  if (step.finishedAt) return formatDuration(step.accumulatedMs || 0);
  if (step.startedAt) return formatDuration(stepWorkMs(step)) + ' (раб.)';
  if (step.pausedAt) return formatDuration(step.accumulatedMs || 0) + ' (пауза)';
  return '-';
}

function blockHasDefects(block: FlowBlock): boolean {
  return !!(block.defects && block.defects.length > 0);
}

function collectPathFromBlock(
  blocks: FlowBlock[],
  connections: FlowConnection[],
  startBlockId: string,
  selections: Record<string, string>
): FlowBlock[] {
  const path: FlowBlock[] = [];
  const visited = new Set<string>();
  const dfs = (blockId: string): boolean => {
    if (visited.has(blockId)) return false;
    visited.add(blockId);
    const block = blocks.find(b => b.id === blockId);
    if (!block) return false;
    if (block.kind === 'end-tests') return true;
    if (block.kind === 'normal') path.push(block);
    let portId: string | undefined = undefined;
    if (blockHasDefects(block)) {
      const sel = selections[block.id] || '';
      if (sel) portId = sel;
    }
    const nexts = connections.filter(c =>
      c.fromBlockId === blockId &&
      ((portId === undefined && c.fromPortId === undefined) || (portId !== undefined && c.fromPortId === portId))
    );
    for (const c of nexts) if (dfs(c.toBlockId)) return true;
    return false;
  };
  dfs(startBlockId);
  return path;
}

function collectBranchFromPort(
  blocks: FlowBlock[],
  connections: FlowConnection[],
  blockId: string,
  portId: string,
  selections: Record<string, string>
): FlowBlock[] {
  const path: FlowBlock[] = [];
  const visited = new Set<string>();
  const dfs = (bId: string): boolean => {
    if (visited.has(bId)) return false;
    visited.add(bId);
    const block = blocks.find(b => b.id === bId);
    if (!block) return false;
    if (block.kind === 'normal') path.push(block);
    if (block.kind === 'end-tests') return true;
    let nextPort: string | undefined = undefined;
    if (blockHasDefects(block)) {
      const sel = selections[block.id] || '';
      if (sel) nextPort = sel;
    }
    const nexts = connections.filter(c =>
      c.fromBlockId === bId &&
      ((nextPort === undefined && c.fromPortId === undefined) || (nextPort !== undefined && c.fromPortId === nextPort))
    );
    for (const c of nexts) if (dfs(c.toBlockId)) return true;
    return false;
  };
  const startConns = connections.filter(c => c.fromBlockId === blockId && c.fromPortId === portId);
  for (const c of startConns) dfs(c.toBlockId);
  return path;
}

function templateFlowToExtraSteps(template: DefectTemplate): MotorStep[] {
  if (!template.flowBlocks) return defaultExtraSteps();
  const start = template.flowBlocks.find(b => b.kind === 'start');
  const endTests = template.flowBlocks.find(b => b.kind === 'end-tests');
  const steps: MotorStep[] = [];
  if (start) steps.push({ area: 'disassembly', estTime: start.estTime, task: start.task, plannerNote: start.plannerNote, _blockId: start.id });
  if (endTests) steps.push({ area: 'kis', estTime: endTests.estTime, task: endTests.task, plannerNote: endTests.plannerNote, _blockId: endTests.id });
  return steps.length > 0 ? steps : defaultExtraSteps();
}

function createNodesWithDefects(
  template: DefectTemplate,
  checkedDefectIds: string[],
  existingNodes?: MotorNode[],
  selections?: Record<string, string>
): MotorNode[] {
  if (template.flowBlocks && template.flowBlocks.length > 0) {
    const start = template.flowBlocks.find(b => b.kind === 'start');
    const connections = template.flowConnections || [];
    const sels = selections || {};

    if (start && start.nodes && start.nodes.length > 0) {
      return start.nodes.map(fNode => {
        const route: MotorStep[] = [];
        const sel = sels[fNode.id] || '';
        const portId = sel || fNode.id;
        const conn = connections.find(c => c.fromBlockId === start.id && c.fromPortId === portId);
        if (conn) {
          const path = collectPathFromBlock(template.flowBlocks!, connections, conn.toBlockId, sels);
          path.forEach(b => route.push({ 
            area: b.area, estTime: b.estTime, task: b.task, plannerNote: b.plannerNote, _blockId: b.id 
          }));
        }
        const existing = existingNodes?.find(n => n.name === fNode.name);
        if (existing) {
          const mergedRoute = route.map(step => {
            const old = existing.route.find(r => r.area === step.area && r._blockId === step._blockId);
            return {
              ...step,
              startedAt: old?.startedAt, finishedAt: old?.finishedAt,
              workerNote: old?.workerNote, plannerNote: old?.plannerNote || step.plannerNote,
              accumulatedMs: old?.accumulatedMs, pausedAt: old?.pausedAt,
            };
          });
          const newIndex = mergedRoute.findIndex(s => !s.finishedAt);
          return {
            ...existing,
            route: mergedRoute,
            status: mergedRoute.length === 0 ? 'done' : (newIndex === -1 ? 'done' : 'pending'),
            currentIndex: newIndex === -1 ? mergedRoute.length : newIndex,
          };
        }
        return {
          id: generateId(), name: fNode.name,
          status: route.length === 0 ? 'done' : 'pending',
          route, currentIndex: 0,
        };
      });
    }

    const route: MotorStep[] = [];
    const startConn = connections.find(c => c.fromBlockId === start?.id && c.fromPortId === undefined);
    if (startConn && start) {
      const path = collectPathFromBlock(template.flowBlocks, connections, startConn.toBlockId, sels);
      path.forEach(b => route.push({ 
        area: b.area, estTime: b.estTime, task: b.task, plannerNote: b.plannerNote, _blockId: b.id 
      }));
    }
    return [{
      id: generateId(), name: template.name || 'Ремонт',
      status: route.length === 0 ? 'done' : 'pending',
      route, currentIndex: 0,
    }];
  }

  return template.nodes.map(tNode => {
    const existing = existingNodes?.find(n => n.name === tNode.name);
    let route: MotorStep[] = tNode.baseRoute.map(step => {
      const oldStep = existing?.route.find(r => r.area === step.area);
      return {
        ...step,
        startedAt: oldStep?.startedAt, finishedAt: oldStep?.finishedAt,
        workerNote: oldStep?.workerNote, plannerNote: oldStep?.plannerNote,
        task: oldStep?.task, accumulatedMs: oldStep?.accumulatedMs, pausedAt: oldStep?.pausedAt,
      };
    });
    const checkedDefects = tNode.defects.filter(d => checkedDefectIds.includes(d.id));
    checkedDefects.forEach(d => {
      if (d.targetArea !== 'none' && !route.some(r => r.area === d.targetArea)) {
        const oldStep = existing?.route.find(r => r.area === d.targetArea);
        route.push({ 
          area: d.targetArea as Area, estTime: 30,
          startedAt: oldStep?.startedAt, finishedAt: oldStep?.finishedAt,
          workerNote: oldStep?.workerNote, plannerNote: oldStep?.plannerNote,
          task: oldStep?.task, accumulatedMs: oldStep?.accumulatedMs, pausedAt: oldStep?.pausedAt,
        });
      }
    });
    route.sort((a, b) => {
      const idxA = AREA_ORDER.indexOf(a.area);
      const idxB = AREA_ORDER.indexOf(b.area);
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });
    if (existing) return { ...existing, route, status: route.length === 0 ? 'done' : (existing.status === 'done' ? 'done' : 'pending') };
    return { id: generateId(), name: tNode.name, status: route.length === 0 ? 'done' : 'pending', route, currentIndex: 0 };
  });
}

function addLog(motor: Motor, action: string, details?: string, user = 'Система'): Motor {
  const logs = motor.logs ? [...motor.logs] : [];
  logs.push({ timestamp: new Date().toISOString(), user, action, details });
  return { ...motor, logs };
}

function addNoteLog(motor: Motor, action: string, details?: string, user = 'Планировщик'): Motor {
  const notesLogs = motor.notesLogs ? [...motor.notesLogs] : [];
  notesLogs.push({ timestamp: new Date().toISOString(), user, action, details });
  return { ...motor, notesLogs };
}

function generateChangeLog(oldMotor: Motor, updatedData: any) {
  const changes = [];
  const fields: Record<string, string> = {
    customerShop: 'Цех-заказчик', customerName: 'Контактное лицо', customerPhone: 'Телефон',
    repairType: 'Вид ремонта',
    model: 'Тип двигателя', serialNumber: 'Инв. №', power: 'Мощность', 
    rpm: 'Обороты', complaint: 'Пожелания', scheduledDate: 'Дата завоза'
  };
  for (const [key, label] of Object.entries(fields)) {
    const oldVal = oldMotor[key as keyof Motor] || '';
    const newVal = updatedData[key] || '';
    if (oldVal.toString() !== newVal.toString()) changes.push(`«${label}»: "${oldVal || 'пусто'}" → "${newVal || 'пусто'}"`);
  }
  return changes.length > 0 ? changes.join('; ') : 'Без изменений';
}

function defaultExtraSteps(): MotorStep[] {
  return [
    { area: 'disassembly', estTime: 60, task: 'Разобрать двигатель согласно техкарте' },
    { area: 'kis', estTime: 60, task: 'Провести контрольные испытания' },
  ];
}

function createDefaultFlow(): { blocks: FlowBlock[], connections: FlowConnection[] } {
  const startId = generateId();
  const endTestsId = generateId();
  return {
    blocks: [
      { id: startId, area: 'disassembly', estTime: 60, task: 'Разобрать двигатель согласно техкарте', x: 60, y: 250, kind: 'start', nodes: [] },
      { id: endTestsId, area: 'kis', estTime: 60, task: 'Провести контрольные испытания', x: 900, y: 250, kind: 'end-tests' },
    ],
    connections: [
      { id: generateId(), fromBlockId: startId, toBlockId: endTestsId },
    ],
  };
}

function buildKisCompletionResult(
  motor: Motor,
  templates: DefectTemplate[],
  defectIdOrEmpty: string,
  user: string
): Motor {
  const template = templates.find(t => t.id === motor.selectedTemplateId);
  const now = new Date().toISOString();
  
  let extraSteps: MotorStep[] = JSON.parse(JSON.stringify(motor.extraSteps || defaultExtraSteps()));
  const kisIdx = extraSteps.findIndex(s => s.area === 'kis' && !s.finishedAt);
  if (kisIdx >= 0) {
    const kis = extraSteps[kisIdx];
    let accum = kis.accumulatedMs || 0;
    if (kis.startedAt) accum += Date.now() - new Date(kis.startedAt).getTime();
    extraSteps[kisIdx] = { 
      ...kis, 
      startedAt: undefined, 
      pausedAt: undefined, 
      accumulatedMs: accum, 
      finishedAt: now 
    };
  }
  
  if (!defectIdOrEmpty) {
    return addLog(
      { ...motor, status: 'ready', readyAt: now, extraSteps },
      'КИС завершены',
      'Двигатель готов к выдаче',
      user
    );
  }
  
  const kisBlock = template?.flowBlocks?.find(b => b.kind === 'end-tests');
  const defectLabel = kisBlock?.defects?.find(d => d.id === defectIdOrEmpty)?.label || '?';
  
  if (!kisBlock || !template?.flowConnections) {
    return addLog(
      { ...motor, status: 'ready', readyAt: now, extraSteps },
      `КИС: обнаружен дефект "${defectLabel}"`,
      'Ветка в техкарте не определена. Двигатель помечен готовым.',
      user
    );
  }
  
  const branchPath = collectBranchFromPort(
    template.flowBlocks,
    template.flowConnections,
    kisBlock.id,
    defectIdOrEmpty,
    motor.defectSelections || {}
  );
  
  const newKisStep: MotorStep = {
    area: 'kis',
    estTime: kisBlock.estTime,
    task: kisBlock.task,
    plannerNote: kisBlock.plannerNote,
    _blockId: kisBlock.id,
  };
  
  const newDefectSelections = { ...(motor.defectSelections || {}), [kisBlock.id]: defectIdOrEmpty };
  
  if (branchPath.length > 0) {
    const branchNode: MotorNode = {
      id: generateId(),
      name: `Устранение: ${defectLabel}`,
      status: 'pending',
      route: branchPath.map(b => ({
        area: b.area, estTime: b.estTime, task: b.task, plannerNote: b.plannerNote, _blockId: b.id
      })),
      currentIndex: 0,
    };
    
    return addLog(
      { 
        ...motor, 
        status: 'in_repair', 
        readyAt: undefined,
        extraSteps: [...extraSteps, newKisStep],
        nodes: [...motor.nodes, branchNode],
        defectSelections: newDefectSelections,
      },
      `КИС: обнаружен дефект "${defectLabel}"`,
      `Создан узел «${branchNode.name}». После устранения — повторная КИС.`,
      user
    );
  }
  
  return addLog(
    { 
      ...motor, 
      status: 'in_repair', 
      readyAt: undefined,
      extraSteps: [...extraSteps, newKisStep],
      defectSelections: newDefectSelections,
    },
    `КИС: обнаружен дефект "${defectLabel}"`,
    'Ветка для дефекта не задана. Нужна повторная КИС.',
    user
  );
}

function computeRoutedPath(
  x1: number, y1: number, x2: number, y2: number,
  blocks: FlowBlock[], excludeIds: Set<string>
): string {
  const samples = 24;
  let collides = false;
  for (let i = 1; i < samples; i++) {
    const t = i / samples;
    const px = x1 + (x2 - x1) * t;
    const py = y1 + (y2 - y1) * t;
    for (const b of blocks) {
      if (excludeIds.has(b.id)) continue;
      if (px > b.x - 4 && px < b.x + BLOCK_W + 4 && py > b.y - 4 && py < b.y + BLOCK_H + 4) {
        collides = true;
        break;
      }
    }
    if (collides) break;
  }

  if (!collides) {
    if (Math.abs(y2 - y1) < 4) return `M ${x1} ${y1} L ${x2} ${y2}`;
    const midX = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
  }

  const obstacles = blocks.filter(b => {
    if (excludeIds.has(b.id)) return false;
    const bRight = b.x + BLOCK_W;
    const bBottom = b.y + BLOCK_H;
    return !(bRight < Math.min(x1, x2) || b.x > Math.max(x1, x2) || bBottom < Math.min(y1, y2) || b.y > Math.max(y1, y2));
  });

  const topY = obstacles.length > 0 ? Math.min(...obstacles.map(o => o.y)) - 40 : Math.min(y1, y2) - 40;
  const bottomY = obstacles.length > 0 ? Math.max(...obstacles.map(o => o.y + BLOCK_H)) + 40 : Math.max(y1, y2) + 40;
  const goTop = (Math.abs(y1 - topY) + Math.abs(y2 - topY)) < (Math.abs(y1 - bottomY) + Math.abs(y2 - bottomY));
  const routeY = goTop ? Math.max(10, topY) : bottomY;

  const exitX = x1 + 25;
  const entryX = x2 - 25;

  if (entryX <= exitX) {
    const midY = (y1 + y2) / 2;
    const midX2 = Math.min(x1, x2) - 40;
    return `M ${x1} ${y1} L ${exitX} ${y1} L ${exitX} ${routeY} L ${midX2} ${routeY} L ${midX2} ${midY} L ${entryX} ${midY} L ${entryX} ${y2} L ${x2} ${y2}`;
  }

  return `M ${x1} ${y1} L ${exitX} ${y1} L ${exitX} ${routeY} L ${entryX} ${routeY} L ${entryX} ${y2} L ${x2} ${y2}`;
}

// ============================================================
// ГЛАВНЫЙ КОМПОНЕНТ
// ============================================================
export default function HomePage() {
  const [role, setRole] = useState<Role | null>(null);
  const [motors, setMotors] = useState<Motor[]>([]);
  const [templates, setTemplates] = useState<DefectTemplate[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [readLogs, setReadLogs] = useState<Record<string, number>>({});

  // Защита от эхо-петель и устаревших замыканий
  const motorsJsonRef = useRef('');
  const templatesJsonRef = useRef('');
  const readLogsJsonRef = useRef('');
  const motorsRef = useRef<Motor[]>([]);
  const lastUserChangeRef = useRef<number>(0);

  useEffect(() => { motorsRef.current = motors; }, [motors]);

  // ---------- Загрузка из Supabase (один раз при монтировании) ----------
  useEffect(() => {
    const load = async () => {
      try {
        const [mRes, tRes] = await Promise.all([
          supabase.from('motors').select('*'),
          supabase.from('templates').select('*'),
        ]);

        const loadedMotors: Motor[] = (mRes.data || []).map(fromDbMotor);

        // Авто-миграция из старого localStorage (если в БД пусто, а в LS данные есть)
        let finalMotors = loadedMotors;
        try {
          const legacy = typeof window !== 'undefined' ? localStorage.getItem('mes_motors_v29') : null;
          if (legacy && loadedMotors.length === 0) {
            const parsed = JSON.parse(legacy) as Motor[];
            if (Array.isArray(parsed) && parsed.length > 0) {
              await supabase.from('motors').upsert(parsed.map(toDbMotor));
              finalMotors = parsed;
              localStorage.removeItem('mes_motors_v29');
            }
          }
        } catch (e) { /* ignore */ }

        setMotors(finalMotors);
        motorsRef.current = finalMotors;
        motorsJsonRef.current = JSON.stringify(finalMotors);

        let loadedTemplates: DefectTemplate[] = (tRes.data || []).map(fromDbTemplate);
        if (loadedTemplates.length === 0) {
          const { blocks, connections } = createDefaultFlow();
          const defaultTpl: DefectTemplate = {
            id: 'default-1',
            name: 'Стандартная ведомость АИР',
            nodes: [],
            flowBlocks: blocks,
            flowConnections: connections,
          };
          await supabase.from('templates').upsert(toDbTemplate(defaultTpl), { onConflict: 'id' });
          loadedTemplates = [defaultTpl];
        }
        setTemplates(loadedTemplates);
        templatesJsonRef.current = JSON.stringify(loadedTemplates);
      } catch (e) {
        console.error('Ошибка загрузки из Supabase:', e);
      } finally {
        setLoaded(true);
      }
    };
    load();
  }, []);

  // ---------- Загрузка read-логов при смене роли ----------
  useEffect(() => {
    if (!role) return;
    const loadRead = async () => {
      try {
        const { data } = await supabase
          .from('read_state')
          .select('*')
          .eq('role', role)
          .maybeSingle();
        const logs = (data?.data as Record<string, number>) || {};
        setReadLogs(logs);
        readLogsJsonRef.current = JSON.stringify(logs);
      } catch (e) {
        console.error('Ошибка загрузки read_state:', e);
      }
    };
    loadRead();
  }, [role]);

  // ---------- Сохранение моторов (debounce 400мс) ----------
  useEffect(() => {
    if (!loaded) return;
    lastUserChangeRef.current = Date.now();
    const json = JSON.stringify(motors);
    if (json === motorsJsonRef.current) return;

    const timer = setTimeout(async () => {
      try {
        const { data: existing } = await supabase.from('motors').select('id');
        const existingIds = new Set((existing || []).map((r: any) => r.id));
        const currentIds = new Set(motors.map(m => m.id));
        const toDelete = [...existingIds].filter(id => !currentIds.has(id));

        if (motors.length > 0) {
          const { error } = await supabase.from('motors').upsert(motors.map(toDbMotor));
          if (error) console.error('upsert motors:', error);
        }
        if (toDelete.length > 0) {
          const { error } = await supabase.from('motors').delete().in('id', toDelete);
          if (error) console.error('delete motors:', error);
        }
        motorsJsonRef.current = json;
      } catch (e) {
        console.error('Ошибка сохранения моторов:', e);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [motors, loaded]);

  // ---------- Сохранение шаблонов ----------
  useEffect(() => {
    if (!loaded) return;
    const json = JSON.stringify(templates);
    if (json === templatesJsonRef.current) return;

    const timer = setTimeout(async () => {
      try {
        const { data: existing } = await supabase.from('templates').select('id');
        const existingIds = new Set((existing || []).map((r: any) => r.id));
        const currentIds = new Set(templates.map(t => t.id));
        const toDelete = [...existingIds].filter(id => !currentIds.has(id));

        if (templates.length > 0) {
          const { error } = await supabase.from('templates').upsert(templates.map(toDbTemplate));
          if (error) console.error('upsert templates:', error);
        }
        if (toDelete.length > 0) {
          const { error } = await supabase.from('templates').delete().in('id', toDelete);
          if (error) console.error('delete templates:', error);
        }
        templatesJsonRef.current = json;
      } catch (e) {
        console.error('Ошибка сохранения шаблонов:', e);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [templates, loaded]);

  // ---------- Сохранение read-логов ----------
  useEffect(() => {
    if (!loaded || !role) return;
    const json = JSON.stringify(readLogs);
    if (json === readLogsJsonRef.current) return;

    const timer = setTimeout(async () => {
      try {
        const { error } = await supabase
          .from('read_state')
          .upsert({ role, data: readLogs }, { onConflict: 'role' });
        if (error) console.error('upsert read_state:', error);
        readLogsJsonRef.current = json;
      } catch (e) {
        console.error('Ошибка сохранения read_state:', e);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [readLogs, role, loaded]);

  // ---------- Polling: подтягиваем чужие изменения каждые 15 сек ----------
  useEffect(() => {
    if (!loaded) return;
    const interval = setInterval(async () => {
      if (Date.now() - lastUserChangeRef.current < 5000) return;
      try {
        const [mRes, tRes] = await Promise.all([
          supabase.from('motors').select('*'),
          supabase.from('templates').select('*'),
        ]);
        if (mRes.data) {
          const fresh = mRes.data.map(fromDbMotor);
          if (JSON.stringify(fresh) !== JSON.stringify(motorsRef.current)) {
            setMotors(fresh);
            motorsRef.current = fresh;
            motorsJsonRef.current = JSON.stringify(fresh);
          }
        }
        if (tRes.data) {
          const freshT = tRes.data.map(fromDbTemplate);
          if (JSON.stringify(freshT) !== templatesJsonRef.current) {
            setTemplates(freshT);
            templatesJsonRef.current = JSON.stringify(freshT);
          }
        }
      } catch (e) {
        console.error('Ошибка polling:', e);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [loaded]);

  const markLogsRead = (id: string, count: number) =>
    setReadLogs(prev => ({ ...prev, [id]: count }));
  const markAllLogsRead = () => {
    const newReadLogs = { ...readLogs };
    motors.forEach(m => { if (m.logs) newReadLogs[m.id] = m.logs.length; });
    setReadLogs(newReadLogs);
  };

  if (!loaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-white text-lg font-medium animate-pulse">⚙️ Загрузка данных из Supabase…</div>
      </div>
    );
  }

  if (!role) return <LoginScreen onLogin={setRole} />;

  return (
    <MainDashboard 
      role={role} motors={motors} setMotors={setMotors} templates={templates} setTemplates={setTemplates}
      onLogout={() => setRole(null)} readLogs={readLogs} markLogsRead={markLogsRead} markAllLogsRead={markAllLogsRead}
    />
  );
}

// ============================================================
// ЭКРАН ВХОДА
// ============================================================
function LoginScreen({ onLogin }: { onLogin: (r: Role) => void }) {
  const [selectedRole, setSelectedRole] = useState<Role>('customer');
  const roles: { value: Role; label: string }[] = [
    { value: 'customer', label: 'Заказчик' },
    { value: 'planner', label: 'Планировщик' },
    { value: 'receiver', label: 'Приемщик' },
    { value: 'worker', label: 'Рабочий' },
    { value: 'technologist', label: 'Редактор техкарт' },
  ];
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-slate-800">⚙️ MES ЭлектроРемонт</h1>
          <p className="text-slate-500 text-sm mt-1">Управление ремонтом электродвигателей</p>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Войти как</label>
            <div className="grid grid-cols-2 gap-2">
              {roles.map((r) => (
                <button key={r.value} onClick={() => setSelectedRole(r.value)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${selectedRole === r.value ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => onLogin(selectedRole)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition">
            Войти в систему
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ДАШБОРД
// ============================================================
function MainDashboard({ role, motors, setMotors, templates, setTemplates, onLogout, readLogs, markLogsRead, markAllLogsRead }: {
  role: Role; motors: Motor[]; setMotors: (m: Motor[]) => void; templates: DefectTemplate[]; setTemplates: (t: DefectTemplate[]) => void;
  onLogout: () => void; readLogs: Record<string, number>; markLogsRead: (id: string, count: number) => void; markAllLogsRead: () => void;
}) {
  const roleLabels: Record<Role, string> = { customer: 'Заказчик', planner: 'Планировщик', receiver: 'Приемщик', worker: 'Рабочий', technologist: 'Редактор техкарт' };
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="bg-white shadow-sm px-4 md:px-6 py-3 md:py-4">
        <div className="max-w-[1600px] mx-auto flex justify-between items-center flex-wrap gap-3">
          <h1 className="text-lg md:text-xl font-bold text-slate-800">
            ⚙️ MES ЭлектроРемонт <span className="text-sm font-normal text-slate-400">/ {roleLabels[role]}</span>
          </h1>
          <button onClick={onLogout} className="text-slate-500 hover:text-slate-800 text-sm font-medium">Выйти</button>
        </div>
      </header>
      <main className="p-2 md:p-4 mx-auto w-full max-w-[1600px] flex-1">
        {role === 'customer' && <CustomerView motors={motors} setMotors={setMotors} readLogs={readLogs} markLogsRead={markLogsRead} />}
        {role === 'planner' && <PlannerView motors={motors} setMotors={setMotors} templates={templates} readLogs={readLogs} markLogsRead={markLogsRead} markAllLogsRead={markAllLogsRead} />}
        {role === 'receiver' && <ReceiverView motors={motors} setMotors={setMotors} />}
        {role === 'worker' && <WorkerView motors={motors} setMotors={setMotors} templates={templates} readLogs={readLogs} markLogsRead={markLogsRead} />}
        {role === 'technologist' && <TechnologistView templates={templates} setTemplates={setTemplates} />}
      </main>
    </div>
  );
}

// ============================================================
// ОБЩИЕ МОДАЛКИ
// ============================================================
function ReasonModal({ title, onClose, onConfirm }: { title: string; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-4">{title}</h3>
        <textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="Укажите причину..." className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 mb-4" />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-300 rounded-lg text-slate-700 font-medium">Отмена</button>
          <button onClick={() => { if (reason.trim()) onConfirm(reason); else alert('Причина обязательна!'); }} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium">Подтвердить</button>
        </div>
      </div>
    </div>
  );
}

function LogsModal({ motor, readCount, currentUser, onClose }: { 
  motor: Motor; readCount: number; currentUser: string; onClose: () => void; 
}) {
  const start = motor.scheduleStartedAt ? new Date(motor.scheduleStartedAt).getTime() : new Date(motor.createdAt).getTime();
  const end = ['ready', 'issued', 'cancelled', 'rejected'].includes(motor.status)
    ? new Date(motor.readyAt || motor.shippedAt || Date.now()).getTime()
    : Date.now();
  const totalMs = end - start;
  let workMs = 0;
  const areaWorkMs: Record<string, number> = {};
  if (motor.nodes) motor.nodes.forEach(n => n.route.forEach(step => {
    const ms = stepWorkMs(step); workMs += ms;
    if (ms > 0) areaWorkMs[step.area] = (areaWorkMs[step.area] || 0) + ms;
  }));
  if (motor.extraSteps) motor.extraSteps.forEach(step => {
    const ms = stepWorkMs(step); workMs += ms;
    if (ms > 0) areaWorkMs[step.area] = (areaWorkMs[step.area] || 0) + ms;
  });
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[90]">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-2xl">
          <h3 className="text-lg font-bold text-slate-800">История и время</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
        </div>
        <div className="p-4 bg-blue-50 border-b border-blue-100 flex flex-col gap-3 text-sm">
           <div className="flex gap-4">
             <div className="flex-1 bg-white p-2 rounded-lg border border-blue-200 shadow-sm">
               <span className="block text-xs text-slate-500 mb-1">⏱ В графике</span>
               <strong className="text-lg text-blue-900">{formatDuration(totalMs)}</strong>
             </div>
             <div className="flex-1 bg-white p-2 rounded-lg border border-blue-200 shadow-sm">
               <span className="block text-xs text-slate-500 mb-1">🛠 Работа всего</span>
               <strong className="text-lg text-blue-900">{formatDuration(workMs)}</strong>
             </div>
           </div>
           {Object.keys(areaWorkMs).length > 0 && (
             <div className="bg-white p-2 rounded-lg border border-blue-200 shadow-sm">
               <span className="block text-xs text-slate-500 mb-2">Детализация по переделам:</span>
               <div className="grid grid-cols-2 gap-2 text-xs">
                 {Object.entries(areaWorkMs).map(([area, ms]) => (
                   <div key={area} className="flex justify-between">
                     <span className="text-slate-600">{AREA_LABELS[area as Area]}:</span>
                     <span className="font-medium text-slate-800">{formatDuration(ms)}</span>
                   </div>
                 ))}
               </div>
             </div>
           )}
        </div>
        <div className="p-4 overflow-y-auto space-y-3">
          {(!motor.logs || motor.logs.length === 0) && <p className="text-slate-500 text-sm">Нет записей.</p>}
          {motor.logs?.map((log, i) => ({ log, originalIndex: i })).reverse().map(({ log, originalIndex }) => {
            const isUnread = originalIndex >= readCount && log.user !== currentUser;
            return (
              <div key={originalIndex} className={`p-3 rounded-lg border text-sm ${isUnread ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-slate-50 border-slate-200'}`}>
                {isUnread && <span className="text-[10px] font-bold text-blue-600 mb-1 block">НОВОЕ СОБЫТИЕ</span>}
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>{new Date(log.timestamp).toLocaleString('ru-RU')}</span>
                  <span className="font-medium text-slate-700">{log.user}</span>
                </div>
                <p className="font-semibold text-slate-800">{log.action}</p>
                {log.details && <p className="text-slate-600 mt-1">{log.details}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AttachmentsModal({ motor, onClose }: { motor: Motor; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800">Вложения ({motor.attachments?.length || 0})</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
        </div>
        <div className="p-4 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(!motor.attachments || motor.attachments.length === 0) && <p className="text-slate-500 text-sm">Нет вложений.</p>}
          {motor.attachments?.map(att => (
            <div key={att.id} className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
              <img src={att.url} alt="Фото" className="w-full h-40 object-contain bg-white" />
              <div className="p-3 text-xs text-slate-600 space-y-1 border-t border-slate-200">
                <p><strong>Дата:</strong> {new Date(att.timestamp).toLocaleString('ru-RU')}</p>
                <p><strong>Автор:</strong> {att.author}</p>
                <p><strong>Этап:</strong> {att.stage}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MotorInfoModal({ motor, canEdit, onClose, onEdit, onOpenLogs }: { 
  motor: Motor; canEdit: boolean; onClose: () => void; onEdit?: () => void; onOpenLogs?: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
          <h3 className="text-lg font-bold text-slate-800">Информация по двигателю</h3>
          <div className="flex gap-2 items-center flex-wrap">
            {onOpenLogs && (
              <button onClick={onOpenLogs} className="text-xs text-slate-600 border border-slate-300 px-2 py-1 rounded hover:bg-slate-100 flex items-center gap-1">📄 Логи</button>
            )}
            {canEdit && onEdit && (
              <button onClick={onEdit} className="text-xs text-blue-600 border border-blue-200 px-2 py-1 rounded hover:bg-blue-50 flex items-center gap-1">✏️ Редактировать</button>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
          </div>
        </div>
        <div className="p-5 overflow-y-auto space-y-4 text-sm">
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
            <h4 className="font-bold text-slate-800 mb-2">🏭 Данные заказчика</h4>
            <div className="grid grid-cols-2 gap-y-1 gap-x-3">
              <span className="text-slate-500">Цех:</span><span className="font-medium">{motor.customerShop || '-'}</span>
              <span className="text-slate-500">Контакт:</span><span className="font-medium">{motor.customerName || '-'}</span>
              <span className="text-slate-500">Телефон:</span><span className="font-medium">{motor.customerPhone || '-'}</span>
              <span className="text-slate-500">Дата завоза:</span><span className="font-medium">{motor.scheduledDate || '-'}</span>
            </div>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <h4 className="font-bold text-slate-800 mb-2">⚙️ Данные двигателя</h4>
            <div className="grid grid-cols-2 gap-y-1 gap-x-3">
              <span className="text-slate-500">Тип:</span><span className="font-medium">{motor.model || '-'}</span>
              <span className="text-slate-500">Инв. №:</span><span className="font-medium">{motor.serialNumber || '-'}</span>
              <span className="text-slate-500">Мощность:</span><span className="font-medium">{motor.power ? motor.power + ' кВт' : '-'}</span>
              <span className="text-slate-500">Обороты:</span><span className="font-medium">{motor.rpm || '-'}</span>
              <span className="text-slate-500">Вид ремонта:</span><span className="font-medium">{motor.repairType || '-'}</span>
              <span className="text-slate-500">Ячейка:</span><span className="font-medium">{motor.cellNumber || '-'}</span>
              <span className="text-slate-500">Статус:</span>
              <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full border ${MOTOR_STATUS_COLORS[motor.status]} w-fit`}>{MOTOR_STATUS_LABELS[motor.status]}</span>
            </div>
          </div>
          <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
            <h4 className="font-bold text-yellow-900 mb-2">💬 Пожелания / описание дефекта</h4>
            <p className="text-slate-700 whitespace-pre-wrap">{motor.complaint || 'Не указаны'}</p>
          </div>
        </div>
        <div className="p-4 border-t flex justify-end">
          <button onClick={onClose} className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-medium transition">Закрыть</button>
        </div>
      </div>
    </div>
  );
}

function NotesModal({ motor, onClose, onSave }: { motor: Motor; onClose: () => void; onSave: (text: string) => void; }) {
  const [text, setText] = useState(motor.notes || '');
  const [showLogs, setShowLogs] = useState(false);
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
          <h3 className="text-lg font-bold text-slate-800">Личные примечания планера</h3>
          <div className="flex gap-2">
            <button onClick={() => setShowLogs(!showLogs)} className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 px-2 py-1 rounded bg-white">
              {showLogs ? 'К примечанию' : 'История изменений'}
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
          </div>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          {showLogs ? (
            <div className="space-y-3">
              {(!motor.notesLogs || motor.notesLogs.length === 0) && <p className="text-slate-500 text-sm">История пуста.</p>}
              {motor.notesLogs?.map((log, i) => (
                <div key={i} className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-sm">
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>{new Date(log.timestamp).toLocaleString('ru-RU')}</span>
                    <span className="font-medium text-slate-700">{log.user}</span>
                  </div>
                  <p className="font-semibold text-slate-800">{log.action}</p>
                  {log.details && <p className="text-slate-600 mt-1">{log.details}</p>}
                </div>
              ))}
            </div>
          ) : (
            <textarea rows={8} value={text} onChange={e => setText(e.target.value)} placeholder="Введите примечания..." className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          )}
        </div>
        <div className="p-4 border-t flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-300 rounded-lg text-slate-700 font-medium">Отмена</button>
          {!showLogs && <button onClick={() => onSave(text)} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">Сохранить</button>}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// РЕДАКТОР ТЕХКАРТ
// ============================================================
function TechnologistView({ templates, setTemplates }: { templates: DefectTemplate[]; setTemplates: (t: DefectTemplate[]) => void; }) {
  const [draft, setDraft] = useState<DefectTemplate | null>(null);

  const startNew = () => {
    const { blocks, connections } = createDefaultFlow();
    setDraft({ id: '', name: 'Новая техкарта', nodes: [], flowBlocks: blocks, flowConnections: connections });
  };

  const editExisting = (tpl: DefectTemplate) => {
    const draftCopy: DefectTemplate = JSON.parse(JSON.stringify(tpl));
    if (!draftCopy.flowBlocks || draftCopy.flowBlocks.length === 0) {
      const { blocks, connections } = createDefaultFlow();
      draftCopy.flowBlocks = blocks;
      draftCopy.flowConnections = connections;
    }
    if (!draftCopy.flowConnections) draftCopy.flowConnections = [];
    setDraft(draftCopy);
  };

  const handleSave = () => {
    if (!draft) return;
    if (!draft.name.trim()) { alert('Введите название техкарты'); return; }
    const hasStart = (draft.flowBlocks || []).some(b => b.kind === 'start');
    const hasEnd = (draft.flowBlocks || []).some(b => b.kind === 'end-tests');
    if (!hasStart) { alert('Не найден блок "Разборка"'); return; }
    if (!hasEnd) { alert('Не найден блок "Контрольные испытания"'); return; }
    const saved: DefectTemplate = { ...draft, id: draft.id || generateId(), nodes: [] };
    if (draft.id) setTemplates(templates.map(t => t.id === draft.id ? saved : t));
    else setTemplates([...templates, saved]);
    setDraft(null);
  };

  const deleteTemplate = (id: string) => {
    if (confirm('Удалить техкарту?')) setTemplates(templates.filter(t => t.id !== id));
  };

  if (draft) return <FlowEditor draft={draft} setDraft={setDraft} onSave={handleSave} onClose={() => setDraft(null)} />;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-800">Конструктор техкарт</h2>
        <button onClick={startNew} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm shadow-sm">+ Создать техкарту</button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {templates.map(t => {
          const blockCount = t.flowBlocks?.length || t.nodes.reduce((s, n) => s + n.baseRoute.length, 0);
          const nodeCount = t.flowBlocks?.find(b => b.kind === 'start')?.nodes?.length || 0;
          return (
            <div key={t.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-bold text-lg text-slate-800">{t.name}</h3>
                <div className="flex gap-2">
                  <button onClick={() => editExisting(t)} className="text-xs text-blue-600 border border-blue-200 px-2 py-1 rounded hover:bg-blue-50">✏️ Редактировать</button>
                  <button onClick={() => deleteTemplate(t.id)} className="text-xs text-red-600 border border-red-200 px-2 py-1 rounded hover:bg-red-50">Удалить</button>
                </div>
              </div>
              <p className="text-sm text-slate-500">
                {t.flowBlocks ? (
                  <>Блоков: <strong>{blockCount}</strong>, связей: <strong>{t.flowConnections?.length || 0}</strong>, узлов: <strong>{nodeCount}</strong></>
                ) : (
                  <>Узлов: <strong>{t.nodes.length}</strong> (старый формат)</>
                )}
              </p>
            </div>
          );
        })}
        {templates.length === 0 && <p className="text-slate-400 text-sm col-span-full">Нет техкарт. Создайте первую.</p>}
      </div>
    </div>
  );
}

// ============================================================
// ВИЗУАЛЬНЫЙ РЕДАКТОР FLOW
// ============================================================
function FlowEditor({ draft, setDraft, onSave, onClose }: {
  draft: DefectTemplate;
  setDraft: (t: DefectTemplate) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const blocks = draft.flowBlocks || [];
  const connections = draft.flowConnections || [];

  const [dragState, setDragState] = useState<{ blockId: string; offsetX: number; offsetY: number; startX: number; startY: number; moved: boolean } | null>(null);
  const [connecting, setConnecting] = useState<{ fromBlockId: string; fromPortId?: string; mouseX: number; mouseY: number } | null>(null);
  const [editingBlock, setEditingBlock] = useState<FlowBlock | null>(null);
  const [editingNode, setEditingNode] = useState<{ blockId: string; nodeId: string } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);

  const updateBlocks = (newBlocks: FlowBlock[]) => setDraft({ ...draft, flowBlocks: newBlocks });
  const updateConnections = (newConns: FlowConnection[]) => setDraft({ ...draft, flowConnections: newConns });

  const getPortPoint = (block: FlowBlock, portId?: string): { x: number; y: number } | null => {
    if (block.kind === 'start' && block.nodes) {
      let nodeY = block.y + NODE_START_Y;
      for (const n of block.nodes) {
        const nodeH = Math.max(NODE_H_MIN, OK_ROW_H + 20 + n.defects.length * DEFECT_ROW_H);
        if (portId === n.id) return { x: block.x + BLOCK_W + NODE_START_X + NODE_W, y: nodeY + 10 + OK_ROW_H / 2 };
        const dIdx = n.defects.findIndex(d => d.id === portId);
        if (dIdx >= 0) return { x: block.x + BLOCK_W + NODE_START_X + NODE_W, y: nodeY + OK_ROW_H + 10 + dIdx * DEFECT_ROW_H + DEFECT_ROW_H / 2 };
        nodeY += nodeH + NODE_GAP;
      }
      return null;
    }
    if (portId === undefined) return { x: block.x + BLOCK_W, y: block.y + BLOCK_H / 2 };
    if (block.defects) {
      const dIdx = block.defects.findIndex(d => d.id === portId);
      if (dIdx >= 0) return { x: block.x + BLOCK_W, y: block.y + BLOCK_H + 20 + dIdx * DEFECT_ROW_H + DEFECT_ROW_H / 2 };
    }
    return null;
  };

  useEffect(() => {
    if (!dragState) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const scrollLeft = canvasRef.current.scrollLeft;
      const scrollTop = canvasRef.current.scrollTop;
      const x = e.clientX - rect.left - dragState.offsetX + scrollLeft;
      const y = e.clientY - rect.top - dragState.offsetY + scrollTop;
      const moved = Math.abs(e.clientX - dragState.startX) > 3 || Math.abs(e.clientY - dragState.startY) > 3;
      updateBlocks(blocks.map(b => b.id === dragState.blockId ? { ...b, x: Math.max(0, x), y: Math.max(0, y) } : b));
      if (moved && !dragState.moved) setDragState({ ...dragState, moved: true });
    };
    const handleMouseUp = () => {
      const wasMoved = dragState.moved;
      const blockId = dragState.blockId;
      setDragState(null);
      if (!wasMoved) {
        const block = blocks.find(b => b.id === blockId);
        if (block) setEditingBlock(block);
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, blocks]);

  useEffect(() => {
    if (!connecting) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const scrollLeft = canvasRef.current.scrollLeft;
      const scrollTop = canvasRef.current.scrollTop;
      setConnecting({ ...connecting, mouseX: e.clientX - rect.left + scrollLeft, mouseY: e.clientY - rect.top + scrollTop });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [connecting]);

  const handleBlockMouseDown = (blockId: string, e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scrollLeft = canvasRef.current.scrollLeft;
    const scrollTop = canvasRef.current.scrollTop;
    setDragState({
      blockId,
      offsetX: e.clientX - rect.left - block.x + scrollLeft,
      offsetY: e.clientY - rect.top - block.y + scrollTop,
      startX: e.clientX, startY: e.clientY, moved: false,
    });
  };

  const handleOutputMouseDown = (blockId: string, e: React.MouseEvent, fromPortId?: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scrollLeft = canvasRef.current.scrollLeft;
    const scrollTop = canvasRef.current.scrollTop;
    setConnecting({ fromBlockId: blockId, fromPortId, mouseX: e.clientX - rect.left + scrollLeft, mouseY: e.clientY - rect.top + scrollTop });
  };

  const handleInputMouseUp = (blockId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!connecting) return;
    if (connecting.fromBlockId === blockId) { setConnecting(null); return; }
    const exists = connections.some(c => c.fromBlockId === connecting.fromBlockId && c.fromPortId === connecting.fromPortId && c.toBlockId === blockId);
    if (exists) { setConnecting(null); return; }
    updateConnections([...connections, { id: generateId(), fromBlockId: connecting.fromBlockId, fromPortId: connecting.fromPortId, toBlockId: blockId }]);
    setConnecting(null);
  };

  const handleDeleteBlock = (blockId: string) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    if (block.kind !== 'normal') { alert('Фиксированный блок удалить нельзя'); return; }
    if (!confirm('Удалить блок и все его связи?')) return;
    setDraft({
      ...draft,
      flowBlocks: blocks.filter(b => b.id !== blockId),
      flowConnections: connections.filter(c => c.fromBlockId !== blockId && c.toBlockId !== blockId),
    });
  };

  const handleCopyBlock = (blockId: string) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    if (block.kind !== 'normal') { alert('Копировать можно только обычные блоки'); return; }
    const newBlock: FlowBlock = {
      id: generateId(), area: block.area, estTime: block.estTime, task: block.task, plannerNote: block.plannerNote,
      x: block.x + 40, y: block.y + 40, kind: 'normal',
      defects: block.defects ? JSON.parse(JSON.stringify(block.defects)) : undefined,
    };
    setDraft({ ...draft, flowBlocks: [...blocks, newBlock] });
  };

  const handleDeleteConnection = (connId: string) => {
    if (!confirm('Удалить связь?')) return;
    updateConnections(connections.filter(c => c.id !== connId));
  };

  const handleAddBlock = () => {
    const newBlock: FlowBlock = {
      id: generateId(), area: 'washing', estTime: 30, task: '',
      x: 200, y: 100 + blocks.length * 30, kind: 'normal',
    };
    updateBlocks([...blocks, newBlock]);
    setEditingBlock(newBlock);
  };

  const handleBlockSave = (updated: FlowBlock) => {
    updateBlocks(blocks.map(b => b.id === updated.id ? updated : b));
    setEditingBlock(null);
  };

  const handleDeleteNode = (blockId: string, nodeId: string) => {
    if (!confirm('Удалить узел и все его дефекты со связями?')) return;
    const block = blocks.find(b => b.id === blockId);
    if (!block || !block.nodes) return;
    const node = block.nodes.find(n => n.id === nodeId);
    const defectIds = new Set(node?.defects.map(d => d.id) || []);
    const portsToRemove = new Set([nodeId, ...defectIds]);
    setDraft({
      ...draft,
      flowBlocks: blocks.map(b => b.id === blockId ? { ...b, nodes: b.nodes!.filter(n => n.id !== nodeId) } : b),
      flowConnections: connections.filter(c => !(c.fromBlockId === blockId && c.fromPortId && portsToRemove.has(c.fromPortId))),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 md:p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-[98vw] h-[95vh] flex flex-col">
        <div className="p-3 border-b flex justify-between items-center gap-3 flex-wrap bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-lg font-bold text-slate-800">🎨 Редактор техкарты:</span>
            <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Название" className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none font-medium w-64" />
            <button onClick={handleAddBlock} className="bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-1.5 rounded-lg font-medium">+ Блок</button>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 font-medium text-sm hover:bg-slate-100">Отмена</button>
            <button onClick={onSave} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm">Сохранить</button>
          </div>
        </div>

        <div className="px-3 py-1.5 bg-blue-50 border-b border-blue-100 text-xs text-blue-800 flex gap-4 flex-wrap">
          <span>🔵 Вход</span>
          <span>🟢 Выход / дефект</span>
          <span>🔗 Клик на линию — удалить</span>
          <span>🖱️ Тянуть блок — перетащить</span>
          <span>✏️ Клик на блок — редактировать</span>
          <span>📋 Копировать</span>
          <span>⚙️ Клик на узел — дефекты</span>
        </div>

        <div ref={canvasRef} className="flex-1 overflow-auto bg-slate-100 relative">
          <div style={{ width: 2400, height: 1600, position: 'relative', backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
            <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}>
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#475569" />
                </marker>
              </defs>
              {connections.map(conn => {
                const from = blocks.find(b => b.id === conn.fromBlockId);
                const to = blocks.find(b => b.id === conn.toBlockId);
                if (!from || !to) return null;
                const pt = getPortPoint(from, conn.fromPortId);
                if (!pt) return null;
                const x1 = pt.x, y1 = pt.y;
                const x2 = to.x;
                const y2 = to.y + BLOCK_H / 2;
                const excludeIds = new Set([from.id, to.id]);
                const path = computeRoutedPath(x1, y1, x2, y2, blocks, excludeIds);
                return (
                  <g key={conn.id}>
                    <path d={path} stroke="#475569" strokeWidth="2" fill="none" markerEnd="url(#arrow)" />
                    <path d={path} stroke="transparent" strokeWidth="14" fill="none" style={{ pointerEvents: 'stroke', cursor: 'pointer' }} onClick={() => handleDeleteConnection(conn.id)} />
                  </g>
                );
              })}
              {connecting && (() => {
                const from = blocks.find(b => b.id === connecting.fromBlockId);
                if (!from) return null;
                const pt = getPortPoint(from, connecting.fromPortId);
                if (!pt) return null;
                const path = computeRoutedPath(pt.x, pt.y, connecting.mouseX, connecting.mouseY, blocks, new Set([from.id]));
                return <path d={path} stroke="#3b82f6" strokeWidth="2" fill="none" strokeDasharray="6,4" />;
              })()}
            </svg>

            {blocks.map(block => {
              const isFixed = block.kind !== 'normal';
              const badge = block.kind === 'start' ? '▶ НАЧАЛО' : block.kind === 'end-tests' ? '🏁 КОНЕЦ (КИС)' : null;
              const hasNodes = block.kind === 'start' && block.nodes && block.nodes.length > 0;
              const hasDefects = blockHasDefects(block);
              const showStandardOutput = !hasNodes;
              const defects = block.defects || [];

              return (
                <div
                  key={block.id}
                  style={{ left: block.x, top: block.y, width: BLOCK_W, height: BLOCK_H, position: 'absolute', zIndex: 10 }}
                  onMouseDown={(e) => {
                    if ((e.target as HTMLElement).closest('[data-no-drag]')) return;
                    e.stopPropagation();
                    handleBlockMouseDown(block.id, e);
                  }}
                  className={`border-2 rounded-xl shadow-md select-none cursor-grab active:cursor-grabbing transition-shadow hover:shadow-xl ${AREA_COLORS[block.area]} ${isFixed ? 'border-slate-700 border-4' : 'border-slate-400'}`}
                >
                  <div
                    data-no-drag
                    onMouseUp={(e) => handleInputMouseUp(block.id, e)}
                    style={{ left: -10, top: BLOCK_H / 2 - 10, width: 20, height: 20, position: 'absolute' }}
                    className="bg-blue-500 rounded-full border-2 border-white shadow-md cursor-pointer hover:scale-125 hover:bg-blue-600 transition"
                    title="Вход"
                  />
                  {showStandardOutput && (
                    <div
                      data-no-drag
                      onMouseDown={(e) => handleOutputMouseDown(block.id, e, undefined)}
                      style={{ right: -10, top: BLOCK_H / 2 - 10, width: 20, height: 20, position: 'absolute' }}
                      className="bg-green-500 rounded-full border-2 border-white shadow-md cursor-crosshair hover:scale-125 hover:bg-green-600 transition"
                      title={hasDefects ? 'OK (нет дефекта)' : 'Выход'}
                    />
                  )}

                  {badge && (
                    <div className={`absolute -top-6 left-0 text-[10px] font-bold whitespace-nowrap px-1.5 py-0.5 rounded ${isFixed ? 'bg-slate-800 text-white' : 'text-slate-600'}`}>{badge}</div>
                  )}

                  <div className="p-2 h-full flex flex-col">
                    <div className="font-bold text-sm mb-0.5 truncate">{AREA_LABELS[block.area]}</div>
                    <div className="text-[11px] text-slate-700 flex-1 overflow-hidden leading-tight" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {block.task || <span className="text-slate-400 italic">без задания</span>}
                    </div>
                    <div className="text-[10px] text-slate-600 mt-1 flex gap-2 items-center flex-wrap">
                      <span>⏱ {block.estTime} мин</span>
                      {hasNodes && <span className="text-slate-500">• узлов: {block.nodes!.length}</span>}
                      {hasDefects && <span className="text-red-600 font-semibold">• деф: {defects.length}</span>}
                    </div>
                    {block.plannerNote && (
                      <div className="text-[10px] text-blue-700 bg-blue-50 border border-blue-200 rounded px-1 mt-0.5 truncate" title={block.plannerNote}>💬 {block.plannerNote}</div>
                    )}
                  </div>

                  <div className="absolute top-1 right-1 flex gap-1">
                    <button data-no-drag onClick={(e) => { e.stopPropagation(); setEditingBlock(block); }} className="bg-white/90 hover:bg-white text-blue-600 w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center shadow" title="Редактировать">✏️</button>
                    {!isFixed && (
                      <>
                        <button data-no-drag onClick={(e) => { e.stopPropagation(); handleCopyBlock(block.id); }} className="bg-white/90 hover:bg-blue-100 text-blue-600 w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center shadow" title="Копировать">📋</button>
                        <button data-no-drag onClick={(e) => { e.stopPropagation(); handleDeleteBlock(block.id); }} className="bg-white/90 hover:bg-red-500 hover:text-white text-red-600 w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center shadow" title="Удалить">✕</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {blocks.filter(b => b.kind !== 'start' && blockHasDefects(b)).map(block => {
              const defects = block.defects || [];
              return defects.map((d, di) => {
                const top = block.y + BLOCK_H + 20 + di * DEFECT_ROW_H;
                return (
                  <div
                    key={d.id}
                    style={{ left: block.x, top, width: BLOCK_W, height: DEFECT_ROW_H, position: 'absolute', zIndex: 11 }}
                    className="bg-red-50 border border-red-300 rounded-md px-2 flex items-center shadow-sm text-[10px] text-red-800 truncate"
                    title={d.label}
                  >
                    ⚡ {d.label}
                    <div
                      data-no-drag
                      onMouseDown={(e) => handleOutputMouseDown(block.id, e, d.id)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ right: -10, top: DEFECT_ROW_H / 2 - 10, width: 20, height: 20, position: 'absolute' }}
                      className="bg-green-500 rounded-full border-2 border-white shadow-md cursor-crosshair hover:scale-125 hover:bg-green-600 transition"
                      title={`Выход: ${d.label}`}
                    />
                  </div>
                );
              });
            })}

            {blocks.filter(b => b.kind === 'start').map(block => {
              if (!block.nodes) return null;
              let nodeY = NODE_START_Y;
              return block.nodes.map(node => {
                const nodeH = Math.max(NODE_H_MIN, OK_ROW_H + 20 + node.defects.length * DEFECT_ROW_H);
                const top = block.y + nodeY;
                nodeY += nodeH + NODE_GAP;
                const colorDef = NODE_COLORS.find(c => c.value === node.color) || NODE_COLORS[0];

                return (
                  <div
                    key={node.id}
                    onClick={() => setEditingNode({ blockId: block.id, nodeId: node.id })}
                    style={{ left: block.x + BLOCK_W + NODE_START_X, top, width: NODE_W, height: nodeH, position: 'absolute', zIndex: 15 }}
                    className={`border-2 ${colorDef.border} ${colorDef.bg} rounded-lg shadow-md cursor-pointer hover:shadow-xl transition`}
                    title="Клик — управление дефектами"
                  >
                    <div className="font-bold text-xs px-2 truncate border-b border-slate-200/60 flex items-center justify-between" style={{ height: OK_ROW_H }}>
                      <span className="truncate">{node.name} (OK)</span>
                      <div
                        data-no-drag
                        onMouseDown={(e) => handleOutputMouseDown(block.id, e, node.id)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ width: 16, height: 16, marginRight: -10 }}
                        className="bg-green-500 rounded-full border-2 border-white shadow-md cursor-crosshair hover:scale-125 hover:bg-green-600 transition shrink-0"
                        title={`OK-выход узла "${node.name}"`}
                      />
                    </div>
                    {node.defects.length === 0 && <div className="text-[10px] text-slate-400 italic px-2 py-1">нет дефектов</div>}
                    {node.defects.map((defect) => (
                      <div key={defect.id} style={{ position: 'relative', height: DEFECT_ROW_H }}>
                        <div className="text-[10px] text-slate-600 truncate px-2 leading-[24px]">{defect.label}</div>
                        <div style={{ position: 'absolute', right: -10, top: DEFECT_ROW_H / 2 - 8 }}>
                          <div
                            data-no-drag
                            onMouseDown={(e) => handleOutputMouseDown(block.id, e, defect.id)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: 16, height: 16 }}
                            className="bg-green-500 rounded-full border-2 border-white shadow-md cursor-crosshair hover:scale-125 hover:bg-green-600 transition"
                            title={`Выход: ${defect.label}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                );
              });
            })}
          </div>
        </div>
      </div>

      {editingBlock && <FlowBlockEditModal block={editingBlock} onClose={() => setEditingBlock(null)} onSave={handleBlockSave} />}

      {editingNode && (() => {
        const block = blocks.find(b => b.id === editingNode.blockId);
        const node = block?.nodes?.find(n => n.id === editingNode.nodeId);
        if (!block || !node) return null;
        return (
          <NodeDefectsModal
            block={block}
            node={node}
            onChange={(newNode) => {
              const newBlocks = blocks.map(b => {
                if (b.id !== block.id || !b.nodes) return b;
                return { ...b, nodes: b.nodes.map(n => n.id === newNode.id ? newNode : n) };
              });
              const currentNode = block.nodes!.find(n => n.id === node.id);
              const oldDefectIds = new Set(currentNode?.defects.map(d => d.id) || []);
              const newDefectIds = new Set(newNode.defects.map(d => d.id));
              const removed = new Set([...oldDefectIds].filter(id => !newDefectIds.has(id)));
              const newConns = connections.filter(c => !(c.fromBlockId === block.id && c.fromPortId && removed.has(c.fromPortId)));
              setDraft({ ...draft, flowBlocks: newBlocks, flowConnections: newConns });
            }}
            onDelete={() => { setEditingNode(null); handleDeleteNode(block.id, node.id); }}
            onClose={() => setEditingNode(null)}
          />
        );
      })()}
    </div>
  );
}

// ============================================================
// МОДАЛКА РЕДАКТИРОВАНИЯ БЛОКА FLOW
// ============================================================
function FlowBlockEditModal({ block, onClose, onSave }: { block: FlowBlock; onClose: () => void; onSave: (b: FlowBlock) => void; }) {
  const isFixed = block.kind !== 'normal';
  const isStart = block.kind === 'start';
  const isEnd = block.kind === 'end-tests';
  const [area, setArea] = useState<Area>(block.area);
  const [estTime, setEstTime] = useState(block.estTime);
  const [task, setTask] = useState(block.task || '');
  const [plannerNote, setPlannerNote] = useState(block.plannerNote || '');
  const [nodes, setNodes] = useState<FlowNode[]>(block.nodes || []);
  const [defects, setDefects] = useState<FlowDefect[]>(block.defects || []);
  const [newNodeName, setNewNodeName] = useState('');
  const [newNodeColor, setNewNodeColor] = useState('blue');
  const [newDefectLabel, setNewDefectLabel] = useState('');

  const fixedLabel = block.kind === 'start' ? 'Разборка (начало)' : block.kind === 'end-tests' ? 'Контрольные испытания (конец)' : null;

  const handleAddNode = () => {
    if (!newNodeName.trim()) { alert('Введите название узла'); return; }
    setNodes([...nodes, { id: generateId(), name: newNodeName.trim(), color: newNodeColor, defects: [] }]);
    setNewNodeName('');
  };
  const handleDeleteNode = (nodeId: string) => {
    if (!confirm('Удалить узел? Все его дефекты и связи будут удалены.')) return;
    setNodes(nodes.filter(n => n.id !== nodeId));
  };
  const handleAddDefect = () => {
    if (!newDefectLabel.trim()) { alert('Введите название дефекта'); return; }
    setDefects([...defects, { id: generateId(), label: newDefectLabel.trim() }]);
    setNewDefectLabel('');
  };
  const handleDeleteDefect = (id: string) => {
    if (!confirm('Удалить дефект? Связи от него будут удалены.')) return;
    setDefects(defects.filter(d => d.id !== id));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[70]">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-4">{isFixed ? fixedLabel : 'Редактирование блока'}</h3>
        <div className="space-y-3">
          {isFixed ? (
            <div className="bg-slate-100 border border-slate-200 rounded-lg p-2 text-sm text-slate-700">
              <strong>Передел:</strong> {AREA_LABELS[block.area]}
              <div className="text-xs text-slate-500 mt-1">Фиксированный блок</div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Передел</label>
              <select value={area} onChange={e => setArea(e.target.value as Area)} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white outline-none text-sm">
                {NODE_AREA_OPTIONS.map(a => <option key={a} value={a}>{AREA_LABELS[a]}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Плановое время (мин)</label>
            <input type="number" min={1} value={estTime} onChange={e => setEstTime(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Задание</label>
            <textarea rows={2} value={task} onChange={e => setTask(e.target.value)} placeholder="Что нужно сделать" className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none text-sm resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">💬 Комментарий планера</label>
            <textarea rows={2} value={plannerNote} onChange={e => setPlannerNote(e.target.value)} placeholder="Пояснения для исполнителя" className="w-full px-3 py-2 border border-blue-200 bg-blue-50 rounded-lg outline-none text-sm resize-none" />
          </div>

          {isStart && (
            <div className="border-t border-slate-200 pt-3">
              <label className="block text-sm font-semibold text-slate-800 mb-2">⚙️ Узлы (разбираемые единицы)</label>
              <p className="text-xs text-slate-500 mb-2">У каждого узла всегда есть OK-выход + дефект-выходы.</p>
              {nodes.length === 0 && <p className="text-xs text-slate-400 italic bg-slate-50 border border-dashed border-slate-300 rounded-lg p-2 text-center mb-2">Узлов нет. Добавьте первый.</p>}
              <div className="space-y-2 mb-3">
                {nodes.map(node => {
                  const colorDef = NODE_COLORS.find(c => c.value === node.color) || NODE_COLORS[0];
                  return (
                    <div key={node.id} className={`border-2 ${colorDef.border} ${colorDef.bg} rounded-lg p-2 flex items-center gap-2`}>
                      <input value={node.name} onChange={e => setNodes(nodes.map(n => n.id === node.id ? { ...n, name: e.target.value } : n))} className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm outline-none bg-white" />
                      <select value={node.color} onChange={e => setNodes(nodes.map(n => n.id === node.id ? { ...n, color: e.target.value } : n))} className="px-1 py-1 border border-slate-300 rounded text-xs bg-white outline-none">
                        {NODE_COLORS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                      <span className="text-xs text-slate-500">{node.defects.length} деф.</span>
                      <button onClick={() => handleDeleteNode(node.id)} className="text-red-500 hover:text-red-700 text-xs font-bold px-1">✕</button>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2 items-center">
                <input value={newNodeName} onChange={e => setNewNodeName(e.target.value)} placeholder="Название узла" className="flex-1 px-2 py-1.5 border border-slate-300 rounded text-sm outline-none" onKeyDown={e => { if (e.key === 'Enter') handleAddNode(); }} />
                <select value={newNodeColor} onChange={e => setNewNodeColor(e.target.value)} className="px-1 py-1.5 border border-slate-300 rounded text-xs bg-white outline-none">
                  {NODE_COLORS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <button onClick={handleAddNode} className="bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-1.5 rounded">+ Узел</button>
              </div>
            </div>
          )}

          {!isStart && (
            <div className="border-t border-slate-200 pt-3">
              <label className="block text-sm font-semibold text-slate-800 mb-2">⚡ Дефекты (развилки на переделе)</label>
              <p className="text-xs text-slate-500 mb-2">Каждый дефект = зелёная точка-выход под блоком. OK-выход = стандартный. {isEnd && 'Для КИС — определяют, куда отправить двигатель при неудачных испытаниях.'}</p>
              {defects.length === 0 && <p className="text-xs text-slate-400 italic bg-slate-50 border border-dashed border-slate-300 rounded-lg p-2 text-center mb-2">Дефектов нет — блок работает как обычно.</p>}
              <div className="space-y-1.5 mb-3">
                {defects.map(d => (
                  <div key={d.id} className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-1.5">
                    <span className="w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow shrink-0" />
                    <input value={d.label} onChange={e => setDefects(defects.map(x => x.id === d.id ? { ...x, label: e.target.value } : x))} className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm outline-none bg-white" />
                    <button onClick={() => handleDeleteDefect(d.id)} className="text-red-500 hover:text-red-700 text-xs font-bold px-1">✕</button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 items-center">
                <input value={newDefectLabel} onChange={e => setNewDefectLabel(e.target.value)} placeholder="Название дефекта" className="flex-1 px-2 py-1.5 border border-slate-300 rounded text-sm outline-none" onKeyDown={e => { if (e.key === 'Enter') handleAddDefect(); }} />
                <button onClick={handleAddDefect} className="bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-1.5 rounded">+ Дефект</button>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-4 pt-3 border-t border-slate-200">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-300 rounded-lg text-slate-700 font-medium">Отмена</button>
          <button onClick={() => onSave({ 
            ...block, 
            area: isFixed ? block.area : area, estTime, 
            task: task.trim(), plannerNote: plannerNote.trim() || undefined,
            nodes: isStart ? nodes : block.nodes,
            defects: (!isStart) ? defects : block.defects,
          })} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">Сохранить</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// МОДАЛКА ДЕФЕКТОВ УЗЛА
// ============================================================
function NodeDefectsModal({ block, node, onChange, onDelete, onClose }: {
  block: FlowBlock; node: FlowNode;
  onChange: (newNode: FlowNode) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(node.name);
  const [color, setColor] = useState(node.color);
  const [defects, setDefects] = useState<FlowDefect[]>(node.defects);
  const [newDefectLabel, setNewDefectLabel] = useState('');

  const handleAddDefect = () => {
    if (!newDefectLabel.trim()) { alert('Введите название дефекта'); return; }
    setDefects([...defects, { id: generateId(), label: newDefectLabel.trim() }]);
    setNewDefectLabel('');
  };
  const handleDeleteDefect = (defectId: string) => {
    if (!confirm('Удалить дефект? Связи от него будут удалены.')) return;
    setDefects(defects.filter(d => d.id !== defectId));
  };
  const handleApply = () => {
    onChange({ ...node, name: name.trim() || node.name, color, defects });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[80]">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto p-6">
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-lg font-bold text-slate-800">Узел: дефектовка</h3>
          <div className="flex gap-2">
            <button onClick={onDelete} className="text-xs text-red-600 border border-red-200 px-2 py-1 rounded hover:bg-red-50">Удалить узел</button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
          </div>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><label className="block text-xs font-medium text-slate-700 mb-1">Название</label><input value={name} onChange={e => setName(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm outline-none" /></div>
            <div><label className="block text-xs font-medium text-slate-700 mb-1">Цвет</label><select value={color} onChange={e => setColor(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm bg-white outline-none">{NODE_COLORS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-xs text-green-800">
            ✓ OK-точка узла создана автоматически — от неё можно протянуть цепочку «нет дефекта → сразу к ремонту».
          </div>
          <div className="border-t border-slate-200 pt-3">
            <label className="block text-sm font-semibold text-slate-800 mb-2">🔴 Дефекты (варианты ответа)</label>
            <p className="text-xs text-slate-500 mb-2">Каждый дефект = зелёная точка-выход.</p>
            {defects.length === 0 && <p className="text-xs text-slate-400 italic bg-slate-50 border border-dashed border-slate-300 rounded-lg p-2 text-center mb-2">Дефектов нет.</p>}
            <div className="space-y-1.5 mb-3">
              {defects.map(defect => (
                <div key={defect.id} className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-1.5">
                  <span className="w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow shrink-0" />
                  <input value={defect.label} onChange={e => setDefects(defects.map(d => d.id === defect.id ? { ...d, label: e.target.value } : d))} className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm outline-none bg-white" />
                  <button onClick={() => handleDeleteDefect(defect.id)} className="text-red-500 hover:text-red-700 text-xs font-bold px-1">✕</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 items-center">
              <input value={newDefectLabel} onChange={e => setNewDefectLabel(e.target.value)} placeholder="Название дефекта" className="flex-1 px-2 py-1.5 border border-slate-300 rounded text-sm outline-none" onKeyDown={e => { if (e.key === 'Enter') handleAddDefect(); }} />
              <button onClick={handleAddDefect} className="bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-1.5 rounded">+ Дефект</button>
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-4 pt-3 border-t border-slate-200">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-300 rounded-lg text-slate-700 font-medium">Отмена</button>
          <button onClick={handleApply} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">Применить</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ЗАКАЗЧИК
// ============================================================
function CustomerView({ motors, setMotors, readLogs, markLogsRead }: { 
  motors: Motor[]; setMotors: (m: Motor[]) => void; 
  readLogs: Record<string, number>; markLogsRead: (id: string, count: number) => void; 
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingMotor, setEditingMotor] = useState<Motor | null>(null);
  const [searchPhone, setSearchPhone] = useState('');
  const [logsMotor, setLogsMotor] = useState<Motor | null>(null);
  const [attachmentsMotor, setAttachmentsMotor] = useState<Motor | null>(null);
  const [infoMotor, setInfoMotor] = useState<Motor | null>(null);

  const myMotors = motors.filter(m => m.customerPhone.includes(searchPhone) && searchPhone !== '');
  const openLogs = (motor: Motor) => setLogsMotor(motor);
  const closeLogs = () => { if (logsMotor) markLogsRead(logsMotor.id, logsMotor.logs?.length || 0); setLogsMotor(null); };

  const handleEditSubmit = (updatedData: any) => {
    if (!editingMotor) return;
    const diff = generateChangeLog(editingMotor, updatedData);
    setMotors(motors.map(m => {
      if (m.id === editingMotor.id) {
        let updated = { ...m, ...updatedData };
        updated = addLog(updated, 'Заказчик отредактировал заявку', diff, 'Заказчик');
        if (m.status === 'revision') updated.status = 'pending_approval';
        return updated;
      }
      return m;
    }));
    setEditingMotor(null);
  };

  const cancelMotor = (id: string) => {
    if (confirm('Вы уверены, что хотите отменить заявку?')) {
      setMotors(motors.map(m => m.id === id ? addLog({ ...m, status: 'cancelled' }, 'Заявка отменена заказчиком', undefined, 'Заказчик') : m));
    }
  };

  const generateTestMotor = () => {
    const types = ['АИР80В2', 'АИР100S4', 'АИР132М4', 'ВАО2-71-4', '4А112М4', 'АИР180S2'];
    const powers = ['1.5', '3', '5.5', '7.5', '11', '15', '22', '30', '45'];
    const rpms = ['750', '1000', '1500', '3000'];
    const repairTypes: RepairType[] = ['СР', 'КР', 'Др.'];
    const shops = ['ЛПЦ-2', 'Прокатный', 'ЭСПЦ', 'Кислородный', 'Доменный'];
    const random = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];
    const testNum = Math.floor(Math.random() * 900) + 100;
    const rType = random(repairTypes);
    let comp = '';
    if (rType === 'Др.') comp = random(['демонтаж п/м', 'монтаж п/м', 'ревизия', 'списание']);
    else comp = Math.random() > 0.5 ? 'Тестовое пожелание (срочно!)' : '';
    const newMotor: Motor = {
      id: generateId(), batchId: generateId(), customerShop: random(shops),
      customerName: 'Тестовый Заказчик', customerPhone: '0', repairType: rType,
      model: random(types), serialNumber: `test${testNum}`,
      power: random(powers), rpm: random(rpms), complaint: comp,
      scheduledDate: new Date().toISOString().split('T')[0], status: 'pending_approval',
      createdAt: new Date().toISOString(), attachments: [],
      logs: [{ timestamp: new Date().toISOString(), user: 'Система', action: 'Создана тестовая заявка' }],
      nodes: [],
    };
    setMotors([newMotor, ...motors]);
    setSearchPhone('0');
  };

  return (
    <>
      <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
        <h2 className="text-lg font-semibold text-slate-800">Мои заявки</h2>
        <div className="flex gap-2">
          <button onClick={generateTestMotor} className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-medium text-sm shadow-sm transition">⚡ + Тестовый двигатель</button>
          <button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm shadow-sm transition">+ Создать заявку</button>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6 max-w-md">
        <label className="block text-sm font-medium text-slate-700 mb-2">Поиск по вашему номеру телефона</label>
        <input value={searchPhone} onChange={(e) => setSearchPhone(e.target.value)} placeholder="+7 900 000-00-00 или 0" className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div className="grid gap-4">
        {myMotors.map(motor => {
          const unread = (motor.logs?.length || 0) > (readLogs[motor.id] || 0);
          return (
            <div key={motor.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 relative">
              <div className="flex justify-between items-start mb-2 pr-8">
                <div>
                  <h3 className="font-bold text-lg text-slate-800">{motor.model}</h3>
                  <p className="text-sm text-slate-500">Цех: {motor.customerShop} • Инв. №: {motor.serialNumber} • {motor.power} кВт • {motor.rpm} об/мин</p>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${MOTOR_STATUS_COLORS[motor.status]}`}>{MOTOR_STATUS_LABELS[motor.status]}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 mb-2 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div><span className="block text-xs text-slate-500">Планируемый завоз:</span> <span className="font-medium text-slate-800">{motor.scheduledDate}</span></div>
                <div><span className="block text-xs text-slate-500">Фактический завоз:</span> <span className="font-medium text-slate-800">{motor.acceptedAt ? new Date(motor.acceptedAt).toLocaleDateString('ru-RU') : '-'}</span></div>
                <div><span className="block text-xs text-slate-500">Дата готовности:</span> <span className="font-medium text-slate-800">{motor.readyAt ? new Date(motor.readyAt).toLocaleDateString('ru-RU') : '-'}</span></div>
                <div><span className="block text-xs text-slate-500">Отгружен:</span> <span className="font-medium text-slate-800">{motor.shippedAt ? new Date(motor.shippedAt).toLocaleDateString('ru-RU') : '-'}</span></div>
              </div>
              <p className="text-sm text-slate-600">🛠 Вид ремонта: <strong>{motor.repairType}</strong></p>
              {motor.complaint && <p className="text-sm text-slate-600">💬 {motor.complaint}</p>}
              {(motor.status === 'rejected' || motor.status === 'revision') && motor.logs.length > 0 && (
                <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded border border-red-100"><strong>Причина:</strong> {motor.logs[motor.logs.length - 1].details}</div>
              )}
              <div className="mt-3 flex gap-2 justify-end flex-wrap">
                <button onClick={() => setInfoMotor(motor)} className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 px-2 py-1 rounded">ℹ️ Инфо</button>
                <button onClick={() => setAttachmentsMotor(motor)} className="text-xs text-slate-500 hover:text-slate-800 border border-slate-200 px-2 py-1 rounded">📎 Вложения ({motor.attachments?.length || 0})</button>
                <button onClick={() => openLogs(motor)} className={`text-xs px-2 py-1 rounded border ${unread ? 'bg-red-50 text-red-600 border-red-200 font-semibold' : 'text-slate-500 hover:text-slate-800 border-slate-200'}`}>📄 Логи {unread && '●'}</button>
                {(motor.status === 'pending_approval' || motor.status === 'revision') && (
                  <button onClick={() => setEditingMotor(motor)} className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 px-2 py-1 rounded flex items-center gap-1">✏️ Редактировать</button>
                )}
                {['pending_approval', 'revision', 'approved'].includes(motor.status) && (
                  <button onClick={() => cancelMotor(motor.id)} className="text-xs text-red-600 hover:text-red-800 border border-red-200 px-2 py-1 rounded">Отменить</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {showForm && <RequestFormModal motors={motors} onClose={() => setShowForm(false)} onSubmit={(newMotors) => { setMotors([...newMotors, ...motors]); setShowForm(false); setSearchPhone(newMotors[0].customerPhone); }} />}
      {editingMotor && <EditMotorModal motor={editingMotor} onClose={() => setEditingMotor(null)} onSubmit={handleEditSubmit} />}
      {logsMotor && <LogsModal motor={logsMotor} readCount={readLogs[logsMotor.id] || 0} currentUser="Заказчик" onClose={closeLogs} />}
      {attachmentsMotor && <AttachmentsModal motor={attachmentsMotor} onClose={() => setAttachmentsMotor(null)} />}
      {infoMotor && <MotorInfoModal motor={infoMotor} canEdit={['pending_approval', 'revision'].includes(infoMotor.status)} onClose={() => setInfoMotor(null)} onEdit={() => { setEditingMotor(infoMotor); setInfoMotor(null); }} onOpenLogs={() => { setLogsMotor(infoMotor); setInfoMotor(null); }} />}
    </>
  );
}

function RequestFormModal({ motors, onClose, onSubmit }: { motors: Motor[]; onClose: () => void; onSubmit: (m: Motor[]) => void; }) {
  const [customerShop, setCustomerShop] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [photo, setPhoto] = useState<string>('');
  const [formMotors, setFormMotors] = useState([{ repairType: 'СР' as RepairType, model: '', serialNumber: '', power: '', rpm: '', complaint: '' }]);

  const phoneTemplates = Array.from(new Set(motors.filter(m => m.customerPhone.includes(customerPhone) && customerPhone.length > 3).map(m => JSON.stringify({ shop: m.customerShop, name: m.customerName })))).map(s => JSON.parse(s));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 800000) alert('Файл слишком большой (макс 800КБ)');
    const reader = new FileReader();
    reader.onloadend = () => setPhoto(reader.result as string);
    reader.readAsDataURL(file);
  };
  const updateMotorField = (index: number, field: string, value: string) => {
    const updated = [...formMotors];
    updated[index] = { ...updated[index], [field]: value };
    setFormMotors(updated);
  };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const batchId = generateId();
    const newMotors: Motor[] = formMotors.map(m => ({
      id: generateId(), batchId, customerShop, customerName, customerPhone, scheduledDate,
      repairType: m.repairType, model: m.model, serialNumber: m.serialNumber, power: m.power, rpm: m.rpm, complaint: m.complaint,
      status: 'pending_approval', createdAt: new Date().toISOString(),
      attachments: photo ? [{ id: generateId(), url: photo, timestamp: new Date().toISOString(), author: 'Заказчик', stage: 'Создание заявки' }] : [],
      logs: [{ timestamp: new Date().toISOString(), user: 'Заказчик', action: 'Создана заявка' }],
      nodes: [],
    }));
    onSubmit(newMotors);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl font-bold text-slate-800">Создание заявки</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
              <h3 className="font-semibold text-slate-800">Данные заявки</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Цех-заказчик *</label><input required value={customerShop} onChange={e => setCustomerShop(e.target.value)} placeholder="ЛПЦ-2" className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Дата завоза *</label><input type="date" required value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Контактное лицо *</label><input required value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none" /></div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Телефон *</label>
                  <input required value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none" />
                  {phoneTemplates.length > 0 && !customerName && (
                    <div className="mt-1 bg-white border border-slate-200 rounded shadow-sm text-xs absolute z-10 w-64">
                      {phoneTemplates.map((t, i) => (
                        <div key={i} onClick={() => { setCustomerName(t.name); setCustomerShop(t.shop); }} className="p-2 hover:bg-blue-50 cursor-pointer">{t.name} ({t.shop})</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Фото при отгрузке (опционально)</label>
                <input type="file" accept="image/*" onChange={handleFileChange} className="text-sm" />
                {photo && <img src={photo} alt="Фото" className="mt-2 h-20 object-contain border rounded" />}
              </div>
            </div>
            <div className="space-y-4">
              {formMotors.map((m, index) => (
                <div key={index} className="relative border border-slate-200 p-4 rounded-xl space-y-4">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-semibold text-slate-700">Двигатель #{index + 1}</h4>
                    {formMotors.length > 1 && <button type="button" onClick={() => setFormMotors(formMotors.filter((_, i) => i !== index))} className="text-red-500 text-sm hover:underline">Удалить</button>}
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-1">
                      <label className="block text-xs font-medium text-slate-700 mb-1">Вид ремонта *</label>
                      <select required value={m.repairType} onChange={e => updateMotorField(index, 'repairType', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none text-sm bg-white">
                        <option value="СР">СР</option><option value="КР">КР</option><option value="Др.">Др.</option>
                      </select>
                    </div>
                    <div className="col-span-1"><label className="block text-xs font-medium text-slate-700 mb-1">Инвентарный № *</label><input required value={m.serialNumber} onChange={e => updateMotorField(index, 'serialNumber', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none text-sm" /></div>
                    <div className="col-span-1"><label className="block text-xs font-medium text-slate-700 mb-1">Тип двигателя *</label><input required value={m.model} onChange={e => updateMotorField(index, 'model', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none text-sm" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-xs font-medium text-slate-700 mb-1">Мощность (кВт) *</label><input required value={m.power} onChange={e => updateMotorField(index, 'power', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none text-sm" /></div>
                    <div><label className="block text-xs font-medium text-slate-700 mb-1">Обороты *</label><input required value={m.rpm} onChange={e => updateMotorField(index, 'rpm', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none text-sm" /></div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Пожелания / описание дефекта {m.repairType === 'Др.' && <span className="text-red-500">*</span>}</label>
                    <textarea rows={2} required={m.repairType === 'Др.'} value={m.complaint} onChange={e => updateMotorField(index, 'complaint', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none text-sm" />
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setFormMotors([...formMotors, { repairType: 'СР', model: '', serialNumber: '', power: '', rpm: '', complaint: '' }])} className="w-full border-2 border-dashed border-blue-300 text-blue-600 font-medium py-2 rounded-xl hover:bg-blue-50 transition">+ Добавить электродвигатель в заявку</button>
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition">Отправить на согласование</button>
          </form>
        </div>
      </div>
    </div>
  );
}

function EditMotorModal({ motor, onClose, onSubmit }: { motor: Motor; onClose: () => void; onSubmit: (d: any) => void; }) {
  const [form, setForm] = useState({ 
    customerShop: motor.customerShop, customerName: motor.customerName, customerPhone: motor.customerPhone,
    repairType: motor.repairType, model: motor.model, serialNumber: motor.serialNumber, power: motor.power, rpm: motor.rpm, 
    complaint: motor.complaint, scheduledDate: motor.scheduledDate 
  });
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
        <h2 className="text-xl font-bold text-slate-800 mb-4">Редактирование заявки</h2>
        <form onSubmit={e => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs mb-1">Цех-заказчик</label><input required value={form.customerShop} onChange={e => setForm({...form, customerShop: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="block text-xs mb-1">Инв. №</label><input required value={form.serialNumber} onChange={e => setForm({...form, serialNumber: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="block text-xs mb-1">Тип</label><input required value={form.model} onChange={e => setForm({...form, model: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="block text-xs mb-1">Дата завоза</label><input type="date" required value={form.scheduledDate} onChange={e => setForm({...form, scheduledDate: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="block text-xs mb-1">Мощность</label><input required value={form.power} onChange={e => setForm({...form, power: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="block text-xs mb-1">Обороты</label><input required value={form.rpm} onChange={e => setForm({...form, rpm: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="block text-xs mb-1">Вид ремонта</label>
              <select value={form.repairType} onChange={e => setForm({...form, repairType: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                <option value="СР">СР</option><option value="КР">КР</option><option value="Др.">Др.</option>
              </select>
            </div>
          </div>
          <div><label className="block text-xs mb-1">Контактное лицо</label><input value={form.customerName} onChange={e => setForm({...form, customerName: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          <div><label className="block text-xs mb-1">Телефон</label><input value={form.customerPhone} onChange={e => setForm({...form, customerPhone: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          <div><label className="block text-xs mb-1">Пожелания</label><textarea rows={3} value={form.complaint} onChange={e => setForm({...form, complaint: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-slate-300 rounded-lg text-slate-700 font-medium">Отмена</button>
            <button type="submit" className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium">Сохранить</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// ПЛАНИРОВЩИК: модалки
// ============================================================
function PlannerDefectsModal({ motor, templates, onClose, onSave }: { motor: Motor; templates: DefectTemplate[]; onClose: () => void; onSave: (templateId: string, checkedIds: string[]) => void; }) {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedTplId, setSelectedTplId] = useState(motor.selectedTemplateId || '');
  const [checkedIds, setCheckedIds] = useState<string[]>(motor.checkedDefectIds || []);

  const template = templates.find(t => t.id === selectedTplId);
  const toggle = (id: string) => {
    if (!isEditing) return;
    if (checkedIds.includes(id)) setCheckedIds(checkedIds.filter(i => i !== id));
    else setCheckedIds([...checkedIds, id]);
  };
  const isFlowWithNodes = template && (template.flowBlocks?.some(b => b.kind === 'start' && b.nodes && b.nodes.length > 0) || template.flowBlocks?.some(b => blockHasDefects(b)));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="p-4 border-b flex justify-between items-start">
          <div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">Дефектовка</h3>
            <p className="text-sm text-slate-500">Двигатель: <strong>{motor.model}</strong> (Инв. {motor.serialNumber})</p>
            {motor.inspectorName && <p className="text-xs text-slate-500 mt-1">Проводил: {motor.inspectorName}</p>}
          </div>
          <div className="flex gap-2 items-center">
            {!isEditing && <button onClick={() => setIsEditing(true)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200 transition">✏️</button>}
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none p-1">×</button>
          </div>
        </div>
        <div className="p-4 border-b bg-slate-50">
          <label className="block text-sm font-medium text-slate-700 mb-1">Техкарта</label>
          {isEditing ? (
            <select value={selectedTplId} onChange={e => setSelectedTplId(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none bg-white">
              <option value="">-- Выбрать техкарту --</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          ) : (
            <div className="font-semibold text-slate-800">{template ? template.name : <span className="text-red-500">Техкарта не выбрана</span>}</div>
          )}
        </div>
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {!template && <p className="text-slate-500 text-sm text-center">Нет данных о дефектах.</p>}
          {isFlowWithNodes && <p className="text-slate-500 text-sm text-center bg-blue-50 border border-blue-200 rounded-lg p-3">Техкарта использует новый формат. Дефекты и маршруты задаются в конструкторе технолога.</p>}
          {template && !isFlowWithNodes && (!template.nodes || template.nodes.length === 0) && <p className="text-slate-500 text-sm text-center">Техкарта без дефектов.</p>}
          {template && !isFlowWithNodes && template.nodes && template.nodes.map(tNode => (
            <div key={tNode.id} className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-100 p-2 font-semibold text-slate-800 text-sm border-b border-slate-200">{tNode.name}</div>
              <div className="p-2 space-y-1">
                {tNode.defects.map(defect => {
                  const isChecked = checkedIds.includes(defect.id);
                  if (!isEditing && !isChecked) return null;
                  return (
                    <label key={defect.id} className={`flex items-start gap-2 p-2 rounded ${isEditing ? 'hover:bg-slate-50 cursor-pointer' : ''}`}>
                      {isEditing ? <input type="checkbox" checked={isChecked} onChange={() => toggle(defect.id)} className="w-4 h-4 accent-blue-600 mt-0.5" /> : <span className="text-green-600 font-bold mt-0.5">✓</span>}
                      <span className="text-sm text-slate-700">{defect.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 border-t flex gap-2">
          {isEditing ? (
            <>
              <button onClick={() => { setIsEditing(false); setSelectedTplId(motor.selectedTemplateId || ''); setCheckedIds(motor.checkedDefectIds || []); }} className="flex-1 py-2.5 border border-slate-300 rounded-lg text-slate-700 font-medium">Отмена</button>
              <button onClick={() => { if (selectedTplId) onSave(selectedTplId, checkedIds); else alert('Выберите техкарту!'); }} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">Сохранить</button>
            </>
          ) : (
            <button onClick={onClose} className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-medium transition">Закрыть</button>
          )}
        </div>
      </div>
    </div>
  );
}

function EditStepModal({ initial, onClose, onSave }: { 
  initial: { area: Area; estTime: number; task: string }; 
  onClose: () => void; 
  onSave: (data: { area: Area; estTime: number; task: string }) => void; 
}) {
  const [area, setArea] = useState<Area>(initial.area);
  const [time, setTime] = useState(initial.estTime);
  const [task, setTask] = useState(initial.task || '');
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[70]">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-4">Редактирование операции</h3>
        <div className="space-y-3">
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Передел</label><select value={area} onChange={e => setArea(e.target.value as Area)} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white outline-none text-sm">{NODE_AREA_OPTIONS.map(a => <option key={a} value={a}>{AREA_LABELS[a]}</option>)}</select></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Плановое время (мин)</label><input type="number" min={1} value={time} onChange={e => setTime(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none text-sm" /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Задание</label><textarea rows={2} value={task} onChange={e => setTask(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none text-sm" /></div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-300 rounded-lg text-slate-700 font-medium">Отмена</button>
          <button onClick={() => onSave({ area, estTime: time, task: task.trim() })} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">Сохранить</button>
        </div>
      </div>
    </div>
  );
}

function EditNodeNameModal({ initial, onClose, onSave }: { initial: string; onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState(initial);
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[70]">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-4">Редактирование узла</h3>
        <input value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none text-sm" />
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-300 rounded-lg text-slate-700 font-medium">Отмена</button>
          <button onClick={() => { if (name.trim()) onSave(name.trim()); else alert('Введите имя'); }} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">Сохранить</button>
        </div>
      </div>
    </div>
  );
}

function AddStepForm({ onAdd }: { onAdd: (area: Area, time: number, task: string) => void }) {
  const [area, setArea] = useState<Area | ''>('');
  const [time, setTime] = useState(30);
  const [task, setTask] = useState('');
  const handleAdd = () => {
    if (!area) { alert('Выберите передел'); return; }
    onAdd(area, time, task.trim());
    setArea(''); setTime(30); setTask('');
  };
  return (
    <div className="bg-slate-50 border-t border-slate-200 p-3 flex flex-wrap gap-2 items-center">
      <select value={area} onChange={e => setArea(e.target.value as Area)} className="px-2 py-1.5 border border-slate-300 rounded text-sm bg-white outline-none">
        <option value="">-- Передел --</option>
        {NODE_AREA_OPTIONS.map(a => <option key={a} value={a}>{AREA_LABELS[a]}</option>)}
      </select>
      <input type="number" min={1} value={time} onChange={e => setTime(Number(e.target.value))} className="w-20 px-2 py-1.5 border border-slate-300 rounded text-sm outline-none" placeholder="мин" />
      <input value={task} onChange={e => setTask(e.target.value)} placeholder="Задание" className="flex-1 min-w-[150px] px-2 py-1.5 border border-slate-300 rounded text-sm outline-none" />
      <button onClick={handleAdd} className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-3 py-1.5 rounded transition">+ Добавить</button>
    </div>
  );
}

// ============================================================
// ЧЕК-ЛИСТ КОМПЛЕКТОВКИ
// ============================================================
function KittingChecklistModal({ motor, onClose, onConfirm }: { 
  motor: Motor; onClose: () => void; 
  onConfirm: (workerNote: string, allReady: boolean) => void; 
}) {
  const [nodes, setNodes] = useState(() => motor.nodes.map(n => ({ id: n.id, name: n.name, ready: true, comment: '' })));
  const [tmcAvailable, setTmcAvailable] = useState(true);
  const [tmcComment, setTmcComment] = useState('');
  const [generalComment, setGeneralComment] = useState('');

  const toggleNode = (id: string) => setNodes(prev => prev.map(n => n.id === id ? { ...n, ready: !n.ready } : n));
  const updateComment = (id: string, comment: string) => setNodes(prev => prev.map(n => n.id === id ? { ...n, comment } : n));

  const handleConfirm = () => {
    const lines: string[] = [];
    nodes.forEach(n => { if (!n.ready) lines.push(`${n.name}: ✗ НЕ готов${n.comment ? ` — ${n.comment}` : ''}`); });
    if (!tmcAvailable) lines.push(`ТМЦ: ✗ нет${tmcComment ? ` — ${tmcComment}` : ''}`);
    if (generalComment) lines.push(`Комментарий: ${generalComment}`);
    if (lines.length === 0) lines.push('Все узлы готовы. ТМЦ в наличии.');
    onConfirm(lines.join('\n'), nodes.every(n => n.ready) && tmcAvailable);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[70]">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
          <h3 className="text-lg font-bold text-slate-800">Чек-лист комплектовщика</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
        </div>
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          <p className="text-sm text-slate-600">Подтвердите готовность узлов и наличие ТМЦ.</p>
          <div>
            <h4 className="text-sm font-semibold text-slate-800 mb-2">Готовность узлов</h4>
            <div className="space-y-2">
              {nodes.map(n => (
                <div key={n.id} className="border border-slate-200 rounded-lg p-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={n.ready} onChange={() => toggleNode(n.id)} className="w-4 h-4 accent-green-600" />
                    <span className={`text-sm font-medium ${n.ready ? 'text-slate-800' : 'text-red-700'}`}>{n.name} — {n.ready ? 'готов' : 'НЕ готов'}</span>
                  </label>
                  {!n.ready && <input value={n.comment} onChange={e => updateComment(n.id, e.target.value)} placeholder="Причина" className="mt-2 w-full px-2 py-1 border border-red-300 rounded text-xs outline-none" />}
                </div>
              ))}
              {nodes.length === 0 && <p className="text-xs text-slate-400 italic">Нет узлов</p>}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-800 mb-2">ТМЦ</h4>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!tmcAvailable} onChange={() => setTmcAvailable(!tmcAvailable)} className="w-4 h-4 accent-red-600" />
              <span className="text-sm">Не хватает ТМЦ</span>
            </label>
            {!tmcAvailable && <input value={tmcComment} onChange={e => setTmcComment(e.target.value)} placeholder="Какие ТМЦ нужны" className="mt-2 w-full px-2 py-1 border border-red-300 rounded text-xs outline-none" />}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Общий комментарий</label>
            <textarea rows={2} value={generalComment} onChange={e => setGeneralComment(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none text-sm resize-none" />
          </div>
        </div>
        <div className="p-4 border-t flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-300 rounded-lg text-slate-700 font-medium">Отмена</button>
          <button onClick={handleConfirm} className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium">Подтвердить</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// МОДАЛКА ОПРОСА ДЕФЕКТА НА ПЕРЕДЕЛЕ
// ============================================================
function StepDefectModal({ block, stepTask, onCancel, onConfirm }: {
  block: FlowBlock; stepTask?: string; onCancel: () => void;
  onConfirm: (defectIdOrEmpty: string) => void;
}) {
  const [selection, setSelection] = useState('');
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[70]">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-1">Дефект на переделе: {AREA_LABELS[block.area]}</h3>
        {stepTask && <p className="text-xs text-slate-500 mb-3">{stepTask}</p>}
        <p className="text-sm text-slate-600 mb-3">Отметьте, всё ли в порядке или обнаружен дефект:</p>
        <div className="space-y-1.5 mb-4">
          <label className="flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-green-50">
            <input type="radio" name="step-defect" checked={selection === ''} onChange={() => setSelection('')} className="w-4 h-4 accent-green-600" />
            <span className="text-sm">✓ Всё в порядке (OK)</span>
          </label>
          {block.defects?.map(d => (
            <label key={d.id} className="flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-red-50">
              <input type="radio" name="step-defect" checked={selection === d.id} onChange={() => setSelection(d.id)} className="w-4 h-4 accent-red-600" />
              <span className="text-sm">⚠️ {d.label}</span>
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2.5 border border-slate-300 rounded-lg text-slate-700 font-medium">Отмена</button>
          <button onClick={() => onConfirm(selection)} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">Подтвердить</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// УПРАВЛЕНИЕ ПЕРЕДЕЛАМИ
// ============================================================
function CurrentAreaModal({ motor, templates, onClose, onUpdateMotor }: { 
  motor: Motor; templates: DefectTemplate[]; onClose: () => void; onUpdateMotor: (updatedMotor: Motor) => void;
}) {
  const [localMotor, setLocalMotor] = useState<Motor>(JSON.parse(JSON.stringify({
    ...motor,
    extraSteps: motor.extraSteps && motor.extraSteps.length > 0 ? motor.extraSteps : (['approved','awaiting_repair','disassembly','in_repair','ready_for_kitting','kitting','assembly','ready'].includes(motor.status) ? defaultExtraSteps() : undefined),
  })));
  const [editingNote, setEditingNote] = useState<{ nIdx: number, sIdx: number, text: string } | null>(null);
  const [editingExtraNote, setEditingExtraNote] = useState<{ sIdx: number, text: string } | null>(null);
  const [newNodeName, setNewNodeName] = useState('');
  const [plannerTplId, setPlannerTplId] = useState('');
  const [plannerCell, setPlannerCell] = useState('');
  const [plannerDefects, setPlannerDefects] = useState<string[]>([]);
  const [plannerFlowSelections, setPlannerFlowSelections] = useState<Record<string, string>>({});
  const [showDisassemblyPicker, setShowDisassemblyPicker] = useState(false);
  const [editingStep, setEditingStep] = useState<{ nIdx: number, sIdx: number, data: { area: Area; estTime: number; task: string } } | null>(null);
  const [editingExtraStep, setEditingExtraStep] = useState<{ sIdx: number, data: { area: Area; estTime: number; task: string } } | null>(null);
  const [editingNodeName, setEditingNodeName] = useState<{ nIdx: number, name: string } | null>(null);
  const [dragState, setDragState] = useState<{ nodeIdx: number, stepIdx: number } | null>(null);
  const [dragOver, setDragOver] = useState<{ nodeIdx: number, stepIdx: number } | null>(null);
  const [kisDefectModal, setKisDefectModal] = useState<{ block: FlowBlock } | null>(null);

  const recomputeNode = (node: MotorNode) => {
    let newIndex = node.route.findIndex(s => !s.finishedAt);
    if (newIndex === -1) newIndex = node.route.length;
    node.currentIndex = newIndex;
    if (newIndex >= node.route.length) node.status = 'done';
    else {
      const step = node.route[newIndex];
      if (step.startedAt || step.pausedAt) node.status = 'in_progress';
      else node.status = 'pending';
    }
  };

  const handleAddStep = (nodeIdx: number, area: Area, time: number, task: string) => {
    const newMotor = JSON.parse(JSON.stringify(localMotor));
    const node = newMotor.nodes[nodeIdx];
    node.route.push({ area, estTime: time, task });
    recomputeNode(node);
    setLocalMotor(newMotor);
  };
  const handleDeleteStep = (nodeIdx: number, stepIdx: number) => {
    if (!confirm('Удалить операцию?')) return;
    const newMotor = JSON.parse(JSON.stringify(localMotor));
    const node = newMotor.nodes[nodeIdx];
    node.route.splice(stepIdx, 1);
    recomputeNode(node);
    setLocalMotor(newMotor);
  };
  const handleEditStepSave = (data: { area: Area; estTime: number; task: string }) => {
    if (!editingStep) return;
    const newMotor = JSON.parse(JSON.stringify(localMotor));
    const step = newMotor.nodes[editingStep.nIdx].route[editingStep.sIdx];
    step.area = data.area; step.estTime = data.estTime; step.task = data.task;
    setLocalMotor(newMotor);
    setEditingStep(null);
  };
  const handleReorderStep = (nodeIdx: number, targetStepIdx: number) => {
    if (!dragState || dragState.nodeIdx !== nodeIdx) return;
    const fromIdx = dragState.stepIdx;
    if (fromIdx === targetStepIdx) return;
    const newMotor = JSON.parse(JSON.stringify(localMotor));
    const node = newMotor.nodes[nodeIdx];
    const [moved] = node.route.splice(fromIdx, 1);
    node.route.splice(targetStepIdx, 0, moved);
    recomputeNode(node);
    setLocalMotor(newMotor);
    setDragState(null); setDragOver(null);
  };
  const handleAddNode = () => {
    if (!newNodeName.trim()) { alert('Введите название узла'); return; }
    const newMotor = JSON.parse(JSON.stringify(localMotor));
    newMotor.nodes.push({ id: generateId(), name: newNodeName.trim(), status: 'done', route: [], currentIndex: 0 });
    setLocalMotor(newMotor);
    setNewNodeName('');
  };
  const handleDeleteNode = (nodeIdx: number) => {
    const node = localMotor.nodes[nodeIdx];
    if (!confirm(`Удалить узел "${node.name}" со всеми операциями?`)) return;
    const newMotor = JSON.parse(JSON.stringify(localMotor));
    newMotor.nodes.splice(nodeIdx, 1);
    setLocalMotor(newMotor);
  };
  const handleEditNodeNameSave = (name: string) => {
    if (!editingNodeName) return;
    const newMotor = JSON.parse(JSON.stringify(localMotor));
    newMotor.nodes[editingNodeName.nIdx].name = name;
    setLocalMotor(newMotor);
    setEditingNodeName(null);
  };
  const handleCompleteStep = (nodeIdx: number, stepIdx: number) => {
    const newMotor = JSON.parse(JSON.stringify(localMotor));
    const node = newMotor.nodes[nodeIdx];
    const now = new Date().toISOString();
    for (let i = 0; i <= stepIdx; i++) {
      const step = node.route[i];
      if (step.finishedAt) continue;
      let accum = step.accumulatedMs || 0;
      if (step.startedAt) accum += Date.now() - new Date(step.startedAt).getTime();
      step.accumulatedMs = accum; step.startedAt = undefined; step.pausedAt = undefined; step.finishedAt = now;
    }
    recomputeNode(node);
    setLocalMotor(newMotor);
  };
  const handleRevertStep = (nodeIdx: number, stepIdx: number) => {
    if (!confirm('Вернуть узел на этот этап? Все последующие операции сбросятся.')) return;
    const newMotor = JSON.parse(JSON.stringify(localMotor));
    const node = newMotor.nodes[nodeIdx];
    for (let i = stepIdx; i < node.route.length; i++) {
      node.route[i].startedAt = undefined;
      node.route[i].finishedAt = undefined;
      node.route[i].pausedAt = undefined;
      node.route[i].accumulatedMs = 0;
    }
    recomputeNode(node);
    setLocalMotor(newMotor);
  };

  const selectedTemplateForPlanner = templates.find(t => t.id === plannerTplId);
  const startBlockForPlanner = selectedTemplateForPlanner?.flowBlocks?.find(b => b.kind === 'start');
  const flowNodesForPlanner = startBlockForPlanner?.nodes || [];
  const hasFlowSelections = flowNodesForPlanner.length > 0;

  const handleDisassemblyComplete = () => {
    if (!plannerTplId || !plannerCell) { alert('Выберите техкарту и укажите ячейку!'); return; }
    const template = templates.find(t => t.id === plannerTplId);
    if (!template) return;
    
    const selections = hasFlowSelections ? plannerFlowSelections : undefined;
    const newNodes = createNodesWithDefects(template, plannerDefects, undefined, selections);
    const foundDefects = template.nodes.flatMap(n => n.defects.filter(d => plannerDefects.includes(d.id)).map(d => `${n.name}: ${d.label}`));
    
    const newMotor = JSON.parse(JSON.stringify(localMotor));
    const now = new Date().toISOString();
    const newExtraSteps = templateFlowToExtraSteps(template);
    const disIdx = newExtraSteps.findIndex(s => s.area === 'disassembly');
    if (disIdx >= 0) {
      newExtraSteps[disIdx] = { ...newExtraSteps[disIdx], startedAt: now, finishedAt: now, accumulatedMs: 60000 };
    }
    newMotor.status = 'in_repair';
    newMotor.cellNumber = plannerCell;
    newMotor.inspectorName = 'Планировщик';
    newMotor.foundDefects = foundDefects.length > 0 ? foundDefects : ['Дефекты не обнаружены'];
    newMotor.nodes = newNodes;
    newMotor.defectSelections = selections;
    newMotor.extraSteps = newExtraSteps;
    newMotor.selectedTemplateId = plannerTplId;
    newMotor.checkedDefectIds = plannerDefects;
    newMotor.logs.push({ timestamp: now, user: 'Планировщик', action: 'Разборка завершена', details: `Ячейка: ${plannerCell}. Созданы узлы и маршруты.` });
    setLocalMotor(newMotor);
    setShowDisassemblyPicker(false);
  };

  const handleRevertDisassembly = () => {
    if (!confirm('Вернуть двигатель на разборку?\n\n⚠️ ЭТО ОТМЕНИТ ВСЕ ОПЕРАЦИИ, КОТОРЫЕ БЫЛИ СДЕЛАНЫ ПОСЛЕ РАЗБОРКИ:\n- узлы будут сброшены\n- номер ячейки обнулится\n\nПродолжить?')) return;
    const newMotor = JSON.parse(JSON.stringify(localMotor));
    newMotor.lastTemplateId = newMotor.selectedTemplateId;
    newMotor.lastCheckedDefectIds = newMotor.checkedDefectIds;
    newMotor.lastDefectDate = new Date().toISOString();
    newMotor.lastCellNumber = newMotor.cellNumber;
    newMotor.nodes = [];
    newMotor.status = 'disassembly';
    newMotor.cellNumber = '';
    newMotor.defectNote = '';
    newMotor.readyAt = undefined;
    newMotor.shippedAt = undefined;
    newMotor.extraSteps = defaultExtraSteps();
    setLocalMotor(newMotor);
  };

  const handleRestoreDefects = () => {
    if (!localMotor.lastTemplateId) return;
    const template = templates.find(t => t.id === localMotor.lastTemplateId);
    if (!template) return;
    const newMotor = JSON.parse(JSON.stringify(localMotor));
    newMotor.nodes = createNodesWithDefects(template, localMotor.lastCheckedDefectIds || [], undefined, localMotor.defectSelections);
    newMotor.status = 'in_repair';
    newMotor.selectedTemplateId = localMotor.lastTemplateId;
    newMotor.checkedDefectIds = localMotor.lastCheckedDefectIds;
    newMotor.cellNumber = localMotor.lastCellNumber || '';
    newMotor.extraSteps = templateFlowToExtraSteps(template);
    const foundDefects = template.nodes.flatMap(n => n.defects.filter(d => localMotor.lastCheckedDefectIds?.includes(d.id)).map(d => `${n.name}: ${d.label}`));
    newMotor.foundDefects = foundDefects.length > 0 ? foundDefects : ['Дефекты не обнаружены'];
    if (newMotor.extraSteps) {
      const dis = newMotor.extraSteps.find(s => s.area === 'disassembly');
      if (dis) dis.finishedAt = newMotor.lastDefectDate;
    }
    setLocalMotor(newMotor);
  };

  const handleEditExtraStepSave = (data: { area: Area; estTime: number; task: string }) => {
    if (!editingExtraStep) return;
    const newMotor = JSON.parse(JSON.stringify(localMotor));
    if (newMotor.extraSteps) {
      newMotor.extraSteps[editingExtraStep.sIdx].area = data.area;
      newMotor.extraSteps[editingExtraStep.sIdx].estTime = data.estTime;
      newMotor.extraSteps[editingExtraStep.sIdx].task = data.task;
    }
    setLocalMotor(newMotor);
    setEditingExtraStep(null);
  };

  const startKis = () => {
    const newMotor = JSON.parse(JSON.stringify(localMotor));
    if (newMotor.extraSteps) {
      const kis = newMotor.extraSteps.find(s => s.area === 'kis' && !s.finishedAt);
      if (kis && !kis.startedAt) kis.startedAt = new Date().toISOString();
    }
    setLocalMotor(newMotor);
  };

  const requestKisComplete = () => {
    const template = templates.find(t => t.id === localMotor.selectedTemplateId);
    const kisBlock = template?.flowBlocks?.find(b => b.kind === 'end-tests');
    if (kisBlock && blockHasDefects(kisBlock)) {
      setKisDefectModal({ block: kisBlock });
      return;
    }
    if (!confirm('Завершить контрольные испытания? Двигатель будет готов к выдаче.')) return;
    const result = buildKisCompletionResult(localMotor, templates, '', 'Планировщик');
    setLocalMotor(result);
  };

  const finishKisWithDefect = (defectIdOrEmpty: string) => {
    const result = buildKisCompletionResult(localMotor, templates, defectIdOrEmpty, 'Планировщик');
    setLocalMotor(result);
    setKisDefectModal(null);
  };

  const revertKis = () => {
    const newMotor = JSON.parse(JSON.stringify(localMotor));
    newMotor.status = 'in_repair';
    newMotor.readyAt = undefined;
    if (newMotor.extraSteps) {
      const lastKisIdx = [...newMotor.extraSteps].reverse().findIndex(s => s.area === 'kis');
      if (lastKisIdx >= 0) {
        const realIdx = newMotor.extraSteps.length - 1 - lastKisIdx;
        newMotor.extraSteps[realIdx] = { ...newMotor.extraSteps[realIdx], finishedAt: undefined, accumulatedMs: 0, startedAt: undefined, pausedAt: undefined };
      }
    }
    setLocalMotor(newMotor);
  };
  const pauseKis = () => {
    const newMotor = JSON.parse(JSON.stringify(localMotor));
    if (newMotor.extraSteps) {
      const kis = newMotor.extraSteps.find(s => s.area === 'kis' && !s.finishedAt);
      if (kis && kis.startedAt) {
        let accum = kis.accumulatedMs || 0;
        accum += Date.now() - new Date(kis.startedAt).getTime();
        kis.accumulatedMs = accum; kis.startedAt = undefined; kis.pausedAt = new Date().toISOString();
      }
    }
    setLocalMotor(newMotor);
  };
  const resumeKis = () => {
    const newMotor = JSON.parse(JSON.stringify(localMotor));
    if (newMotor.extraSteps) {
      const kis = newMotor.extraSteps.find(s => s.area === 'kis' && !s.finishedAt);
      if (kis && !kis.startedAt) kis.startedAt = new Date().toISOString();
      if (kis) kis.pausedAt = undefined;
    }
    setLocalMotor(newMotor);
  };

  const handleSave = () => { onUpdateMotor(localMotor); onClose(); };

  const hasNodes = localMotor.nodes && localMotor.nodes.length > 0;
  const allNodesDone = hasNodes && localMotor.nodes.every(n => n.status === 'done');
  const disassemblyStep = localMotor.extraSteps?.find(s => s.area === 'disassembly');
  const disassemblyDone = !!disassemblyStep?.finishedAt;

  const handleTplChange = (tplId: string) => {
    setPlannerTplId(tplId);
    const tpl = templates.find(t => t.id === tplId);
    const init: Record<string, string> = {};
    const stBlock = tpl?.flowBlocks?.find(b => b.kind === 'start');
    stBlock?.nodes?.forEach(n => { init[n.id] = ''; });
    setPlannerFlowSelections(init);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-6xl max-h-[92vh] flex flex-col">
        <div className="p-4 border-b bg-slate-50">
          <div className="flex justify-between items-center gap-3 flex-wrap">
            <h3 className="text-lg font-bold text-slate-800">Управление переделами: {motor.model}</h3>
            <div className="flex gap-2">
              <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg font-medium text-sm transition">Сохранить и закрыть</button>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className="text-sm text-slate-600">📍 Ячейка:</span>
            <input value={localMotor.cellNumber || ''} onChange={e => setLocalMotor({ ...localMotor, cellNumber: e.target.value })} placeholder="не указана" className="px-3 py-1 border border-blue-300 rounded-lg text-sm font-semibold w-32 bg-white outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
        </div>

        <div className="p-4 overflow-y-auto space-y-6">
          {localMotor.defectNote && (
             <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-900 shadow-sm">
               <strong>Комментарий при дефектовке:</strong> {localMotor.defectNote}
             </div>
          )}

          {localMotor.extraSteps && localMotor.extraSteps.length > 0 && (
            <div className="border border-slate-300 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-indigo-800 text-white px-4 py-2 font-bold">⚙️ Общие операции двигателя</div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-100 text-slate-600 border-b">
                    <tr>
                      <th className="px-2 py-2 font-medium">Передел</th>
                      <th className="px-2 py-2 font-medium w-16">План</th>
                      <th className="px-2 py-2 font-medium w-24">Факт</th>
                      <th className="px-2 py-2 font-medium w-24">Статус</th>
                      <th className="px-2 py-2 font-medium">Задание</th>
                      <th className="px-2 py-2 font-medium">Комментарий планера</th>
                      <th className="px-2 py-2 font-medium">Примечание рабочего</th>
                      <th className="px-2 py-2 font-medium text-right">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {localMotor.extraSteps.map((step, sIdx) => {
                      const isDone = !!step.finishedAt;
                      const isActive = !!step.startedAt;
                      const isPaused = !!step.pausedAt;
                      const isDisassembly = step.area === 'disassembly';
                      const isKis = step.area === 'kis';
                      
                      let canStart = false;
                      let canComplete = false;
                      let lockReason = '';
                      
                      if (isDisassembly) {
                        if (!isDone) { canComplete = true; }
                      } else if (isKis) {
                        if (!allNodesDone && hasNodes) lockReason = 'Ждём готовности узлов';
                        else if (!isDone && !isActive && !isPaused) canStart = true;
                      }
                      
                      return (
                        <tr key={sIdx} className={isActive ? 'bg-blue-50' : ''}>
                          <td className="px-2 py-2 font-medium text-slate-800"><span className={`inline-block text-xs px-2 py-0.5 rounded border ${AREA_COLORS[step.area]}`}>{AREA_LABELS[step.area]}</span></td>
                          <td className="px-2 py-2 text-slate-600">{step.estTime}м</td>
                          <td className="px-2 py-2 text-slate-800 font-medium">{stepFactTime(step)}</td>
                          <td className="px-2 py-2">
                            {isDone && <span className="text-green-600 text-xs font-bold">✓ Выполнено</span>}
                            {isActive && <span className="text-blue-600 text-xs font-bold animate-pulse">▶ В работе</span>}
                            {isPaused && <span className="text-orange-600 text-xs font-bold">⏸ Пауза</span>}
                            {!isDone && !isActive && !isPaused && <span className="text-slate-400 text-xs">Ожидает</span>}
                          </td>
                          <td className="px-2 py-2 text-xs text-slate-700 max-w-[180px] whitespace-normal break-words">{step.task ? <span className="text-amber-900 bg-amber-50 px-1 py-0.5 rounded">📋 {step.task}</span> : '-'}</td>
                          <td className="px-2 py-2 text-xs text-slate-600">
                            {step.plannerNote ? (<div className="flex items-center gap-1"><span className="text-blue-800 bg-blue-100 px-1 py-0.5 rounded">💬 {step.plannerNote}</span><button onClick={() => setEditingExtraNote({ sIdx, text: step.plannerNote || '' })} className="text-blue-500 hover:text-blue-700">✏️</button></div>) : (<button onClick={() => setEditingExtraNote({ sIdx, text: '' })} className="text-[10px] text-blue-600 hover:underline">+ Добавить</button>)}
                          </td>
                          <td className="px-2 py-2 text-xs text-slate-600 max-w-[180px] whitespace-normal break-words">{step.workerNote ? <span className="text-yellow-800 bg-yellow-100 px-1 py-0.5 rounded whitespace-pre-wrap">📝 {step.workerNote}</span> : '-'}</td>
                          <td className="px-2 py-2 text-right">
                            <div className="flex gap-1 justify-end flex-wrap">
                              {lockReason && <span className="text-[10px] text-slate-400 italic">{lockReason}</span>}
                              {isKis && isActive && !isDone && (
                                <>
                                  <button onClick={pauseKis} className="bg-yellow-100 hover:bg-yellow-200 text-yellow-800 text-xs px-2 py-1 rounded border border-yellow-200">⏸ Пауза</button>
                                  <button onClick={requestKisComplete} className="bg-green-100 hover:bg-green-200 text-green-700 text-xs px-2 py-1 rounded border border-green-200">✓ Завершить</button>
                                </>
                              )}
                              {isKis && isPaused && !isDone && (
                                <>
                                  <button onClick={resumeKis} className="bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs px-2 py-1 rounded border border-blue-200">▶ Продолжить</button>
                                  <button onClick={requestKisComplete} className="bg-green-100 hover:bg-green-200 text-green-700 text-xs px-2 py-1 rounded border border-green-200">✓ Завершить</button>
                                </>
                              )}
                              {isKis && canStart && (
                                <button onClick={startKis} className="bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs px-2 py-1 rounded border border-blue-200">▶ Запустить КИС</button>
                              )}
                              {isDisassembly && canComplete && !isDone && (
                                <button onClick={() => setShowDisassemblyPicker(true)} className="bg-green-100 hover:bg-green-200 text-green-700 text-xs px-2 py-1 rounded border border-green-200">✓ {hasNodes ? 'Завершить разборку' : 'Провести разборку'}</button>
                              )}
                              {isDone && isDisassembly && <button onClick={handleRevertDisassembly} className="bg-orange-100 hover:bg-orange-200 text-orange-700 text-xs px-2 py-1 rounded border border-orange-200">Вернуть</button>}
                              {isDone && isKis && <button onClick={revertKis} className="bg-orange-100 hover:bg-orange-200 text-orange-700 text-xs px-2 py-1 rounded border border-orange-200">Вернуть</button>}
                              <button onClick={() => setEditingExtraStep({ sIdx, data: { area: step.area, estTime: step.estTime, task: step.task || '' } })} className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-2 py-1 rounded border border-slate-200">✏️</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!hasNodes && !disassemblyDone && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="text-slate-500 text-sm text-center">Проведите разборку с выбором техкарты:</div>
              {localMotor.lastTemplateId && (
                <button onClick={handleRestoreDefects} className="w-full py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300 rounded-lg text-sm font-medium transition">
                  ↩️ Восстановить дефектовку от {localMotor.lastDefectDate ? new Date(localMotor.lastDefectDate).toLocaleString('ru-RU') : ''}
                </button>
              )}
              <div className="grid grid-cols-2 gap-2">
                <select value={plannerTplId} onChange={e => handleTplChange(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm outline-none">
                  <option value="">-- Техкарта --</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <input value={plannerCell} onChange={e => setPlannerCell(e.target.value)} placeholder="Ячейка (А-12)" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none" />
              </div>
              {flowNodesForPlanner.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-700">🔍 Узлы разборки:</div>
                  {flowNodesForPlanner.map(fNode => {
                    const colorDef = NODE_COLORS.find(c => c.value === fNode.color) || NODE_COLORS[0];
                    return (
                      <div key={fNode.id} className={`border-2 ${colorDef.border} ${colorDef.bg} rounded-lg p-2`}>
                        <div className="font-semibold text-xs mb-1">{fNode.name}</div>
                        <label className="flex items-center gap-2 text-xs cursor-pointer p-1 rounded hover:bg-white/60">
                          <input type="radio" name={`p-flow-${fNode.id}`} checked={(plannerFlowSelections[fNode.id] || '') === ''} onChange={() => setPlannerFlowSelections({ ...plannerFlowSelections, [fNode.id]: '' })} className="w-3 h-3 accent-green-600" />
                          <span>✓ OK (нет дефекта)</span>
                        </label>
                        {fNode.defects.map(d => (
                          <label key={d.id} className="flex items-center gap-2 text-xs cursor-pointer p-1 rounded hover:bg-white/60">
                            <input type="radio" name={`p-flow-${fNode.id}`} checked={plannerFlowSelections[fNode.id] === d.id} onChange={() => setPlannerFlowSelections({ ...plannerFlowSelections, [fNode.id]: d.id })} className="w-3 h-3 accent-red-600" />
                            <span>{d.label}</span>
                          </label>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
              <button onClick={handleDisassemblyComplete} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition">Создать узлы и перейти в работу</button>
            </div>
          )}

          {hasNodes && (
            <>
              {localMotor.nodes.map((node, nIdx) => (
                <div key={node.id} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-slate-800 text-white px-4 py-2 font-bold flex justify-between items-center">
                    <span>{node.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-slate-700 px-2 py-0.5 rounded text-slate-300">{node.status === 'done' ? 'Готов' : node.status === 'in_progress' ? 'В работе' : 'Ожидает'}</span>
                      <button onClick={() => setEditingNodeName({ nIdx, name: node.name })} className="text-blue-300 hover:text-blue-100 text-xs px-2 py-0.5 rounded border border-blue-500/40">✏️</button>
                      <button onClick={() => handleDeleteNode(nIdx)} className="text-red-300 hover:text-red-100 text-xs px-2 py-0.5 rounded border border-red-500/40">✕</button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-100 text-slate-600 border-b">
                        <tr>
                          <th className="px-1 py-2 w-8"></th>
                          <th className="px-2 py-2 font-medium">Передел</th>
                          <th className="px-2 py-2 font-medium w-16">План</th>
                          <th className="px-2 py-2 font-medium w-20">Факт</th>
                          <th className="px-2 py-2 font-medium w-24">Статус</th>
                          <th className="px-2 py-2 font-medium">Задание</th>
                          <th className="px-2 py-2 font-medium">Комментарий планера</th>
                          <th className="px-2 py-2 font-medium">Примечание рабочего</th>
                          <th className="px-2 py-2 font-medium text-right">Действия</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {node.route.length === 0 && <tr><td colSpan={9} className="px-3 py-4 text-center text-slate-400 italic text-xs">Нет операций в узле.</td></tr>}
                        {node.route.map((step, sIdx) => {
                          const isDone = !!step.finishedAt;
                          const isActive = sIdx === node.currentIndex && !isDone;
                          const isDropTarget = dragOver?.nodeIdx === nIdx && dragOver?.stepIdx === sIdx && dragState?.nodeIdx === nIdx && dragState?.stepIdx !== sIdx;
                          return (
                            <tr key={sIdx}
                              onDragOver={(e) => { e.preventDefault(); if (dragState?.nodeIdx === nIdx && dragState.stepIdx !== sIdx) setDragOver({ nodeIdx: nIdx, stepIdx: sIdx }); }}
                              onDragLeave={() => { if (dragOver?.nodeIdx === nIdx && dragOver?.stepIdx === sIdx) setDragOver(null); }}
                              onDrop={(e) => { e.preventDefault(); handleReorderStep(nIdx, sIdx); }}
                              className={`${isActive ? 'bg-blue-50' : ''} ${isDropTarget ? 'border-t-2 border-blue-500' : ''}`}
                            >
                              <td className="px-1 py-1 text-center"><span draggable onDragStart={() => setDragState({ nodeIdx: nIdx, stepIdx: sIdx })} onDragEnd={() => { setDragState(null); setDragOver(null); }} className="cursor-grab active:cursor-grabbing inline-block text-slate-400 hover:text-slate-700 select-none text-base leading-none px-1 py-1">⠿</span></td>
                              <td className="px-2 py-2 font-medium text-slate-800"><span className={`inline-block text-xs px-2 py-0.5 rounded border ${AREA_COLORS[step.area]}`}>{AREA_LABELS[step.area]}</span></td>
                              <td className="px-2 py-2 text-slate-600">{step.estTime}м</td>
                              <td className="px-2 py-2 text-slate-800 font-medium">{stepFactTime(step)}</td>
                              <td className="px-2 py-2">
                                {isDone && <span className="text-green-600 text-xs font-bold">✓ Выполнено</span>}
                                {isActive && !step.pausedAt && <span className="text-blue-600 text-xs font-bold animate-pulse">▶ В работе</span>}
                                {isActive && step.pausedAt && <span className="text-orange-600 text-xs font-bold">⏸ Пауза</span>}
                                {!isDone && !isActive && <span className="text-slate-400 text-xs">Ожидает</span>}
                              </td>
                              <td className="px-2 py-2 text-xs text-slate-700 max-w-[180px] whitespace-normal break-words">{step.task ? <span className="text-amber-900 bg-amber-50 px-1 py-0.5 rounded">📋 {step.task}</span> : '-'}</td>
                              <td className="px-2 py-2 text-xs text-slate-600">
                                {step.plannerNote ? (<div className="flex items-center gap-1"><span className="text-blue-800 bg-blue-100 px-1 py-0.5 rounded">💬 {step.plannerNote}</span><button onClick={() => setEditingNote({ nIdx, sIdx, text: step.plannerNote || '' })} className="text-blue-500 hover:text-blue-700">✏️</button></div>) : (<button onClick={() => setEditingNote({ nIdx, sIdx, text: '' })} className="text-[10px] text-blue-600 hover:underline">+ Добавить</button>)}
                              </td>
                              <td className="px-2 py-2 text-xs text-slate-600 whitespace-normal break-words max-w-[150px]">{step.workerNote ? <span className="text-yellow-800 bg-yellow-100 px-1 py-0.5 rounded">📝 {step.workerNote}</span> : '-'}</td>
                              <td className="px-2 py-2 text-right">
                                <div className="flex gap-1 justify-end">
                                  {!isDone && <button onClick={() => handleCompleteStep(nIdx, sIdx)} className="bg-green-100 hover:bg-green-200 text-green-700 text-xs px-2 py-1 rounded border border-green-200">Завершить</button>}
                                  {isDone && <button onClick={() => handleRevertStep(nIdx, sIdx)} className="bg-orange-100 hover:bg-orange-200 text-orange-700 text-xs px-2 py-1 rounded border border-orange-200">Вернуть</button>}
                                  <button onClick={() => setEditingStep({ nIdx, sIdx, data: { area: step.area, estTime: step.estTime, task: step.task || '' } })} className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-2 py-1 rounded border border-slate-200">✏️</button>
                                  <button onClick={() => handleDeleteStep(nIdx, sIdx)} className="bg-red-100 hover:bg-red-200 text-red-700 text-xs px-2 py-1 rounded border border-red-200">✕</button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <AddStepForm onAdd={(area, time, task) => handleAddStep(nIdx, area, time, task)} />
                </div>
              ))}
              <div className="bg-slate-50 border-2 border-dashed border-blue-300 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Добавить новый узел</h4>
                <div className="flex gap-2">
                  <input value={newNodeName} onChange={e => setNewNodeName(e.target.value)} placeholder="Название узла" className="flex-1 px-3 py-2 border border-slate-300 rounded text-sm outline-none" onKeyDown={e => { if (e.key === 'Enter') handleAddNode(); }} />
                  <button onClick={handleAddNode} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded transition">+ Добавить узел</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {editingNote && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Комментарий для рабочего</h3>
            <textarea rows={3} value={editingNote.text} onChange={e => setEditingNote({...editingNote, text: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 mb-4" />
            <div className="flex gap-2">
              <button onClick={() => setEditingNote(null)} className="flex-1 py-2.5 border border-slate-300 rounded-lg text-slate-700 font-medium">Отмена</button>
              <button onClick={() => { const newMotor = JSON.parse(JSON.stringify(localMotor)); newMotor.nodes[editingNote.nIdx].route[editingNote.sIdx].plannerNote = editingNote.text; setLocalMotor(newMotor); setEditingNote(null); }} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">Сохранить</button>
            </div>
          </div>
        </div>
      )}

      {editingExtraNote && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Комментарий планера</h3>
            <textarea rows={3} value={editingExtraNote.text} onChange={e => setEditingExtraNote({...editingExtraNote, text: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 mb-4" />
            <div className="flex gap-2">
              <button onClick={() => setEditingExtraNote(null)} className="flex-1 py-2.5 border border-slate-300 rounded-lg text-slate-700 font-medium">Отмена</button>
              <button onClick={() => { const newMotor = JSON.parse(JSON.stringify(localMotor)); if (newMotor.extraSteps) newMotor.extraSteps[editingExtraNote.sIdx].plannerNote = editingExtraNote.text; setLocalMotor(newMotor); setEditingExtraNote(null); }} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">Сохранить</button>
            </div>
          </div>
        </div>
      )}

      {editingStep && <EditStepModal initial={editingStep.data} onClose={() => setEditingStep(null)} onSave={handleEditStepSave} />}
      {editingExtraStep && <EditStepModal initial={editingExtraStep.data} onClose={() => setEditingExtraStep(null)} onSave={handleEditExtraStepSave} />}
      {editingNodeName && <EditNodeNameModal initial={editingNodeName.name} onClose={() => setEditingNodeName(null)} onSave={handleEditNodeNameSave} />}

      {showDisassemblyPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-3">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Завершение разборки</h3>
            <select value={plannerTplId} onChange={e => handleTplChange(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm outline-none">
              <option value="">-- Техкарта --</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <input value={plannerCell} onChange={e => setPlannerCell(e.target.value)} placeholder="Ячейка" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none" />
            <div className="max-h-64 overflow-y-auto space-y-2 border border-slate-200 rounded-lg p-2">
              {flowNodesForPlanner.map(fNode => (
                <div key={fNode.id} className="border border-slate-200 rounded p-2 bg-white">
                  <div className="font-semibold text-xs mb-1">{fNode.name}</div>
                  <label className="flex items-center gap-2 text-xs p-0.5">
                    <input type="radio" name={`d-flow-${fNode.id}`} checked={(plannerFlowSelections[fNode.id] || '') === ''} onChange={() => setPlannerFlowSelections({ ...plannerFlowSelections, [fNode.id]: '' })} className="w-3 h-3" /> OK
                  </label>
                  {fNode.defects.map(d => (
                    <label key={d.id} className="flex items-center gap-2 text-xs p-0.5">
                      <input type="radio" name={`d-flow-${fNode.id}`} checked={plannerFlowSelections[fNode.id] === d.id} onChange={() => setPlannerFlowSelections({ ...plannerFlowSelections, [fNode.id]: d.id })} className="w-3 h-3" /> {d.label}
                    </label>
                  ))}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowDisassemblyPicker(false)} className="flex-1 py-2.5 border border-slate-300 rounded-lg text-slate-700 font-medium">Отмена</button>
              <button onClick={handleDisassemblyComplete} className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium">Завершить разборку</button>
            </div>
          </div>
        </div>
      )}

      {kisDefectModal && (
        <StepDefectModal 
          block={kisDefectModal.block} 
          stepTask={localMotor.extraSteps?.find(s => s.area === 'kis' && !s.finishedAt)?.task} 
          onCancel={() => setKisDefectModal(null)} 
          onConfirm={(defectIdOrEmpty) => finishKisWithDefect(defectIdOrEmpty)} 
        />
      )}
    </div>
  );
}

// ============================================================
// ПЛАНИРОВЩИК
// ============================================================
function PlannerView({ motors, setMotors, templates, readLogs, markLogsRead, markAllLogsRead }: { 
  motors: Motor[]; setMotors: (m: Motor[]) => void; templates: DefectTemplate[];
  readLogs: Record<string, number>; markLogsRead: (id: string, count: number) => void; markAllLogsRead: () => void;
}) {
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [revisingId, setRevisingId] = useState<string | null>(null);
  const [editingMotor, setEditingMotor] = useState<Motor | null>(null);
  const [logsMotor, setLogsMotor] = useState<Motor | null>(null);
  const [attachmentsMotor, setAttachmentsMotor] = useState<Motor | null>(null);
  const [defectsMotor, setDefectsMotor] = useState<Motor | null>(null); 
  const [areaDetailsMotor, setAreaDetailsMotor] = useState<Motor | null>(null);
  const [infoMotor, setInfoMotor] = useState<Motor | null>(null);
  const [notesMotor, setNotesMotor] = useState<Motor | null>(null);
  const [kisDefectModal, setKisDefectModal] = useState<{ motorId: string; block: FlowBlock } | null>(null);
  const [filters, setFilters] = useState({ customerShop: '', repairType: '', serialNumber: '', model: '', power: '', rpm: '', scheduledDate: '', cellNumber: '', currentArea: '', action: '', logs: '', notes: '' });
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [isPendingApprovalsOpen, setIsPendingApprovalsOpen] = useState(true);
  const [isCompletedOpen, setIsCompletedOpen] = useState(false); 
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  const openLogs = (motor: Motor) => setLogsMotor(motor);
  const closeLogs = () => { if (logsMotor) markLogsRead(logsMotor.id, logsMotor.logs?.length || 0); setLogsMotor(null); };
  const isUnreadForPlanner = (m: Motor) => {
    const readCount = readLogs[m.id] || 0;
    return (m.logs || []).slice(readCount).some(log => log.user !== 'Планировщик');
  };

  const pendingApprovals = motors.filter(m => m.status === 'pending_approval');
  const allActive = motors.filter(m => ['approved', 'awaiting_repair', 'disassembly', 'in_repair', 'ready_for_kitting', 'kitting', 'assembly', 'ready'].includes(m.status));
  const completedMotors = motors.filter(m => ['issued', 'cancelled', 'rejected'].includes(m.status));
  const uniqueStatuses = Array.from(new Set(allActive.map(m => m.status)));

  const handleReject = (reason: string) => {
    if (!rejectingId) return;
    setMotors(motors.map(m => m.id === rejectingId ? addLog({ ...m, status: 'rejected' } as Motor, 'Заявка отклонена', reason, 'Планировщик') : m));
    setRejectingId(null);
  };
  const handleRevision = (reason: string) => {
    if (!revisingId) return;
    setMotors(motors.map(m => m.id === revisingId ? addLog({ ...m, status: 'revision' }, 'Отправлено на доработку', reason, 'Планировщик') : m));
    setRevisingId(null);
  };
  const approveRequest = (id: string) => {
    setMotors(motors.map(m => m.id === id ? addLog({ ...m, status: 'approved' }, 'Заявка согласована', undefined, 'Планировщик') : m));
  };
  const cancelApproved = (id: string) => {
    if (confirm('Отменить согласованную заявку?')) {
      setMotors(motors.map(m => m.id === id ? addLog({ ...m, status: 'cancelled' } as Motor, 'Отменена планировщиком (до завоза)', 'Заказчик не привез двигатель', 'Планировщик') : m));
    }
  };
  const handleEditPlanner = (updatedData: any) => {
    if (!editingMotor) return;
    const diff = generateChangeLog(editingMotor, updatedData);
    setMotors(motors.map(m => m.id === editingMotor.id ? addLog({ ...m, ...updatedData }, 'Планировщик отредактировал заявку', diff, 'Планировщик') : m));
    setEditingMotor(null);
  };
  const takeToWork = (id: string) => {
    setMotors(motors.map(m => m.id === id ? addLog({ ...m, status: 'disassembly', scheduleStartedAt: new Date().toISOString(), nodes: [], extraSteps: defaultExtraSteps() }, 'Взято в работу', 'Отправлено на разборку', 'Планировщик') : m));
  };

  const requestKisComplete = (motor: Motor) => {
    const template = templates.find(t => t.id === motor.selectedTemplateId);
    const kisBlock = template?.flowBlocks?.find(b => b.kind === 'end-tests');
    if (kisBlock && blockHasDefects(kisBlock)) {
      setKisDefectModal({ motorId: motor.id, block: kisBlock });
      return;
    }
    if (!confirm('Завершить контрольные испытания? Двигатель будет готов к выдаче.')) return;
    setMotors(motors.map(m => m.id === motor.id ? buildKisCompletionResult(m, templates, '', 'Планировщик') : m));
  };

  const confirmKisWithDefect = (defectIdOrEmpty: string) => {
    if (!kisDefectModal) return;
    const motorId = kisDefectModal.motorId;
    setMotors(motors.map(m => m.id === motorId ? buildKisCompletionResult(m, templates, defectIdOrEmpty, 'Планировщик') : m));
    setKisDefectModal(null);
  };

  const saveDefectsCorrection = (motorId: string, templateId: string, checkedIds: string[]) => {
    setMotors(motors.map(m => {
      if (m.id !== motorId) return m;
      const newTemplate = templates.find(t => t.id === templateId);
      if (!newTemplate) return m;
      const newNodes = createNodesWithDefects(newTemplate, checkedIds, m.nodes, m.defectSelections);
      const foundDefects = newTemplate.nodes.flatMap(n => n.defects.filter(d => checkedIds.includes(d.id)).map(d => `${n.name}: ${d.label}`));
      const updated = { ...m, selectedTemplateId: templateId, checkedDefectIds: checkedIds, nodes: newNodes, foundDefects: foundDefects.length > 0 ? foundDefects : ['Дефекты не обнаружены'], inspectorName: m.inspectorName ? `${m.inspectorName} (изм. План.)` : 'Планировщик' };
      return addLog(updated, 'Корректировка дефектовки', '', 'Планировщик');
    }));
    setDefectsMotor(null);
  };

  const handleUpdateMotorFromDetails = (updatedMotor: Motor) => {
    setMotors(motors.map(m => m.id === updatedMotor.id ? updatedMotor : m));
  };
  const saveNotes = (motorId: string, text: string) => {
    setMotors(motors.map(m => {
      if (m.id !== motorId) return m;
      if (m.notes === text) return m;
      let updated = { ...m, notes: text };
      updated = addNoteLog(updated, 'Обновление примечания', text ? `Текст изменен на: "${text}"` : 'Текст удален');
      return updated;
    }));
    setNotesMotor(null);
  };

  const getKisState = (m: Motor) => {
    const kis = m.extraSteps?.find(s => s.area === 'kis' && !s.finishedAt);
    const allNodesDone = !m.nodes || m.nodes.length === 0 || m.nodes.every(n => n.status === 'done');
    return {
      step: kis,
      allNodesDone,
      canComplete: !!(kis && allNodesDone && ['in_repair', 'ready_for_kitting'].includes(m.status)),
    };
  };

  const getCurrentArea = (m: Motor) => {
    if (m.status === 'approved') return 'Ожидает завоза';
    if (m.status === 'awaiting_repair') return 'Ожидает разборки';
    if (m.status === 'disassembly') return 'Разборка';
    if (m.status === 'ready') return 'Готов к выдаче';
    if (m.status === 'issued') return 'Выдана';
    if (m.status === 'cancelled') return 'Отменена';
    if (m.status === 'rejected') return 'Отклонена';
    if (m.status === 'ready_for_kitting') return 'Готов к КИС (устар.)';
    if (m.status === 'kitting' || m.status === 'assembly') return 'КИС (устар.)';
    
    const kis = m.extraSteps?.find(s => s.area === 'kis' && !s.finishedAt);
    if (kis?.startedAt) return 'КИС в работе';
    if (kis?.pausedAt) return 'КИС на паузе';
    const allNodesDone = !m.nodes || m.nodes.length === 0 || m.nodes.every(n => n.status === 'done');
    if (allNodesDone && kis) return 'Готов к КИС';
    if (m.nodes && m.nodes.length > 0) {
      const activeNodes = m.nodes.filter(n => n.status !== 'done');
      if (activeNodes.length > 0) return activeNodes.map(n => `${n.name} (${AREA_LABELS[n.route[n.currentIndex].area]})`).join(', ');
    }
    return 'В работе';
  };
  
  const getTimes = (m: Motor) => {
    const start = m.scheduleStartedAt ? new Date(m.scheduleStartedAt).getTime() : new Date(m.createdAt).getTime();
    const end = ['ready', 'issued', 'cancelled', 'rejected'].includes(m.status) ? new Date(m.readyAt || m.shippedAt || Date.now()).getTime() : Date.now();
    const totalMs = end - start;
    let workMs = 0;
    if (m.nodes) m.nodes.forEach(n => n.route.forEach(r => { workMs += stepWorkMs(r); }));
    if (m.extraSteps) m.extraSteps.forEach(r => { workMs += stepWorkMs(r); });
    return { total: formatDuration(totalMs), work: formatDuration(workMs), totalMs, workMs };
  };

  const allActiveWithArea = allActive.map(m => {
    const times = getTimes(m);
    const kisState = getKisState(m);
    return { 
      ...m, currentAreaText: getCurrentArea(m),
      actionText: m.status === 'approved' ? 'Отменить завоз' : m.status === 'awaiting_repair' ? 'В разборку!' : kisState.canComplete ? 'Завершить КИС' : m.status === 'ready' ? 'Готов к выдаче' : 'В процессе...',
      totalTimeStr: times.total, workTimeStr: times.work, totalTimeMs: times.totalMs, workTimeMs: times.workMs,
      kisCanComplete: kisState.canComplete,
    };
  });

  const filteredAndSorted = allActiveWithArea
    .filter(m => {
      if (statusFilter.length > 0 && !statusFilter.includes(m.status)) return false;
      return Object.entries(filters).every(([key, val]) => {
        if (!val) return true;
        if (key === 'currentArea') return m.currentAreaText.toLowerCase().includes(val.toLowerCase());
        if (key === 'action') return m.actionText.toLowerCase().includes(val.toLowerCase());
        if (key === 'notes') return (m.notes || '').toLowerCase().includes(val.toLowerCase());
        if (key === 'logs') {
          const isUnread = isUnreadForPlanner(m);
          if (val === 'unread') return isUnread;
          if (val === 'read') return !isUnread;
          return true;
        }
        const itemValue = (m[key as keyof typeof m] || '');
        return itemValue.toString().toLowerCase().includes(val.toLowerCase());
      });
    })
    .sort((a, b) => {
      if (!sortConfig) return 0;
      const { key, direction } = sortConfig;
      if (key === 'logs') {
        const unreadA = isUnreadForPlanner(a);
        const unreadB = isUnreadForPlanner(b);
        if (unreadA === unreadB) return 0;
        return direction === 'asc' ? (unreadA ? 1 : -1) : (unreadA ? -1 : 1);
      }
      let valA = a[key as keyof typeof a] || '';
      let valB = b[key as keyof typeof b] || '';
      if (['power', 'rpm', 'totalTimeMs', 'workTimeMs'].includes(key)) { valA = Number(valA) || 0; valB = Number(valB) || 0; }
      else if (typeof valA === 'string') { valA = valA.toLowerCase(); valB = (valB || '').toString().toLowerCase(); }
      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };
  const getSortIcon = (key: string) => (!sortConfig || sortConfig.key !== key) ? '↕️' : sortConfig.direction === 'asc' ? '⬆️' : '⬇️';

  return (
    <>
      <div className="space-y-8">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2 cursor-pointer select-none" onClick={() => setIsPendingApprovalsOpen(!isPendingApprovalsOpen)}>
            <span className={`text-slate-400 transform transition-transform ${isPendingApprovalsOpen ? 'rotate-90' : ''}`}>▶</span>
            <span className="w-2 h-2 rounded-full bg-orange-500"></span> Заявки на согласовании ({pendingApprovals.length})
          </h2>
          {isPendingApprovalsOpen && (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {pendingApprovals.map(m => {
                const unread = isUnreadForPlanner(m);
                return (
                  <div key={m.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col">
                    <div className="mb-2">
                      <h3 className="font-bold text-slate-800">{m.model} (Инв. {m.serialNumber})</h3>
                      <p className="text-sm text-slate-500">Цех: {m.customerShop} • {m.customerName} • {m.customerPhone}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="text-xs font-bold text-slate-800 bg-slate-100 border border-slate-300 rounded px-2 py-0.5">
                          🔧 Вид ремонта: {m.repairType || '-'}
                        </span>
                        <span className="text-xs text-slate-600">
                          {m.power ? `${m.power} кВт` : ''}{m.rpm ? ` • ${m.rpm} об/мин` : ''}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 mt-2">📅 Завоз: <strong>{m.scheduledDate}</strong></p>
                      {m.complaint && (
                        <div className="mt-2 text-xs text-yellow-900 bg-yellow-50 border border-yellow-200 rounded p-2 whitespace-pre-wrap">
                          <strong>💬 Пожелания:</strong> {m.complaint}
                        </div>
                      )}
                    </div>
                    <div className="mt-auto pt-3 flex gap-2">
                      <button onClick={() => approveRequest(m.id)} className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium py-2 rounded-lg">Согласовать</button>
                      <button onClick={() => setRevisingId(m.id)} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium py-2 rounded-lg">На доработку</button>
                      <button onClick={() => setRejectingId(m.id)} className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs font-medium py-2 rounded-lg">Отклонить</button>
                    </div>
                    <div className="mt-2 flex gap-2 justify-end flex-wrap">
                      <button onClick={() => setInfoMotor(m)} className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 px-2 py-1 rounded">ℹ️ Инфо</button>
                      <button onClick={() => setAttachmentsMotor(m)} className="text-xs text-slate-500 hover:text-slate-800 border px-2 py-1 rounded">📎 ({m.attachments?.length || 0})</button>
                      <button onClick={() => openLogs(m)} className={`text-xs px-2 py-1 rounded border ${unread ? 'bg-red-50 text-red-600 border-red-200 font-semibold' : 'text-slate-500 hover:text-slate-800 border-slate-200'}`}>📄 {unread && '●'}</button>
                      <button onClick={() => setEditingMotor(m)} className="text-xs text-slate-500 hover:text-slate-800 border px-2 py-1 rounded">✏️</button>
                    </div>
                  </div>
                );
              })}
              {pendingApprovals.length === 0 && <p className="text-slate-400 text-sm col-span-full">Нет новых заявок</p>}
            </div>
          )}
        </div>

        <div>
          <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span> Активные ремонты в цеху ({filteredAndSorted.length} из {allActive.length})
            </h2>
            <div className="flex gap-2">
              <button onClick={markAllLogsRead} className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-3 py-1.5 rounded-lg text-sm shadow-sm">✓ Прочитать все логи</button>
              <div className="relative">
                <button onClick={() => setShowStatusMenu(!showStatusMenu)} className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-3 py-1.5 rounded-lg text-sm shadow-sm flex items-center gap-2">
                  Фильтр по статусам {statusFilter.length > 0 && <span className="bg-blue-600 text-white text-xs px-1.5 rounded-full">{statusFilter.length}</span>}
                </button>
                {showStatusMenu && (
                  <div className="absolute top-full right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 p-3 w-64 max-h-64 overflow-y-auto">
                    <label className="flex items-center gap-2 mb-2 font-medium border-b pb-2 cursor-pointer text-sm">
                      <input type="checkbox" checked={statusFilter.length === 0} onChange={() => setStatusFilter([])} className="w-4 h-4 accent-blue-600" /> Показать все
                    </label>
                    {uniqueStatuses.map(s => (
                      <label key={s} className="flex items-center gap-2 mb-2 cursor-pointer text-sm text-slate-700 hover:text-slate-900">
                        <input type="checkbox" checked={statusFilter.includes(s)} onChange={(e) => {
                          if (e.target.checked) setStatusFilter([...statusFilter, s]);
                          else setStatusFilter(statusFilter.filter(x => x !== s));
                        }} className="w-4 h-4 accent-blue-600" />
                        {MOTOR_STATUS_LABELS[s as MotorStatus]}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto w-full">
            <table className="w-full text-left text-xs whitespace-nowrap min-w-[1400px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 align-top">
                <tr>
                  <th className="px-2 py-2 font-medium"><div className="flex flex-col gap-1"><span onClick={() => requestSort('customerShop')} className="cursor-pointer select-none flex items-center gap-1">Цех {getSortIcon('customerShop')}</span><input value={filters.customerShop} onChange={e => setFilters({...filters, customerShop: e.target.value})} placeholder="Поиск..." className="border border-slate-300 px-1 py-1 text-[10px] rounded w-full font-normal outline-none focus:border-blue-500" /></div></th>
                  <th className="px-2 py-2 font-medium"><div className="flex flex-col gap-1"><span onClick={() => requestSort('repairType')} className="cursor-pointer select-none flex items-center gap-1">Вид {getSortIcon('repairType')}</span><input value={filters.repairType} onChange={e => setFilters({...filters, repairType: e.target.value})} placeholder="СР/КР" className="border border-slate-300 px-1 py-1 text-[10px] rounded w-full font-normal outline-none focus:border-blue-500" /></div></th>
                  <th className="px-2 py-2 font-medium"><div className="flex flex-col gap-1"><span onClick={() => requestSort('serialNumber')} className="cursor-pointer select-none flex items-center gap-1">Инв. № {getSortIcon('serialNumber')}</span><input value={filters.serialNumber} onChange={e => setFilters({...filters, serialNumber: e.target.value})} placeholder="Поиск..." className="border border-slate-300 px-1 py-1 text-[10px] rounded w-full font-normal outline-none focus:border-blue-500" /></div></th>
                  <th className="px-2 py-2 font-medium"><div className="flex flex-col gap-1"><span onClick={() => requestSort('model')} className="cursor-pointer select-none flex items-center gap-1">Тип {getSortIcon('model')}</span><input value={filters.model} onChange={e => setFilters({...filters, model: e.target.value})} placeholder="Поиск..." className="border border-slate-300 px-1 py-1 text-[10px] rounded w-full font-normal outline-none focus:border-blue-500" /></div></th>
                  <th className="px-2 py-2 font-medium"><div className="flex flex-col gap-1"><span onClick={() => requestSort('power')} className="cursor-pointer select-none flex items-center gap-1">Мощн {getSortIcon('power')}</span><input value={filters.power} onChange={e => setFilters({...filters, power: e.target.value})} placeholder="кВт" className="border border-slate-300 px-1 py-1 text-[10px] rounded w-full font-normal outline-none focus:border-blue-500" /></div></th>
                  <th className="px-2 py-2 font-medium"><div className="flex flex-col gap-1"><span onClick={() => requestSort('rpm')} className="cursor-pointer select-none flex items-center gap-1">Об/мин {getSortIcon('rpm')}</span><input value={filters.rpm} onChange={e => setFilters({...filters, rpm: e.target.value})} placeholder="Число" className="border border-slate-300 px-1 py-1 text-[10px] rounded w-full font-normal outline-none focus:border-blue-500" /></div></th>
                  <th className="px-2 py-2 font-medium"><div className="flex flex-col gap-1"><span onClick={() => requestSort('scheduledDate')} className="cursor-pointer select-none flex items-center gap-1">Завоз {getSortIcon('scheduledDate')}</span><input value={filters.scheduledDate} onChange={e => setFilters({...filters, scheduledDate: e.target.value})} placeholder="Дата" className="border border-slate-300 px-1 py-1 text-[10px] rounded w-full font-normal outline-none focus:border-blue-500" /></div></th>
                  <th className="px-2 py-2 font-medium"><div className="flex flex-col gap-1"><span onClick={() => requestSort('cellNumber')} className="cursor-pointer select-none flex items-center gap-1">Ячейка {getSortIcon('cellNumber')}</span><input value={filters.cellNumber} onChange={e => setFilters({...filters, cellNumber: e.target.value})} placeholder="Ячейка" className="border border-slate-300 px-1 py-1 text-[10px] rounded w-full font-normal outline-none focus:border-blue-500" /></div></th>
                  <th className="px-2 py-2 font-medium"><div className="flex flex-col gap-1"><span onClick={() => requestSort('currentAreaText')} className="cursor-pointer select-none flex items-center gap-1">Передел {getSortIcon('currentAreaText')}</span><input value={filters.currentArea} onChange={e => setFilters({...filters, currentArea: e.target.value})} placeholder="Поиск..." className="border border-slate-300 px-1 py-1 text-[10px] rounded w-full font-normal outline-none focus:border-blue-500" /></div></th>
                  <th className="px-2 py-2 font-medium"><div className="flex flex-col gap-1"><span onClick={() => requestSort('totalTimeMs')} className="cursor-pointer select-none flex items-center gap-1">Время {getSortIcon('totalTimeMs')}</span><span className="text-[10px] font-normal text-slate-400">(общ/раб)</span></div></th>
                  <th className="px-2 py-2 font-medium"><div className="flex flex-col gap-1"><span onClick={() => requestSort('notes')} className="cursor-pointer select-none flex items-center gap-1">Заметки {getSortIcon('notes')}</span><input value={filters.notes} onChange={e => setFilters({...filters, notes: e.target.value})} placeholder="Поиск..." className="border border-slate-300 px-1 py-1 text-[10px] rounded w-full font-normal outline-none focus:border-blue-500" /></div></th>
                  <th className="px-2 py-2 font-medium"><div className="flex flex-col gap-1"><span onClick={() => requestSort('actionText')} className="cursor-pointer select-none flex items-center gap-1 text-right justify-end">Действия {getSortIcon('actionText')}</span><input value={filters.action} onChange={e => setFilters({...filters, action: e.target.value})} placeholder="Поиск..." className="border border-slate-300 px-1 py-1 text-[10px] rounded w-full font-normal outline-none focus:border-blue-500" /></div></th>
                  <th className="px-2 py-2 font-medium text-center"><div className="flex flex-col gap-1 items-center"><span onClick={() => requestSort('logs')} className="cursor-pointer select-none flex items-center gap-1">Логи {getSortIcon('logs')}</span><select value={filters.logs} onChange={e => setFilters({...filters, logs: e.target.value})} className="border border-slate-300 px-1 py-1 text-[10px] rounded w-full font-normal outline-none focus:border-blue-500 bg-white"><option value="">Все</option><option value="unread">Непрочит.</option><option value="read">Прочит.</option></select></div></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAndSorted.map(m => {
                  const unread = isUnreadForPlanner(m);
                  return (
                    <tr key={m.id} className="hover:bg-slate-50 transition">
                      <td className="px-2 py-2 font-medium text-slate-800">
                        <div className="flex items-center gap-1">
                          <span>{m.customerShop}</span>
                          <button onClick={() => setInfoMotor(m)} className="text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 p-1 rounded-full transition shrink-0">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          </button>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-slate-600 font-bold">{m.repairType}</td>
                      <td className="px-2 py-2 text-slate-700 font-mono text-[11px]">{m.serialNumber || '-'}</td>
                      <td className="px-2 py-2 text-slate-800 font-medium">{m.model}</td>
                      <td className="px-2 py-2 text-slate-600">{m.power} кВт</td>
                      <td className="px-2 py-2 text-slate-600">{m.rpm}</td>
                      <td className="px-2 py-2 text-slate-600">{m.scheduledDate}</td>
                      <td className="px-2 py-2 text-slate-800 font-bold">
                        <div className="flex items-center gap-1">
                          {m.cellNumber || '-'}
                          {m.cellNumber && (
                            <button onClick={() => setDefectsMotor(m)} className="text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 p-1 rounded-full transition">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2"><button onClick={() => setAreaDetailsMotor(m)} className="text-[10px] font-medium text-indigo-700 bg-indigo-50 px-2 py-1 rounded border border-indigo-100 hover:bg-indigo-100 transition shadow-sm text-left">{m.currentAreaText} 🔍</button></td>
                      <td className="px-2 py-2 text-[10px] text-slate-600"><div className="flex flex-col gap-1"><span>⏱ {m.totalTimeStr}</span><span className="text-slate-400">🛠 {m.workTimeStr}</span></div></td>
                      <td className="px-2 py-2 text-[10px] text-slate-600"><div className="max-w-[150px] cursor-pointer hover:bg-slate-100 p-1 rounded border border-transparent hover:border-slate-300 transition flex items-center gap-1" onClick={() => setNotesMotor(m)} title={m.notes || 'Добавить'}>{m.notes ? (<><span>📝</span><span className="truncate">{m.notes}</span></>) : (<span className="text-slate-400 italic">+ Добавить</span>)}</div></td>
                      <td className="px-2 py-2 text-right">
                        {m.status === 'approved' && <button onClick={() => cancelApproved(m.id)} className="bg-red-100 hover:bg-red-200 text-red-700 text-[10px] px-2 py-1 rounded transition border border-red-200">Отменить</button>}
                        {m.status === 'awaiting_repair' && <button onClick={() => takeToWork(m.id)} className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] px-2 py-1 rounded-lg transition">В разборку!</button>}
                        {m.kisCanComplete && <button onClick={() => requestKisComplete(m)} className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] px-2 py-1 rounded-lg transition">Завершить КИС</button>}
                        {m.status === 'ready' && <span className="text-[10px] text-green-600 font-medium">Готов</span>}
                        {['disassembly', 'in_repair'].includes(m.status) && !m.kisCanComplete && <span className="text-[10px] text-slate-400 italic">В процессе...</span>}
                      </td>
                      <td className="px-2 py-2 text-center"><button onClick={() => openLogs(m)} className={`text-[10px] px-2 py-1 rounded border ${unread ? 'bg-red-50 text-red-600 border-red-200 font-semibold' : 'text-slate-500 hover:text-slate-800 border-slate-200'}`}>📄 {unread && '●'}</button></td>
                    </tr>
                  );
                })}
                {filteredAndSorted.length === 0 && <tr><td colSpan={13} className="px-2 py-8 text-center text-slate-400">Нет активных ремонтов</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2 cursor-pointer select-none" onClick={() => setIsCompletedOpen(!isCompletedOpen)}>
            <span className={`text-slate-400 transform transition-transform ${isCompletedOpen ? 'rotate-90' : ''}`}>▶</span>
            <span className="w-2 h-2 rounded-full bg-slate-400"></span> Архив ({completedMotors.length})
          </h2>
          {isCompletedOpen && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto w-full">
              <table className="w-full text-left text-xs whitespace-nowrap min-w-[1000px]">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="px-2 py-2 font-medium">Цех</th>
                    <th className="px-2 py-2 font-medium">Тип двиг.</th>
                    <th className="px-2 py-2 font-medium">Инв. №</th>
                    <th className="px-2 py-2 font-medium">Статус</th>
                    <th className="px-2 py-2 font-medium">Время ремонта</th>
                    <th className="px-2 py-2 font-medium">Дата готовности</th>
                    <th className="px-2 py-2 font-medium">Дата отгрузки</th>
                    <th className="px-2 py-2 font-medium text-center">Логи</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {completedMotors.map(m => {
                    const times = getTimes(m);
                    return (
                      <tr key={m.id} className="hover:bg-slate-50 transition opacity-75">
                        <td className="px-2 py-2 font-medium text-slate-800">{m.customerShop}</td>
                        <td className="px-2 py-2 text-slate-800">{m.model}</td>
                        <td className="px-2 py-2 text-slate-500">{m.serialNumber}</td>
                        <td className="px-2 py-2"><span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${MOTOR_STATUS_COLORS[m.status]}`}>{MOTOR_STATUS_LABELS[m.status]}</span></td>
                        <td className="px-2 py-2 text-[10px] text-slate-600">⏱ {times.total}</td>
                        <td className="px-2 py-2 text-[10px] text-slate-600">{m.readyAt ? new Date(m.readyAt).toLocaleString('ru-RU') : '-'}</td>
                        <td className="px-2 py-2 text-[10px] text-slate-600">{m.shippedAt ? new Date(m.shippedAt).toLocaleString('ru-RU') : '-'}</td>
                        <td className="px-2 py-2 text-center"><button onClick={() => openLogs(m)} className="text-[10px] px-2 py-1 rounded border border-slate-200 text-slate-500 hover:text-slate-800">📄</button></td>
                      </tr>
                    );
                  })}
                  {completedMotors.length === 0 && <tr><td colSpan={8} className="px-2 py-8 text-center text-slate-400">Архив пуст</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {rejectingId && <ReasonModal title="Отклонить заявку" onClose={() => setRejectingId(null)} onConfirm={handleReject} />}
      {revisingId && <ReasonModal title="Отправить на доработку" onClose={() => setRevisingId(null)} onConfirm={handleRevision} />}
      {editingMotor && <EditMotorModal motor={editingMotor} onClose={() => setEditingMotor(null)} onSubmit={handleEditPlanner} />}
      {logsMotor && <LogsModal motor={logsMotor} readCount={readLogs[logsMotor.id] || 0} currentUser="Планировщик" onClose={closeLogs} />}
      {attachmentsMotor && <AttachmentsModal motor={attachmentsMotor} onClose={() => setAttachmentsMotor(null)} />}
      {defectsMotor && <PlannerDefectsModal motor={defectsMotor} templates={templates} onClose={() => setDefectsMotor(null)} onSave={(tId, cIds) => saveDefectsCorrection(defectsMotor.id, tId, cIds)} />}
      {areaDetailsMotor && <CurrentAreaModal motor={areaDetailsMotor} templates={templates} onClose={() => setAreaDetailsMotor(null)} onUpdateMotor={handleUpdateMotorFromDetails} />}
      {infoMotor && <MotorInfoModal motor={infoMotor} canEdit={!['issued', 'cancelled', 'rejected'].includes(infoMotor.status)} onClose={() => setInfoMotor(null)} onEdit={() => { setEditingMotor(infoMotor); setInfoMotor(null); }} onOpenLogs={() => { setLogsMotor(infoMotor); setInfoMotor(null); }} />}
      {notesMotor && <NotesModal motor={notesMotor} onClose={() => setNotesMotor(null)} onSave={(text) => saveNotes(notesMotor.id, text)} />}
      {kisDefectModal && (
        <StepDefectModal 
          block={kisDefectModal.block} 
          stepTask={motors.find(m => m.id === kisDefectModal.motorId)?.extraSteps?.find(s => s.area === 'kis' && !s.finishedAt)?.task}
          onCancel={() => setKisDefectModal(null)} 
          onConfirm={confirmKisWithDefect} 
        />
      )}
    </>
  );
}

// ============================================================
// ПРИЕМЩИК
// ============================================================
function ReceiverView({ motors, setMotors }: { motors: Motor[]; setMotors: (m: Motor[]) => void }) {
  const [receivingMotor, setReceivingMotor] = useState<Motor | null>(null);
  const [photo, setPhoto] = useState('');
  const approvedRequests = motors.filter(m => m.status === 'approved');
  const readyRequests = motors.filter(m => m.status === 'ready');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setPhoto(reader.result as string);
    reader.readAsDataURL(file);
  };
  const confirmReceipt = () => {
    if (!receivingMotor) return;
    const newAttachment = photo ? { id: generateId(), url: photo, timestamp: new Date().toISOString(), author: 'Приемщик', stage: 'Приемка в цех' } : null;
    const updatedAttachments = newAttachment ? [...(receivingMotor.attachments || []), newAttachment] : (receivingMotor.attachments || []);
    setMotors(motors.map(m => m.id === receivingMotor.id ? addLog({ ...m, status: 'awaiting_repair', acceptedAt: new Date().toISOString(), attachments: updatedAttachments }, 'Принят в цех', 'Сверен инв. номер и тип', 'Приемщик') : m));
    setReceivingMotor(null);
    setPhoto('');
  };
  const issueMotor = (id: string) => {
    setMotors(motors.map(m => m.id === id ? addLog({ ...m, status: 'issued', shippedAt: new Date().toISOString() }, 'Выдан заказчику', undefined, 'Приемщик') : m));
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Ожидают приемки ({approvedRequests.length})</h2>
          <div className="space-y-3">
            {approvedRequests.map(m => (
              <div key={m.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <h3 className="font-bold text-slate-800">{m.model}</h3>
                <p className="text-sm text-slate-500">Цех: {m.customerShop} • Инв. {m.serialNumber}</p>
                <p className="text-sm text-slate-500 mb-3">{m.customerName} • {m.customerPhone}</p>
                <button onClick={() => setReceivingMotor(m)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg">Принять двигатель</button>
              </div>
            ))}
            {approvedRequests.length === 0 && <p className="text-slate-400 text-sm">Нет машин на приемку</p>}
          </div>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500"></span> Готовы к выдаче ({readyRequests.length})</h2>
          <div className="space-y-3">
            {readyRequests.map(m => (
              <div key={m.id} className="bg-white rounded-xl shadow-sm border border-green-200 p-4">
                <h3 className="font-bold text-slate-800">{m.model}</h3>
                <p className="text-sm text-slate-500">Цех: {m.customerShop} • Инв. {m.serialNumber}</p>
                <p className="text-sm text-slate-500 mb-3">{m.customerName} • {m.customerPhone}</p>
                <button onClick={() => issueMotor(m.id)} className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 rounded-lg">Выдать заказчику</button>
              </div>
            ))}
            {readyRequests.length === 0 && <p className="text-slate-400 text-sm">Нет готовых двигателей</p>}
          </div>
        </div>
      </div>
      {receivingMotor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Приемка двигателя</h3>
            <p className="text-sm text-slate-600 mb-4">Проверьте: <strong>{receivingMotor.model}</strong>, Инв. <strong>{receivingMotor.serialNumber}</strong>, Мощность <strong>{receivingMotor.power}</strong> кВт.</p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Фото при приемке</label>
              <input type="file" accept="image/*" onChange={handleFileChange} className="text-sm mb-2" />
              {photo && <img src={photo} alt="Фото" className="h-20 object-contain border rounded" />}
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setReceivingMotor(null); setPhoto(''); }} className="flex-1 py-2.5 border rounded-lg">Отмена</button>
              <button onClick={confirmReceipt} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg">Подтвердить</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================
// РАБОЧИЙ
// ============================================================
function WorkerView({ motors, setMotors, templates, readLogs, markLogsRead }: { 
  motors: Motor[]; setMotors: (m: Motor[]) => void; templates: DefectTemplate[];
  readLogs: Record<string, number>; markLogsRead: (id: string, count: number) => void;
}) {
  const [selectedArea, setSelectedArea] = useState<Area>('disassembly');
  const [seenNodes, setSeenNodes] = useState<string[]>([]);
  const [noteModalData, setNoteModalData] = useState<{ motor: Motor, node?: MotorNode } | null>(null);
  const [kittingMotor, setKittingMotor] = useState<Motor | null>(null);
  const [finishDefectModal, setFinishDefectModal] = useState<{ motorId: string; nodeId: string; stepIdx: number; block: FlowBlock; stepTask?: string } | null>(null);
  const [kisDefectModal, setKisDefectModal] = useState<{ motorId: string; block: FlowBlock } | null>(null);
  const [infoMotor, setInfoMotor] = useState<Motor | null>(null);
  const [logsMotorWorker, setLogsMotorWorker] = useState<Motor | null>(null);
  
  const areas: Area[] = ['disassembly', 'washing', 'drying', 'kis', 'machining', 'welding', 'balancing', 'unwinding', 'winding', 'kitting', 'assembly'];

  useEffect(() => {
    const saved = localStorage.getItem('mes_seen_nodes');
    if (saved) setSeenNodes(JSON.parse(saved));
  }, []);

  const markAsSeen = (nodeIds: string[]) => {
    const updated = Array.from(new Set([...seenNodes, ...nodeIds]));
    setSeenNodes(updated);
    localStorage.setItem('mes_seen_nodes', JSON.stringify(updated));
  };

  const closeWorkerLogs = () => {
    if (logsMotorWorker) markLogsRead(logsMotorWorker.id, logsMotorWorker.logs?.length || 0);
    setLogsMotorWorker(null);
  };

  const getExtraStep = (motor: Motor, area: Area): MotorStep | undefined => {
    const unfinished = motor.extraSteps?.find(s => s.area === area && !s.finishedAt);
    if (unfinished) return unfinished;
    return motor.extraSteps?.find(s => s.area === area);
  };

  const updateExtraStep = (
    motorId: string, area: Area, updater: (s: MotorStep) => MotorStep, actionName: string, logDetails?: string
  ) => {
    setMotors(motors.map(m => {
      if (m.id !== motorId) return m;
      let extraSteps = m.extraSteps && m.extraSteps.length > 0 ? JSON.parse(JSON.stringify(m.extraSteps)) : defaultExtraSteps();
      const idx = extraSteps.findIndex((s: MotorStep) => s.area === area && !s.finishedAt);
      if (idx === -1) extraSteps.push(updater({ area, estTime: 60, task: '' }));
      else extraSteps[idx] = updater(extraSteps[idx]);
      return addLog({ ...m, extraSteps }, actionName, logDetails, 'Рабочий');
    }));
  };

  const handleExtraStepStart = (motorId: string, area: Area) => {
    updateExtraStep(motorId, area, s => ({ ...s, startedAt: new Date().toISOString(), pausedAt: undefined }), 'Начало операции', `Этап: ${AREA_LABELS[area]}`);
  };
  const handleExtraStepPause = (motorId: string, area: Area) => {
    updateExtraStep(motorId, area, s => {
      if (!s.startedAt) return s;
      const addMs = Date.now() - new Date(s.startedAt).getTime();
      return { ...s, startedAt: undefined, pausedAt: new Date().toISOString(), accumulatedMs: (s.accumulatedMs || 0) + addMs };
    }, 'Пауза', `Этап: ${AREA_LABELS[area]}`);
  };
  const handleExtraStepResume = (motorId: string, area: Area) => {
    updateExtraStep(motorId, area, s => ({ ...s, startedAt: new Date().toISOString(), pausedAt: undefined }), 'Возобновление', `Этап: ${AREA_LABELS[area]}`);
  };
  const handleExtraStepCancel = (motorId: string, area: Area) => {
    if (!confirm('Отменить выполнение операции? Накопленное время будет сброшено.')) return;
    updateExtraStep(motorId, area, s => ({ ...s, startedAt: undefined, pausedAt: undefined, accumulatedMs: 0 }), 'Отмена выполнения', `Этап: ${AREA_LABELS[area]}`);
  };

  const requestKisComplete = (motor: Motor) => {
    const template = templates.find(t => t.id === motor.selectedTemplateId);
    const kisBlock = template?.flowBlocks?.find(b => b.kind === 'end-tests');
    if (kisBlock && blockHasDefects(kisBlock)) {
      setKisDefectModal({ motorId: motor.id, block: kisBlock });
      return;
    }
    if (!confirm('Завершить контрольные испытания? Двигатель будет готов к выдаче.')) return;
    setMotors(motors.map(m => m.id === motor.id ? buildKisCompletionResult(m, templates, '', 'Рабочий') : m));
  };

  const confirmKisWithDefect = (defectIdOrEmpty: string) => {
    if (!kisDefectModal) return;
    const motorId = kisDefectModal.motorId;
    setMotors(motors.map(m => m.id === motorId ? buildKisCompletionResult(m, templates, defectIdOrEmpty, 'Рабочий') : m));
    setKisDefectModal(null);
  };

  const updateNode = (motorId: string, nodeId: string, updater: (n: MotorNode) => MotorNode, actionName = 'Изменение статуса', logDetails?: string) => {
    setMotors(motors.map(m => {
      if (m.id !== motorId) return m;
      const nodes = m.nodes.map(n => n.id === nodeId ? updater(n) : n);
      const allDone = nodes.every(n => n.status === 'done');
      let status = m.status;
      if (allDone && m.status === 'in_repair') status = 'ready_for_kitting';
      else if (!allDone && m.status === 'ready_for_kitting') status = 'in_repair';
      const node = m.nodes.find(n => n.id === nodeId);
      const area = node?.route[node.currentIndex]?.area;
      return addLog({ ...m, nodes, status }, actionName, logDetails || `Узел: ${node?.name}, Этап: ${area ? AREA_LABELS[area] : ''}`, 'Рабочий');
    }));
  };

  const handleFinishStepWithDefect = (motorId: string, nodeId: string, stepIdx: number, defectIdOrEmpty: string) => {
    setMotors(motors.map(m => {
      if (m.id !== motorId) return m;
      const template = templates.find(t => t.id === m.selectedTemplateId);
      
      const newNodes = m.nodes.map(n => {
        if (n.id !== nodeId) return n;
        const newRoute = [...n.route];
        const currentStep = newRoute[stepIdx];
        if (!currentStep) return n;
        
        const now = new Date().toISOString();
        let accum = currentStep.accumulatedMs || 0;
        if (currentStep.startedAt) accum += Date.now() - new Date(currentStep.startedAt).getTime();
        newRoute[stepIdx] = { ...currentStep, startedAt: undefined, pausedAt: undefined, accumulatedMs: accum, finishedAt: now };
        
        if (defectIdOrEmpty && currentStep._blockId && template?.flowBlocks && template?.flowConnections) {
          const conn = template.flowConnections.find(c => c.fromBlockId === currentStep._blockId && c.fromPortId === defectIdOrEmpty);
          if (conn) {
            const path = collectPathFromBlock(template.flowBlocks, template.flowConnections, conn.toBlockId, m.defectSelections || {});
            const extraSteps: MotorStep[] = path.map(b => ({
              area: b.area, estTime: b.estTime, task: b.task, plannerNote: b.plannerNote, _blockId: b.id,
            }));
            newRoute.splice(stepIdx + 1, 0, ...extraSteps);
          }
        }
        
        let newIndex = newRoute.findIndex(s => !s.finishedAt);
        if (newIndex === -1) newIndex = newRoute.length;
        return { 
          ...n, route: newRoute, currentIndex: newIndex, 
          status: (newIndex >= newRoute.length ? 'done' : 'pending') as NodeStatus 
        };
      });
      
      let newDefectSelections = { ...(m.defectSelections || {}) };
      if (defectIdOrEmpty) {
        const oldNode = m.nodes.find(n => n.id === nodeId);
        const step = oldNode?.route[stepIdx];
        if (step?._blockId) newDefectSelections[step._blockId] = defectIdOrEmpty;
      }
      
      const oldNode = m.nodes.find(n => n.id === nodeId);
      const blockId = oldNode?.route[stepIdx]?._blockId;
      const defectBlock = blockId ? template?.flowBlocks?.find(b => b.id === blockId) : undefined;
      const defectLabel = defectIdOrEmpty ? defectBlock?.defects?.find(d => d.id === defectIdOrEmpty)?.label : undefined;
      
      return addLog({ 
        ...m, nodes: newNodes, defectSelections: newDefectSelections 
      }, 
        defectIdOrEmpty ? `Обнаружен дефект: ${defectLabel || '?'}` : 'Операция завершена',
        defectIdOrEmpty ? `Добавлены операции по устранению` : undefined,
        'Рабочий');
    }));
    setFinishDefectModal(null);
  };

  const handleDisassemblyComplete = (motorId: string, templateId: string, checkedDefectIds: string[], cellNum: string, comment: string, selections?: Record<string, string>) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;
    const newNodes = createNodesWithDefects(template, checkedDefectIds, undefined, selections);
    const foundDefects = template.nodes.flatMap(n => n.defects.filter(d => checkedDefectIds.includes(d.id)).map(d => `${n.name}: ${d.label}`));
    setMotors(motors.map(m => {
      if (m.id !== motorId) return m;
      const now = new Date().toISOString();
      const newExtraSteps = templateFlowToExtraSteps(template);
      const disIdx = newExtraSteps.findIndex(s => s.area === 'disassembly');
      if (disIdx >= 0) {
        newExtraSteps[disIdx] = { ...newExtraSteps[disIdx], startedAt: now, finishedAt: now, accumulatedMs: 60000 };
      }
      return addLog({ 
        ...m, status: 'in_repair', cellNumber: cellNum, inspectorName: 'Разборщик',
        foundDefects: foundDefects.length > 0 ? foundDefects : ['Дефекты не обнаружены'],
        defectNote: comment, nodes: newNodes, extraSteps: newExtraSteps,
        selectedTemplateId: templateId, checkedDefectIds, defectSelections: selections,
      }, 'Разборка завершена', `Ячейка: ${cellNum}. Дефектовка проведена.`, 'Разборщик');
    }));
  };

  const saveNodeWorkerNote = (motorId: string, nodeId: string, stepIdx: number, text: string) => {
    setMotors(motors.map(m => {
      if (m.id !== motorId) return m;
      const newNodes = m.nodes.map(n => {
        if (n.id !== nodeId) return n;
        const newRoute = [...n.route];
        newRoute[stepIdx] = { ...newRoute[stepIdx], workerNote: text };
        return { ...n, route: newRoute };
      });
      return addLog({ ...m, nodes: newNodes }, 'Примечание рабочего', `Текст: "${text}"`, 'Рабочий');
    }));
    setNoteModalData(null);
  };

  const handleKittingConfirm = (workerNote: string, allReady: boolean) => {
    if (!kittingMotor) return;
    setMotors(motors.map(m => {
      if (m.id !== kittingMotor.id) return m;
      const now = new Date().toISOString();
      const extraSteps = (m.extraSteps || defaultExtraSteps()).map(s => {
        if (s.area === 'kitting') {
          const updated = { ...s, workerNote };
          if (allReady && !s.finishedAt) {
            let accum = s.accumulatedMs || 0;
            if (s.startedAt) accum += Date.now() - new Date(s.startedAt).getTime();
            updated.accumulatedMs = accum; updated.startedAt = undefined; updated.pausedAt = undefined; updated.finishedAt = now;
          }
          return updated;
        }
        return s;
      });
      return addLog({ ...m, extraSteps }, 'Комплектовка: чек-лист', workerNote, 'Рабочий');
    }));
    setKittingMotor(null);
  };

  const getTasksByArea = (area: Area) => {
    let motorTasks: Motor[] = [];
    if (area === 'disassembly') {
      motorTasks = motors.filter(m => m.status === 'disassembly');
    } else if (area === 'kis') {
      motorTasks = motors.filter(m => {
        if (!['in_repair', 'ready_for_kitting'].includes(m.status)) return false;
        const kisStep = m.extraSteps?.find(s => s.area === 'kis' && !s.finishedAt);
        if (!kisStep) return false;
        const allNodesDone = !m.nodes || m.nodes.length === 0 || m.nodes.every(n => n.status === 'done');
        return allNodesDone;
      });
    }
    const nodeTasks = motors
      .filter(m => ['in_repair', 'ready_for_kitting', 'kitting', 'assembly'].includes(m.status))
      .flatMap(m => m.nodes.filter(n => n.status !== 'done' && n.route[n.currentIndex]?.area === area).map(n => ({ motor: m, node: n })));
    return { motorTasks, nodeTasks };
  };

  const currentTasks = getTasksByArea(selectedArea);
  const handleAreaClick = (area: Area) => {
    setSelectedArea(area);
    const { motorTasks, nodeTasks } = getTasksByArea(area);
    markAsSeen([...motorTasks.map(m => m.id), ...nodeTasks.map(t => t.node.id)]);
  };

  const renderInfoButton = (motor: Motor) => (
    <button
      onClick={() => setInfoMotor(motor)}
      className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 transition"
      title="Информация о двигателе"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </button>
  );

  const renderMotorCard = (motor: Motor) => {
    const isNew = !seenNodes.includes(motor.id);
    const step = getExtraStep(motor, selectedArea);
    const isDisassembly = selectedArea === 'disassembly';
    return (
      <div key={motor.id} className={`bg-white rounded-xl shadow-sm border-2 p-4 relative ${isNew ? 'border-blue-400' : 'border-slate-200'}`}>
        {isNew && <span className="absolute -top-3 left-4 bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">Новое</span>}
        <div className="flex justify-between items-start mb-3">
          <div>
            <p className="font-bold text-slate-800 mb-1">{motor.model}</p>
            <p className="text-xs text-slate-500">Цех: {motor.customerShop} (Инв: {motor.serialNumber})</p>
          </div>
          <div className="flex gap-1 items-center shrink-0 ml-2">
            {renderInfoButton(motor)}
            <button onClick={() => setNoteModalData({ motor })} className={`text-xl p-1 rounded-lg border transition ${motor.workerNote ? 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>📝</button>
          </div>
        </div>

        {motor.cellNumber && selectedArea !== 'disassembly' && (
          <div className="text-xs text-slate-600 mb-2">📍 Ячейка: <strong>{motor.cellNumber}</strong></div>
        )}

        {isDisassembly ? (
          <div className="mb-2 text-xs bg-amber-50 border border-amber-200 p-2 rounded space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-amber-900"><strong>Вид ремонта:</strong></span>
              <span className="px-2 py-0.5 rounded border font-bold text-slate-800 bg-white border-amber-300">{motor.repairType || '-'}</span>
            </div>
            {step?.task && (
              <div className="text-amber-900"><strong>Задание:</strong> {step.task}</div>
            )}
          </div>
        ) : (
          step?.task && (
            <div className="mb-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 p-2 rounded">
              <strong>Задание:</strong> {step.task}
            </div>
          )
        )}

        {step?.plannerNote && (
          <div className="mb-2 text-xs text-blue-800 bg-blue-50 border border-blue-200 p-2 rounded">
            <strong>Планер:</strong> {step.plannerNote}
          </div>
        )}

        {selectedArea === 'disassembly' && (
          <MotorDisassemblyCard motor={motor} templates={templates} onUpdateMotor={(updated) => setMotors(motors.map(x => x.id === updated.id ? updated : x))} onComplete={(tId, cIds, cell, comment, sels) => handleDisassemblyComplete(motor.id, tId, cIds, cell, comment, sels)} />
        )}

        {selectedArea === 'kis' && (
          <div className="space-y-2">
            {step ? (
              <>
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <span className="text-xs px-2 py-0.5 rounded border bg-pink-100 text-pink-800 border-pink-300">Контрольные испытания</span>
                  <div className="flex gap-2 items-center text-xs">
                    <span className="text-slate-500 font-medium">План: {step.estTime}м</span>
                    <span className="font-bold text-slate-700">Факт: {stepFactTime(step)}</span>
                  </div>
                </div>
                {!step.finishedAt && !step.startedAt && !step.pausedAt && (
                  <button onClick={() => handleExtraStepStart(motor.id, 'kis')} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 rounded">▶ Запустить КИС</button>
                )}
                {step.startedAt && (
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => handleExtraStepPause(motor.id, 'kis')} className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-semibold py-1.5 rounded">⏸ Пауза</button>
                    <button onClick={() => handleExtraStepCancel(motor.id, 'kis')} className="bg-red-100 hover:bg-red-200 text-red-700 text-xs font-semibold py-1.5 px-2 rounded border border-red-200" title="Отмена">⏹</button>
                    <button onClick={() => requestKisComplete(motor)} className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold py-1.5 rounded">✓ Завершить КИС</button>
                  </div>
                )}
                {step.pausedAt && (
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => handleExtraStepResume(motor.id, 'kis')} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-1.5 rounded">▶ Продолжить</button>
                    <button onClick={() => handleExtraStepCancel(motor.id, 'kis')} className="bg-red-100 hover:bg-red-200 text-red-700 text-xs font-semibold py-1.5 px-2 rounded border border-red-200" title="Отмена">⏹</button>
                    <button onClick={() => requestKisComplete(motor)} className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold py-1.5 rounded">✓ Завершить КИС</button>
                  </div>
                )}
                {step.finishedAt && (
                  <p className="text-sm text-green-700 bg-green-50 border border-green-200 p-2 rounded">✓ КИС завершён</p>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-500">КИС не назначен в техкарте</p>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderNodeCard = ({ motor, node }: { motor: Motor; node: MotorNode }) => {
    const isNew = !seenNodes.includes(node.id);
    const currentStep = node.route[node.currentIndex];
    const template = templates.find(t => t.id === motor.selectedTemplateId);
    return (
      <div key={node.id} className={`bg-white rounded-xl shadow-sm border-2 p-4 relative ${isNew ? 'border-blue-400' : 'border-slate-200'}`}>
        {isNew && <span className="absolute -top-3 left-4 bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">Новое</span>}
        <div className="flex justify-between items-start mb-3">
          <div>
            <p className="font-bold text-slate-800 mb-1">{node.name} — {motor.model}</p>
            <p className="text-xs text-slate-500">Цех: {motor.customerShop} (Ячейка: {motor.cellNumber || '-'})</p>
          </div>
          <div className="flex gap-1 items-center shrink-0 ml-2">
            {renderInfoButton(motor)}
            <button onClick={() => setNoteModalData({ motor, node })} className={`text-xl p-1 rounded-lg border transition ${currentStep?.workerNote ? 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>📝</button>
          </div>
        </div>
        {currentStep?.plannerNote && <div className="mb-2 text-xs text-blue-800 bg-blue-50 border border-blue-200 p-2 rounded"><strong>Планировщик:</strong> {currentStep.plannerNote}</div>}
        <NodeCard 
          node={node} 
          template={template}
          onUpdate={(updater, logAction, logDetails) => updateNode(motor.id, node.id, updater, logAction, logDetails)} 
          onFinishWithDefect={(stepIdx, block) => {
            setFinishDefectModal({ motorId: motor.id, nodeId: node.id, stepIdx, block, stepTask: currentStep?.task });
          }}
        />
      </div>
    );
  };

  return (
    <>
      <div className="mb-4 flex gap-2 flex-wrap">
        {areas.map((a) => {
          const t = getTasksByArea(a);
          const total = t.motorTasks.length + t.nodeTasks.length;
          const isActive = selectedArea === a;
          const unseen = [...t.motorTasks.map(m => m.id), ...t.nodeTasks.map(x => x.node.id)].filter(id => !seenNodes.includes(id)).length;
          return (
            <button key={a} onClick={() => handleAreaClick(a)} className={`relative px-3 py-2 rounded-lg text-sm font-medium transition ${isActive ? 'bg-slate-800 text-white' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'}`}>
              {AREA_LABELS[a]} ({total})
              {unseen > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-slate-100 animate-pulse">+{unseen}</span>}
            </button>
          );
        })}
      </div>
      <h2 className="text-lg font-semibold text-slate-800 mb-3">Задачи на участке «{AREA_LABELS[selectedArea]}»</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {currentTasks.motorTasks.map(m => renderMotorCard(m))}
        {currentTasks.nodeTasks.map(t => renderNodeCard(t))}
        {currentTasks.motorTasks.length === 0 && currentTasks.nodeTasks.length === 0 && (
          <p className="text-slate-500 col-span-full">Нет задач на этом участке.</p>
        )}
      </div>
      {noteModalData && <WorkerNotesModal motor={noteModalData.motor} node={noteModalData.node} onClose={() => setNoteModalData(null)} onSave={(text) => {
        if (noteModalData.node) saveNodeWorkerNote(noteModalData.motor.id, noteModalData.node.id, noteModalData.node.currentIndex, text);
        else { setMotors(motors.map(m => m.id === noteModalData.motor.id ? addLog({ ...m, workerNote: text }, 'Примечание рабочего', `Общее: "${text}"`, 'Рабочий') : m)); setNoteModalData(null); }
      }} />}
      {kittingMotor && <KittingChecklistModal motor={kittingMotor} onClose={() => setKittingMotor(null)} onConfirm={handleKittingConfirm} />}
      {finishDefectModal && <StepDefectModal block={finishDefectModal.block} stepTask={finishDefectModal.stepTask} onCancel={() => setFinishDefectModal(null)} onConfirm={(defectIdOrEmpty) => handleFinishStepWithDefect(finishDefectModal.motorId, finishDefectModal.nodeId, finishDefectModal.stepIdx, defectIdOrEmpty)} />}
      {kisDefectModal && (
        <StepDefectModal 
          block={kisDefectModal.block} 
          stepTask={motors.find(m => m.id === kisDefectModal.motorId)?.extraSteps?.find(s => s.area === 'kis' && !s.finishedAt)?.task}
          onCancel={() => setKisDefectModal(null)} 
          onConfirm={confirmKisWithDefect} 
        />
      )}
      {infoMotor && <MotorInfoModal motor={infoMotor} canEdit={false} onClose={() => setInfoMotor(null)} onOpenLogs={() => { setLogsMotorWorker(infoMotor); setInfoMotor(null); }} />}
      {logsMotorWorker && <LogsModal motor={logsMotorWorker} readCount={readLogs[logsMotorWorker.id] || 0} currentUser="Рабочий" onClose={closeWorkerLogs} />}
    </>
  );
}

function WorkerNotesModal({ motor, node, onClose, onSave }: { motor: Motor; node?: MotorNode; onClose: () => void; onSave: (text: string) => void; }) {
  const currentStep = node ? node.route[node.currentIndex] : null;
  const [text, setText] = useState(currentStep?.workerNote || motor.workerNote || '');
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
          <h3 className="text-lg font-bold text-slate-800">Ваше примечание</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
        </div>
        <div className="p-4 overflow-y-auto flex flex-col gap-4">
          <textarea rows={4} value={text} onChange={e => setText(e.target.value)} placeholder="Напишите здесь, если есть вопросы или нужна помощь..." className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>
        <div className="p-4 border-t flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-300 rounded-lg text-slate-700 font-medium">Отмена</button>
          <button onClick={() => onSave(text)} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">Сохранить</button>
        </div>
      </div>
    </div>
  );
}

function MotorDisassemblyCard({ motor, templates, onUpdateMotor, onComplete }: { 
  motor: Motor; templates: DefectTemplate[]; onUpdateMotor: (motor: Motor) => void;
  onComplete: (templateId: string, checkedDefectIds: string[], cell: string, comment: string, selections: Record<string, string>) => void; 
}) {
  const [selectedTplId, setSelectedTplId] = useState(motor.selectedTemplateId || '');
  const [cellNumber, setCellNumber] = useState(motor.cellNumber || '');
  const [showChecklist, setShowChecklist] = useState(false);

  const extraSteps = motor.extraSteps || [];
  const disStep = extraSteps.find(s => s.area === 'disassembly');
  const isStarted = !!disStep?.startedAt;
  const isPaused = !!disStep?.pausedAt;
  const isFinished = !!disStep?.finishedAt;

  const handleStart = () => {
    if (!selectedTplId || !cellNumber) { alert('Укажите ячейку и выберите техкарту!'); return; }
    const now = new Date().toISOString();
    onUpdateMotor({ ...motor, extraSteps: (motor.extraSteps || defaultExtraSteps()).map(s => s.area === 'disassembly' ? { ...s, startedAt: now, pausedAt: undefined } : s), cellNumber });
  };
  const handlePause = () => {
    if (!disStep?.startedAt) return;
    const now = Date.now();
    const addMs = now - new Date(disStep.startedAt).getTime();
    onUpdateMotor({ ...motor, extraSteps: (motor.extraSteps || []).map(s => s.area === 'disassembly' ? { ...s, startedAt: undefined, pausedAt: new Date(now).toISOString(), accumulatedMs: (s.accumulatedMs || 0) + addMs } : s) });
  };
  const handleResume = () => {
    const now = new Date().toISOString();
    onUpdateMotor({ ...motor, extraSteps: (motor.extraSteps || []).map(s => s.area === 'disassembly' ? { ...s, startedAt: now, pausedAt: undefined } : s) });
  };
  const handleCancel = () => {
    if (!confirm('Отменить выполнение разборки? Накопленное время будет сброшено.')) return;
    onUpdateMotor({ ...motor, extraSteps: (motor.extraSteps || []).map(s => s.area === 'disassembly' ? { area: 'disassembly', estTime: s.estTime, task: s.task, plannerNote: s.plannerNote } : s) });
  };

  if (showChecklist) {
    const template = templates.find(t => t.id === selectedTplId);
    if (!template) return null;
    return <DefectChecklistModal motor={motor} template={template} onCancel={() => setShowChecklist(false)} onConfirm={(ids, comment, sels) => { setShowChecklist(false); onComplete(selectedTplId, ids, cellNumber, comment, sels); }} />;
  }

  if (isStarted || isPaused) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 mb-1">
          <span>📍 Ячейка: <strong>{motor.cellNumber || '-'}</strong></span>
          <span>⏱ Время: <strong>{disStep ? stepFactTime(disStep) : '-'}</strong></span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {isStarted && (
            <>
              <button onClick={handlePause} className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-semibold py-1.5 rounded">⏸ Пауза</button>
              <button onClick={handleCancel} className="bg-red-100 hover:bg-red-200 text-red-700 text-xs font-semibold py-1.5 px-2 rounded border border-red-200">⏹</button>
              <button onClick={() => setShowChecklist(true)} className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold py-1.5 rounded">✓ Завершить</button>
            </>
          )}
          {isPaused && (
            <>
              <button onClick={handleResume} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-1.5 rounded">▶ Продолжить</button>
              <button onClick={handleCancel} className="bg-red-100 hover:bg-red-200 text-red-700 text-xs font-semibold py-1.5 px-2 rounded border border-red-200">⏹</button>
              <button onClick={() => setShowChecklist(true)} className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold py-1.5 rounded">✓ Завершить</button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (isFinished) return <p className="text-sm text-green-700 bg-green-50 border border-green-200 p-2 rounded">✓ Разборка завершена</p>;

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-slate-500 mb-1">Номер ячейки</label>
        <input value={cellNumber} onChange={e => setCellNumber(e.target.value)} placeholder="Например: А-12" className="w-full text-sm p-2 border border-slate-300 rounded outline-none" />
      </div>
      <select value={selectedTplId} onChange={e => setSelectedTplId(e.target.value)} className="w-full text-sm p-2 border border-slate-300 rounded outline-none bg-white">
        <option value="">-- Выбрать техкарту --</option>
        {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <button onClick={handleStart} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded transition">▶ Начать разборку</button>
    </div>
  );
}

// ============================================================
// NODE CARD
// ============================================================
function NodeCard({ 
  node, onUpdate, template, onFinishWithDefect 
}: { 
  node: MotorNode; 
  onUpdate: (updater: (n: MotorNode) => MotorNode, logAction?: string, logDetails?: string) => void;
  template?: DefectTemplate;
  onFinishWithDefect?: (stepIdx: number, block: FlowBlock) => void;
}) {
  const currentStep = node.route[node.currentIndex];
  const isDone = node.status === 'done';
  const isInProgress = node.status === 'in_progress';
  const isPaused = !!currentStep?.pausedAt;
  const isActive = !!currentStep?.startedAt;

  const handleStart = () => {
    const newRoute = [...node.route];
    newRoute[node.currentIndex] = { ...newRoute[node.currentIndex], startedAt: new Date().toISOString(), pausedAt: undefined };
    onUpdate((n) => ({ ...n, status: 'in_progress', route: newRoute }), 'Начало операции', `Узел: ${node.name}, Этап: ${AREA_LABELS[currentStep.area]}`);
  };
  const handlePause = () => {
    if (!currentStep.startedAt) return;
    const now = Date.now();
    const addMs = now - new Date(currentStep.startedAt).getTime();
    const newRoute = [...node.route];
    newRoute[node.currentIndex] = { ...currentStep, startedAt: undefined, pausedAt: new Date(now).toISOString(), accumulatedMs: (currentStep.accumulatedMs || 0) + addMs };
    onUpdate((n) => ({ ...n, route: newRoute }), 'Пауза', `Узел: ${node.name}, Этап: ${AREA_LABELS[currentStep.area]}`);
  };
  const handleResume = () => {
    const newRoute = [...node.route];
    newRoute[node.currentIndex] = { ...currentStep, startedAt: new Date().toISOString(), pausedAt: undefined };
    onUpdate((n) => ({ ...n, route: newRoute }), 'Возобновление', `Узел: ${node.name}, Этап: ${AREA_LABELS[currentStep.area]}`);
  };
  const handleStop = () => {
    if (!confirm('Отменить выполнение операции? Накопленное время будет сброшено.')) return;
    const newRoute = [...node.route];
    newRoute[node.currentIndex] = { ...currentStep, startedAt: undefined, pausedAt: undefined, accumulatedMs: 0 };
    onUpdate((n) => ({ ...n, status: 'pending', route: newRoute }), 'Отмена выполнения', `Узел: ${node.name}, Этап: ${AREA_LABELS[currentStep.area]}`);
  };

  const handleFinish = () => {
    if (currentStep?._blockId && template?.flowBlocks) {
      const block = template.flowBlocks.find(b => b.id === currentStep._blockId);
      if (block && blockHasDefects(block) && onFinishWithDefect) {
        onFinishWithDefect(node.currentIndex, block);
        return;
      }
    }
    let accum = currentStep.accumulatedMs || 0;
    if (currentStep.startedAt) accum += Date.now() - new Date(currentStep.startedAt).getTime();
    const newRoute = [...node.route];
    newRoute[node.currentIndex] = { ...currentStep, startedAt: undefined, pausedAt: undefined, accumulatedMs: accum, finishedAt: new Date().toISOString() };
    const isLast = node.currentIndex === node.route.length - 1;
    onUpdate((n) => ({ ...n, status: isLast ? 'done' : 'pending', currentIndex: isLast ? node.currentIndex : node.currentIndex + 1, route: newRoute }), 'Завершение операции', `Узел: ${node.name}, Этап: ${AREA_LABELS[currentStep.area]}`);
  };

  return (
    <div className={`border-2 rounded-lg p-3 ${isDone ? 'border-green-300 bg-green-50/50' : isPaused ? 'border-orange-400 bg-orange-50' : isInProgress ? 'border-blue-400 bg-blue-50 shadow-md' : 'border-slate-200 bg-white'}`}>
      <div className="flex justify-between items-start mb-2">
        <span className="font-semibold text-slate-800 text-sm">{node.name}</span>
        <span className={`w-2 h-2 rounded-full mt-1.5 ${isDone ? 'bg-green-500' : isPaused ? 'bg-orange-500' : isInProgress ? 'bg-blue-500 animate-pulse' : 'bg-slate-300'}`} />
      </div>
      {!isDone && currentStep?.task && (
        <div className="mb-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 p-2 rounded"><strong>Задание:</strong> {currentStep.task}</div>
      )}
      {!isDone && currentStep?.plannerNote && (
        <div className="mb-2 text-xs text-blue-800 bg-blue-50 border border-blue-200 p-2 rounded"><strong>Планер:</strong> {currentStep.plannerNote}</div>
      )}
      {!isDone && currentStep && (
        <div className="mb-3 flex justify-between items-center flex-wrap gap-2">
          <span className={`inline-block text-xs px-2 py-0.5 rounded border ${AREA_COLORS[currentStep.area]}`}>{AREA_LABELS[currentStep.area]}</span>
          <div className="flex gap-2 items-center">
            <span className="text-xs text-slate-500 font-medium">План: {currentStep.estTime}м</span>
            <span className="text-xs font-bold text-slate-700">Факт: {stepFactTime(currentStep)}</span>
          </div>
        </div>
      )}
      {isDone && <div className="mb-2"><span className="inline-block text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-500">✓ Готов</span></div>}
      {!isDone && (
        <div className="flex flex-wrap gap-1.5">
          {node.status === 'pending' && <button onClick={handleStart} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-1.5 rounded">▶ Начать</button>}
          {isActive && (
            <>
              <button onClick={handlePause} className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-semibold py-1.5 rounded">⏸ Пауза</button>
              <button onClick={handleStop} className="bg-red-100 hover:bg-red-200 text-red-700 text-xs font-semibold py-1.5 px-2 rounded border border-red-200">⏹</button>
              <button onClick={handleFinish} className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold py-1.5 rounded">✓ Завершить</button>
            </>
          )}
          {isPaused && (
            <>
              <button onClick={handleResume} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-1.5 rounded">▶ Продолжить</button>
              <button onClick={handleStop} className="bg-red-100 hover:bg-red-200 text-red-700 text-xs font-semibold py-1.5 px-2 rounded border border-red-200">⏹</button>
              <button onClick={handleFinish} className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold py-1.5 rounded">✓ Завершить</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// ЧЕК-ЛИСТ ДЕФЕКТОВКИ (при разборке)
// ============================================================
function DefectChecklistModal({ motor, template, onCancel, onConfirm }: { 
  motor: Motor; template: DefectTemplate; onCancel: () => void; 
  onConfirm: (ids: string[], comment: string, selections: Record<string, string>) => void; 
}) {
  const [checked, setChecked] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  
  const startBlock = template.flowBlocks?.find(b => b.kind === 'start');
  const flowNodes = startBlock?.nodes || [];
  const hasFlowSelections = flowNodes.length > 0;
  
  const [flowSelections, setFlowSelections] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    flowNodes.forEach(n => { init[n.id] = ''; });
    return init;
  });

  const toggle = (id: string) => {
    if (checked.includes(id)) setChecked(checked.filter(i => i !== id));
    else setChecked([...checked, id]);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="p-4 border-b">
          <h3 className="text-lg font-bold text-slate-800 mb-1">Дефектная ведомость</h3>
          <p className="text-sm text-slate-500">Двигатель: <strong>{motor.model}</strong> • Техкарта: <strong>{template.name}</strong></p>
        </div>
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {hasFlowSelections && (
            <div className="space-y-3">
              <div className="text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded-lg p-2">
                Для каждого узла выберите <strong>один</strong> дефект (или «OK»). От этого зависит маршрут.
              </div>
              {flowNodes.map(fNode => {
                const colorDef = NODE_COLORS.find(c => c.value === fNode.color) || NODE_COLORS[0];
                return (
                  <div key={fNode.id} className={`border-2 ${colorDef.border} ${colorDef.bg} rounded-lg p-2`}>
                    <div className="font-semibold text-sm mb-2">{fNode.name}</div>
                    <label className="flex items-center gap-2 p-1.5 rounded cursor-pointer hover:bg-white/60">
                      <input type="radio" name={`flow-${fNode.id}`} checked={(flowSelections[fNode.id] || '') === ''} onChange={() => setFlowSelections({ ...flowSelections, [fNode.id]: '' })} className="w-4 h-4 accent-green-600" />
                      <span className="text-sm">✓ OK (нет дефекта)</span>
                    </label>
                    {fNode.defects.map(defect => (
                      <label key={defect.id} className="flex items-center gap-2 p-1.5 rounded cursor-pointer hover:bg-white/60">
                        <input type="radio" name={`flow-${fNode.id}`} checked={flowSelections[fNode.id] === defect.id} onChange={() => setFlowSelections({ ...flowSelections, [fNode.id]: defect.id })} className="w-4 h-4 accent-red-600" />
                        <span className="text-sm">{defect.label}</span>
                      </label>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {template.nodes && template.nodes.length > 0 && (
            <div className="space-y-2">
              {template.nodes.map(tNode => (
                <div key={tNode.id} className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-100 p-2 font-semibold text-slate-800 text-sm border-b border-slate-200">{tNode.name}</div>
                  <div className="p-2 space-y-1">
                    {tNode.defects.map(defect => (
                      <label key={defect.id} className="flex items-start gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer">
                        <input type="checkbox" checked={checked.includes(defect.id)} onChange={() => toggle(defect.id)} className="w-4 h-4 accent-blue-600 mt-0.5" />
                        <span className="text-sm text-slate-700">{defect.label}</span>
                      </label>
                    ))}
                    {tNode.defects.length === 0 && <p className="text-xs text-slate-400 italic p-2">Нет дефектов</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!hasFlowSelections && (!template.nodes || template.nodes.length === 0) && (
            <p className="text-xs text-slate-400 italic text-center">Техкарта без дефектов</p>
          )}

          <div>
             <label className="block text-sm font-medium text-slate-700 mb-1">Комментарий</label>
             <textarea rows={3} value={comment} onChange={e => setComment(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
        </div>
        <div className="p-4 border-t flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2.5 border border-slate-300 rounded-lg text-slate-700 font-medium">Отмена</button>
          <button onClick={() => onConfirm(checked, comment, flowSelections)} className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium">Завершить разборку</button>
        </div>
      </div>
    </div>
  );
}