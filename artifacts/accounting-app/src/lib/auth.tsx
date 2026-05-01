import { createContext, useContext, useState, ReactNode } from "react";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react";
import { useLocation } from "wouter";

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  login: (token: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [hasToken, setHasToken] = useState<boolean>(() => !!localStorage.getItem("auth_token"));
  const [, setLocation] = useLocation();

  const { data: user, isLoading: isUserLoading, refetch } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      enabled: hasToken,
      retry: false,
      staleTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    },
  });

  const login = (newToken: string) => {
    localStorage.setItem("auth_token", newToken);
    setHasToken(true);
    setTimeout(() => refetch(), 0);
  };

  const logout = () => {
    localStorage.removeItem("auth_token");
    setHasToken(false);
    setLocation("/login");
  };

  const isLoading = isUserLoading && hasToken;

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isLoading,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
