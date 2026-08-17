import "client-only";

const DATABASE_NAME = "gardening-final-photos";
const DATABASE_VERSION = 1;
const STORE_NAME = "final-photos";

interface StoredMiniFinalPhoto {
  id: string;
  blob: Blob;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("완성작 사진 저장소를 열지 못했습니다."));
  });
}

export async function saveMiniFinalPhoto(id: string, blob: Blob): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put({ id, blob } satisfies StoredMiniFinalPhoto);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("완성작 사진을 저장하지 못했습니다."));
  });
  database.close();
}

export async function getMiniFinalPhoto(id: string): Promise<Blob | null> {
  const database = await openDatabase();
  const result = await new Promise<StoredMiniFinalPhoto | undefined>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result as StoredMiniFinalPhoto | undefined);
    request.onerror = () => reject(request.error ?? new Error("완성작 사진을 불러오지 못했습니다."));
  });
  database.close();
  return result?.blob ?? null;
}

export async function deleteMiniFinalPhoto(id: string): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("완성작 사진을 삭제하지 못했습니다."));
  });
  database.close();
}
