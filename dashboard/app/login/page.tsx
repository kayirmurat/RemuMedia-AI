export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string };
}) {
  const next = searchParams.next ?? "/";
  return (
    <div className="card mx-auto mt-24 max-w-[360px]">
      <h1 className="mt-0 text-lg font-bold text-ink">RemuMedia AI</h1>
      {searchParams.error && <p className="text-sm text-danger">Şifre yanlış.</p>}
      <form method="POST" action="/api/auth/login">
        <input type="hidden" name="next" value={next} />
        <label className="muted" htmlFor="password">
          Şifre
        </label>
        <div style={{ marginTop: 6, marginBottom: 14 }}>
          <input type="password" id="password" name="password" autoFocus required />
        </div>
        <button type="submit">Giriş yap</button>
      </form>
    </div>
  );
}
