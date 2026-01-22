// 主处理逻辑 - 翻译自 src/process.jl
import { Note, Hand, Finger, Fingering, Part, FingeringResult, FingeringResultEntry, ProgressCallback, WorkerConfig, WorkerResult } from './types';
import { QLearningSolver } from './qlearning';
import { DynaQSolver } from './dynaQ';
import { actionSpace } from './mdp';

/**
 * 检测设备并返回Worker数量
 */
function getWorkerCount(): number {
  // 检测是否为移动设备
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  // 获取CPU核心数
  const cores = navigator.hardwareConcurrency || 4;
  
  // 移动设备统一使用单线程
  if (isMobile) return 1;
  
  // 根据核心数决定Worker数量
  if (cores >= 8) return 4;  // 高端PC
  if (cores >= 4) return 2;  // 中端PC
  return 1;  // 低端PC
}

/**
 * 创建Worker配置
 */
function createWorkerConfigs(workerCount: number): WorkerConfig[] {
  const episodesPerWorker = Math.floor(10000 / workerCount); // 总共10000轮
  
  return Array.from({ length: workerCount }, (_, i) => ({
    seed: Date.now() + i * 1000,
    episodes: episodesPerWorker,
    planningSteps: 10,
    learningRate: 0.99,
    explorationRate: 0.8
  }));
}

/**
 * 合并Q表（简单平均）
 */
function mergeQTables(qTables: Map<string, number>[]): Map<string, number> {
  const merged = new Map<string, number>();
  const allKeys = new Set<string>();
  
  // 收集所有键
  for (const qTable of qTables) {
    for (const key of qTable.keys()) {
      allKeys.add(key);
    }
  }
  
  // 对每个键计算平均值
  for (const key of allKeys) {
    const values = qTables.map(q => q.get(key) || 0);
    const avg = values.reduce((a, b) => a + b) / values.length;
    merged.set(key, avg);
  }
  
  return merged;
}

/**
 * 从合并的Q表中提取策略
 */
function extractPolicyFromQTable(
  qTable: Map<string, number>,
  hand: Hand,
  allNotes: Note[][],
  part: Part
): Fingering[] {
  const policy: Fingering[] = [];

  let state = {
    index: 0,
    fingering: [] as Fingering,
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
      let bestValue = getQValue(qTable, state, bestAction);

      for (const action of actions) {
        const value = getQValue(qTable, state, action);
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
 * 获取Q值
 */
function getQValue(qTable: Map<string, number>, state: any, action: Fingering): number {
  const key = stateActionKey(state, action);
  return qTable.get(key) || 0;
}

/**
 * 生成状态-动作键
 */
function stateActionKey(state: any, action: Fingering): string {
  const stateStr = `${state.index}_${fingeringToString(state.fingering)}`;
  const actionStr = fingeringToString(action);
  return `${stateStr}|${actionStr}`;
}

/**
 * 指法转字符串
 */
function fingeringToString(fingering: Fingering): string {
  return fingering.map(entry => `${entry.pitch}:${entry.finger}`).join(',');
}

/**
 * 并行训练（使用Web Workers - 双层渐进式策略）
 */
async function parallelTrain(
  notes: Note[][],
  hand: Hand,
  part: Part,
  progressCallback?: ProgressCallback
): Promise<Fingering[]> {
  // 检测Worker数量
  const workerCount = getWorkerCount();
  console.log(`Detected ${workerCount} worker(s) for parallel training`);

  // 如果只有1个Worker，直接使用单线程
  if (workerCount === 1) {
    console.log('Using single-threaded mode (1 worker)');
    const solver = new DynaQSolver({
      nEpisodes: 10000,
      maxEpisodeLength: 100,
      learningRate: 0.99,
      explorationRate: 0.8,
      planningSteps: 10,
      randomSeed: Date.now()
    });

    return solver.solve(hand, notes, part, (episode, total) => {
      if (progressCallback) {
        progressCallback((episode / total) * 100);
      }
    });
  }

  // 尝试创建Worker（双层策略）
  const { createWorker, trainWithWorker } = await import('@/lib/workers/workerFactory');
  const { worker, method, cleanup } = await createWorker();

  console.log(`Worker creation method: ${method}`);

  // 如果Worker创建失败，使用单线程fallback
  if (method === 'fallback' || !worker) {
    console.warn('Using single-threaded fallback');
    const solver = new DynaQSolver({
      nEpisodes: 10000,
      maxEpisodeLength: 100,
      learningRate: 0.99,
      explorationRate: 0.8,
      planningSteps: 10,
      randomSeed: Date.now()
    });

    return solver.solve(hand, notes, part, (episode, total) => {
      if (progressCallback) {
        progressCallback((episode / total) * 100);
      }
    });
  }

  // 使用多Worker并行训练
  console.log(`Using ${workerCount} ${method} worker(s) for parallel training`);
  const workerConfigs = createWorkerConfigs(workerCount);
  
  try {
    // 创建多个Worker实例
    const workers: Worker[] = [];
    const cleanups: (() => void)[] = [];
    
    for (let i = 0; i < workerCount; i++) {
      if (i === 0) {
        // 使用已创建的第一个Worker
        workers.push(worker);
        if (cleanup) cleanups.push(cleanup);
      } else {
        // 创建额外的Worker
        const result = await createWorker();
        if (result.worker) {
          workers.push(result.worker);
          if (result.cleanup) cleanups.push(result.cleanup);
        }
      }
    }

    console.log(`Created ${workers.length} worker instances`);

    // 并行训练
    const workerPromises = workers.map((w, index) => {
      return trainWithWorker(w, notes, hand, part, workerConfigs[index]).then(qTable => {
        // 处理进度回调
        if (progressCallback) {
          const overallProgress = ((index + 1) / workerCount) * 100;
          progressCallback(overallProgress);
        }
        return qTable;
      });
    });

    // 等待所有Workers完成
    const qTables = await Promise.all(workerPromises);

    // 清理Workers
    workers.forEach(w => w.terminate());
    cleanups.forEach(c => c());

    // 合并Q表
    console.log(`Merging ${qTables.length} Q-tables...`);
    const mergedQTable = mergeQTables(qTables);

    // 提取策略
    return extractPolicyFromQTable(mergedQTable, hand, notes, part);
    
  } catch (error) {
    console.error('Worker training failed, falling back to single-threaded:', error);
    
    // 清理
    if (worker) worker.terminate();
    if (cleanup) cleanup();
    
    // Fallback到单线程
    const solver = new DynaQSolver({
      nEpisodes: 10000,
      maxEpisodeLength: 100,
      learningRate: 0.99,
      explorationRate: 0.8,
      planningSteps: 10,
      randomSeed: Date.now()
    });

    return solver.solve(hand, notes, part, (episode, total) => {
      if (progressCallback) {
        progressCallback((episode / total) * 100);
      }
    });
  }
}

/**
 * 分段范围计算
 */
function splitedRange(notes: Note[][], hand: Hand): number[][] {
  const ranges: number[][] = [];
  let start = 0;
  const maxSegmentSize = 50; // 每段最多50个音符组

  while (start < notes.length) {
    const end = Math.min(start + maxSegmentSize, notes.length);
    ranges.push([start, end]);
    start = end;
  }

  return ranges;
}

/**
 * 带进度追踪的分段处理
 */
function runSplitWithProgress(
  notes: Note[][],
  hand: Hand,
  readRange: number[][],
  totalSegments: number,
  completedSegments: { value: number },
  progressCallback?: ProgressCallback
): Promise<Fingering[]> {
  return new Promise(async (resolve, reject) => {
    try {
      const resultFingering: Fingering[] = new Array(notes.length);

      for (let index = 0; index < readRange.length; index++) {
        const [start, end] = readRange[index];
        const rangeLen = readRange.length;

        // 确定部分类型
        let part: Part;
        if (rangeLen === 1) {
          part = Part.WholePart;
        } else if (index === 0) {
          part = Part.FirstPart;
        } else if (index === rangeLen - 1) {
          part = Part.LastPart;
        } else {
          part = Part.MiddlePart;
        }

        // 使用并行训练
        const segmentNotes = notes.slice(start, end);
        const policy = await parallelTrain(segmentNotes, hand, part, (segmentProgress) => {
          // 计算总体进度
          const baseProgress = (completedSegments.value / totalSegments) * 100;
          const segmentWeight = (1 / totalSegments) * 100;
          const totalProgress = baseProgress + (segmentProgress / 100) * segmentWeight;
          
          if (progressCallback) {
            progressCallback(totalProgress);
          }
        });

        // 保存结果
        for (let i = 0; i < policy.length; i++) {
          resultFingering[start + i] = policy[i];
        }

        console.log(`Completed: part ${index + 1}/${rangeLen}, length ${segmentNotes.length}`);

        // 更新进度
        completedSegments.value += 1;
        const progressPct = (completedSegments.value / totalSegments) * 100;

        if (progressCallback) {
          try {
            progressCallback(progressPct);
          } catch (e) {
            console.warn('Progress callback failed:', e);
          }
        }
      }

      console.log('runSplitWithProgress result:', {
        isArray: Array.isArray(resultFingering),
        length: resultFingering.length,
        firstItem: resultFingering[0],
        lastItem: resultFingering[resultFingering.length - 1]
      });

      resolve(resultFingering);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 主指法生成函数
 */
export async function generateFingering(
  notesRh: Note[][],
  notesLh: Note[][],
  progressCallback?: ProgressCallback
): Promise<FingeringResult> {
  console.log('generateFingering called with:', {
    rhLength: notesRh.length,
    lhLength: notesLh.length
  });

  // 处理空手的情况
  if (notesRh.length === 0 && notesLh.length === 0) {
    console.warn('Both hands are empty!');
    return { rightHand: [], leftHand: [] };
  }

  // 计算总分段数
  const readRangeRh = notesRh.length > 0 ? splitedRange(notesRh, Hand.RightHand) : [];
  const readRangeLh = notesLh.length > 0 ? splitedRange(notesLh, Hand.LeftHand) : [];
  const totalSegments = readRangeRh.length + readRangeLh.length;
  const completedSegments = { value: 0 };

  let rhResult: Fingering[] = [];
  let lhResult: Fingering[] = [];

  if (notesRh.length > 0) {
    console.log('Right hand processing started...');
    rhResult = await runSplitWithProgress(
      notesRh,
      Hand.RightHand,
      readRangeRh,
      totalSegments,
      completedSegments,
      progressCallback
    );
  } else {
    console.log('Right hand is empty, skipping...');
  }

  if (notesLh.length > 0) {
    console.log('Left hand processing started...');
    lhResult = await runSplitWithProgress(
      notesLh,
      Hand.LeftHand,
      readRangeLh,
      totalSegments,
      completedSegments,
      progressCallback
    );
  } else {
    console.log('Left hand is empty, skipping...');
  }

  // 转换为输出格式
  const result = {
    rightHand: rhResult.length > 0 ? convertToFingeringEntries(rhResult) : [],
    leftHand: lhResult.length > 0 ? convertToFingeringEntries(lhResult) : []
  };

  console.log('generateFingering result:', {
    rhCount: result.rightHand.length,
    lhCount: result.leftHand.length
  });

  return result;
}

/**
 * 转换为指法条目格式
 */
function convertToFingeringEntries(
  fingerings: Fingering[]
): FingeringResultEntry[] {
  console.log('convertToFingeringEntries called with:', {
    isArray: Array.isArray(fingerings),
    length: fingerings?.length,
    type: typeof fingerings
  });

  if (!Array.isArray(fingerings)) {
    console.error('fingerings is not an array!', fingerings);
    throw new Error(`fingerings must be an array, got ${typeof fingerings}`);
  }

  const entries: FingeringResultEntry[] = [];
  let globalPosition = 0;

  for (let i = 0; i < fingerings.length; i++) {
    const fingering = fingerings[i];
    
    console.log(`Processing fingering ${i}:`, {
      isArray: Array.isArray(fingering),
      length: fingering?.length,
      type: typeof fingering,
      content: fingering
    });

    // 防御性检查：确保fingering是数组
    if (!Array.isArray(fingering)) {
      console.error(`Invalid fingering at index ${i} (not an array):`, fingering);
      continue;
    }

    // 按pitch排序，确保顺序正确
    const sortedFingering = [...fingering].sort((a, b) => a.pitch - b.pitch);

    for (let j = 0; j < sortedFingering.length; j++) {
      const entry = sortedFingering[j];
      
      // 防御性检查：确保entry有必需的属性
      if (!entry || typeof entry.pitch !== 'number' || typeof entry.finger !== 'number') {
        console.error(`Invalid fingering entry at [${i}][${j}]:`, entry);
        continue;
      }

      entries.push({
        pitch: entry.pitch,
        finger: entry.finger,
        position: globalPosition
      });
      globalPosition++;
    }
  }

  console.log('convertToFingeringEntries result:', {
    entriesCount: entries.length,
    firstFew: entries.slice(0, 5),
    lastFew: entries.slice(-5)
  });

  return entries;
}
