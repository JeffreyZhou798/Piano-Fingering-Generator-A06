// Auto-generated file - DO NOT EDIT
// Generated from: src/workers/dynaQ.worker.ts and dependencies
// Build time: 2026-01-22T12:36:59.062Z

export const INLINE_WORKER_CODE = `
// ============================================
// Auto-generated inline Worker code
// DO NOT EDIT - Generated from multiple source files
// Build time: 2026-01-22T12:36:59.061Z
// ============================================

// Types
// 类型定义 - 对应Julia代码的数据结构

// 枚举类型
export enum Hand {
  LeftHand = -1,
  RightHand = 1
}

export enum Finger {
  F1 = 1,
  F2 = 2,
  F3 = 3,
  F4 = 4,
  F5 = 5
}

export enum Direct {
  Up = 1,
  Down = -1,
  Level = 0
}

export enum FingeringType {
  Nature = 'nature',
  Cross = 'cross',
  Move = 'move'
}

export enum Part {
  FirstPart = 'first_part',
  LastPart = 'last_part',
  MiddlePart = 'middle_part',
  WholePart = 'whole_part'
}

// 音符类型
export interface Note {
  pitch: number;
  velocity: number;
  position: number;
  duration: number;
  channel: number;
}

// 指法条目
export interface FingeringEntry {
  pitch: number;
  finger: Finger;
}

// 指法映射（使用数组，按pitch排序）
export type Fingering = FingeringEntry[];

// 指法对
export interface NoteFingerPair {
  note: Note;
  finger: Finger;
}

// 指法状态
export interface FingeringState {
  index: number;
  fingering: Fingering;
  nextNotes: Note[];
  part?: Part;
}

// 指法结果（用于输出）
export interface FingeringResultEntry {
  pitch: number;
  finger: number;
  position: number;
}

export interface FingeringResult {
  rightHand?: FingeringResultEntry[];
  leftHand?: FingeringResultEntry[];
}

// Q-Learning配置
export interface QLearningSolverConfig {
  nEpisodes: number;
  maxEpisodeLength: number;
  learningRate: number;
  explorationRate: number;
}

// Dyna-Q配置
export interface DynaQConfig {
  nEpisodes: number;
  maxEpisodeLength: number;
  learningRate: number;
  explorationRate: number;
  planningSteps: number;
  randomSeed: number;
}

// 模型条目
export interface ModelEntry {
  nextState: FingeringState;
  reward: number;
}

// Worker配置
export interface WorkerConfig {
  seed: number;
  episodes: number;
  planningSteps: number;
  learningRate: number;
  explorationRate: number;
}

// Worker结果
export interface WorkerResult {
  qTable: [string, number][];
  finalReward: number;
  episodesCompleted: number;
}

// 进度回调
export type ProgressCallback = (progress: number) => void;


// Constants
// 常量和辅助函数 - 翻译自 src/const.jl

// 单指力量（按指号排序）
export const SINGLE_FINGER_STRENGTH = [2, 4, 5, 3, 1];

// 白键MIDI音符号
export const WHITE_KEYS = [
  21, 23, 24, 26, 28, 29, 31, 33, 35, 36, 38, 40, 41, 43, 45, 47, 48, 50, 52, 53, 55, 57, 59, 60, 62,
  64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83, 84, 86, 88, 89, 91, 93, 95, 96, 98, 100, 101, 103, 105, 107, 108
];

// 黑键MIDI音符号
export const BLACK_KEYS = [
  22, 25, 27, 30, 32, 34, 37, 39, 42, 44, 46, 49, 51, 54, 56, 58, 61, 63, 66, 68, 70, 73, 75, 78, 80,
  82, 85, 87, 90, 92, 94, 97, 99, 102, 104, 106
];

// 最大手指距离矩阵
export const MAX_FINGER_DISTANCE = [
  [-1, 4, 5, 6, 7],
  [3, -1, 3, 4, 6],
  [2, -1, -1, 3, 4],
  [1.5, -1, -1, -1, 3],
  [-1, -1, -1, -1, -1]
];

/**
 * 获取音符在键盘上的相对位置
 */
export function relativePosition(note: Note): number {
  if (WHITE_KEYS.includes(note.pitch)) {
    return WHITE_KEYS.indexOf(note.pitch);
  } else {
    return WHITE_KEYS.indexOf(note.pitch + 1) - 0.5;
  }
}

/**
 * 计算两个键之间的距离
 */
export function keyDistance(startNote: Note, endNote: Note): number {
  return Math.abs(relativePosition(endNote) - relativePosition(startNote));
}

/**
 * 获取音符相对于A0的位置
 */
export function notePosition(note: Note): number {
  const a0 = { pitch: 21, velocity: 0, position: 0, duration: 0, channel: 0 };
  return keyDistance(a0, note) + 1;
}

/**
 * 计算和弦音域范围
 */
export function chordRange(notes: Note[]): number {
  if (notes.length === 0) return 0;
  
  const maxPitch = Math.max(...notes.map(n => n.pitch));
  const minPitch = Math.min(...notes.map(n => n.pitch));
  
  const maxNote = notes.find(n => n.pitch === maxPitch)!;
  const minNote = notes.find(n => n.pitch === minPitch)!;
  
  return keyDistance(maxNote, minNote) + 1;
}

/**
 * 自然手指距离
 */
export function natureDistance(finger1: Finger, finger2: Finger): number {
  return Math.abs(finger1 - finger2);
}

/**
 * 检查两个手指在键盘上是否过于狭窄
 */
export function narrowFingerCheck(
  p1: { note: Note; finger: Finger },
  p2: { note: Note; finger: Finger }
): boolean {
  return Math.ceil(keyDistance(p1.note, p2.note)) < Math.abs(p1.finger - p2.finger);
}

/**
 * 计算手部移动距离
 */
export function handMoveDistance(
  hand: Hand,
  f1: Fingering,
  f2: Fingering
): number {
  if (f1.length === 0 || f2.length === 0) return 0;

  const handPositionS = (pitch: number, finger: Finger): number => {
    const note: Note = { pitch, velocity: 64, position: 0, duration: 0, channel: 0 };
    return notePosition(note) + hand * (3 - finger);
  };

  const handPosition = (fingering: Fingering): number => {
    const first = fingering[0];
    const last = fingering[fingering.length - 1];
    return (handPositionS(first.pitch, first.finger) + handPositionS(last.pitch, last.finger)) / 2;
  };

  return Math.abs(handPosition(f1) - handPosition(f2));
}

/**
 * 检查下一个音符是否与当前指法相同
 */
export function isSameNotes(fingering: Fingering, notes: Note[]): boolean {
  const sortedNotes = [...notes].sort((a, b) => a.pitch - b.pitch);
  const fingeringPitches = fingering.map(f => f.pitch).sort((a, b) => a - b);
  
  if (sortedNotes.length !== fingeringPitches.length) return false;
  
  return sortedNotes.every((note, i) => note.pitch === fingeringPitches[i]);
}

/**
 * 构建指法映射
 */
export function buildFingering(
  hand: Hand,
  notes: Note[],
  fingers: Finger[]
): Fingering {
  if (notes.length !== fingers.length) {
    throw new Error('Notes and fingers count mismatch');
  }

  const sortedNotes = [...notes].sort((a, b) => a.pitch - b.pitch);
  const sortedFingers = hand === Hand.RightHand 
    ? [...fingers].sort((a, b) => a - b)
    : [...fingers].sort((a, b) => b - a);

  const fingering: Fingering = [];
  sortedNotes.forEach((note, i) => {
    fingering.push({ pitch: note.pitch, finger: sortedFingers[i] });
  });

  return fingering;
}

/**
 * 生成所有可能的指法组合
 */
function* combinations<T>(arr: T[], k: number): Generator<T[]> {
  if (k === 1) {
    for (const item of arr) {
      yield [item];
    }
    return;
  }

  for (let i = 0; i <= arr.length - k; i++) {
    for (const combo of combinations(arr.slice(i + 1), k - 1)) {
      yield [arr[i], ...combo];
    }
  }
}

/**
 * 为音符分配初始指法
 */
export function assignFingering(hand: Hand, notes: Note[]): Fingering[] {
  const notesNum = notes.length;
  
  if (notesNum === 0) {
    throw new Error('Wrong notes number: 0');
  }
  
  // 如果音符数量超过5，只取最高或最低的5个音符
  if (notesNum > 5) {
    console.warn(\`Chord has \${notesNum} notes, truncating to 5\`);
    const sortedNotes = [...notes].sort((a, b) => a.pitch - b.pitch);
    const selectedNotes = hand === Hand.RightHand 
      ? sortedNotes.slice(-5) // 右手取最高的5个
      : sortedNotes.slice(0, 5); // 左手取最低的5个
    return assignFingering(hand, selectedNotes);
  }

  const sortedNotes = [...notes].sort((a, b) => a.pitch - b.pitch);
  const result: Fingering[] = [];
  
  const allFingers = [Finger.F1, Finger.F2, Finger.F3, Finger.F4, Finger.F5];
  const fingerCombinations = Array.from(combinations(allFingers, notesNum));

  if (notesNum === 1) {
    return fingerCombinations.map(fingers => buildFingering(hand, sortedNotes, fingers));
  }

  for (const fingering of fingerCombinations) {
    let physicalPossible = true;

    // 检查物理可能性
    const fingerPairs = Array.from(combinations(fingering, 2));
    const notePairs = Array.from(combinations(sortedNotes, 2));

    for (let i = 0; i < fingerPairs.length; i++) {
      const [f1, f2] = fingerPairs[i];
      const [n1, n2] = notePairs[i];
      const keyDis = keyDistance(n1, n2);
      
      const [fi, fo] = hand === Hand.RightHand 
        ? [f1 - 1, f2 - 1]
        : [f2 - 1, f1 - 1];

      if (keyDis > MAX_FINGER_DISTANCE[fi][fo]) {
        physicalPossible = false;
        break;
      }
    }

    if (!physicalPossible) continue;

    // 检查手指是否过于狭窄
    let fingerCheck = true;
    const builtFingering = buildFingering(hand, sortedNotes, fingering);
    
    for (let i = 0; i < builtFingering.length - 1; i++) {
      const entry1 = builtFingering[i];
      const entry2 = builtFingering[i + 1];
      const note1 = sortedNotes.find(n => n.pitch === entry1.pitch)!;
      const note2 = sortedNotes.find(n => n.pitch === entry2.pitch)!;
      
      if (narrowFingerCheck(
        { note: note1, finger: entry1.finger },
        { note: note2, finger: entry2.finger }
      )) {
        fingerCheck = false;
        break;
      }
    }

    if (fingerCheck) {
      result.push(builtFingering);
    }
  }

  // 如果没有找到任何合适的指法，返回一个简单的默认指法
  if (result.length === 0) {
    console.warn(\`No valid fingering found for \${notesNum} notes, using simple default\`);
    // 简单地按顺序分配手指：1, 2, 3, 4, 5
    const defaultFingers = Array.from({ length: notesNum }, (_, i) => 
      (i + 1) as Finger
    );
    result.push(buildFingering(hand, sortedNotes, defaultFingers));
  }

  return result;
}

/**
 * 检查1对1指法是否需要手部移动
 */
export function is1to1NoMove(
  hand: Hand,
  startFingering: Fingering,
  nextNote: Note
): boolean {
  if (startFingering.length !== 1) {
    throw new Error('Wrong fingering number, fingering must have only 1 note');
  }

  const entry = startFingering[0];
  const startNote: Note = { pitch: entry.pitch, velocity: 64, position: 0, duration: 0, channel: 0 };
  const startFinger = entry.finger;
  const startNotePosition = relativePosition(startNote);
  const nextNotePosition = relativePosition(nextNote);

  let innerDistance = 0;
  let outerDistance = 0;

  if (startFinger === Finger.F1) {
    innerDistance = MAX_FINGER_DISTANCE[1][0];
    outerDistance = MAX_FINGER_DISTANCE[0][4];
  } else if (startFinger === Finger.F5) {
    innerDistance = MAX_FINGER_DISTANCE[0][4];
    outerDistance = 0;
  } else {
    innerDistance = MAX_FINGER_DISTANCE[0][startFinger - 1];
    outerDistance = MAX_FINGER_DISTANCE[startFinger - 1][4];
  }

  const [leftDistance, rightDistance] = hand === Hand.RightHand
    ? [innerDistance, outerDistance]
    : [outerDistance, innerDistance];

  const leftBound = startNotePosition - leftDistance;
  const rightBound = startNotePosition + rightDistance;

  return nextNotePosition >= leftBound && nextNotePosition <= rightBound;
}

/**
 * 计算拉伸率
 */
export function stretchRate(
  hand: Hand,
  nfp1: { note: Note; finger: Finger },
  nfp2: { note: Note; finger: Finger }
): number {
  let [p1, p2] = [nfp1, nfp2];
  
  if ((p1.note.pitch > p2.note.pitch && hand === Hand.RightHand) ||
      (p1.note.pitch < p2.note.pitch && hand === Hand.LeftHand)) {
    [p1, p2] = [p2, p1];
  }

  const natureDis = natureDistance(p1.finger, p2.finger);
  const fingerDis = keyDistance(p1.note, p2.note);
  const maxDis = MAX_FINGER_DISTANCE[p1.finger - 1][p2.finger - 1];

  const rate = fingerDis > natureDis
    ? (fingerDis - natureDis) / (maxDis - natureDis)
    : -(natureDis - fingerDis) / natureDis;

  return Math.round(rate * 100) / 100;
}

/**
 * 计算所有手指的平均拉伸率
 */
export function allStretchRate(hand: Hand, fingering: Fingering): number {
  const entries = fingering;
  const pairs = Array.from(combinations(entries, 2));
  
  if (pairs.length === 0) return 0;

  const sum = pairs.reduce((acc, [e1, e2]) => {
    const note1: Note = { pitch: e1.pitch, velocity: 64, position: 0, duration: 0, channel: 0 };
    const note2: Note = { pitch: e2.pitch, velocity: 64, position: 0, duration: 0, channel: 0 };
    const rate = Math.abs(stretchRate(
      hand,
      { note: note1, finger: e1.finger },
      { note: note2, finger: e2.finger }
    ));
    return acc + Math.pow(rate, 1.5);
  }, 0);

  return Math.round((sum / pairs.length) * 100) / 100;
}


// MDP
// MDP定义 - 翻译自 src/mdp.jl

  Note,
  Hand,
  Finger,
  Fingering,
  FingeringState,
  Part
} from './types';

  SINGLE_FINGER_STRENGTH,
  keyDistance,
  chordRange,
  handMoveDistance,
  allStretchRate,
  stretchRate,
  assignFingering,
  buildFingering,
  isSameNotes
} from './const';

/**
 * 奖励函数 - 核心算法
 */
export function rewardFunction(
  hand: Hand,
  s: FingeringState,
  a: Fingering
): number {
  const fingeringSp = a;
  const fingeringS = s.fingering;
  const numS = fingeringS.length;
  const numSp = fingeringSp.length;

  const notesSp = fingeringSp.map(f => ({ pitch: f.pitch, velocity: 64, position: 0, duration: 0, channel: 0 } as Note));
  const notesS = fingeringS.map(f => ({ pitch: f.pitch, velocity: 64, position: 0, duration: 0, channel: 0 } as Note));

  const notesSduration = numS !== 0 ? notesS[0].duration : 0;

  // 手指力量奖励
  const fingerReward = fingeringSp
    .reduce((sum, f) => sum + SINGLE_FINGER_STRENGTH[f.finger - 1], 0);

  let reward = 0;

  // 初始指法奖励
  if (s.index === 0 || notesSduration >= 15120) {
    reward = numSp === 1 ? 50 : 50 * (1 - allStretchRate(hand, fingeringSp));
  }
  // 前一个指法与下一个指法相同
  else if (fingeringsEqual(fingeringS, fingeringSp)) {
    reward = 50;
  }
  // 1音到1音
  else if (numS === 1 && numSp === 1) {
    const possibleFingerings = get1to1Fingering(hand, fingeringS, notesSp[0]);
    
    if (possibleFingerings.some(f => fingeringsEqual(f, fingeringSp))) {
      const nfpS = { note: notesS[0], finger: fingeringS[0].finger };
      const nfpSp = { note: notesSp[0], finger: fingeringSp[0].finger };

      if (is1to1Cross(hand, nfpS, nfpSp)) {
        const cd = crossDistance(nfpS, nfpSp);
        reward = 20 + 2.5 * (4 - cd);
      } else {
        const sr = stretchRate(hand, nfpS, nfpSp);

        if (sr === 0 || (
          Math.ceil(keyDistance(notesS[0], notesSp[0])) === 1 &&
          Math.abs(fingeringS[0].finger - fingeringSp[0].finger) === 1
        )) {
          return 50;
        } else if (sr > 0) {
          const absSr = Math.abs(sr);
          reward = 40 + 10 * (1 - Math.pow(absSr, 2));
        }
      }
    } else {
      reward = 20 - handMoveDistance(hand, fingeringS, fingeringSp) / 2;
    }
  }
  // N音到N音
  else {
    const rangeS = chordRange(notesS);
    const rangeSp = chordRange(notesSp);
    const revNum = noteFingerReverseOrderNum(hand, fingeringS, fingeringSp);

    let sameFingerNum = 0;
    let sameNoteNum = 0;

    if (revNum === 0) {
      sameFingerNum = sameFingerButDifferentNoteNum(fingeringS, fingeringSp);
      sameNoteNum = sameNoteButDifferentFingerNum(fingeringS, fingeringSp);
    }

    let discount = 1;
    if (!(rangeS >= 6 && rangeSp >= 6)) {
      discount = 1 - (sameFingerNum + sameNoteNum + revNum) / (numS + numSp);
    }

    // 1到N, N到N
    if (numSp > 1) {
      const moveDis = handMoveDistance(hand, fingeringS, fingeringSp);
      const strRate = allStretchRate(hand, fingeringSp);

      if (rangeS >= 6 && rangeSp >= 6) {
        reward = 49 * (1 - strRate) + 1;
      } else if (moveDis > 5) {
        reward = (20 * (1 - strRate) + (45 - moveDis) / 4.5) * discount;
      } else {
        reward = (25 * (6 * (1 - Math.pow(strRate, 2.2)) + 4 * (5 - moveDis)) / 13) * discount;
      }
    }
    // N到1
    else {
      const moveDis = handMoveDistance(hand, fingeringS, fingeringSp);
      const cr = chordRangeBetween(fingeringS, fingeringSp);

      if (cr >= 7) {
        discount = 1;
      }

      reward = (50 - 1.2 * moveDis) * discount;

      if (moveDis >= 20) {
        return reward + 0.01 * fingerReward * 500;
      }
    }
  }

  return reward + 0.01 * fingerReward;
}

/**
 * 动作空间函数
 */
export function actionSpace(
  hand: Hand,
  s: FingeringState,
  allNotes: Note[][]
): Fingering[] {
  if (s.index >= allNotes.length) {
    return [];
  }

  const notesSp = allNotes[s.index];
  const fingeringS = s.fingering;
  const numS = fingeringS.length;
  const numSp = notesSp.length;

  const notesS = fingeringS.map(f => ({ pitch: f.pitch, velocity: 64, position: 0, duration: 0, channel: 0 } as Note));
  const notesSduration = numS !== 0 ? notesS[0].duration : 0;

  // 第一个音符
  if (s.index === 0) {
    if (s.part === Part.FirstPart || s.part === Part.WholePart || notesSduration >= 15120) {
      return assignFingering(hand, notesSp);
    } else {
      // 只有单音时才使用F5，和弦时使用assignFingering
      if (numSp === 1) {
        return [buildFingering(hand, notesSp, [Finger.F5])];
      } else {
        return assignFingering(hand, notesSp);
      }
    }
  }
  // 最后一个音符
  else if (s.index === allNotes.length - 1 && 
           (s.part === Part.FirstPart || s.part === Part.MiddlePart)) {
    // 只有单音时才使用F5，和弦时使用assignFingering
    if (numSp === 1) {
      return [buildFingering(hand, notesSp, [Finger.F5])];
    } else {
      return assignFingering(hand, notesSp);
    }
  }
  // 1对1
  else if (numS === 1 && numSp === 1) {
    const actions = get1to1Fingering(hand, fingeringS, notesSp[0]);
    if (actions.length !== 0) {
      return actions;
    } else {
      return assignFingering(hand, notesSp);
    }
  }
  // 其他情况
  else {
    return assignFingering(hand, notesSp);
  }
}

// 辅助函数

function fingeringsEqual(f1: Fingering, f2: Fingering): boolean {
  if (f1.length !== f2.length) return false;
  
  for (let i = 0; i < f1.length; i++) {
    if (f1[i].pitch !== f2[i].pitch || f1[i].finger !== f2[i].finger) {
      return false;
    }
  }
  
  return true;
}

function sameFingerButDifferentNoteNum(
  preFingering: Fingering,
  nextFingering: Fingering
): number {
  const preFingers = preFingering.map(f => f.finger);
  const nextFingers = nextFingering.map(f => f.finger);
  const sameFingers = preFingers.filter(f => nextFingers.includes(f));

  let num = 0;
  for (const finger of sameFingers) {
    const preEntry = preFingering.find(f => f.finger === finger);
    const nextEntry = nextFingering.find(f => f.finger === finger);
    
    if (preEntry && nextEntry && preEntry.pitch !== nextEntry.pitch) {
      num++;
    }
  }

  return num;
}

function sameNoteButDifferentFingerNum(
  preFingering: Fingering,
  nextFingering: Fingering
): number {
  let num = 0;

  for (const entry of preFingering) {
    const nextEntry = nextFingering.find(f => f.pitch === entry.pitch);
    
    if (nextEntry && nextEntry.finger !== entry.finger) {
      num++;
    }
  }

  return num;
}

function noteFingerReverseOrderNum(
  hand: Hand,
  preFingering: Fingering,
  nextFingering: Fingering
): number {
  const mergeFingering = [...preFingering, ...nextFingering];
  mergeFingering.sort((a, b) => a.pitch - b.pitch);

  let num = 0;
  for (let i = 0; i < mergeFingering.length - 1; i++) {
    const f1 = mergeFingering[i].finger;
    const f2 = mergeFingering[i + 1].finger;

    if ((hand === Hand.RightHand && f1 > f2) || (hand === Hand.LeftHand && f2 > f1)) {
      num++;
    }
  }

  return num;
}

function chordRangeBetween(
  f1: Fingering,
  f2: Fingering
): number {
  const allPitches = [...f1.map(f => f.pitch), ...f2.map(f => f.pitch)];
  const allNotes = allPitches.map(pitch => ({ pitch, velocity: 64, position: 0, duration: 0, channel: 0 } as Note));
  allNotes.sort((a, b) => a.pitch - b.pitch);
  return chordRange(allNotes);
}


// Dyna-Q Solver
// Dyna-Q求解器 - 完整实现模型学习 + Q-Learning


/**
 * Dyna-Q求解器
 * 核心算法：Q-Learning + 模型学习
 * 
 * Dyna-Q = 真实交互 + 模拟学习
 * 每次真实交互后，从模型中随机采样进行多次模拟学习
 */
export class DynaQSolver {
  private nEpisodes: number;
  private maxEpisodeLength: number;
  private learningRate: number;
  private explorationRate: number;
  private planningSteps: number;
  private theta: number; // 优先级阈值
  private randomSeed: number;
  private qTable: Map<string, number>;
  private model: Map<string, ModelEntry>;
  private predict: Map<string, Set<string>>; // 前驱状态字典: state -> Set of (s,a) keys that lead to it
  private priorityQueue: Array<{key: string, priority: number}>; // 优先级队列
  private initialStates: Set<string>; // 初始状态集合
  private rng: () => number;

  constructor(config: DynaQConfig) {
    this.nEpisodes = config.nEpisodes;
    this.maxEpisodeLength = config.maxEpisodeLength;
    this.learningRate = config.learningRate;
    this.explorationRate = config.explorationRate;
    this.planningSteps = config.planningSteps;
    this.theta = 3.0; // 默认阈值，与原Julia实现一致
    this.randomSeed = config.randomSeed;
    this.qTable = new Map();
    this.model = new Map();
    this.predict = new Map(); // 新增：前驱状态追踪
    this.priorityQueue = []; // 新增：优先级队列
    this.initialStates = new Set(); // 新增：初始状态集合
    
    // 使用种子初始化随机数生成器
    this.rng = this.seededRandom(this.randomSeed);
  }

  /**
   * 种子随机数生成器
   */
  private seededRandom(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
  }

  /**
   * 求解MDP问题
   */
  solve(
    hand: Hand,
    allNotes: Note[][],
    part: Part,
    onProgress?: (episode: number, totalEpisodes: number) => void
  ): Fingering[] {
    // 初始化Q表、模型和优先级队列
    this.qTable.clear();
    this.model.clear();
    this.predict.clear();
    this.priorityQueue = [];
    this.initialStates.clear();

    let oldAvg = 0;

    // Episode循环
    for (let episode = 1; episode <= this.nEpisodes; episode++) {
      this.runEpisode(hand, allNotes, part);

      // 定期评估（每300轮，与原Julia实现一致）
      if (episode % 300 === 0) {
        const nEvalTraj = Math.min(20, allNotes.length);
        const newAvg = this.evaluate(hand, allNotes, part, nEvalTraj);
        
        if (onProgress) {
          onProgress(episode, this.nEpisodes);
        }

        console.log(\`On Iteration \${episode}, Returns: \${newAvg}\`);

        // 收敛检查（精度到0.1，与原Julia实现一致）
        if (Math.round(oldAvg * 10) === Math.round(newAvg * 10)) {
          console.log(\`Converged at episode \${episode}\`);
          break;
        }
        oldAvg = newAvg;
      }
    }

    // 返回最优策略
    return this.extractPolicy(hand, allNotes, part);
  }

  /**
   * 运行一个Episode（完整实现优先级回放）
   */
  private runEpisode(hand: Hand, allNotes: Note[][], part: Part): void {
    // 初始状态
    let state: FingeringState = {
      index: 0,
      fingering: [],
      nextNotes: allNotes[0],
      part
    };

    // 记录初始状态
    const initialStateKey = this.stateKey(state);
    if (!this.initialStates.has(initialStateKey)) {
      this.initialStates.add(initialStateKey);
    }

    let step = 0;

    // Step循环
    while (state.index < allNotes.length && step < this.maxEpisodeLength) {
      // 获取可用动作
      const actions = actionSpace(hand, state, allNotes);
      if (actions.length === 0) break;

      // 1. 选择动作（ε-greedy策略）
      const action = this.selectAction(hand, state, actions);

      // 2. 执行动作，获取奖励
      const reward = rewardFunction(hand, state, action);

      // 3. 下一个状态
      const nextState: FingeringState = {
        index: state.index + 1,
        fingering: action,
        nextNotes: state.index + 1 < allNotes.length ? allNotes[state.index + 1] : [],
        part
      };

      // 4. 更新predict字典（记录前驱状态）
      const nextStateKey = this.stateKey(nextState);
      const stateActionKey = this.stateActionKey(state, action);
      
      if (!this.predict.has(nextStateKey)) {
        this.predict.set(nextStateKey, new Set());
      }
      this.predict.get(nextStateKey)!.add(stateActionKey);

      // 5. 记录到模型
      this.model.set(stateActionKey, {
        nextState: nextState,
        reward: reward
      });

      // 6. 计算所有可用动作的Q值
      const nextActions = actionSpace(hand, nextState, allNotes);
      const actionValues = nextActions.map(a => this.getQValue(nextState, a));
      const maxSpPrediction = actionValues.length > 0 ? Math.max(...actionValues) : 0;

      // 7. 获取当前Q值
      const currentSPrediction = this.getQValue(state, action);

      // 8. 计算TD误差
      const tdError = reward + 0.99 * maxSpPrediction - currentSPrediction;

      // 9. 计算优先级
      const prioritize = Math.abs(tdError);

      // 10. 加入优先级队列（与原Julia实现一致，不检查theta阈值）
      this.enqueue(stateActionKey, prioritize);

      // 11. 优先级回放（Dyna-Q核心）
      while (this.priorityQueue.length > 0) {
        // 取出优先级最高的状态-动作对
        const {key: tempSAKey, priority: tempPriority} = this.dequeue()!;
        
        // 获取模型中的经验
        const modelEntry = this.model.get(tempSAKey);
        if (!modelEntry) continue;

        const {state: tempS, action: tempA} = this.parseStateActionKey(tempSAKey);
        const {nextState: tempSp, reward: tempR} = modelEntry;

        // 计算tempSp的最大Q值
        const tempNextActions = actionSpace(hand, tempSp, allNotes);
        const tempActionValues = tempNextActions.map(a => this.getQValue(tempSp, a));
        const tempMaxSpPrediction = tempActionValues.length > 0 ? Math.max(...tempActionValues) : 0;

        // 更新Q值
        const oldQ = this.getQValue(tempS, tempA);
        const newQ = oldQ + this.learningRate * (tempR + 0.99 * tempMaxSpPrediction - oldQ);
        this.setQValue(tempS, tempA, newQ);

        // 如果tempS不是初始状态，更新其前驱状态的优先级
        const tempSKey = this.stateKey(tempS);
        if (!this.initialStates.has(tempSKey)) {
          const predecessors = this.predict.get(tempSKey);
          if (predecessors) {
            for (const preSAKey of predecessors) {
              const preModelEntry = this.model.get(preSAKey);
              if (!preModelEntry) continue;

              const {action: preA} = this.parseStateActionKey(preSAKey);
              const {reward: preR} = preModelEntry;

              // 计算tempS的最大Q值
              const tempSActions = actionSpace(hand, tempS, allNotes);
              const tempSActionValues = tempSActions.map(a => this.getQValue(tempS, a));
              const tempMaxSPrediction = tempSActionValues.length > 0 ? Math.max(...tempSActionValues) : 0;

              // 计算前驱状态的TD误差
              const preQ = this.qTable.get(preSAKey) || 0;
              const preTdError = preR + 0.99 * tempMaxSPrediction - preQ;
              const prePrioritize = Math.abs(preTdError);

              // 如果优先级超过阈值，加入队列
              if (prePrioritize > this.theta) {
                this.enqueue(preSAKey, prePrioritize);
              }
            }
          }
        }
      }

      // 转移到下一个状态
      state = nextState;
      step++;
    }
  }

  /**
   * 优先级队列操作：入队
   */
  private enqueue(key: string, priority: number): void {
    // 检查是否已存在，如果存在则更新优先级
    const existingIndex = this.priorityQueue.findIndex(item => item.key === key);
    if (existingIndex !== -1) {
      this.priorityQueue[existingIndex].priority = priority;
    } else {
      this.priorityQueue.push({key, priority});
    }
    
    // 按优先级降序排序（优先级高的在前）
    this.priorityQueue.sort((a, b) => b.priority - a.priority);
  }

  /**
   * 优先级队列操作：出队
   */
  private dequeue(): {key: string, priority: number} | undefined {
    return this.priorityQueue.shift();
  }

  /**
   * 生成状态键（用于predict字典）
   */
  private stateKey(state: FingeringState): string {
    return \`\${state.index}_\${this.fingeringToString(state.fingering)}\`;
  }

  /**
   * 选择动作（ε-greedy策略）
   */
  private selectAction(
    hand: Hand,
    state: FingeringState,
    actions: Fingering[]
  ): Fingering {
    // ε-greedy探索
    if (this.rng() < this.explorationRate) {
      // 随机选择
      const randomIndex = Math.floor(this.rng() * actions.length);
      return actions[randomIndex];
    } else {
      // 选择Q值最大的动作
      let bestAction = actions[0];
      let bestValue = this.getQValue(state, bestAction);

      for (const action of actions) {
        const value = this.getQValue(state, action);
        if (value > bestValue) {
          bestValue = value;
          bestAction = action;
        }
      }

      return bestAction;
    }
  }

  /**
   * 更新Q值
   */
  private updateQValue(
    hand: Hand,
    state: FingeringState,
    action: Fingering,
    reward: number,
    nextState: FingeringState,
    allNotes: Note[][]
  ): void {
    const currentQ = this.getQValue(state, action);

    // 计算下一个状态的最大Q值
    let maxNextQ = 0;
    if (nextState.index < allNotes.length) {
      const nextActions = actionSpace(hand, nextState, allNotes);
      if (nextActions.length > 0) {
        maxNextQ = Math.max(...nextActions.map(a => this.getQValue(nextState, a)));
      }
    }

    // Q-Learning更新公式
    const newQ = currentQ + this.learningRate * (reward + 0.99 * maxNextQ - currentQ);

    this.setQValue(state, action, newQ);
  }

  /**
   * 获取Q值
   */
  private getQValue(state: FingeringState, action: Fingering): number {
    const key = this.stateActionKey(state, action);
    return this.qTable.get(key) || 0;
  }

  /**
   * 设置Q值
   */
  private setQValue(state: FingeringState, action: Fingering, value: number): void {
    const key = this.stateActionKey(state, action);
    this.qTable.set(key, value);
  }

  /**
   * 生成状态-动作键
   */
  private stateActionKey(state: FingeringState, action: Fingering): string {
    const stateStr = \`\${state.index}_\${this.fingeringToString(state.fingering)}\`;
    const actionStr = this.fingeringToString(action);
    return \`\${stateStr}|\${actionStr}\`;
  }

  /**
   * 解析状态-动作键
   */
  private parseStateActionKey(key: string): { state: FingeringState; action: Fingering } {
    const [stateStr, actionStr] = key.split('|');
    const [indexStr, fingeringStr] = stateStr.split('_');
    
    const index = parseInt(indexStr);
    const fingering = this.stringToFingering(fingeringStr);
    const action = this.stringToFingering(actionStr);

    const state: FingeringState = {
      index: index,
      fingering: fingering,
      nextNotes: [],
      part: Part.WholePart
    };

    return { state, action };
  }

  /**
   * 指法转字符串
   */
  private fingeringToString(fingering: Fingering): string {
    if (!fingering || fingering.length === 0) return '';
    return fingering.map(entry => \`\${entry.pitch}:\${entry.finger}\`).join(',');
  }

  /**
   * 字符串转指法
   */
  private stringToFingering(str: string): Fingering {
    if (!str) return [];
    return str.split(',').map(entry => {
      const [pitch, finger] = entry.split(':');
      return {
        pitch: parseInt(pitch),
        finger: parseInt(finger) as Finger
      };
    });
  }

  /**
   * 评估策略
   */
  private evaluate(hand: Hand, allNotes: Note[][], part: Part, nTrajectories: number): number {
    let totalReward = 0;

    for (let i = 0; i < nTrajectories; i++) {
      let state: FingeringState = {
        index: 0,
        fingering: [],
        nextNotes: allNotes[0],
        part
      };

      let trajectoryReward = 0;

      while (state.index < allNotes.length) {
        const actions = actionSpace(hand, state, allNotes);
        if (actions.length === 0) break;

        // 选择最优动作（不探索）
        let bestAction = actions[0];
        let bestValue = this.getQValue(state, bestAction);

        for (const action of actions) {
          const value = this.getQValue(state, action);
          if (value > bestValue) {
            bestValue = value;
            bestAction = action;
          }
        }

        const reward = rewardFunction(hand, state, bestAction);
        trajectoryReward += reward;

        state = {
          index: state.index + 1,
          fingering: bestAction,
          nextNotes: state.index + 1 < allNotes.length ? allNotes[state.index + 1] : [],
          part
        };
      }

      totalReward += trajectoryReward;
    }

    return totalReward / nTrajectories;
  }

  /**
   * 提取最优策略
   */
  private extractPolicy(hand: Hand, allNotes: Note[][], part: Part): Fingering[] {
    const policy: Fingering[] = [];

    let state: FingeringState = {
      index: 0,
      fingering: [],
      nextNotes: allNotes[0],
      part
    };

    while (state.index < allNotes.length) {
      const actions = actionSpace(hand, state, allNotes);
      
      let bestAction: Fingering;
      
      if (actions.length === 0) {
        // 如果没有可用动作，使用默认指法
        const notes = allNotes[state.index];
        bestAction = notes.map((note, i) => ({
          pitch: note.pitch,
          finger: Math.min(i + 1, 5) as Finger
        }));
      } else {
        // 选择Q值最大的动作
        bestAction = actions[0];
        let bestValue = this.getQValue(state, bestAction);

        for (const action of actions) {
          const value = this.getQValue(state, action);
          if (value > bestValue) {
            bestValue = value;
            bestAction = action;
          }
        }
      }

      policy.push(bestAction);

      state = {
        index: state.index + 1,
        fingering: bestAction,
        nextNotes: state.index + 1 < allNotes.length ? allNotes[state.index + 1] : [],
        part
      };
    }

    return policy;
  }

  /**
   * 获取Q表（用于并行训练合并）
   */
  getQTable(): Map<string, number> {
    return new Map(this.qTable);
  }

  /**
   * 获取最终奖励（用于评估）
   */
  getFinalReward(): number {
    return this.evaluate(Hand.RightHand, [], Part.WholePart, 1);
  }
}


// Worker Logic
// Dyna-Q Worker - 并行训练


// Worker消息类型
interface WorkerMessage {
  type: 'train' | 'test';
  notes?: Note[][];
  hand?: Hand;
  part?: Part;
  config?: WorkerConfig;
}

interface WorkerResponse {
  type: 'complete' | 'error' | 'progress';
  qTable?: [string, number][];
  finalReward?: number;
  episodesCompleted?: number;
  error?: string;
  progress?: number;
}

// 监听主线程消息
self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  // 处理测试消息
  if (e.data.type === 'test') {
    self.postMessage({ type: 'test-ok' });
    return;
  }

  const { notes, hand, part, config } = e.data;

  // 类型检查
  if (!notes || !hand || !part || !config) {
    self.postMessage({
      type: 'error',
      error: 'Missing required parameters'
    });
    return;
  }

  try {
    // 创建Dyna-Q求解器
    const solver = new DynaQSolver({
      nEpisodes: config.episodes,
      maxEpisodeLength: 100,
      learningRate: config.learningRate,
      explorationRate: config.explorationRate,
      planningSteps: config.planningSteps,
      randomSeed: config.seed
    });

    // 训练
    const policy = solver.solve(hand, notes, part, (episode, total) => {
      // 发送进度更新
      const progress = (episode / total) * 100;
      const response: WorkerResponse = {
        type: 'progress',
        progress
      };
      self.postMessage(response);
    });

    // 获取Q表
    const qTable = solver.getQTable();
    const qTableArray: [string, number][] = Array.from(qTable.entries());

    // 返回结果
    const response: WorkerResponse = {
      type: 'complete',
      qTable: qTableArray,
      finalReward: 0, // 可以添加评估逻辑
      episodesCompleted: config.episodes
    };

    self.postMessage(response);

  } catch (error) {
    // 返回错误
    const response: WorkerResponse = {
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    self.postMessage(response);
  }
};

// 导出空对象以满足TypeScript模块要求
export {};

`;
