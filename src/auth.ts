import { PrismaAdapter } from "@auth/prisma-adapter";
import { Prisma } from "@prisma/client";
import { type NextAuthOptions, getServerSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Email from "next-auth/providers/email";
import Google from "next-auth/providers/google";
import { sendMagicLinkEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

function assertEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is missing. Please set it in your environment.`);
  }
  return value;
}

export const authOptions: NextAuthOptions = {
  adapter: {
    ...PrismaAdapter(prisma),
    async deleteSession(sessionToken) {
      try {
        return await prisma.session.delete({
          where: { sessionToken },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2025"
        ) {
          return null;
        }
        throw error;
      }
    },
  },
  session: {
    strategy: "database",
  },
  pages: {
    error: "/auth/error",
    signIn: "/auth/signin",
  },
  providers: [
    Google({
      clientId: assertEnv("GOOGLE_CLIENT_ID"),
      clientSecret: assertEnv("GOOGLE_CLIENT_SECRET"),
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          prompt: "select_account",
        },
      },
    }),
    Email({
      from:
        process.env.AUTH_FROM_EMAIL ??
        process.env.INVITE_FROM_EMAIL ??
        "noreply@watchd.app",
      maxAge: 10 * 60,
      async sendVerificationRequest({ identifier, url }) {
        await sendMagicLinkEmail({ to: identifier, url });
      },
    }),
    ...(process.env.E2E_AUTH === "1"
      ? [
          Credentials({
            name: "E2E",
            credentials: {
              email: { label: "Email", type: "email" },
            },
            async authorize(credentials) {
              const email = credentials?.email?.toLowerCase();
              if (!email) return null;
              const user = await prisma.user.upsert({
                where: { email },
                update: {},
                create: {
                  email,
                  name: "E2E User",
                },
              });
              return { id: user.id, email: user.email, name: user.name };
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "credentials" && process.env.E2E_AUTH === "1") {
        return true;
      }
      // Admins bypass allowlist.
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { email: true, role: true },
      });

      if (dbUser?.role === "ADMIN") {
        return true;
      }

      const email = (
        dbUser?.email ??
        user.email ??
        profile?.email
      )?.toLowerCase();
      if (!email) {
        return false;
      }

      const allowed = await prisma.groupAllowlist.findUnique({
        where: { email },
        select: { id: true },
      });

      return Boolean(allowed);
    },
    session: async ({ session, user }) => {
      if (session.user) {
        session.user.id = user.id;
        // @ts-expect-error custom role from Prisma
        session.user.role = (user as { role?: string }).role ?? "USER";
      }
      return session;
    },
  },
};

export function auth() {
  return getServerSession(authOptions);
}
