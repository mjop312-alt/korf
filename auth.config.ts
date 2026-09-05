// Edge-veilige Auth.js-config: geen Prisma, geen adapter. Gebruikt door de
// middleware (draait op de Edge runtime). De volledige config staat in auth.ts.

import type { NextAuthConfig } from "next-auth";

const PROTECTED_PREFIXES = ["/dashboard", "/lijsten", "/instellingen"];

export const authConfig = {
  pages: { signIn: "/inloggen" },
  providers: [], // credentials-provider wordt in auth.ts toegevoegd
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isProtected = PROTECTED_PREFIXES.some((p) => nextUrl.pathname.startsWith(p));
      return isProtected ? isLoggedIn : true;
    },
    jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.id && session.user) session.user.id = token.id as string;
      return session;
    },
  },
} satisfies NextAuthConfig;
