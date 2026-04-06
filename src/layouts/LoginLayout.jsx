export default function LoginLayout({ children, aside }) {
  return (
    <div className="layout layout-login">
      <section className="login-hero">{aside}</section>
      <section className="login-panel">{children}</section>
    </div>
  );
}
