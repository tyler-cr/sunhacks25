# 🎶 SpectoVisualizer

SpectoVisualizer is an AI-powered music visualizer built with **Flask**, **WebGL**, and **Google’s Gemini API**.  
Drop in your favorite track, and watch as Specto (our purple bulldog mascot 🐶💜 with golden headphones) generates dynamic, AI-driven visual presets that react to the beat.  

![Specto Logo](static/dog.png)


# DEMO

<a href="https://youtu.be/uMUpQ_b3-9I" target="_blank">
  <img src="https://img.youtube.com/vi/uMUpQ_b3-9I/maxresdefault.jpg" alt="Watch the video" width="600">
</a>

---

## 🚀 Features
- 🎧 Upload your own `.mp3`, `.wav`, or `.ogg` file  
- 🖼️ AI-generated visual presets via Google Gemini  
- 🔮 Variables auto-update per upload (color palettes, animation parameters, etc.)  
- 🎛️ Live WebGL audio-reactive rendering  
- 🐶 **Specto the Bulldog**

---

## 🛠️ Setup

### 1. Clone the repo
```bash
git clone https://github.com/yourusername/spectovisualizer.git
cd spectovisualizer
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```
### 3. Get a Gemini API Key
You’ll need an API key from Google’s Gemini platform.
Follow the guide here: 👉 [Get a Gemini API Key](https://ai.google.dev/gemini-api/docs/api-key)

### 4. Run the Flask server
```bash
python main.py
```
You'll see
```bash
Running on http://127.0.0.1:8000
```
Go to that url on your browser!

---

## Usage
1. Click *upload* and drop in your song
2. Click *Get AI Preset* -- Gemini generates a fresh visual preset for your track
3. Use the *Play/Pause* button to control the audio
4. Enjoy reactive visuals synced to your music

---

## Dev Notes
- Flask's dev server is used here. For production, use a WSGI server like gunicorn or waitress
- Uploaded files and generated presets are stored in the ```uploads/``` directory
