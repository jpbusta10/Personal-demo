export default function Hero() {
  const scrollToDemos = () => {
    document.getElementById('demos')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 via-transparent to-accent-500/10 dark:from-primary-600/20 dark:to-accent-600/20" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary-400/5 to-transparent" />
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-slate-900 dark:text-white mb-4 animate-slide-up">
          Juan Pablo <span className="text-primary-600 dark:text-primary-400">Bustamante</span>
        </h1>
        <p className="text-xl sm:text-2xl text-slate-600 dark:text-slate-300 mb-2 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          Video Software Developer
        </p>
        <p className="text-slate-500 dark:text-slate-400 max-w-2xl mx-auto mb-10 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          Building streaming players, ABR, Web Codecs, MSE, and protocol implementations for the web.
        </p>
        <button
          onClick={scrollToDemos}
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all animate-slide-up"
          style={{ animationDelay: '0.3s' }}
        >
          Explore Video Demos
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      </div>
    </section>
  )
}
