# EasyPeasyAI 🧠

**Understand anything. Learn everything. The easy way.**

EasyPeasyAI is an AI-powered learning platform designed to make complex topics simple, engaging, and easier to remember.

Instead of overwhelming learners with complicated definitions, EasyPeasyAI breaks concepts into beginner-friendly explanations and connects them to familiar real-world situations, fictional worlds, and everyday experiences in such a way that even a ten-year old would find it easy to understand. 

Whether you're learning programming, science, mathematics, or technology, EasyPeasyAI helps you understand concepts rather than simply memorize them.

## ✨ Key Features

### 🪄 1. Analogy-Based Learning – Learn Through What You Already Know

One of the core features of EasyPeasyAI is its analogy-based learning approach.

Sometimes, the hardest part of learning something new is understanding an unfamiliar idea. EasyPeasyAI solves this by connecting complex concepts to familiar situations, characters, stories, and fictional worlds.

**How does it work?**

1. Enter a topic you want to understand.
2. EasyPeasyAI identifies the key ideas behind that topic.
3. Select an analogy style or familiar context.
4. AI explains the concept by connecting it to that context.
5. Understand the actual concept through the analogy and its explanation.

**Example: Understanding Computer Networking Through Harry Potter**

Imagine learning how data travels across a computer network. Instead of starting with technical networking terminology, let's enter the world of Harry Potter!


**Let's understand it through a story:**

Imagine Harry wants to send a message to Hermione at Hogwarts.

- Harry writes a message. This represents the data.
- He sends it through a magical communication system. This represents the network.
- A magical guide directs the message towards Hermione. This represents the router.
- The message follows certain rules so it reaches its destination correctly. These represent network protocols.
- Hermione receives the message. She is the receiver.

Now, think about what happens when you send a message over the internet. Your device sends data through a network, routers help forward it towards its destination, and communication protocols define how devices exchange information.

Suddenly, networking doesn't seem so complicated!

**The important part:** The Harry Potter story is only a learning analogy. EasyPeasyAI also connects each analogy back to the actual technical concept, so learners understand the real meaning instead of memorizing the fictional comparison.

### 📖 2. AI-Powered Explanations
- Breaks down complicated topics into simple, beginner-friendly explanations.
- Makes difficult concepts easier to understand.
- Designed to make learning accessible even to complete beginners.

### 🔊 3. Read Aloud
Listen to explanations instead of only reading them, making learning more accessible and convenient.

### 📝 4. Interactive Quizzes
Automatically generate quizzes based on the topic being learned and test your understanding.

### 🃏 5. Interactive 3D Flashcards
Revise important concepts using interactive flashcards that make remembering key information more engaging.

### 🧩 6. Interactive Mind Maps
Visualize concepts, explore their subtopics, and understand the relationships between different ideas.

### 🖼️ 7. Concept-Based Images
Retrieve relevant images to support explanations and make abstract concepts more visual.

### ▶️ 8. YouTube Learning Resources
Find relevant YouTube videos to explore topics further and discover additional learning resources.

## 🛠️ Tech Stack

**Frontend**
- React
- TypeScript
- Vite
- CSS

**Backend**
- Node.js
- Express.js

**AI & Integrations**
- Google Gemini API
- Wikimedia Commons API
- YouTube Search

## 🚀 Getting Started

### Prerequisites
- Node.js and npm
- Google Gemini API key

### 1. Clone the repository

```bash
git clone https://github.com/ShreyS007/EasyPeasyAI.git
```

### 2. Navigate to the project directory

```bash
cd EasyPeasyAI
```

### 3. Install dependencies

```bash
npm install
```

### 4. Configure environment variables

Create a `.env` file in the project root:

```env
GEMINI_API_KEY=your_gemini_api_key
```

Get your API key from [Google AI Studio](https://aistudio.google.com/apikey).

**Security note:** Never upload your `.env` file or expose your API key publicly.

### 5. Run the application

Start the backend:

```bash
node server.mjs
```

Open another terminal in the project directory and start the frontend:

```bash
npm run dev
```

Open the local URL displayed by Vite in your browser.

## 📁 Project Structure

```text
EasyPeasyAI/
├── public/
├── src/
│   ├── App.tsx
│   └── ...
├── server.mjs
├── index.html
├── package.json
├── .gitignore
├── .env.example
└── README.md
```

*This is a simplified overview of the project structure.*

## 🔮 Future Improvements

- Personalized learning paths
- User accounts and learning progress tracking
- Saved explanations and revision history
- More analogy styles and fictional learning contexts
- Expanded interactive learning activities
- Improved mobile responsiveness and accessibility

## 👨‍💻 Author

**ShreyS007**

GitHub: [@ShreyS007](https://github.com/ShreyS007)

## 📄 License

A license can be added to specify how others may use, modify, and distribute this project.

---

**EasyPeasyAI – Don't just memorize concepts. Understand them!**