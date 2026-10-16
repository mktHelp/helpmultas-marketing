import { redirect } from "next/navigation";

// O Calendário virou uma visualização de Tarefas.
export default function CalendarRedirect() {
  redirect("/tasks?view=calendar");
}
