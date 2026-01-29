import { useState } from 'react'
import VideoPlayerBase from './VideoPlayerBase'

// Import players from the new player module
import { 
  MSEHLSPlayer, 
  MSEDASHPlayer, 
  WebCodecsHLSPlayer, 
  WebCodecsDASHPlayer 
} from '../../player'

const TECHNOLOGIES = [
  { id: 'mse', label: 'MSE' },
  { id: 'webcodecs', label: 'Web Codecs' },
]

const FLAVORS = [
  { id: 'hls', label: 'HLS' },
  { id: 'dash', label: 'DASH' },
]

export default function VideoDemos() {
  const [technology, setTechnology] = useState('mse')
  const [flavor, setFlavor] = useState('hls')

  const renderDemo = () => {
    if (technology === 'mse') {
      if (flavor === 'hls') {
        return <MSEHLSPlayer VideoWrapper={VideoPlayerBase} />
      }
      return <MSEDASHPlayer VideoWrapper={VideoPlayerBase} />
    }
    
    // Web Codecs
    if (flavor === 'hls') {
      return <WebCodecsHLSPlayer VideoWrapper={VideoPlayerBase} />
    }
    return <WebCodecsDASHPlayer VideoWrapper={VideoPlayerBase} />
  }

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4">
          Video Technology Demos
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-2xl">
          Choose technology (MSE or Web Codecs) and flavor (HLS or DASH). All players are built from scratch with no external libraries.
        </p>

        <div className="flex flex-col sm:flex-row gap-6 mb-8">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Technology
            </label>
            <div className="flex flex-wrap gap-2">
              {TECHNOLOGIES.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setTechnology(opt.id)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    technology === opt.id
                      ? 'bg-primary-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Flavor
            </label>
            <div className="flex flex-wrap gap-2">
              {FLAVORS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setFlavor(opt.id)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    flavor === opt.id
                      ? 'bg-primary-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="animate-fade-in" key={`${technology}-${flavor}`}>
          {renderDemo()}
        </div>
      </div>
    </section>
  )
}
