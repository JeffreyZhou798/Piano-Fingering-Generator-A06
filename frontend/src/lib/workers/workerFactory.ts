// Worker工厂 - 双层渐进式策略
import { WorkerConfig, WorkerResult } from '@/lib/algorithm/types';

export type WorkerMethod = 'native' | 'inline' | 'fallback';

export interface WorkerFactoryResult {
  worker: Worker | null;
  method: WorkerMethod;
  cleanup?: () => void;
}

/**
 * 创建Worker（双层渐进式策略）
 * 第1层：原生Worker（最优雅）
 * 第2层：内联Worker（最可靠）
 * 第3层：单线程Fallback（保底）
 */
export async function createWorker(): Promise<WorkerFactoryResult> {
  // 第1层：尝试原生Worker
  try {
    console.log('Attempting to create native Worker...');
    const worker = new Worker(
      new URL('../../workers/dynaQ.worker.ts', import.meta.url),
      { type: 'module' }
    );
    
    // 测试Worker是否可用
    await testWorker(worker);
    
    console.log('✅ Native Worker created successfully');
    return { worker, method: 'native' };
  } catch (error) {
    console.warn('Native Worker creation failed:', error);
  }

  // 第2层：尝试内联Worker
  try {
    console.log('Attempting to create inline Worker...');
    const { worker, cleanup } = await createInlineWorker();
    
    // 测试Worker是否可用
    await testWorker(worker);
    
    console.log('✅ Inline Worker created successfully');
    return { worker, method: 'inline', cleanup };
  } catch (error) {
    console.warn('Inline Worker creation failed:', error);
  }

  // 第3层：Fallback到单线程
  console.warn('⚠️ All Worker creation methods failed, using single-threaded fallback');
  return { worker: null, method: 'fallback' };
}

/**
 * 测试Worker是否可用
 */
function testWorker(worker: Worker): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Worker test timeout'));
    }, 1000);

    worker.onmessage = () => {
      clearTimeout(timeout);
      resolve();
    };

    worker.onerror = (error) => {
      clearTimeout(timeout);
      reject(error);
    };

    // 发送测试消息
    worker.postMessage({ type: 'test' });
  });
}

/**
 * 创建内联Worker（使用Blob URL）
 */
async function createInlineWorker(): Promise<{ worker: Worker; cleanup: () => void }> {
  // 动态导入Worker代码
  const { INLINE_WORKER_CODE } = await import('./inlineWorkerCode.generated');
  
  // 创建Blob
  const blob = new Blob([INLINE_WORKER_CODE], { 
    type: 'application/javascript' 
  });
  
  // 创建Blob URL
  const blobUrl = URL.createObjectURL(blob);
  
  // 创建Worker
  const worker = new Worker(blobUrl);
  
  // 返回Worker和清理函数
  return {
    worker,
    cleanup: () => URL.revokeObjectURL(blobUrl)
  };
}

/**
 * 使用Worker进行训练
 */
export function trainWithWorker(
  worker: Worker,
  notes: any[][],
  hand: any,
  part: any,
  config: WorkerConfig
): Promise<Map<string, number>> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Worker training timeout (5 minutes)'));
    }, 5 * 60 * 1000);

    worker.onmessage = (e) => {
      const response = e.data;
      
      if (response.type === 'complete') {
        clearTimeout(timeout);
        
        // 转换Q表回Map
        const qTable = new Map<string, number>(response.qTable);
        
        resolve(qTable);
      } else if (response.type === 'error') {
        clearTimeout(timeout);
        reject(new Error(response.error));
      }
      // progress消息会被忽略（可以在外部处理）
    };

    worker.onerror = (error) => {
      clearTimeout(timeout);
      reject(error);
    };

    // 发送训练任务
    worker.postMessage({
      type: 'train',
      notes,
      hand,
      part,
      config
    });
  });
}
