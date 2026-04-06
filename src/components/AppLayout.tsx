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
  profile_picture_url: string | null;
}

const AppLayout = () => {
  const navigate = useNavigate();
  const [dealer, setDealer] = useState<DealerInfo | null>(null);

  useEffect(() => {
    let dealerId: string | null = null;

    const fetchDealer = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const { data } = await supabase
        .from("dealers")
        .select("id, dealership_name, subscription_tier, wallet_balance, profile_picture_url")
        .eq("user_id", session.user.id)
        .single();

      if (data) {
        dealerId = data.id;
        setDealer(data);
      }
    };

    fetchDealer();

    const channel = supabase
      .channel("dealer-balance")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "dealers" },
        (payload) => {
          if (payload.new && payload.new.id === dealerId) {
            setDealer((prev) =>
              prev
                ? {
                    ...prev,
                    wallet_balance: payload.new.wallet_balance,
                    subscription_tier: payload.new.subscription_tier,
                    dealership_name: payload.new.dealership_name,
                    profile_picture_url: payload.new.profile_picture_url,
                  }
                : prev
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full starfield">
        <AppSidebar
          walletBalance={dealer?.wallet_balance ?? 0}
          onLogout={handleLogout}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <TopNavbar
            dealerName={dealer?.dealership_name}
            tier={dealer?.subscription_tier}
            walletBalance={dealer?.wallet_balance ?? 0}
            onLogout={handleLogout}
            profilePictureUrl={dealer?.profile_picture_url}
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
