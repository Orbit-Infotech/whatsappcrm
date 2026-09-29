import { cn } from "@/lib/utils";

interface FooterProps {
  className?: string;
}

export function Footer({ className }: FooterProps) {
  return (
    <footer className={cn("text-center text-xs text-muted-foreground", className)}>
      Developed by{" "}
      <a
        href="https://orbitinfotech.com"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-foreground underline underline-offset-4 transition-colors hover:text-primary"
      >
        Orbit Infotech
      </a>
    </footer>
  );
}
