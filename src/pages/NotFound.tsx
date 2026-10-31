import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="auth-not-found flex min-h-[100dvh] items-center justify-center px-5 py-14">
      <div className="w-full max-w-xl text-center">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-muted-foreground">Nothing at this address</p>
        <h1 className="auth-not-found-code mt-4">404</h1>
        <p className="mx-auto mt-5 max-w-md text-base leading-7 text-muted-foreground">This page may have moved, or the address may be incomplete.</p>
        <Link to="/" className="mt-8 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 font-semibold text-primary-foreground hover:bg-[hsl(var(--primary-hover))]">
          Return to ScopeClear
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
