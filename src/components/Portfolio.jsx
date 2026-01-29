const projects = [
  {
    id: '1',
    title: 'HLS ABR Player',
    description: 'Custom adaptive bitrate player using hls.js with quality switching and stats overlay.',
    tags: ['React', 'HLS', 'ABR', 'MSE'],
    link: '#',
    videoPreview: null,
  },
  {
    id: '2',
    title: 'DASH Streaming Demo',
    description: 'DASH player with multi-codec support and custom UI.',
    tags: ['dash.js', 'DASH', 'ABR'],
    link: '#',
    videoPreview: null,
  },
  {
    id: '3',
    title: 'Web Codecs Pipeline',
    description: 'Video processing pipeline using Web Codecs API for encode/decode.',
    tags: ['Web Codecs', 'JavaScript'],
    link: '#',
    videoPreview: null,
  },
  {
    id: '4',
    title: 'Low-Latency WebRTC',
    description: 'Real-time video streaming with WebRTC and signaling.',
    tags: ['WebRTC', 'Node.js'],
    link: '#',
    videoPreview: null,
  },
]

export default function Portfolio() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-100 dark:bg-slate-800/30">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4">
          Portfolio
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-12 max-w-2xl">
          Selected projects in video software: players, streaming, and tooling.
        </p>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
          {projects.map((project) => (
            <article
              key={project.id}
              className="rounded-xl overflow-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-lg transition-shadow"
            >
              <div className="aspect-video bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                {project.videoPreview ? (
                  <video
                    src={project.videoPreview}
                    className="w-full h-full object-cover"
                    muted
                    loop
                    playsInline
                  />
                ) : (
                  <div className="text-slate-400 dark:text-slate-500 text-sm">
                    Video preview
                  </div>
                )}
              </div>
              <div className="p-5">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                  {project.title}
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
                  {project.description}
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {project.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 rounded text-xs font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <a
                  href={project.link}
                  className="inline-flex items-center gap-1 text-primary-600 dark:text-primary-400 font-medium text-sm hover:underline"
                >
                  View project
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
