import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user?: DefaultSession["user"] & {
      id: string;
      role?: "USER" | "ADMIN";
    };
  }

  interface User {
    id: string;
    role?: "USER" | "ADMIN";
  }
}
