import { AuthStage } from "@/features/auth/auth-stage";
import { Peg } from "@/features/auth/peg";

/**
 * Auth layout (design system §10): one centred 400 px column that fits the
 * screen without page scroll, and Peg hanging from the bar at the top. The column scrolls on its own only when zoom or a
 * very small viewport leaves no other choice.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex h-dvh flex-col items-center overflow-y-auto px-4 py-6 short:py-4">
      <AuthStage className="relative isolate my-auto flex w-full max-w-[400px] flex-col items-center gap-5 sm:gap-6 short:gap-4">
        {children}
        <Peg />
      </AuthStage>
    </main>
  );
}
