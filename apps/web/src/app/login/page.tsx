import Link from "next/link";

export default function Login() {
  return (
    <div className="items-center justify-center content-center">
      <div className="bg-purple-400 min-h-screen flex items-center justify-center flex-col gap-4 p-6 w-full max-w-sm rounded-xl border">
        <h1 className="text-cyan-300 text-2xl">Login Page</h1>
        <label htmlFor="email">Email</label>
        <input type="email" id="email" autoComplete="email" name="email" />
        <label htmlFor="password">Password</label>
        <input
          type="password"
          id="password"
          autoComplete="new-password"
          name="password"
        />
        <button>Login</button>
        <Link href={"/register"}>Belum punya akun?</Link>
      </div>
    </div>
  );
}
