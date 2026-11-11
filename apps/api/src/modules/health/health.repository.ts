import { db } from "../../db/transaction.js";

export async function checkDatabase(timeoutMs: number): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;

  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });

  const query = db.$queryRaw`SELECT 1`.then(
    () => true,
    () => false,
  );

  try {
    return await Promise.race([query, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
