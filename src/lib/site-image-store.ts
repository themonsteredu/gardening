import "client-only";

const DATABASE_NAME = "gardening-career-lab";
const DATABASE_VERSION = 1;
const STORE_NAME = "site-image-files";

interface StoredSiteImageFile {
  id: string;
  blob: Blob;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("브라우저 저장소를 열지 못했습니다."));
  });
}

export async function saveSiteImageFile(id: string, blob: Blob): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put({ id, blob } satisfies StoredSiteImageFile);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("파일을 저장하지 못했습니다."));
  });
  database.close();
}

export async function getSiteImageFile(id: string): Promise<Blob | null> {
  const database = await openDatabase();
  const result = await new Promise<StoredSiteImageFile | undefined>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result as StoredSiteImageFile | undefined);
    request.onerror = () => reject(request.error ?? new Error("파일을 불러오지 못했습니다."));
  });
  database.close();
  return result?.blob ?? null;
}

export async function deleteSiteImageFile(id: string): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("이전 파일을 정리하지 못했습니다."));
  });
  database.close();
}
