import type { PropsWithChildren } from "react";
import { Link } from "react-router-dom";

export function AuthShell({ children }: PropsWithChildren) {
  return (
    <div className="auth-shell">
      <aside className="auth-art" aria-label="ScopeClear account">
        <Link to="/" className="auth-brand" aria-label="ScopeClear home">
          <span className="auth-brand-mark">SC</span>
          <span className="auth-brand-name">ScopeClear</span>
        </Link>
        <div className="auth-art-copy">
          <p className="auth-art-kicker">For the work that matters</p>
          <h2>Clarity from quote to site.</h2>
          <p>
            Keep the agreed scope, client decisions and field updates in one
            place your team can return to.
          </p>
        </div>
        <div className="auth-path" aria-label="A clear project record">
          <div className="auth-path-step"><span>01</span> Agreed work</div>
          <div className="auth-path-step"><span>02</span> Recorded changes</div>
          <div className="auth-path-step"><span>03</span> Shared progress</div>
        </div>
        <p className="auth-art-footer">
          Made for Australian trade teams.
        </p>
      </aside>
      <main className="auth-main">{children}</main>
    </div>
  );
}
