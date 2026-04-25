import { useState } from "react";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export default function Login() {
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("password");
  const { login } = useAuth();
  const loginMutation = useLogin();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await loginMutation.mutateAsync({
        data: { email, password }
      });
      login(result.token);
      toast({
        title: "Welcome back",
        description: `Logged in as ${result.user.name}`,
      });
      setLocation("/");
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message || "Invalid credentials",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex w-full bg-muted/30">
      <div className="flex-1 flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-[400px] space-y-6">
          <div className="flex flex-col items-center text-center space-y-2 mb-8">
            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold text-xl mb-2 shadow-lg">
              Acc
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Accounting Suite</h1>
            <p className="text-muted-foreground text-sm">Enter your credentials to access your account</p>
          </div>

          <div className="bg-card border shadow-sm rounded-xl p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                  placeholder="name@example.com"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <a href="#" className="text-sm text-primary hover:underline font-medium">Forgot password?</a>
                </div>
                <Input 
                  id="password" 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                />
              </div>
              
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox id="remember" />
                <Label htmlFor="remember" className="font-normal text-muted-foreground">Remember me for 30 days</Label>
              </div>

              <Button type="submit" className="w-full mt-4" disabled={loginMutation.isPending}>
                {loginMutation.isPending ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </div>
          
          <p className="text-center text-sm text-muted-foreground">
            By logging in, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
      <div className="hidden lg:block lg:w-1/2 bg-sidebar relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-sidebar" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-sidebar-foreground p-12">
          <h2 className="text-3xl font-bold mb-4">The Professional's Choice</h2>
          <p className="text-sidebar-foreground/70 text-center max-w-md text-lg">
            Fast, dense, and precise. A complete business accounting solution designed for Indian SMBs.
          </p>
        </div>
      </div>
    </div>
  );
}
