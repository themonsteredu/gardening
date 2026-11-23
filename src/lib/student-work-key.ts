export function getStudentWorkEditKey(sessionId: string) {
  const key = `gardening.student.work-edit-key.${sessionId}`;
  const saved = window.localStorage.getItem(key);
  if (saved) return saved;
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const editKey = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  window.localStorage.setItem(key, editKey);
  return editKey;
}
