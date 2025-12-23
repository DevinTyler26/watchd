import { signIn, signOut } from "@/auth";

type AuthButtonProps = {
  isAuthenticated: boolean;
};

export function AuthButton({ isAuthenticated }: AuthButtonProps) {
  async function handleAction() {
    "use server";

    if (isAuthenticated) {
      await signOut();
      return;
    }

    await signIn("google");
  }

  return (
    <form action={handleAction}>
      <button
        type="submit"
        className="rounded-full bg-white/10 px-5 py-2 text-sm font-medium uppercase tracking-wide text-mist transition hover:bg-white/20"
      >
        {isAuthenticated ? "Sign out" : "Sign in with Google"}
      </button>
    </form>
  );
}
