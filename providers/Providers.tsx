"use client";

import { PrivyProvider } from "@privy-io/react-auth";

/**
 * Client providers. Privy backs the (optional) contributor dashboard login;
 * the public chat needs no provider and no account.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!appId) return <>{children}</>;

  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: { theme: "dark", accentColor: "#00ff88" },
        loginMethods: ["wallet", "email"],
      }}
    >
      {children}
    </PrivyProvider>
  );
}
