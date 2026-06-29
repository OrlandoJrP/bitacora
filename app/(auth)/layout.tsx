export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-brand-cream">
      {/* Telón navy decorativo */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[42vh] bg-brand-navy" />
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-gold/20 blur-3xl" />
      <div className="relative z-10 grid min-h-screen place-items-center px-4 py-12">
        {children}
      </div>
    </div>
  );
}
