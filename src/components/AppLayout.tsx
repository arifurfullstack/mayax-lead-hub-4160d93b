import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import TopNavbar from "@/components/TopNavbar";
import { supabase } from "@/integrations/supabase/client";

interface DealerInfo {
  dealership_name: string;
  subscription_tier: string;
  wallet_balance: number;
}

const AppLayout = () => {
  const navigate = useNavigate();
  const [dealer, setDealer] = useState<DealerInfo | null>(null);

  useEffect(() => {
    const fetchDealer = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const { data } = await supabase
        .from("dealers")
        .select("dealership_name, subscription_tier, wallet_balance")
        .eq("user_id", session.user.id)
        .single();

      if (data) setDealer(data);
    };
    fetchDealer();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar
          walletBalance={dealer?.wallet_balance ?? 0}
          onLogout={handleLogout}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <TopNavbar
            dealerName={dealer?.dealership_name}
            tier={dealer?.subscription_tier}
            walletBalance={dealer?.wallet_balance ?? 0}
          />
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AppLayout;
