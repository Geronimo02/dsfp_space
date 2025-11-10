import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { NotificationCenter } from "../NotificationCenter";
import { CompanySelector } from "../CompanySelector";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="container mx-auto px-8 py-4 flex justify-between items-center">
            <CompanySelector />
            <NotificationCenter />
          </div>
        </div>
        <div className="container mx-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
