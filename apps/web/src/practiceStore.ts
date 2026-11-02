import type { Practice, PracticeHistoryResponse } from '@expression/shared';

// 每次操作独立打开连接；事务完成后关闭，不阻塞后续版本升级。
async function withStore<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  if (!globalThis.indexedDB) throw new Error('当前浏览器无法使用本地历史存储。');
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('yanxu', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('practices', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('无法打开本地历史，请检查浏览器是否允许保存站点数据。'));
  });
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction('practices', mode);
      const request = action(transaction.objectStore('practices'));
      // put 成功不代表已落库，必须等待整个事务完成。
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(new Error('本地历史读写失败，请检查浏览器存储权限和剩余空间。'));
    });
  } finally {
    database.close();
  }
}

export async function savePractice(practice: Practice): Promise<void> {
  await withStore('readwrite', (store) => store.put(practice));
}

export async function getPractice(id: string): Promise<Practice> {
  const practice = await withStore<Practice | undefined>('readonly', (store) => store.get(id));
  if (!practice) throw new Error('未找到这次练习，记录可能已被清除。');
  return practice;
}

export async function getPracticeHistory(offset = 0): Promise<PracticeHistoryResponse> {
  const practices = await withStore<Practice[]>('readonly', (store) => store.getAll());
  practices.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id));
  return {
    total: practices.length,
    items: practices.slice(offset, offset + 20).map((practice) => ({
      id: practice.id, topicTitle: practice.topic.title, attemptCount: practice.results.length,
      createdAt: practice.createdAt, updatedAt: practice.updatedAt,
    })),
  };
}
