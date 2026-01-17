import { Suspense } from "react";

import { AuthSignInClient } from "@/app/auth/signin/signin-client";

export default function AuthSignInPage() {
  return (
    <Suspense>
      <AuthSignInClient />
    </Suspense>
  );
}
