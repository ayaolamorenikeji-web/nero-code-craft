import { useAuth } from "@/contexts/AuthContext";
import { LoginPage } from "@/components/nero/LoginPage";
import { NeroLayout } from "@/components/nero/NeroLayout";

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-6 h-6 border-2 border-muted-foreground border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return <NeroLayout />;
};

export default Index;
