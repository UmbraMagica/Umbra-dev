import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Crown, LogIn, Eye, EyeOff } from "lucide-react";

export default function Landing() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoginPending, loginError } = useAuth();
  const { toast } = useToast();
  
  console.log("Landing component rendered");
  console.log("Login function:", typeof login);
  console.log("isLoginPending:", isLoginPending);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("=== FRONTEND LOGIN HANDLER ===");
    console.log("Username:", username);
    console.log("Password:", password ? "***" : "empty");
    
    if (!username || !password) {
      console.log("Missing credentials, showing toast");
      toast({
        title: "Chyba",
        description: "Vyplňte všechna pole",
        variant: "destructive",
      });
      return;
    }

    console.log("Calling login function...");
    try {
      const result = await login({ username, password });
      console.log("Login result:", result);
      // PODROBNÝ DEBUG LOG
      console.log("localStorage keys:", Object.keys(localStorage));
      console.log("localStorage['jwt_token']:", localStorage.getItem('jwt_token'));
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        console.log(`localStorage[${key}]:`, localStorage.getItem(key));
      }
      toast({
        title: "Úspěch",
        description: "Přihlášení bylo úspěšné",
      });
    } catch (error: any) {
      console.log("Login error:", error);
      let errorMessage = "Neplatné přihlašovací údaje";
      
      if (error.status === 401) {
        errorMessage = "Nesprávné uživatelské jméno nebo heslo";
      } else if (error.status === 500) {
        errorMessage = "Chyba serveru, zkuste to později";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Přihlášení selhalo",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center rpg-gradient-bg relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 rpg-bg-pattern opacity-30"></div>
      
      <Card className="max-w-md w-full mx-4 rpg-card">
        <CardContent className="pt-6">
          <div className="text-center mb-8">
            <div className="mx-auto h-16 w-16 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center mb-4">
              <Crown className="h-8 w-8 text-primary-foreground" />
            </div>
            <h2 className="text-3xl fantasy-font font-bold text-accent tracking-wide">Umbra Magica</h2>
            <p className="mt-2 text-sm text-muted-foreground">Vstupte do světa nekonečných příběhů</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <Label htmlFor="username" className="block text-sm font-medium text-foreground mb-2">
                Uživatelské jméno
              </Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Zadejte uživatelské jméno"
                className="rpg-input"
                required
              />
            </div>
            
            <div className="relative">
              <Label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
                Heslo
              </Label>
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Zadejte heslo"
                className="rpg-input pr-10"
                required
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-8 transform -translate-y-1/2 text-muted-foreground hover:text-accent focus:outline-none"
                aria-label={showPassword ? "Skrýt heslo" : "Zobrazit heslo"}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            <Button
              type="submit"
              disabled={isLoginPending}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <LogIn className="mr-2 h-4 w-4" />
              {isLoginPending ? "Přihlašování..." : "Přihlásit se"}
            </Button>
          </form>

          <div className="text-center mt-6 space-y-2">
            <Link href="/registration">
              <Button variant="link" className="text-accent hover:text-secondary transition-colors duration-200">
                Nemáte účet? Zaregistrujte se
              </Button>
            </Link>
            
            <div className="text-sm text-muted-foreground">
              Zapomněli jste přihlašovací údaje? Kontaktujte administrátora.
            </div>
          </div>


        </CardContent>
      </Card>
    </div>
  );
}
