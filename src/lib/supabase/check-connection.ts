import { createClient } from "@/lib/supabase/server";

export type DatabaseConnection = {
  ok: boolean;
  message: string;
};

export async function checkDatabaseConnection(): Promise<DatabaseConnection> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("work_orders").select("id").limit(1);

    if (error) {
      const text = error.message.toLowerCase();
      const keyProblem =
        text.includes("api key") ||
        text.includes("jwt") ||
        text.includes("invalid") ||
        error.code === "PGRST301";

      if (keyProblem) {
        return {
          ok: false,
          message: "Ключ API отклонён. Проверьте publishable key в .env.local",
        };
      }
    }

    return {
      ok: true,
      message: "Связь с Supabase установлена. Таблицы доступны.",
    };
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : "Неизвестная ошибка подключения";
    return { ok: false, message };
  }
}
