import Header from './components/Header'
import Footer from './components/Footer'
import Hero from './components/Hero'
import About from './components/About'
import VideoDemos from './components/VideoDemos'
import Portfolio from './components/Portfolio'
import Contact from './components/Contact'

function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 pt-16">
        <section id="home">
          <Hero />
        </section>
        <section id="about">
          <About />
        </section>
        <section id="demos">
          <VideoDemos />
        </section>
        <section id="portfolio">
          <Portfolio />
        </section>
        <section id="contact">
          <Contact />
        </section>
      </main>
      <Footer />
    </div>
  )
}

export default App
