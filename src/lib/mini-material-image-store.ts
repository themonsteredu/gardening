import "client-only";

const DATABASE_NAME = "gardening-mini-materials";
const DATABASE_VERSION = 1;
const STORE_NAME = "material-images";

interface StoredMiniMaterialImage {
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
    request.onerror = () => reject(request.error ?? new Error("재료 사진 저장소를 열지 못했습니다."));
  });
}

export async function saveMiniMaterialImage(id: string, blob: Blob): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put({ id, blob } satisfies StoredMiniMaterialImage);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("재료 사진을 저장하지 못했습니다."));
  });
  database.close();
}

export async function getMiniMaterialImage(id: string): Promise<Blob | null> {
  const database = await openDatabase();
  const result = await new Promise<StoredMiniMaterialImage | undefined>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result as StoredMiniMaterialImage | undefined);
    request.onerror = () => reject(request.error ?? new Error("재료 사진을 불러오지 못했습니다."));
  });
  database.close();
  return result?.blob ?? null;
}

export async function deleteMiniMaterialImage(id: string): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("재료 사진을 삭제하지 못했습니다."));
  });
  database.close();
}
