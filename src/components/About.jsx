const skills = [
  'React',
  'JavaScript / TypeScript',
  'Video.js',
  'HLS',
  'DASH',
  'MSE',
  'Web Codecs API',
  'ABR',
  'WebRTC',
  'FFmpeg',
  'Node.js',
]

export default function About() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-slate-800/50">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-8">
          About Me
        </h2>
        <p className="text-lg text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
          I'm a video software developer focused on web video: adaptive bitrate streaming,
          Media Source Extensions (MSE), Web Codecs API, and multiple delivery protocols
          (HLS, DASH, WebRTC). I build players and tooling that make video reliable and
          efficient on the web.
        </p>
        <p className="text-lg text-slate-600 dark:text-slate-300 mb-10 leading-relaxed">
          This site showcases live demos of ABR players, Web Codecs, MSE, and protocol
          comparisons so you can see the tech in action.
        </p>
        <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
          Technologies & Skills
        </h3>
        <div className="flex flex-wrap gap-3">
          {skills.map((skill) => (
            <span
              key={skill}
              className="px-4 py-2 bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 rounded-full text-sm font-medium"
            >
              {skill}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
