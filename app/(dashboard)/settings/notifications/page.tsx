import { PageHeader } from "@/components/page-header";
import { TelegramSettings } from "@/components/notifications/telegram-settings";
import { getTelegramConfiguration } from "@/lib/env.server";

export default function NotificationsPage() {
  const configuration = getTelegramConfiguration();
  const botConfigured = configuration.configured || configuration.botConfigured;
  const chatConfigured = configuration.configured || configuration.chatConfigured;
  return <><PageHeader title="Notificaciones" description="Configura y verifica la entrega privada de alertas." /><TelegramSettings botConfigured={botConfigured} chatConfigured={chatConfigured} /></>;
}
