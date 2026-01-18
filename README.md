# 🎤 Rhyme Lines

*A minimalist Sublime-style lyric editor with syllables, rhymes, and rhythm.*

Rhyme Lines is a modern lyric-writing web app built with **Next.js 16**, **TypeScript**, and **Tailwind CSS**.

It gives rappers, poets, and songwriters a distraction-free space to write with **live syllable overlays** and **rhyme assistance**.

---

## ✨ Features

* 📝 **Full-screen lyric editor** (Sublime-inspired, distraction-free)
* 🔢 **Live syllable counts** per word & line
* 🎨 **Dark & light themes** (toggleable)
* ⚡ **Ultra-responsive typing** (<10ms latency budget)
* ⏱️ **Auto-save to localStorage**
* 🎶 **Rhyme suggestions sidebar** (perfect, slant, near)
* ♿ **Accessible design** (keyboard shortcuts, ARIA roles)

---

## 🛠️ Tech Stack

* [Next.js 16](https://nextjs.org/) (App Router)
* [TypeScript](https://www.typescriptlang.org/)
* [Tailwind CSS](https://tailwindcss.com/)
* [shadcn/ui](https://ui.shadcn.com/) (for UI components)
* [Prisma](https://www.prisma.io/) (for future database work)
* [PostgreSQL](https://www.postgresql.org/) (planned cloud storage)
* [Vercel](https://vercel.com/) (deployment)

---

## 🚀 Getting Started

Clone the repo:

```bash
git clone https://github.com/ClayTheMisfit/rhyme-lines.git
cd rhyme-lines

```

Install dependencies:

```bash
npm install

```

Run the dev server:

```bash
npm run dev

```

Build the production bundle (mirrors Vercel):

```bash
npm run vercel-build

```

Open in your browser:
👉 [http://localhost:3000](https://www.google.com/search?q=http://localhost:3000)

### 🔐 Environment variables

Create a `.env.local` file in the project root before running the app and provide your [Wordnik API key](https://developer.wordnik.com/):

```bash
WORDNIK_API_KEY=your_wordnik_key

```

The key is consumed only by the server-side proxy and is never bundled in client code.

---

## 📸 Screenshots

> *Coming soon: previews of the editor in action*

---

## 🔮 Roadmap

* ✅ Core editor with syllable counts
* ⏳ Rhyme suggestion engine
* ⏳ Cloud sync & user accounts
* ⏳ Mobile-friendly layout
* ⏳ Collaboration (multi-user editing)

---

## 📜 License

This project is licensed under the **MIT License**.

See [LICENSE](https://www.google.com/search?q=./LICENSE) for details.

---

## 🤝 Contributing

Pull requests and feedback are welcome!
Open an issue for ideas, bugs, or feature requests.

---

## 🌐 Live Demo

Soon on [Vercel](https://vercel.com/) — stay tuned!
