import { redirect } from "next/navigation";

// O Quadro virou uma visualização de Tarefas (padrão).
export default function BoardRedirect() {
  redirect("/tasks");
}
