import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { waUrl } from "@/lib/site";

interface WhatsAppCTAProps {
  message?: string;
  label?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export default function WhatsAppCTA({
  message = "Hola, me interesa un vehículo",
  label = "Consultar por WhatsApp",
  className,
  size = "md",
}: WhatsAppCTAProps) {
  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm gap-1.5",
    md: "px-5 py-2.5 text-sm gap-2",
    lg: "px-7 py-3.5 text-base gap-2.5",
  };

  return (
    <a
      href={waUrl(message)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("btn btn-wa", sizeClasses[size], className)}
    >
      <MessageCircle size={size === "sm" ? 14 : size === "lg" ? 20 : 16} />
      <span>{label}</span>
    </a>
  );
}

export function WhatsAppFloat() {
  return (
    <a
      href={waUrl("Hola, me interesa un vehículo")}
      target="_blank"
      rel="noopener noreferrer"
      className="support-chat-launcher"
      aria-label="WhatsApp"
    >
      <MessageCircle size={18} strokeWidth={1.75} />
    </a>
  );
}
