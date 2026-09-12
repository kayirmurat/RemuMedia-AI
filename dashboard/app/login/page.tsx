export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string };
}) {
  const next = searchParams.next ?? "/";
  return (
    <div className="card" style={{ maxWidth: 360, margin: "80px auto" }}>
      <h1 style={{ fontSize: 18, marginTop: 0 }}>RemuMedia AI</h1>
      {searchParams.error && (
        <p style={{ color: "var(--danger)", fontSize: 14 }}>Şifre yanlış.</p>
      )}
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
