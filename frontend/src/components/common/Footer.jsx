export default function Footer() {
  return (
    <footer className="border-t border-slate-700 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-center px-4 py-12 text-center sm:px-6 lg:px-8">
        <h4 className="text-sm font-semibold uppercase tracking-[0.24em] text-white">
          Support
        </h4>

        <div className="mt-4 space-y-2 text-sm text-slate-300">
          <a
            href="mailto:aventorautomation@gmail.com"
            className="block transition-colors hover:text-white"
          >
            aventorautomation@gmail.com
          </a>
          <a
            href="tel:+919177343707"
            className="block transition-colors hover:text-white"
          >
            +91 9177343707
          </a>
        </div>
      </div>
    </footer>
  );
}
